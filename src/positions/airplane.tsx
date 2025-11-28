import { Fragment, useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { toast } from "react-hot-toast";
import { debug } from "../logger";
import { getRotatableIcon } from "../marker";
import { PositionHandler, Position } from "./base";
import type { DataSourceMessage } from "../../data-sources/dataSource";
import type { OpenSkyMessagePayload } from "../../data-sources/messagePayloads";

export type AirplanePosition = Position & {
    callsign: string;
    positionTime: Date;
    altitudeMeters: number;
    // In decimal degrees from north.
    heading: number;
    velocityMetersPerSecond: number;
};

/**
 * Generate top-down airplane SVG icon (static, no rotation)
 * Icon points north (up) by default, rotation applied via CSS transform
 */
const getAirplaneMarkerSVG = () => {
    // Top-down airplane silhouette - clean, recognizable shape
    const svg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="airplaneShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.3"/>
            </filter>
            <linearGradient id="planeBody" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#f8fafc"/>
                <stop offset="100%" style="stop-color:#cbd5e1"/>
            </linearGradient>
        </defs>
        <!-- Main fuselage -->
        <path d="M 20 4 
                 C 22 4, 23 6, 23 8 
                 L 23 14 L 36 20 L 36 22 L 23 19 
                 L 23 28 L 28 32 L 28 34 L 20 31 L 12 34 L 12 32 L 17 28 
                 L 17 19 L 4 22 L 4 20 L 17 14 
                 L 17 8 C 17 6, 18 4, 20 4 Z" 
              fill="url(#planeBody)" stroke="#475569" stroke-width="0.8" filter="url(#airplaneShadow)"/>
        <!-- Cockpit -->
        <ellipse cx="20" cy="8" rx="2" ry="3" fill="#0ea5e9" stroke="#0369a1" stroke-width="0.5"/>
        <!-- Engine nacelles -->
        <ellipse cx="14" cy="17" rx="1.5" ry="2.5" fill="#64748b"/>
        <ellipse cx="26" cy="17" rx="1.5" ry="2.5" fill="#64748b"/>
    </svg>`;
    
    return svg;
};

type Airport = {
    country_iso_name: string;
    country_name: string;
    elevation: number;
    iata_code: string;
    latitude: number;
    longitude: number;
    municipality: string;
    name: string;
};

type FlightData = {
    callsign: string;
    callsign_icao: string;
    callsign_iata: string;
    airline: {
        name: string;
        icao: string;
        iata: string;
        country: string;
        country_iso: string;
        callsign: string;
    };
    destination: Airport;
    origin: Airport;
};

const FlightDataComponent = ({ flightData }: { flightData: FlightData }) => {
    return (
        <div style={{ marginTop: "1em" }}>
            <div>
                Flight: {flightData.airline.name} {flightData.callsign_iata}
            </div>
            <div>
                From: {flightData.origin.name} ({flightData.origin.iata_code})
            </div>
            <div>
                To: {flightData.destination.name} (
                {flightData.destination.iata_code})
            </div>
        </div>
    );
};

const AirplanePopup = ({ position }: { position: AirplanePosition }) => {
    const [flightData, setFlightData] = useState<FlightData | null | false>(
        null,
    );

    const { isAuthenticated } = useConvexAuth();
    const allAchievements = useQuery(api.achievements.get);
    const addAchievement = useMutation(api.user_achievements.add);
    const achievements = useQuery(api.user_achievements.list);

    const maybeAddAchievement = async (achievement: Doc<"achievements">) => {
        const id = achievement._id;
        const alreadyEarned = achievements?.find(
            (achievement) => achievement.achievementId === id,
        );
        if (alreadyEarned) {
            return;
        }
        console.log("Recording achievement:", achievement.name);
        toast(
            `Achievement unlocked: ${achievement.category} - ${achievement.name}`,
            {
                icon: "🏆",
                style: {
                    borderRadius: "10px",
                    background: "#333",
                    color: "#fff",
                },
            },
        );
        await addAchievement({ achievementId: id });
    };

    useEffect(() => {
        if (flightData !== null) {
            return;
        }

        const abortController = new AbortController();

        (async () => {
            debug("sending flight info request for", position);
            try {
                const response = await fetch(
                    `/api/flightInfo?icao=${position.callsign.trim()}`,
                    { signal: abortController.signal },
                );
                const data = await response.json();
                if (
                    data?.response?.flightroute &&
                    data.response.flightroute.airline
                ) {
                    setFlightData(data.response.flightroute);
                } else {
                    setFlightData(false);
                }
            } catch (e) {
                console.error("request failed", e);
            }
        })();

        return () => {
            abortController.abort();
        };
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !flightData) {
            return;
        }
        const earn = async () => {
            for (const achievement of allAchievements ?? []) {
                switch (achievement.category) {
                    case "Airlines": {
                        if (achievement.name === flightData.airline.name) {
                            await maybeAddAchievement(achievement);
                        }
                        break;
                    }
                    case "Airports": {
                        if (
                            achievement.name === flightData.destination.iata_code ||
                            achievement.name === flightData.origin.iata_code
                        ) {
                            await maybeAddAchievement(achievement);
                        }
                        break;
                    }
                }
            }
        };
        earn();
    }, [isAuthenticated, flightData, allAchievements, achievements]);

    return (
        <Fragment>
            <div>{position.callsign}</div>
            <div>
                Altitude:{" "}
                {(position.altitudeMeters * 3.28024)
                    .toFixed(2)
                    .toLocaleString()}
                ft
            </div>
            <div>Heading: {position.heading}°</div>
            <div>
                Speed: {(position.velocityMetersPerSecond * 2.23694).toFixed(2)}
                mph
            </div>
            {flightData === null
                ? "Loading..."
                : flightData && <FlightDataComponent flightData={flightData} />}
        </Fragment>
    );
};

export class AirplanePositionHandler extends PositionHandler<AirplanePosition, "OpenSky"> {
    constructor() {
        super({
            getMessageType: () => "OpenSky",
            getMarkerSVG: (_position) => getAirplaneMarkerSVG(),
            renderPopup: (position) => <AirplanePopup position={position} />,
            parseMessage: (rawMsg: DataSourceMessage<"OpenSky">): Map<string, AirplanePosition> | null => {
                const payload: OpenSkyMessagePayload = rawMsg.msg;
                const newAirplanePositions = new Map<
                    string,
                    AirplanePosition
                >();
                for (const state of payload.states) {
                    // See if there's data - we need at least indices 0, 1, 3, 5, 6, 9, 10
                    // For the full data format, see: https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
                    // [0] = icao24, [1] = callsign, [3] = time, [5] = longitude, [6] = latitude, 
                    // [7] = altitude (can be null), [9] = velocity, [10] = heading
                    if (!state[0] || !state[1] || !state[3] || state[5] == null || state[6] == null || 
                        state[9] == null || state[10] == null) {
                        continue;
                    }
                    newAirplanePositions.set(state[0], {
                        uniqueKey: state[0],
                        callsign: state[1],
                        positionTime: new Date(state[3] * 1000),
                        lng: state[5],
                        lat: state[6],
                        altitudeMeters: state[7] ?? 0, // Altitude can be null, default to 0
                        heading: state[10],
                        velocityMetersPerSecond: state[9],
                    });
                }
                return newAirplanePositions;
            },
        });
    }
}

export const AirplaneMarkers = ({
    airplanePositions,
}: {
    airplanePositions: Map<string, AirplanePosition>;
}) => {
    const handler = new AirplanePositionHandler();
    handler.updatePositions(airplanePositions);
    return <Fragment>
        {Array.from(airplanePositions.entries()).map(([_, position]) => (
            <Marker
                key={position.uniqueKey}
                position={[position.lat, position.lng]}
                icon={getRotatableIcon(getAirplaneMarkerSVG(), position.heading)}
            >
                <Popup>
                    <AirplanePopup position={position} />
                </Popup>
            </Marker>
        ))}
    </Fragment>;
};

