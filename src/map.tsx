import { Fragment, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import {
    AirplaneMarkers,
    BoatMarkers,
    TrainMarkers,
    usePositions,
} from "./positions";
import { debug } from "./logger";

export type Bounds = {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
};

const InnerMap = ({
    center,
    maxHeight,
}: {
    center: { lat: number; lng: number };
    maxHeight: number;
}) => {
    const [bounds, setBounds] = useState<Bounds | null>(null);
    const map = useMapEvents({
        click(e) {
            console.log("clicked at:", e.latlng, "in bounds?");
        },
    });

    // If the max height changes, make sure we reset the size.
    useLayoutEffect(() => {
        map?.invalidateSize();
        if (map) {
            // TODO: If I want to also update these when panning around, I need to call `useMapEvents` and listen
            // to both the moveEnd and zoomEnd events (and probably also resize?)
            const bounds = map.getBounds();
            setBounds({
                minLat: bounds.getSouth(),
                maxLat: bounds.getNorth(),
                minLng: bounds.getWest(),
                maxLng: bounds.getEast(),
            });
        }
    }, [map, maxHeight]);

    const { boatPositions, trainPositions, airplanePositions } =
        usePositions(bounds);

    return (
        <Fragment>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright"/>OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <BoatMarkers boatPositions={boatPositions} />
            <TrainMarkers trainPositions={trainPositions} />
            <AirplaneMarkers airplanePositions={airplanePositions} />
        </Fragment>
    );
};

export const MapWrapper = ({ maxHeight }: { maxHeight: number }) => {
    const [center, setCenter] = useState<{ lat: number; lng: number }>({
        lat: 40.7869,
        lng: -73.9505,
    });

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                debug("Got current position!", position);
                setCenter({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            });
        }
    }, []);

    return (
        <div style={{ height: maxHeight, width: "100%" }}>
            <MapContainer
                style={{ height: "100%", width: "100%" }}
                center={[center.lat, center.lng]}
                zoom={12}
                minZoom={12}
                scrollWheelZoom={false}
                dragging={false}
            >
                <InnerMap center={center} maxHeight={maxHeight} />
            </MapContainer>
        </div>
    );
};
