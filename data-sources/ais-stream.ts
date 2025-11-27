import WebSocket from "ws";
import type {
    DataSource,
    DataSourceConfig,
    BroadcastFunction,
    Logger,
    DataSourceMessage,
} from "./dataSource";

export interface AISStreamConfig {
    apiKey: string;
}

export class AISStreamSource implements DataSource<"AISStream", AISStreamConfig> {
    private config: DataSourceConfig;
    private broadcast: BroadcastFunction<"AISStream">;
    private log: Logger;
    private apiKey: string;
    private connection?: WebSocket;

    constructor(
        config: DataSourceConfig,
        broadcast: BroadcastFunction<"AISStream">,
        log: Logger,
        sourceConfig: AISStreamConfig,
    ) {
        this.config = config;
        this.broadcast = broadcast;
        this.log = log;
        this.apiKey = sourceConfig.apiKey;
    }

    start(): void {
        const { maxLat, minLat, maxLng, minLng } = this.config.bounds;
        const log = this.log;
        const broadcast = this.broadcast;
        const apiKey = this.apiKey;

        log("Opening connection to AISStream");
        this.connection = new WebSocket("wss://stream.aisstream.io/v0/stream");

        this.connection.on("open", () => {
            log("Opened connection to AISStream");
            this.connection!.send(
                JSON.stringify({
                    APIKey: apiKey,
                    BoundingBoxes: [
                        [
                            [maxLat, minLng],
                            [minLat, maxLng],
                        ],
                    ],
                    FilterMessageTypes: ["PositionReport"],
                }),
            );
        });

        this.connection.on("error", (error) => {
            log("Error from AISStream:", error);
        });

        this.connection.on("message", (e) => {
            const message: DataSourceMessage<"AISStream"> = {
                t: "AISStream",
                msg: JSON.parse(e.toString()),
            };
            broadcast(message);
        });
    }

    stop(): void {
        if (this.connection) {
            this.log("Closing AISStream connection");
            this.connection.close();
            this.connection = undefined;
        }
    }
}

