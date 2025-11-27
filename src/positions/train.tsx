import { Fragment, useEffect } from "react";
import { Marker, Popup } from "react-leaflet";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { toast } from "react-hot-toast";
import { getIcon } from "../marker";
import { PositionHandler, Position } from "./base";

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

const getTrainMarkerSVG = () => {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`<?xml version="1.0" encoding="iso-8859-1"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg fill="#18567d" height="40px" width="40px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
	 viewBox="0 0 288.618 288.618" xml:space="preserve">
<g>
	<path d="M287.985,215.049l-9.848-24.938c-1.365-3.458-4.706-5.73-8.424-5.73h-33.89c4.387,0,8.465-2.258,10.794-5.976
		c16.747-26.736,16.747-60.691,0-87.428c-2.329-3.719-6.407-5.977-10.795-5.977h-11.347V53.66h5.851
		c3.616,0,6.548-2.932,6.548-6.548V39.94c0-3.616-2.932-6.548-6.548-6.548h-48.184c-3.616,0-6.548,2.932-6.548,6.548v7.172
		c0,3.616,2.932,6.548,6.548,6.548h5.851v31.342h-38.869V29.45c0-5.003-4.055-9.058-9.057-9.058H9.057
		C4.055,20.392,0,24.447,0,29.45v13.875c0,5.002,4.055,9.057,9.057,9.057h10.101v132H9.057c-5.002,0-9.057,4.055-9.057,9.057v24.938
		c0,5.003,4.055,9.058,9.057,9.058h19.682v-0.001c0-30.765,25.028-55.793,55.793-55.793c30.765,0,55.794,25.028,55.794,55.793v0.001
		h26.992c5.183-17.839,21.663-30.919,41.151-30.919c19.488,0,35.969,13.08,41.152,30.919h29.939c2.999,0,5.803-1.483,7.489-3.963
		C288.736,220.991,289.086,217.838,287.985,215.049z M116.777,136.744c0,4.705-3.814,8.52-8.52,8.52H57.782
		c-4.705,0-8.52-3.814-8.52-8.52V94.139c0-18.645,15.113-33.758,33.757-33.758c18.645,0,33.758,15.113,33.758,33.758V136.744z"/>
	<path d="M208.469,210.514c-15.34,0-27.877,11.971-28.796,27.079c-5.911,0-49.787,0-55.624,0c0.833-3.248,1.276-6.653,1.276-10.161
		c0-22.529-18.264-40.793-40.794-40.793c-22.529,0-40.793,18.264-40.793,40.793c0,22.53,18.264,40.794,40.793,40.794
		c13.033,0,24.63-6.119,32.098-15.633c23.751,0,41.245,0,66.195,0c4.796,9.283,14.476,15.633,25.645,15.633
		c15.938,0,28.856-12.919,28.856-28.856C237.325,223.433,224.406,210.514,208.469,210.514z"/>
</g>
</svg>`)}`;
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

export class TrainPositionHandler extends PositionHandler<TrainPosition> {
    constructor() {
        super({
            getMessageType: () => "Amtraker",
            getMarkerSVG: () => getTrainMarkerSVG(),
            renderPopup: (position) => <TrainPopup position={position} />,
            parseMessage: (rawMsg: any): Map<string, TrainPosition> | null => {
                const newTrainPositions = new Map<string, TrainPosition>();
                for (const key of Object.keys(rawMsg.msg)) {
                    const trainRoute = rawMsg.msg[key];
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
                        icon={getIcon(getTrainMarkerSVG())}
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

