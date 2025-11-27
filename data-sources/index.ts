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
    type Logger,
    type MessageType,
    type DataSourceMessage,
} from "./dataSource";
import { AISStreamSource, } from "./ais-stream";
import { OpenSkySource } from "./opensky";
import { AmtrakerSource } from "./amtracker";
import { MTASource } from "./mta";

export interface InitializedDataSources {
    aisStream: AISStreamSource;
    openSky: OpenSkySource;
    amtraker: AmtrakerSource;
    mta: MTASource;
}

export function initializeDataSources(
    config: DataSourceConfig,
    broadcast: <T extends MessageType>(message: DataSourceMessage<T>) => void,
    log: Logger,
    aisApiKey: string,
): InitializedDataSources {
    // Initialize and start AISStream source
    const aisStream = new AISStreamSource(config, broadcast, log, { apiKey: aisApiKey });
    aisStream.start();

    // Initialize and start OpenSky source
    const openSky = new OpenSkySource(config, broadcast, log);
    openSky.start();

    // Initialize and start Amtraker source
    const amtraker = new AmtrakerSource(config, broadcast, log);
    amtraker.start();

    // Initialize and start MTA source
    const mta = new MTASource(config, broadcast, log);
    mta.start();

    const result: InitializedDataSources = {
        aisStream,
        openSky,
        amtraker,
        mta,
    };
    return result;
}
