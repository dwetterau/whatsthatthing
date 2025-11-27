import { Fragment, useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { toast } from "react-hot-toast";
import { debug } from "../logger";
import { getIcon } from "../marker";
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

const getAirplaneMarkerSVG = (heading: number) => {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg fill="#db373f" style="transform:rotate(${
        heading + 90
    }deg)" height="40px" width="40px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
	 viewBox="0 0 512.004 512.004" xml:space="preserve">
<g>
	<g>
		<path d="M509.5,305.471l-59.349-59.349c7.335-4.483,12.075-10.717,13.159-17.933c1.23-8.164-2.212-16.063-9.547-22.382
			l23.646-70.929c0.871-2.604,0.427-5.465-1.178-7.694c-1.597-2.229-4.184-3.544-6.926-3.544h-25.618
			c-2.946,0-5.687,1.52-7.241,4.013l-32.928,52.688l-29.572-44.362c-1.588-2.374-4.261-3.8-7.113-3.8h-25.618
			c-2.681,0-5.201,1.255-6.814,3.399c-1.614,2.143-2.135,4.91-1.392,7.489l13.962,48.888H235.478l45.054-90.117
			c1.324-2.647,1.178-5.79-0.376-8.309c-1.546-2.511-4.295-4.048-7.259-4.048H238.74c-2.263,0-4.44,0.897-6.037,2.502
			L132.654,192.033c-40.067,1.059-62.406,7.66-80.92,21.605c-2.237,1.682-2.143,5.107,0.094,6.78l17.83,13.381
			c0.743,0.555,1.64,0.854,2.562,0.854H85.03c4.714,0,8.539,3.826,8.539,8.539c0,4.714-3.826,8.539-8.539,8.539H67.951
			c-1.853,0-3.646-0.598-5.132-1.708l-26.037-21.443c-1.699-1.401-4.176-1.281-5.73,0.273l-5.798,5.798
			C0.318,249.11-2.124,270.536,1.155,284.191c3.877,16.08,19.53,26.541,41.177,27.318h53.807c-1.597,3.894-2.57,8.206-2.57,12.809
			c0,16.481,11.494,29.888,25.618,29.888c32.484,0,66.83-6.703,79.869-21.067l137.554,88.033c1.375,0.88,2.972,1.349,4.603,1.349
			h59.776c3.587,0,6.789-2.246,8.019-5.61c1.23-3.365,0.222-7.148-2.519-9.462L278.363,299.553
			c55.284-9.274,97.307-21.699,120.68-29.589l82.483,57.103c1.452,1.008,3.151,1.52,4.859,1.52c1.307,0,2.613-0.299,3.817-0.897
			l17.079-8.539c2.459-1.23,4.167-3.561,4.611-6.268C512.335,310.168,511.447,307.409,509.5,305.471z M127.727,251.732h-8.539
			c-4.714,0-8.539-3.826-8.539-8.539c0-4.714,3.826-8.539,8.539-8.539h8.539c4.714,0,8.539,3.826,8.539,8.539
			C136.266,247.906,132.441,251.732,127.727,251.732z M170.424,251.732h-8.539c-4.714,0-8.539-3.826-8.539-8.539
			c0-4.714,3.826-8.539,8.539-8.539h8.539c4.714,0,8.539,3.826,8.539,8.539C178.964,247.906,175.138,251.732,170.424,251.732z
			 M213.121,251.732h-8.539c-4.714,0-8.539-3.826-8.539-8.539c0-4.714,3.826-8.539,8.539-8.539h8.539
			c4.714,0,8.539,3.826,8.539,8.539C221.661,247.906,217.835,251.732,213.121,251.732z M255.819,251.732h-8.539
			c-4.714,0-8.539-3.826-8.539-8.539c0-4.714,3.826-8.539,8.539-8.539h8.539c4.714,0,8.54,3.826,8.54,8.539
			C264.358,247.906,260.533,251.732,255.819,251.732z M298.516,251.732h-8.539c-4.714,0-8.539-3.826-8.539-8.539
			c0-4.714,3.826-8.539,8.539-8.539h8.539c4.714,0,8.539,3.826,8.539,8.539C307.055,247.906,303.23,251.732,298.516,251.732z
			 M341.213,251.732h-8.539c-4.714,0-8.539-3.826-8.539-8.539c0-4.714,3.826-8.539,8.539-8.539h8.539
			c4.714,0,8.539,3.826,8.539,8.539C349.753,247.906,345.927,251.732,341.213,251.732z"/>
	</g>
</g>
</svg>`)}`;
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
            getMarkerSVG: (position) => getAirplaneMarkerSVG(position.heading),
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
                icon={getIcon(getAirplaneMarkerSVG(position.heading))}
            >
                <Popup>
                    <AirplanePopup position={position} />
                </Popup>
            </Marker>
        ))}
    </Fragment>;
};

