import { useEffect, useRef, useState } from "react";
import { debug } from "../logger";
import type { Bounds } from "../map";
import { AirplanePositionHandler, AirplanePosition, AirplaneMarkers } from "./airplane";
import { BoatPositionHandler, BoatPosition, BoatMarkers } from "./boat";
import { TrainPositionHandler, TrainPosition, TrainMarkers } from "./train";

export { AirplaneMarkers, BoatMarkers, TrainMarkers };
export type { AirplanePosition, BoatPosition, TrainPosition };

export const usePositions = (
    currentBounds: Bounds | null,
    onSetBounds: (bounds: Bounds) => void,
) => {
    const airplaneHandlerRef = useRef(new AirplanePositionHandler());
    const boatHandlerRef = useRef(new BoatPositionHandler());
    const trainHandlerRef = useRef(new TrainPositionHandler());

    const [boatPositions, setBoatPositions] = useState<
        Map<string, BoatPosition>
    >(new Map());
    const [airplanePositions, setAirplanePositions] = useState<
        Map<string, AirplanePosition>
    >(new Map());
    const [trainPositions, setTrainPositions] = useState<
        Map<string, TrainPosition>
    >(new Map());

    useEffect(() => {
        if (currentBounds === null) {
            return;
        }
        // TODO: Set the domain somewhere centrally
        const websocket = new WebSocket("ws://localhost:5174");
        websocket.onmessage = (e) => {
            const rawMsg = JSON.parse(e.data);
            debug(`got ${rawMsg.t} message from server:`, rawMsg);
            switch (rawMsg.t) {
                case "START": {
                    if (rawMsg.msg === "connection established") {
                        websocket!.send(JSON.stringify(currentBounds));
                    }
                    break;
                }
                case "Bounds": {
                    onSetBounds(rawMsg.msg);
                    break;
                }
                default: {
                    // Try each handler to see if it can handle the message
                    const airplaneHandled = airplaneHandlerRef.current.handleMessage(rawMsg);
                    const boatHandled = boatHandlerRef.current.handleMessage(rawMsg);
                    const trainHandled = trainHandlerRef.current.handleMessage(rawMsg);

                    if (airplaneHandled) {
                        setAirplanePositions(airplaneHandlerRef.current.getPositions());
                    }
                    if (boatHandled) {
                        setBoatPositions(boatHandlerRef.current.getPositions());
                    }
                    if (trainHandled) {
                        setTrainPositions(trainHandlerRef.current.getPositions());
                    }

                    if (!airplaneHandled && !boatHandled && !trainHandled) {
                        console.error("unknown message", rawMsg);
                    }
                }
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
    };
};

