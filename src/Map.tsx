import { Fragment, useEffect, useLayoutEffect, useState } from "react"
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet"

type Bounds = {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}

type AirplanePosition = {
    uniqueKey: string;
    lat: number;
    lng: number;
    callsign: string;
    positionTime: Date;
    altitudeMeters: number;
}

const InnerMap = ({
    center, 
    maxHeight
}: {
    center: {lat: number, lng: number}, 
    maxHeight: number
}) => {
    const map = useMap();
    const [currentBounds, setCurrentBounds] = useState<Bounds | null>(null);

    const [airplanePositions, setAirplanePositions] = useState<Array<AirplanePosition>>([]);

    // If the max height changes, make sure we reset the size.
    useLayoutEffect(() => {
        map?.invalidateSize(); 
    }, [map, maxHeight]);

    useEffect(() => {
        // TODO: If I want to also update these when panning around, I need to call `useMapEvents` and listen
        // to both the moveEnd and zoomEnd events (and probably also resize?)
        if (map !== null) {
            const bounds = map.getBounds();            
            setCurrentBounds({
                minLat: bounds.getSouth(),
                maxLat: bounds.getNorth(),
                minLng: bounds.getWest(),
                maxLng: bounds.getEast(),
            })
        }
    }, [map])

    // Fetch the current planes in the viewing area
    useEffect(() => {
        if (currentBounds === null) {
            return;
        }
        const fetchPlaneData = async () => {
            const {minLat, maxLat, minLng, maxLng} = currentBounds;
            const params = new URLSearchParams();
            params.set("lamin", minLat + "");
            params.set("lamax", maxLat + "");
            params.set("lomin", minLng + "");
            params.set("lomax", maxLng + "");
            const response =  await fetch("https://opensky-network.org/api/states/all?" + params.toString());
            const data = await response.json();

            const newAirplanePositions: Array<AirplanePosition> = [];
            for (const state of data.states) {
                // See if there's data
                let missingData = false;
                for (let i = 0; i < 7; i++) {
                    missingData ||= !state[i];
                }
                if (missingData) {
                    continue
                }
                newAirplanePositions.push({
                    uniqueKey: state[0],
                    callsign: state[1],
                    positionTime: new Date(state[3] * 1000),
                    lng: state[5],
                    lat: state[6],
                    altitudeMeters: state[7],
                })
            }
            setAirplanePositions(newAirplanePositions)

            // For the full data format, see: https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
        }
        fetchPlaneData();
    }, [currentBounds])


    return <Fragment>
        <TileLayer 
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright"/>OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
        />
        {airplanePositions.map((position) => (
            <Marker key={position.uniqueKey} position={[position.lat, position.lng]} />
        ))}
    </Fragment>
}

export const MapWrapper = ({maxHeight}: {maxHeight: number}) => {
    const [center, setCenter] = useState<{lat: number, lng: number}>({lat: 40.786900, lng: -73.950500});

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                console.log("Got current position!", position);
                setCenter({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                })
            })
        }
    }, [])

    return <div style={{height: maxHeight, width: "100%"}}>
        <MapContainer 
            style={{height: "100%", width: "100%"}} 
            center={[center.lat, center.lng]} 
            zoom={10} 
            scrollWheelZoom={false}
        >
            <InnerMap center={center} maxHeight={maxHeight} />
        </MapContainer>
    </div>
}