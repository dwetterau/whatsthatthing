import { Fragment, useEffect, useLayoutEffect, useState } from "react"
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet"
import L from "leaflet";

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

const getAirplaneMarkerIcon = (heading: number) => {
    console.log(heading);
    return L.icon({
        iconUrl: getAirplaneMarkerSVG(heading),
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, 0],
    })
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
                    heading: state[10],
                    velocityMetersPerSecond: state[9],
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
            <Marker 
                key={position.uniqueKey} 
                position={[position.lat, position.lng]}
                icon={getAirplaneMarkerIcon(position.heading)}
            />
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