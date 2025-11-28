import { Fragment } from "react";
import { Marker, Popup } from "react-leaflet";
import { getRotatableIcon } from "../marker";
import { PositionHandler, Position } from "./base";
import type { DataSourceMessage } from "../../data-sources/dataSource";
import type { AISStreamMessagePayload } from "../../data-sources/messagePayloads";

export type BoatPosition = Position & {
    shipName: string;
    time: Date;
    heading?: number; // Bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West)
};

const getBoatMarkerSVG = () => {
    // Top-down ship / vessel - clean ship silhouette from above
    const svg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="boatShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.3"/>
            </filter>
            <linearGradient id="hullGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#1e3a8a"/>
                <stop offset="50%" style="stop-color:#3b82f6"/>
                <stop offset="100%" style="stop-color:#1e3a8a"/>
            </linearGradient>
        </defs>
        <!-- Hull outline (ship body) - pointed bow, rounded stern -->
        <path d="M 20 4 
                 L 28 14 L 28 30 C 28 33, 24 36, 20 36 
                 C 16 36, 12 33, 12 30 L 12 14 Z" 
              fill="url(#hullGrad)" stroke="#1e40af" stroke-width="1" filter="url(#boatShadow)"/>
        <!-- Deck (lighter blue) -->
        <path d="M 20 8 L 25 15 L 25 29 C 25 31, 23 33, 20 33 
                 C 17 33, 15 31, 15 29 L 15 15 Z" 
              fill="#60a5fa"/>
        <!-- Bow accent -->
        <path d="M 20 5 L 24 12 L 20 10 L 16 12 Z" fill="#1e40af"/>
        <!-- Bridge/cabin (white rectangle) -->
        <rect x="16" y="17" width="8" height="6" rx="1" fill="#f1f5f9" stroke="#64748b" stroke-width="0.5"/>
        <!-- Bridge windows -->
        <rect x="17" y="18.5" width="6" height="2" rx="0.3" fill="#1e3a8a"/>
        <!-- Stern/rear deck -->
        <ellipse cx="20" cy="30" rx="4" ry="2" fill="#475569"/>
    </svg>`;
    
    return svg;
};

export class BoatPositionHandler extends PositionHandler<BoatPosition, "AISStream"> {
    constructor() {
        super({
            getMessageType: () => "AISStream",
            getMarkerSVG: (_position) => getBoatMarkerSVG(),
            renderPopup: (position) => <div>{position.shipName}</div>,
            parseMessage: (rawMsg: DataSourceMessage<"AISStream">): Map<string, BoatPosition> | null => {
                const payload: AISStreamMessagePayload = rawMsg.msg;
                // TODO: Get heading information too...
                if (payload.MessageType === "PositionReport") {
                    const { MMSI, ShipName, latitude, longitude } =
                        payload.MetaData;
                    if (MMSI) {
                        const newBoatPositions = new Map<string, BoatPosition>();
                        const uniqueKey = String(MMSI);
                        newBoatPositions.set(uniqueKey, {
                            uniqueKey,
                            shipName: ShipName,
                            lat: latitude,
                            lng: longitude,
                            time: new Date(),
                        });
                        return newBoatPositions;
                    }
                }
                return null;
            },
        });
    }

    /**
     * Override handleMessage to handle incremental updates
     */
    handleMessage(rawMsg: DataSourceMessage<"AISStream"> | DataSourceMessage<any>): boolean {
        if (rawMsg.t !== this.config.getMessageType()) {
            return false;
        }

        const newPositions = this.config.parseMessage(rawMsg as DataSourceMessage<"AISStream">);
        if (newPositions !== null) {
            // Merge with existing positions instead of replacing
            const currentPositions = new Map(this.positions.entries());
            for (const [key, value] of newPositions.entries()) {
                currentPositions.set(key, value);
            }
            this.updatePositions(currentPositions);
            return true;
        }
        return false;
    }
}

export const BoatMarkers = ({
    boatPositions,
}: {
    boatPositions: Map<string, BoatPosition>;
}) => {
    return (
        <Fragment>
            {Array.from(boatPositions.entries()).map(
                ([uniqueKey, position]) => {
                    const { lat, lng, shipName } = position;
                    return (
                        <Marker
                            key={uniqueKey}
                            position={[lat, lng]}
                            icon={getRotatableIcon(getBoatMarkerSVG(), position.heading)}
                        >
                            <Popup>
                                <div>{shipName}</div>
                            </Popup>
                        </Marker>
                    );
                },
            )}
        </Fragment>
    );
};

