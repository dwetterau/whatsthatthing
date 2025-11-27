export type {
    MessageType,
    DataSourceMessage,
    DataSourceConfig,
    BroadcastFunction,
    Logger,
    DataSource,
} from "./dataSource";

import {
    type DataSourceConfig,
    type BroadcastFunction,
    type Logger,
    type MessageType,
    type DataSourceMessage,
} from "./dataSource";
import { AISStreamSource, } from "./ais-stream";
import { OpenSkySource } from "./opensky";
import { AmtrakerSource } from "./amtracker";

export interface InitializedDataSources {
    aisStream: AISStreamSource;
    openSky: OpenSkySource;
    amtraker: AmtrakerSource;
}

export function initializeDataSources(
    config: DataSourceConfig,
    broadcast: <T extends MessageType>(message: DataSourceMessage<T>) => void,
    log: Logger,
    aisApiKey: string,
): InitializedDataSources {
    // Create typed broadcast functions for each source
    const aisStreamBroadcast: BroadcastFunction<"AISStream"> = (message) => {
        broadcast(message);
    };

    const openSkyBroadcast: BroadcastFunction<"OpenSky"> = (message) => {
        broadcast(message);
    };

    const amtrakerBroadcast: BroadcastFunction<"Amtraker"> = (message) => {
        broadcast(message);
    };

    // Initialize and start AISStream source
    const aisStream = new AISStreamSource(config, aisStreamBroadcast, log, { apiKey: aisApiKey });
    aisStream.start();

    // Initialize and start OpenSky source
    const openSky = new OpenSkySource(config, openSkyBroadcast, log);
    openSky.start();

    // Initialize and start Amtraker source
    const amtraker = new AmtrakerSource(config, amtrakerBroadcast, log);
    amtraker.start();

    return {
        aisStream,
        openSky,
        amtraker,
    };
}
