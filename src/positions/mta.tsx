import { Fragment } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
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
    heading?: number; // Bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West)
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
 * Includes a small direction arrow indicator pointing in the direction of travel
 * Marker is less opaque for better visibility, arrow indicator is larger
 */
const getMTAMarkerSVG = (routeId: string, routeColor?: string, heading?: number): string => {
    const color = getMTARouteColor(routeId, routeColor);
    // Display route ID, truncate if too long
    const displayRoute = routeId.length > 2 ? routeId.substring(0, 2) : routeId;
    // Adjust font size based on route ID length
    const fontSize = displayRoute.length === 1 ? "18" : "14";
    
    // Calculate arrow position and rotation based on heading
    // Heading is in degrees where 0 = North, 90 = East, 180 = South, 270 = West
    // SVG coordinates: 0 degrees points right (East), so we need to adjust
    // Position arrow on the edge of the circle pointing in the direction of travel
    const arrowRadius = 17; // Same as circle radius
    let arrowX = 20;
    let arrowY = 20;
    let arrowRotation = 0;
    
    if (heading !== undefined) {
        // Convert compass bearing (0=North) to SVG angle (0=East, clockwise)
        // SVG: 0° = right (East), 90° = down (South), 180° = left (West), 270° = up (North)
        // Compass: 0° = North, 90° = East, 180° = South, 270° = West
        // Conversion: SVG angle = 90 - compass bearing (then normalize)
        const svgAngle = (90 - heading + 360) % 360;
        
        // Position arrow on the edge of the circle
        // SVG coordinates: 0° = right, so we use standard math coordinates
        const angleRad = (svgAngle * Math.PI) / 180;
        arrowX = 20 + arrowRadius * Math.cos(angleRad);
        arrowY = 20 + arrowRadius * Math.sin(angleRad);
        
        // Arrow should point in the direction of travel (same as heading)
        arrowRotation = svgAngle;
    }
    
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
        ${heading !== undefined ? `<g transform="translate(${arrowX}, ${arrowY}) rotate(${arrowRotation})">
            <polygon points="0,-6 8,0 0,6" fill="${color}" stroke="#FFFFFF" stroke-width="0.8" opacity="0.95" filter="url(#shadow)"/>
        </g>` : ''}
    </svg>`;
    
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Get Leaflet icon for MTA marker
 */
const getMTAIcon = (svgUrl: string) => {
    return L.icon({
        iconUrl: svgUrl,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -15],
    });
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
            getMarkerSVG: (position) => getMTAMarkerSVG(position.routeId, position.routeColor, position.heading),
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
                        heading: train.heading,
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
                    icon={getMTAIcon(getMTAMarkerSVG(position.routeId, position.routeColor, position.heading))}
                >
                    <Popup>
                        <MTAPopup position={position} />
                    </Popup>
                </Marker>
            ))}
        </Fragment>
    );
};

