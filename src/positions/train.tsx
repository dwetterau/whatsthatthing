import { Fragment, useEffect } from "react";
import { Marker, Popup } from "react-leaflet";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { toast } from "react-hot-toast";
import { getRotatableIcon } from "../marker";
import { PositionHandler, Position } from "./base";
import type { DataSourceMessage } from "../../data-sources/dataSource";
import type { AmtrakerMessagePayload } from "../../data-sources/messagePayloads";

export type TrainStation = {
    name: string;
    code: string;
    tz: string;
    // JSON date string
    schArr: string;
    schDep: string;
    arr: string;
    dep: string;
    arrCmnt: string;
    depCmnt: string;
    status: string;
};

export type TrainPosition = Position & {
    trainID: string;
    trainNum: number;
    routeName: string;
    lon: number;
    trainTimely: string;
    stations: Array<TrainStation>;
    heading?: number; // Bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West)
};

const computeStations = (
    position: TrainPosition,
): {
    nextStation: TrainStation | null;
    previousStation: TrainStation | null;
    firstStation: TrainStation | null;
    lastStation: TrainStation | null;
} => {
    let nextStation = null;
    let previousStation = null;
    let firstStation = position.stations[0] ?? null;
    let lastStation = position.stations[position.stations.length - 1] ?? null;

    for (const station of position.stations) {
        if (nextStation === null && station.status === "Enroute") {
            nextStation = station;
        }
        if (station.status === "Departed") {
            previousStation = station;
        }
    }
    return {
        nextStation,
        previousStation,
        firstStation,
        lastStation,
    };
};

/**
 * Generate top-down Amtrak train SVG icon (static, no rotation)
 * Icon points north (up) by default, rotation applied via CSS transform
 * Acela-style stainless steel look
 */
const getTrainMarkerSVG = () => {
    // Top-down Acela-style train - sleek stainless steel rectangle with pointed nose
    const svg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="trainShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.3"/>
            </filter>
            <linearGradient id="steelBody" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#94a3b8"/>
                <stop offset="30%" style="stop-color:#e2e8f0"/>
                <stop offset="50%" style="stop-color:#f8fafc"/>
                <stop offset="70%" style="stop-color:#e2e8f0"/>
                <stop offset="100%" style="stop-color:#94a3b8"/>
            </linearGradient>
        </defs>
        <!-- Main body - stainless steel rectangle with aerodynamic nose -->
        <path d="M 20 4 L 26 10 L 26 34 L 14 34 L 14 10 Z" 
              fill="url(#steelBody)" stroke="#64748b" stroke-width="1" filter="url(#trainShadow)"/>
        <!-- Nose point accent -->
        <path d="M 20 4 L 24 9 L 16 9 Z" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.5"/>
        <!-- Windshield -->
        <rect x="17" y="10" width="6" height="3" rx="0.5" fill="#1e3a8a"/>
        <!-- Red Amtrak stripe -->
        <rect x="14" y="14" width="12" height="1.5" fill="#dc2626"/>
        <!-- Windows (dark blue tint) -->
        <rect x="15" y="17" width="10" height="1.5" rx="0.3" fill="#334155"/>
        <rect x="15" y="20" width="10" height="1.5" rx="0.3" fill="#334155"/>
        <rect x="15" y="23" width="10" height="1.5" rx="0.3" fill="#334155"/>
        <rect x="15" y="26" width="10" height="1.5" rx="0.3" fill="#334155"/>
        <!-- Rear -->
        <rect x="15" y="30" width="10" height="3" rx="0.5" fill="#64748b"/>
    </svg>`;
    
    return svg;
};

const TrainPopup = ({ position }: { position: TrainPosition }) => {
    const { nextStation, previousStation, firstStation, lastStation } =
        computeStations(position);

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
        if (!isAuthenticated) {
            return;
        }
        const earn = async () => {
            for (const achievement of allAchievements ?? []) {
                switch (achievement.category) {
                    case "Train Routes": {
                        if (
                            achievement.name === position.routeName
                        ) {
                            await maybeAddAchievement(achievement);
                        }
                        break;
                    }
                    case "Train Stations": {
                        const {
                            firstStation,
                            lastStation,
                            nextStation,
                            previousStation,
                        } = computeStations(position);
                        if (
                            achievement.name === firstStation?.name ||
                            achievement.name === lastStation?.name ||
                            achievement.name == nextStation?.name ||
                            achievement.name === previousStation?.name
                        ) {
                            await maybeAddAchievement(achievement);
                        }
                        break;
                    }
                }
            }
        };
        earn();
    }, [isAuthenticated, position, allAchievements, achievements]);

    return (
        <Fragment>
            <div>
                {position.routeName} ({position.trainID})
            </div>
            {firstStation !== null && <div>Origin: {firstStation.name}</div>}
            {previousStation !== null && (
                <div>Previous: {previousStation.name}</div>
            )}
            {nextStation !== null && <div>Next: {nextStation.name}</div>}
            {lastStation !== null && <div>Destination: {lastStation.name}</div>}
            <div>{position.trainTimely}</div>
        </Fragment>
    );
};

export class TrainPositionHandler extends PositionHandler<TrainPosition, "Amtraker"> {
    constructor() {
        super({
            getMessageType: () => "Amtraker",
            getMarkerSVG: () => getTrainMarkerSVG(),
            renderPopup: (position) => <TrainPopup position={position} />,
            parseMessage: (rawMsg: DataSourceMessage<"Amtraker">): Map<string, TrainPosition> | null => {
                const payload: AmtrakerMessagePayload = rawMsg.msg;
                const newTrainPositions = new Map<string, TrainPosition>();
                for (const key of Object.keys(payload)) {
                    const trainRoute = payload[key];
                    for (const train of trainRoute) {
                        newTrainPositions.set(train.trainID, {
                            ...train,
                            uniqueKey: train.trainID,
                            lng: train.lon,
                        });
                    }
                }
                return newTrainPositions;
            },
        });
    }
}

export const TrainMarkers = ({
    trainPositions,
}: {
    trainPositions: Map<string, TrainPosition>;
}) => {
    return (
        <Fragment>
            {Array.from(trainPositions.entries()).map(([_, position]) => {
                const { lat, lon, trainID } = position;
                    return (
                        <Marker
                            key={trainID}
                            position={[lat, lon]}
                            icon={getRotatableIcon(getTrainMarkerSVG(), position.heading)}
                        >
                        <Popup>
                            <TrainPopup position={position} />
                        </Popup>
                    </Marker>
                );
            })}
        </Fragment>
    );
};

