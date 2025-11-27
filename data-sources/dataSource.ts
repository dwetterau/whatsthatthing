export type MessageType = "AISStream" | "OpenSky" | "Amtraker" | "MTA";

export interface DataSourceMessage<T extends MessageType> {
    t: T;
    msg: object;
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

export interface DataSource<T extends MessageType, TSourceConfig = void> {
    /**
     * Start fetching/streaming data
     */
    start(): void;

    /**
     * Stop fetching/streaming data and clean up resources
     */
    stop(): void;
}

