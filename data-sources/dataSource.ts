import type {
    AISStreamMessagePayload,
    AmtrakerMessagePayload,
    MTAMessagePayload,
    OpenSkyMessagePayload,
} from "./messagePayloads";

export type MessageType = "AISStream" | "OpenSky" | "Amtraker" | "MTA";

// Message payload types for each datasource
export type MessagePayload<T extends MessageType> = 
    T extends "AISStream" ? AISStreamMessagePayload :
    T extends "OpenSky" ? OpenSkyMessagePayload :
    T extends "Amtraker" ? AmtrakerMessagePayload :
    T extends "MTA" ? MTAMessagePayload :
    never;

export interface DataSourceMessage<T extends MessageType> {
    t: T;
    msg: MessagePayload<T>;
}

export interface DataSourceConfig {
    bounds: {
        maxLat: number;
        minLat: number;
        maxLng: number;
        minLng: number;
    };
}

export interface BroadcastFunction<T extends MessageType> {
    (message: DataSourceMessage<T>): void;
}

export interface Logger {
    (...args: any[]): void;
}

export interface DataSource {
    /**
     * Start fetching/streaming data
     */
    start(): void;

    /**
     * Stop fetching/streaming data and clean up resources
     */
    stop(): void;
}

