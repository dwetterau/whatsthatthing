// gtfs-realtime-bindings uses CommonJS, so we import the default and extract transit_realtime
// @ts-ignore - CommonJS module doesn't have proper ES module types
import gtfsRealtimeBindings from "gtfs-realtime-bindings";
import type { transit_realtime } from "gtfs-realtime-bindings";
const transit_realtime_module = (gtfsRealtimeBindings as any).transit_realtime as typeof transit_realtime;
import type {
    DataSource,
    DataSourceConfig,
    BroadcastFunction,
    Logger,
    DataSourceMessage,
    MessageType,
} from "./dataSource";
import type { StaticGTFSData, Route } from "./mta-gtfs-static";
import { loadStaticGTFS } from "./mta-gtfs-static";
import {
    interpolateTrainPosition,
    findShapeForTrip,
} from "./mta-interpolation";

// Import for internal use
import type { MTATrainPosition } from "./messagePayloads";

// Keep internal interface alias for backwards compatibility
type TrainPosition = MTATrainPosition;

/**
 * MTA GTFS-RT data source
 * 
 * Fetches real-time train positions from MTA's GTFS-RT feeds and interpolates
 * positions between stations based on arrival predictions.
 */
export class MTASource implements DataSource {
    private config: DataSourceConfig;
    private broadcast: BroadcastFunction<"MTA">;
    private log: Logger;
    private staticDataCache: Map<string, StaticGTFSData> = new Map();
    private staticDataPromises: Map<string, Promise<StaticGTFSData>> = new Map();
    private intervalId?: NodeJS.Timeout;
    private tripShapeCache: Map<string, string> = new Map();

    // MTA feed URLs
    private readonly FEEDS = [
        // NYC Subway feeds (split by line groups)
        {
            name: "NYC Subway - 1234567",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
            staticType: "subway" as const,
        },
        {
            name: "NYC Subway - ACE",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
            staticType: "subway" as const,
        },
        {
            name: "NYC Subway - G",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",
            staticType: "subway" as const,
        },
        {
            name: "NYC Subway - NQRW",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
            staticType: "subway" as const,
        },
        {
            name: "NYC Subway - BDFM",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm",
            staticType: "subway" as const,
        },
        {
            name: "NYC Subway - JZ",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",
            staticType: "subway" as const,
        },
        {
            name: "NYC Subway - L",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l",
            staticType: "subway" as const,
        },
        // Commuter rail feeds
        {
            name: "LIRR",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/lirr%2Fgtfs-lirr",
            staticType: "lirr" as const,
        },
        {
            name: "Metro-North",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr",
            staticType: "mnr" as const,
        },
    ];

    constructor(
        config: DataSourceConfig,
        broadcast: <T extends MessageType>(message: DataSourceMessage<T>) => void,
        log: Logger,
    ) {
        this.config = config;
        this.broadcast = (message: DataSourceMessage<"MTA">) => {
            broadcast(message);
        };
        this.log = log;
    }

    /**
     * Get static GTFS data for a specific feed type, loading if needed
     */
    private async getStaticData(staticType: "subway" | "lirr" | "mnr"): Promise<StaticGTFSData> {
        // Return cached data if available
        const cached = this.staticDataCache.get(staticType);
        if (cached) {
            return cached;
        }

        // Return existing promise if already loading
        const existingPromise = this.staticDataPromises.get(staticType);
        if (existingPromise) {
            return existingPromise;
        }

        // Start loading
        const promise = this.loadStaticData(staticType);
        this.staticDataPromises.set(staticType, promise);
        
        const staticData = await promise;
        this.staticDataCache.set(staticType, staticData);
        return staticData;
    }

