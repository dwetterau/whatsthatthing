import { Fragment, useEffect, useState } from "react";
import type { Bounds } from "./map";
import { Marker, Popup } from "react-leaflet";
import { getIcon } from "./marker";
import { debug } from "./logger";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

type AirplanePosition = {
    uniqueKey: string;
    lat: number;
    lng: number;
    callsign: string;
    positionTime: Date;
    altitudeMeters: number;
    // In decimal degrees from north.
    heading: number;
    velocityMetersPerSecond: number;
}

const getAirplaneMarkerSVG = (heading: number) => {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg fill="#db373f" style="transform:rotate(${heading + 90}deg)" height="40px" width="40px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
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
</svg>`)}`
}

type BoatPosition = {
    uniqueKey: string;
    shipName: string;
    lat: number;
    lng: number;
    time: Date;
}

const getBoatMarkerSVG = () => {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`<?xml version="1.0" encoding="iso-8859-1"?>
<svg fill="#7a0dd4" height="40px" width="40px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
	 viewBox="0 0 488.027 488.027" xml:space="preserve">
<g>
	<g>
		<path d="M486.138,299.514L486.138,299.514c-2.2-3.1-6-4.7-9.8-4c-28,4.7-53.7,10-78.6,15c-50.8,10.4-95.1,19.4-143.4,20.8v-46.3
			h112.1c4,0,7.5-2.3,9.1-6c1.6-3.6,0.9-7.9-1.8-10.8l-119.5-131v-88.1c0-5.5-4.5-10-10-10s-10,4.5-10,10v26.9l-150.9,192.7
			c-2.4,3-2.8,7.1-1.1,10.5c1.7,3.4,5.2,5.6,9,5.6h143v46.3c-102.2-2.5-189-35-189.9-35.3c-1.1-0.4-2.3-0.7-3.5-0.7h-30.8
			c-3.6,0-6.9,1.9-8.7,5s-1.8,6.9,0.1,10l72.4,123.2c1.6,2.8,4.5,4.6,7.6,4.9c4.5,0.4,110.2,10.7,165.4,10.7
			c54.4,0,160.9-10.3,165.4-10.7c3.3-0.3,6.2-2.3,7.8-5.2l66.7-123.2C488.638,306.714,488.438,302.613,486.138,299.514z
			 M254.438,166.913l89.4,98h-89.4V166.913z M111.938,264.914L111.938,264.914l122.5-156.4v156.4H111.938z M405.038,419.013
			L405.038,419.013c-22.5,2.1-111.5,10.1-158.2,10.1c-47.5,0-136.3-8.1-158.4-10.1l-61-103.7h11.7c13.9,5.1,103.4,36.1,207.7,36.1
			h0.1c53.2-0.6,102.6-10.7,154.8-21.4c18.5-3.8,37.5-7.7,57.5-11.3L405.038,419.013z"/>
	</g>
</g>
</svg>`)}`
}

export const usePositions = (currentBounds: Bounds | null) => {
    const [hasWs, setHasWs] = useState<boolean>(false);
    const [boatPositions, setBoatPositions] = useState<Map<string, BoatPosition>>(new Map());
    const [airplanePositions, setAirplanePositions] = useState<Map<string, AirplanePosition>>(new Map());

    useEffect(() => {
        if (currentBounds === null) {
            return;
        }
        if (hasWs) {
            return;
        }
        // TODO: Set the domain somewhere centrally
        const websocket = new WebSocket('ws://localhost:5174');
        websocket.onmessage = (e) => {
            const rawMsg = JSON.parse(e.data);
            debug(`got ${rawMsg.t} message from server:`, rawMsg);
            switch (rawMsg.t) {
                case 'START': {
                    if (rawMsg.msg === 'connection established') {
                        websocket!.send(JSON.stringify(currentBounds));     
                    }
                    break
                }
                case 'AISStream': {                        
                    // TODO: Get heading information too...
                    if (rawMsg.msg.MessageType === 'PositionReport') {
                        const {MMSI, ShipName, latitude, longitude} = rawMsg.msg.MetaData;
                        if (MMSI) {
                            setBoatPositions((currentBoatPositions) => {
                                const newBoatPositions = new Map(currentBoatPositions.entries());
                                newBoatPositions.set(MMSI, {
                                    uniqueKey: MMSI,
                                    shipName: ShipName,
                                    lat: latitude,
                                    lng: longitude,
                                    time: new Date(),
                                });
                                return newBoatPositions;
                            })
                        }
                    }
                    break;
                }
                case 'OpenSky': {
                    const newAirplanePositions = new Map<string, AirplanePosition>();
                    for (const state of rawMsg.msg) {
                        // See if there's data
                        let missingData = false;
                        for (let i = 0; i < 7; i++) {
                            missingData ||= !state[i];
                        }
                        if (missingData) {
                            continue
                        }
                        // For the full data format, see: https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
                        newAirplanePositions.set(state[0], {
                            uniqueKey: state[0],
                            callsign: state[1],
                            positionTime: new Date(state[3] * 1000),
                            lng: state[5],
                            lat: state[6],
                            altitudeMeters: state[7],
                            heading: state[10],
                            velocityMetersPerSecond: state[9],
                        })
                    }
                    setAirplanePositions(newAirplanePositions);
                    break;
                }
                default:
                    console.error("unknown message", rawMsg)
            }
        }
        setHasWs(true);
        return () => {
            websocket.close(1000, "component unmounted")
        }
    }, [currentBounds]);
    
    return {
        boatPositions,
        airplanePositions,
    }
}

type Airport  = {
    airport: string,
    timezone: string,
    iata: string,
    icao: string,
    terminal: string | null,
    // A date
    estimated: string,
    gate: string,
    scheduled: string,
    delay: number | null
}

type FlightData = {
    airline: {
        name: string,
        iata: string,
        icao: string,
    },
    arrival: Airport,
    departure: Airport;
    flight: {
        iata: string;
        icao: string;
        number: string;
    }
    // Format YYYY-MM-DD
    flight_date: string;
    flight_status: 'scheduled' | 'active' | 'diverted' | 'landed' | 'cancelled' | 'incident';
}

const useEarnAchievement = async (flightData: FlightData | null | false) => {
    const {isAuthenticated} = useConvexAuth();
    const achievements = useQuery(api.achievements.get);
    const addAchievement = useMutation(api.user_achievements.add);
    const [userAchievementId, setUserAchievementId] = useState<Id<'userAchievements'> | null>(null);

    useEffect(() => {
        if (!isAuthenticated || !flightData) {
            return;
        }
        const earn = async () => {
            for (const achievement of achievements ?? []) {
                if (achievement.name === flightData.airline.name) {
                    console.log("Recording achievement:", achievement);
                    setUserAchievementId(await addAchievement({achievementId: achievement._id}));
                }
            }
        }
        earn();
    }, [isAuthenticated, flightData, userAchievementId]);

    return userAchievementId;
}

const FlightDataComponent = ({flightData}: {flightData: FlightData}) => {
    return <div style={{marginTop: '1em'}}>
        <div>Flight: {flightData.airline.name} {flightData.flight.number}</div>
        <div>From: {flightData.departure.airport} ({flightData.departure.iata})</div>
        <div>To: {flightData.arrival.airport} ({flightData.arrival.iata})</div>
        <div>Status: {flightData.flight_status}</div>
    </div>
}

const AirplanePopup = ({position}: {position: AirplanePosition}) => {
    const [flightData, setFlightData] = useState<FlightData | null | false>(null);
    useEarnAchievement(flightData);

    useEffect(() => {
        if (flightData !== null) {
            return
        }

        const abortController = new AbortController();

        (async () => {
            debug("sending flight info request for", position)
            try {
                const response = await fetch(`/api/flightInfo?icao=${position.callsign.trim()}`, {signal: abortController.signal});
                const data = await response.json();
                if ((data.data ?? []).length > 0) {
                    const flightData = data.data[0];
                    setFlightData(flightData);
                } else {
                    setFlightData(false);
                }
            } catch (e) {
                console.error('request failed', e)
            }
        })();

        return () => {
            abortController.abort();
        }
    }, [])

    return <Fragment>
        <div>{position.callsign}</div>
        <div>Altitude: {(position.altitudeMeters * 3.28024).toFixed(2).toLocaleString()}ft</div>
        <div>Heading: {position.heading}°</div>
        <div>Speed: {(position.velocityMetersPerSecond * 2.23694).toFixed(2)}mph</div>
        {flightData === null ? 'Loading...' : flightData && <FlightDataComponent flightData={flightData} />}
    </Fragment>
}

export const AirplaneMarkers = ({airplanePositions}: {airplanePositions: Map<String, AirplanePosition>}) => {
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

    </Fragment>
}

export const BoatMarkers = ({boatPositions}: {boatPositions: Map<string, BoatPosition>}) => {
    return <Fragment>        
        {Array.from(boatPositions.entries()).map(([uniqueKey, position]) => {
            const {lat, lng, shipName} = position;
            return <Marker key={uniqueKey} position={[lat, lng]} icon={getIcon(getBoatMarkerSVG())}>
                <Popup>
                    <div>{shipName}</div>
                </Popup>
            </Marker>
        })}

    </Fragment>
}