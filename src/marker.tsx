import L from "leaflet";

export const getIcon = (svgUrl: string) => {
    return L.icon({
        iconUrl: svgUrl,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -15],
    });
};

/**
 * Create a Leaflet DivIcon with SVG content and optional rotation
 * @param svgContent - The SVG content as a string (without data URI encoding)
 * @param rotationAngle - Optional rotation angle in degrees (0 = North, 90 = East, etc.)
 */
export const getRotatableIcon = (svgContent: string, rotationAngle?: number) => {
    // Convert compass bearing (0=North) to CSS rotation angle
    // CSS: 0° = no rotation, positive = clockwise
    // Compass: 0° = North, 90° = East, 180° = South, 270° = West
    // For top-down icons pointing north, we need: CSS angle = compass bearing
    const cssRotation = rotationAngle !== undefined ? rotationAngle : 0;
    
    const html = `<div style="transform: rotate(${cssRotation}deg); transform-origin: center center; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
        ${svgContent}
    </div>`;
    
    return L.divIcon({
        html,
        className: 'rotatable-marker-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -15],
    });
};