    /**
     * Load static GTFS data from local files for a specific feed type
     */
    private async loadStaticData(staticType: "subway" | "lirr" | "mnr"): Promise<StaticGTFSData> {
        this.log(`Loading MTA static GTFS data for ${staticType}...`);
        const staticData = await loadStaticGTFS(staticType);
        this.log(`Loaded ${staticData.stops.size} stops, ${staticData.shapes.size} shapes, ${staticData.stopTimes.size} stop times, ${staticData.trips.size} trips, ${staticData.routes.size} routes for ${staticType}`);
        return staticData;
    }

    /**
     * Fetch and parse a GTFS-RT feed
     */
    private async fetchFeed(feedUrl: string): Promise<transit_realtime.FeedMessage | null> {
        try {
            const response = await fetch(feedUrl, {
                headers: {},
            });

            if (!response.ok) {
                this.log(`Failed to fetch MTA feed ${feedUrl}: ${response.status} ${response.statusText}`);
                return null;
            }

            const buffer = await response.arrayBuffer();
            const feedMessage = transit_realtime_module.FeedMessage.decode(
                new Uint8Array(buffer),
            );
            return feedMessage;
        } catch (error) {
            this.log(`Error fetching MTA feed ${feedUrl}:`, error);
            return null;
        }
    }

    /**
     * Convert GTFS-RT timestamp to Unix timestamp (seconds)
     */
    private timestampToUnix(timestamp: number | Long | null | undefined): number {
        if (!timestamp) return 0;
        // Handle Long type from protobuf
        if (typeof timestamp === "object" && "toNumber" in timestamp) {
            return timestamp.toNumber();
        }
        return Number(timestamp);
    }

