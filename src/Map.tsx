import { Fragment, useEffect, useLayoutEffect, useState } from "react"
import { MapContainer, TileLayer, useMap } from "react-leaflet"

const InnerMap = ({
    center, 
    maxHeight
}: {
    center: {lat: number, lng: number}, 
    maxHeight: number
}) => {
    const map = useMap();

    useLayoutEffect(() => {
        map?.invalidateSize(); 
    }, [map, maxHeight]);

    return <Fragment>
        <TileLayer 
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright"/>OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
        />
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
            zoom={14} 
            scrollWheelZoom={false}
        >
            <InnerMap center={center} maxHeight={maxHeight} />
        </MapContainer>
    </div>
}