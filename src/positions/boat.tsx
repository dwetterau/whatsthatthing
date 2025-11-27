import { Fragment } from "react";
import { Marker, Popup } from "react-leaflet";
import { getIcon } from "../marker";
import { PositionHandler, Position } from "./base";

export type BoatPosition = Position & {
    shipName: string;
    time: Date;
};

const getBoatMarkerSVG = () => {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`<?xml version="1.0" encoding="iso-8859-1"?>
<svg fill="#7a0dd4" height="40px" width="40px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
	 viewBox="0 0 488.027 488.027" xml:space="preserve">
<g>
	<g>
		<path d="M486.138,299.514L486.138,299.514c-2.2-3.1-6-4.7-9.8-4c-28,4.7-53.7,10-78.6,15c-50.8,10.4-95.1,19.4-143.4,20.8v-46.3
			h112.1c4,0,7.5-2.3,9.1-6c1.6-3.6,0.9-7.9-1.8-10.8l-119.5-131v-88.1c0-5.5-4.5-10-10-10s-10,4.5-10,10v26.9l-150.9,192.7
			c-2.4,3-2.8,7.1-1.1,10.5c1.7,3.4,5.2,5.6,9,5.6h143v46.3c-102.2-2.5-189-35-189.9-35.3c-1.1-0.4-2.3-0.7-3.5-0.7h-30.8
			c-3.6,0-6.9,1.9-8.7,5s-1.8,6.9,0.1,10l72.4,123.2c1.6,2.8,4.5,4.6,7.6,4.9c4.5,0.4,110.2,10.7,165.4,10.7
			c54.4,0,160.9-10.3,165.4-10.7c3.3-0.3,6.2-2.3,7.8-5.2l66.7-123.2C488.638,306.714,488.438,302.613,486.138,299.514z
			 M254.438,166.913l89.4,98h-89.4V166.913z M111.938,264.914L111.938,264.914l122.5-156.4v156.4H111.938z M405.038,419.013
			L405.038,419.013c-22.5,2.1-111.5,10.1-158.2,10.1c-47.5,0-136.3-8.1-158.4-10.1l-61-103.7h11.7c13.9,5.1,103.4,36.1,207.7,36.1
			h0.1c53.2-0.6,102.6-10.7,154.8-21.4c18.5-3.8,37.5-7.7,57.5-11.3L405.038,419.013z"/>
	</g>
</g>
</svg>`)}`;
};

export class BoatPositionHandler extends PositionHandler<BoatPosition> {
    constructor() {
        super({
            getMessageType: () => "AISStream",
            getMarkerSVG: () => getBoatMarkerSVG(),
            renderPopup: (position) => <div>{position.shipName}</div>,
            parseMessage: (rawMsg: any): Map<string, BoatPosition> | null => {
                // TODO: Get heading information too...
                if (rawMsg.msg.MessageType === "PositionReport") {
                    const { MMSI, ShipName, latitude, longitude } =
                        rawMsg.msg.MetaData;
                    if (MMSI) {
                        const newBoatPositions = new Map<string, BoatPosition>();
                        newBoatPositions.set(MMSI, {
                            uniqueKey: MMSI,
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
    handleMessage(rawMsg: any): boolean {
        if (rawMsg.t !== this.config.getMessageType()) {
            return false;
        }

        const newPositions = this.config.parseMessage(rawMsg);
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
                            icon={getIcon(getBoatMarkerSVG())}
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