    /**
     * Get route ID and color for a trip, using multiple fallback strategies:
     * 1. Use routeId from GTFS-RT trip descriptor (most reliable)
     * 2. Look up tripId in static GTFS trips.txt
     * 3. Extract from tripId using regex pattern (fallback)
     * 
     * Then maps the routeId to route_short_name from routes.txt for display.
     * Only returns route IDs that exist in routes.txt.
     * 
     * Returns an object with displayRouteId (for display) and routeColor (if available).
     */
    private async getRouteInfo(
        trip: transit_realtime.ITripDescriptor,
        tripId: string,
        staticData: StaticGTFSData,
        staticType?: "subway" | "lirr" | "mnr",
    ): Promise<{ displayRouteId: string; routeColor?: string } | null> {
        let routeId: string | undefined;
        
        // First, try to use routeId directly from GTFS-RT feed
        // Convert to string and normalize (GTFS-RT might return numbers or strings)
        if (trip.routeId) {
            routeId = String(trip.routeId).trim();
        }
        // Second, look up tripId in static GTFS trips.txt
        else {
            const staticTrip = staticData.trips.get(tripId);
            if (staticTrip) {
                routeId = staticTrip.routeId;
            }
        }
        
        // Last resort: extract from tripId using regex pattern
        // Subway trip IDs format: PREFIX-SERVICE-DAY_TIME_ROUTE..DIRECTION
        // e.g., "AFA25GEN-1038-Sunday-00_000600_1..S03R" -> "1"
        // e.g., "BFA25GEN-A047-Saturday-00_001150_A..S74R" -> "A"
        if (!routeId) {
            // Extract route ID between last underscore and dots
            const match = tripId.match(/_([A-Z0-9]+)\.\./);
            if (match && match[1]) {
                routeId = match[1];
            } else {
                // Fallback: try to match single letter or number at start after prefix
                const altMatch = tripId.match(/[A-Z]+-([A-Z0-9]+)-/);
                if (altMatch && altMatch[1] && /^[A-Z0-9]{1,3}$/.test(altMatch[1])) {
                    routeId = altMatch[1];
                }
            }
        }
        
        // Now look up the route in routes.txt to get route_short_name for display
        // route_short_name is what the marker expects (e.g., "1", "A", "B")
        // Only return route IDs that exist in routes.txt
        if (routeId) {
            // Normalize routeId: convert to string, trim whitespace, remove quotes
            // GTFS-RT might return numbers or strings, and different sources format differently
            const normalizedRouteId = String(routeId).trim().replace(/^["']|["']$/g, '');
            
            // Direct lookup
            const route = staticData.routes.get(normalizedRouteId);
            
            if (route) {
                // Prefer routeShortName, but fall back to routeLongName or routeId
                // Commuter rail (LIRR/MNR) often doesn't have route_short_name
                let displayRouteId: string;
                if (route.routeShortName && route.routeShortName.trim()) {
                    displayRouteId = route.routeShortName.trim();
                } else if (route.routeLongName && route.routeLongName.trim()) {
                    // Use routeLongName if available (e.g., "New Haven", "Babylon Branch")
                    displayRouteId = route.routeLongName.trim();
                } else {
                    // Final fallback: use routeId (e.g., "3", "4")
                    displayRouteId = route.routeId;
                }
                
                // Get route color if available (prepend # if it's a hex color without it)
                let routeColor: string | undefined;
                if (route.routeColor && route.routeColor.trim()) {
                    const color = route.routeColor.trim();
                    routeColor = color.startsWith('#') ? color : `#${color}`;
                }
                
                return { displayRouteId, routeColor };
            }
            
            // Route not found
            this.log(`Warning: Route ID "${normalizedRouteId}" from trip "${tripId}" (staticType: ${staticType || "unknown"}) not found in routes.txt, skipping`);
            return null;
        }
        
        // No route ID found at all
        this.log(`Warning: Could not determine route ID for trip "${tripId}", skipping`);
        return null;
    }

    /**
     * Process TripUpdate entities to extract train positions
     */
    private async processTripUpdates(
        feedMessage: transit_realtime.FeedMessage,
        staticType: "subway" | "lirr" | "mnr",
    ): Promise<TrainPosition[]> {
        const trains: TrainPosition[] = [];
        const currentTime = Math.floor(Date.now() / 1000);
        const staticData = await this.getStaticData(staticType);

        if (!feedMessage.entity) {
            return trains;
        }

        for (const entity of feedMessage.entity) {
            if (!entity.tripUpdate || !entity.tripUpdate.trip) {
                continue;
            }

            const tripUpdate = entity.tripUpdate;
            const trip = tripUpdate.trip;
            const tripId = trip.tripId || "";
            const routeInfo = await this.getRouteInfo(trip, tripId, staticData, staticType);
            
            // Skip trains where we couldn't determine a valid route ID
            if (!routeInfo) {
                continue;
            }
            
            const routeId = routeInfo.displayRouteId;
            const routeColor = routeInfo.routeColor;
            
            const direction = trip.directionId ?? 0;

            if (!tripUpdate.stopTimeUpdate || tripUpdate.stopTimeUpdate.length === 0) {
                continue;
            }

            const stopTimeUpdates = tripUpdate.stopTimeUpdate;
            
            // Find the current position: last stop passed and next stop coming
            let lastStopIndex = -1;
            let nextStopIndex = -1;

            for (let i = 0; i < stopTimeUpdates.length; i++) {
                const update = stopTimeUpdates[i];
                const arrivalTime = update.arrival
                    ? this.timestampToUnix(update.arrival.time)
                    : null;
                const departureTime = update.departure
                    ? this.timestampToUnix(update.departure.time)
                    : null;

                if (!arrivalTime && !departureTime) continue;

                const stopTime = arrivalTime || departureTime || 0;

                if (stopTime <= currentTime) {
                    lastStopIndex = i;
                } else if (nextStopIndex === -1) {
                    nextStopIndex = i;
                    break;
                }
            }

            // If we found a position, interpolate it
            if (lastStopIndex >= 0 && nextStopIndex >= 0) {
                const lastUpdate = stopTimeUpdates[lastStopIndex];
                const nextUpdate = stopTimeUpdates[nextStopIndex];

                const lastStopId = lastUpdate.stopId || "";
                const nextStopId = nextUpdate.stopId || "";

                const lastStop = staticData.stops.get(lastStopId);
                const nextStop = staticData.stops.get(nextStopId);

                if (lastStop && nextStop) {
                    const lastStopTime =
                        this.timestampToUnix(lastUpdate.departure?.time) ||
                        this.timestampToUnix(lastUpdate.arrival?.time) ||
                        currentTime;
                    const nextStopTime =
                        this.timestampToUnix(nextUpdate.arrival?.time) ||
                        this.timestampToUnix(nextUpdate.departure?.time) ||
                        currentTime;

                    // Get or cache shape ID for this trip
                    let shapeId = this.tripShapeCache.get(tripId);
                    if (!shapeId) {
                        shapeId = findShapeForTrip(tripId, staticData) || undefined;
                        if (shapeId) {
                            this.tripShapeCache.set(tripId, shapeId);
                        }
                    }

                    const position = interpolateTrainPosition(
                        lastStop,
                        nextStop,
                        lastStopTime,
                        nextStopTime,
                        currentTime,
                        staticData,
                        shapeId,
                    );

                    if (position) {
                        trains.push({
                            lat: position.lat,
                            lng: position.lng,
                            tripId,
                            routeId,
                            routeColor,
                            direction,
                            nextStop: nextStop.stopName,
                            lastStop: lastStop.stopName,
                            progress: position.progress,
                            heading: position.heading,
                        });
                    }
                }
            } else if (lastStopIndex >= 0) {
                // Train is at or past the last stop in the update
                const lastUpdate = stopTimeUpdates[lastStopIndex];
                const lastStopId = lastUpdate.stopId || "";
                const lastStop = staticData.stops.get(lastStopId);

                if (lastStop) {
                    trains.push({
                        lat: lastStop.lat,
                        lng: lastStop.lng,
                        tripId,
                        routeId,
                        routeColor,
                        direction,
                        lastStop: lastStop.stopName,
                        progress: 1,
                    });
                }
            }
        }

        return trains;
    }

    /**
     * Filter trains by bounds
     */
    private filterByBounds(trains: TrainPosition[]): TrainPosition[] {
        const { maxLat, minLat, maxLng, minLng } = this.config.bounds;
        return trains.filter(
            (train) =>
                train.lat >= minLat &&
                train.lat <= maxLat &&
                train.lng >= minLng &&
                train.lng <= maxLng,
        );
    }

    /**
     * Fetch data from all MTA feeds
     */
    private async fetchData(): Promise<void> {
        this.log("fetching MTA data");

        try {
            const allTrains: TrainPosition[] = [];

            // Fetch all feeds in parallel
            const feedPromises = this.FEEDS.map(async (feed) => {
                const feedMessage = await this.fetchFeed(feed.url);
                if (feedMessage) {
                    const trains = await this.processTripUpdates(feedMessage, feed.staticType);
                    this.log(`Found ${trains.length} trains in ${feed.name}`);
                    return trains;
                }
                return [];
            });

            const feedResults = await Promise.all(feedPromises);
            for (const trains of feedResults) {
                allTrains.push(...trains);
            }

            // Filter by bounds
            const filteredTrains = this.filterByBounds(allTrains);

            this.log(`Broadcasting ${filteredTrains.length} MTA trains`);

            const message: DataSourceMessage<"MTA"> = {
                t: "MTA",
                msg: {
                    trains: filteredTrains,
                    timestamp: Date.now(),
                },
            };
            this.broadcast(message);
        } catch (e) {
            this.log("Error fetching MTA data", e);
        }
    }

    start(): void {
        // Fetch immediately
        this.fetchData();

        // Then fetch every 30 seconds (MTA updates feeds every ~30s)
        this.intervalId = setInterval(() => {
            this.fetchData();
        }, 30 * 1000);
    }

    stop(): void {
        if (this.intervalId) {
            this.log("Stopping MTA polling");
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }
}

