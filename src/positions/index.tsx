import { useEffect, useRef, useState } from "react";
import { debug } from "../logger";
import type { Bounds } from "../map";
import { AirplanePositionHandler, AirplanePosition, AirplaneMarkers } from "./airplane";
import { BoatPositionHandler, BoatPosition, BoatMarkers } from "./boat";
import { TrainPositionHandler, TrainPosition, TrainMarkers } from "./train";
import { MTAPositionHandler, MTAPosition, MTAMarkers } from "./mta";
import type { DataSourceMessage } from "../../data-sources/dataSource";

export { AirplaneMarkers, BoatMarkers, TrainMarkers, MTAMarkers };
export type { AirplanePosition, BoatPosition, TrainPosition, MTAPosition };

export const usePositions = (
    currentBounds: Bounds | null,
    onSetBounds: (bounds: Bounds) => void,
) => {
    const airplaneHandlerRef = useRef(new AirplanePositionHandler());
    const boatHandlerRef = useRef(new BoatPositionHandler());
    const trainHandlerRef = useRef(new TrainPositionHandler());
    const mtaHandlerRef = useRef(new MTAPositionHandler());

    const [boatPositions, setBoatPositions] = useState<
        Map<string, BoatPosition>
    >(new Map());
    const [airplanePositions, setAirplanePositions] = useState<
        Map<string, AirplanePosition>
    >(new Map());
    const [trainPositions, setTrainPositions] = useState<
        Map<string, TrainPosition>
    >(new Map());
    const [mtaPositions, setMTAPositions] = useState<
        Map<string, MTAPosition>
    >(new Map());

    useEffect(() => {
        if (currentBounds === null) {
            return;
        }
        // TODO: Set the domain somewhere centrally
        const websocket = new WebSocket("ws://localhost:5174");
        websocket.onmessage = (e) => {
            const parsed = JSON.parse(e.data);
            debug(`got ${parsed.t} message from server:`, parsed);
            
            // Handle special control messages
            if (parsed.t === "START") {
                if (parsed.msg === "connection established") {
                    websocket!.send(JSON.stringify(currentBounds));
                }
                return;
            }
            if (parsed.t === "Bounds") {
                onSetBounds(parsed.msg);
                return;
            }
            
            // Type guard: check if it's a valid DataSourceMessage and route to the correct handler
            if (parsed.t && parsed.msg !== undefined) {
                switch (parsed.t) {
                    case "OpenSky": {
                        const rawMsg = parsed as DataSourceMessage<"OpenSky">;
                        const handled = airplaneHandlerRef.current.handleMessage(rawMsg);
                        if (handled) {
                            const positions = airplaneHandlerRef.current.getPositions();
                            debug(`Setting ${positions.size} airplane positions`);
                            setAirplanePositions(positions);
                        }
                        break;
                    }
                    case "AISStream": {
                        const rawMsg = parsed as DataSourceMessage<"AISStream">;
                        const handled = boatHandlerRef.current.handleMessage(rawMsg);
                        if (handled) {
                            setBoatPositions(boatHandlerRef.current.getPositions());
                        }
                        break;
                    }
                    case "Amtraker": {
                        const rawMsg = parsed as DataSourceMessage<"Amtraker">;
                        const handled = trainHandlerRef.current.handleMessage(rawMsg);
                        if (handled) {
                            setTrainPositions(trainHandlerRef.current.getPositions());
                        }
                        break;
                    }
                    case "MTA": {
                        const rawMsg = parsed as DataSourceMessage<"MTA">;
                        const handled = mtaHandlerRef.current.handleMessage(rawMsg);
                        if (handled) {
                            setMTAPositions(mtaHandlerRef.current.getPositions());
                        }
                        break;
                    }
                    default: {
                        console.error("unknown message type", parsed.t, parsed);
                    }
                }
            } else {
                console.error("invalid message format", parsed);
            }
        };
        return () => {
            websocket.close(1000, "component unmounted");
        };
    }, [
        currentBounds?.minLat,
        currentBounds?.maxLat,
        currentBounds?.minLng,
        currentBounds?.maxLng,
    ]);

    return {
        boatPositions,
        airplanePositions,
        trainPositions,
        mtaPositions,
    };
};

