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
import type { StaticGTFSData } from "./mta-gtfs-static";
import { loadStaticGTFS } from "./mta-gtfs-static";
import {
    interpolateTrainPosition,
    findShapeForTrip,
} from "./mta-interpolation";

interface TrainPosition {
    lat: number;
    lng: number;
    tripId: string;
    routeId: string;
    direction: number;
    nextStop?: string;
    lastStop?: string;
    progress?: number;
}

/**
 * MTA GTFS-RT data source
 * 
 * Fetches real-time train positions from MTA's GTFS-RT feeds and interpolates
 * positions between stations based on arrival predictions.
 */
export class MTASource implements DataSource<"MTA"> {
    private config: DataSourceConfig;
    private broadcast: BroadcastFunction<"MTA">;
    private log: Logger;
    private staticDataPromise: Promise<StaticGTFSData>;
    private staticData?: StaticGTFSData;
    private intervalId?: NodeJS.Timeout;
    private tripShapeCache: Map<string, string> = new Map();

    // MTA feed URLs
    private readonly FEEDS = [
        {
            name: "NYC Subway",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
        },
        {
            name: "LIRR",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/lirr%2Fgtfs-lirr",
        },
        {
            name: "Metro-North",
            url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr",
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
        
        // Load static GTFS data asynchronously
        this.staticDataPromise = this.loadStaticData();
    }

    /**
     * Load static GTFS data from local files
     */
    private async loadStaticData(): Promise<StaticGTFSData> {
        this.log("Loading MTA static GTFS data...");
        const staticData = await loadStaticGTFS(
            "./mta-gtfs-static/stops.txt",
            "./mta-gtfs-static/shapes.txt",
            "./mta-gtfs-static/stop_times.txt",
        );
        this.log(`Loaded ${staticData.stops.size} stops, ${staticData.shapes.size} shapes, ${staticData.stopTimes.size} trips`);
        this.staticData = staticData;
        return staticData;
    }

    /**
     * Get static GTFS data, ensuring it's loaded
     */
    private async getStaticData(): Promise<StaticGTFSData> {
        if (this.staticData) {
            return this.staticData;
        }
        return await this.staticDataPromise;
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
     * Extract route ID from trip ID (MTA-specific format)
     */
    private extractRouteId(tripId: string): string {
        // MTA trip IDs often contain route info, e.g., "1..N00R" -> "1"
        const match = tripId.match(/^([A-Z0-9]+)/);
        return match ? match[1] : tripId;
    }

    /**
     * Process TripUpdate entities to extract train positions
     */
    private async processTripUpdates(
        feedMessage: transit_realtime.FeedMessage,
    ): Promise<TrainPosition[]> {
        const trains: TrainPosition[] = [];
        const currentTime = Math.floor(Date.now() / 1000);
        const staticData = await this.getStaticData();

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
            const routeId = this.extractRouteId(tripId);
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
                            direction,
                            nextStop: nextStop.stopName,
                            lastStop: lastStop.stopName,
                            progress: position.progress,
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
                    const trains = await this.processTripUpdates(feedMessage);
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

