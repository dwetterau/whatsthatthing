import L from "leaflet";

export const getIcon = (svgUrl: string) => {
    return L.icon({
        iconUrl: svgUrl,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, 0],
    });
};
