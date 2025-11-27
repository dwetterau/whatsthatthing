/**
 * Message payload types for each datasource
 * 
 * These types define the structure of the `msg` field in DataSourceMessage
 * for each message type. They are defined here to avoid circular dependencies.
 */

// MTA message payload
export interface MTATrainPosition {
    lat: number;
    lng: number;
    tripId: string;
    routeId: string;
    routeColor?: string;
    direction: number;
    nextStop?: string;
    lastStop?: string;
    progress?: number;
    heading?: number; // Bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West)
}

export interface MTAMessagePayload {
    trains: MTATrainPosition[];
    timestamp: number;
}

// OpenSky message payload
// OpenSky API state vector format
// See: https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
export type OpenSkyStateVector = any[];

export interface OpenSkyMessagePayload {
    states: OpenSkyStateVector[];
}

// Amtraker message payload
export interface AmtrakerTrain {
    trainID: string;
    trainNum: number;
    routeName: string;
    lat: number;
    lon: number;
    trainTimely: string;
    stations: Array<{
        name: string;
        code: string;
        tz: string;
        schArr: string;
        schDep: string;
        arr: string;
        dep: string;
        arrCmnt: string;
        depCmnt: string;
        status: string;
    }>;
}

export interface AmtrakerMessagePayload {
    [routeName: string]: AmtrakerTrain[];
}

// AISStream message payload
export interface AISStreamMessagePayload {
    MessageType: string;
    MetaData: {
        MMSI: number;
        ShipName: string;
        latitude: number;
        longitude: number;
        [key: string]: any;
    };
    [key: string]: any;
}

