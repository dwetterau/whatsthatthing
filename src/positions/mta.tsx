import { Fragment } from "react";
import { Marker, Popup } from "react-leaflet";
import { getIcon } from "../marker";
import { PositionHandler, Position } from "./base";
import type { DataSourceMessage } from "../../data-sources/dataSource";
import type { MTAMessagePayload } from "../../data-sources/messagePayloads";

export type MTAPosition = Position & {
    tripId: string;
    routeId: string;
    routeColor?: string;
    direction: number;
    nextStop?: string;
    lastStop?: string;
    progress?: number;
};

/**
 * Get MTA subway line color based on route ID
 * Colors match the official MTA subway map
 * If routeColor is provided (from GTFS route_color), it takes precedence
 */
const getMTARouteColor = (routeId: string, routeColor?: string): string => {
    // If routeColor is provided (e.g., from LIRR routes.txt), use it
    if (routeColor) {
        return routeColor;
    }
    const route = routeId.toUpperCase();
    
    // Numbered lines (IRT)
    if (route === "1" || route === "2" || route === "3") {
        return "#EE352E"; // Red
    }
    if (route === "4" || route === "5" || route === "6") {
        return "#00933C"; // Green
    }
    if (route === "7") {
        return "#B933AD"; // Purple
    }
    
    // Lettered lines (BMT/IND)
    if (route === "A" || route === "C" || route === "E") {
        return "#0039A6"; // Blue
    }
    if (route === "B" || route === "D" || route === "F" || route === "M") {
        return "#FF6319"; // Orange
    }
    if (route === "G") {
        return "#6CBE45"; // Light Green
    }
    if (route === "J" || route === "Z") {
        return "#996633"; // Brown
    }
    if (route === "L") {
        return "#A7A9AC"; // Light Gray
    }
    if (route === "N" || route === "Q" || route === "R" || route === "W") {
        return "#FCCC0A"; // Yellow
    }
    if (route === "S") {
        return "#808183"; // Dark Gray
    }
    
    // Staten Island Railway
    if (route === "SI" || route === "SIR") {
        return "#0039A6"; // Blue
    }
    
    // LIRR and Metro-North (commuter rail)
    if (route.includes("LIRR") || route.includes("MNR")) {
        return "#4D7EB8"; // Commuter Rail Blue
    }
    
    // Default color for unknown routes
    return "#808183"; // Gray
};

/**
 * Generate SVG marker for MTA train showing route ID with appropriate color
 * Styled like MTA subway route badges - circular with route ID
 */
const getMTAMarkerSVG = (routeId: string, routeColor?: string): string => {
    const color = getMTARouteColor(routeId, routeColor);
    // Display route ID, truncate if too long
    const displayRoute = routeId.length > 2 ? routeId.substring(0, 2) : routeId;
    // Adjust font size based on route ID length
    const fontSize = displayRoute.length === 1 ? "18" : "14";
    
    // Create a circular badge similar to MTA subway route badges
    const svg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.3"/>
            </filter>
        </defs>
        <circle cx="20" cy="20" r="17" fill="${color}" stroke="#FFFFFF" stroke-width="2.5" filter="url(#shadow)"/>
        <text x="20" y="20" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" 
              fill="#FFFFFF" text-anchor="middle" dominant-baseline="central" 
              style="text-shadow: 0 1px 2px rgba(0,0,0,0.3);">${displayRoute}</text>
    </svg>`;
    
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const MTAPopup = ({ position }: { position: MTAPosition }) => {
    return (
        <Fragment>
            <div>
                <strong>Route {position.routeId}</strong>
            </div>
            {position.lastStop && (
                <div>Last Stop: {position.lastStop}</div>
            )}
            {position.nextStop && (
                <div>Next Stop: {position.nextStop}</div>
            )}
            {position.progress !== undefined && (
                <div>Progress: {(position.progress * 100).toFixed(0)}%</div>
            )}
            <div>Direction: {position.direction === 0 ? "Northbound" : "Southbound"}</div>
            <div style={{ fontSize: "0.8em", color: "#666", marginTop: "0.5em" }}>
                Trip: {position.tripId}
            </div>
        </Fragment>
    );
};

export class MTAPositionHandler extends PositionHandler<MTAPosition, "MTA"> {
    constructor() {
        super({
            getMessageType: () => "MTA",
            getMarkerSVG: (position) => getMTAMarkerSVG(position.routeId, position.routeColor),
            renderPopup: (position) => <MTAPopup position={position} />,
            parseMessage: (rawMsg: DataSourceMessage<"MTA">): Map<string, MTAPosition> | null => {
                const payload: MTAMessagePayload = rawMsg.msg;
                if (!payload.trains) {
                    return null;
                }
                
                const newMTAPositions = new Map<string, MTAPosition>();
                for (const train of payload.trains) {
                    const uniqueKey = train.tripId || `${train.routeId}-${train.lat}-${train.lng}`;
                    newMTAPositions.set(uniqueKey, {
                        uniqueKey,
                        lat: train.lat,
                        lng: train.lng,
                        tripId: train.tripId,
                        routeId: train.routeId,
                        routeColor: train.routeColor,
                        direction: train.direction,
                        nextStop: train.nextStop,
                        lastStop: train.lastStop,
                        progress: train.progress,
                    });
                }
                return newMTAPositions;
            },
        });
    }
}

export const MTAMarkers = ({
    mtaPositions,
}: {
    mtaPositions: Map<string, MTAPosition>;
}) => {
    return (
        <Fragment>
            {Array.from(mtaPositions.entries()).map(([_, position]) => (
                <Marker
                    key={position.uniqueKey}
                    position={[position.lat, position.lng]}
                    icon={getIcon(getMTAMarkerSVG(position.routeId, position.routeColor))}
                >
                    <Popup>
                        <MTAPopup position={position} />
                    </Popup>
                </Marker>
            ))}
        </Fragment>
    );
};

