import type {
    DataSource,
    DataSourceConfig,
    BroadcastFunction,
    Logger,
    DataSourceMessage,
    MessageType,
} from "./dataSource";

export class OpenSkySource implements DataSource {
    private config: DataSourceConfig;
    private broadcast: BroadcastFunction<"OpenSky">;
    private log: Logger;
    private intervalId?: NodeJS.Timeout;

    constructor(
        config: DataSourceConfig,
        broadcast: <T extends MessageType>(message: DataSourceMessage<T>) => void,
        log: Logger,
    ) {
        this.config = config;
        // Wrap the generic broadcast function with our specific type
        this.broadcast = (message: DataSourceMessage<"OpenSky">) => {
            broadcast(message);
        };
        this.log = log;
    }

    private async fetchData(): Promise<void> {
        const { maxLat, minLat, maxLng, minLng } = this.config.bounds;
        const params = new URLSearchParams();
        params.set("lamin", minLat + "");
        params.set("lamax", maxLat + "");
        params.set("lomin", minLng + "");
        params.set("lomax", maxLng + "");

        this.log("fetching OpenSky states...");
        try {
            const response = await fetch(
                "https://opensky-network.org/api/states/all?" +
                    params.toString(),
            );
            const data = await response.json();
            const message: DataSourceMessage<"OpenSky"> = {
                t: "OpenSky",
                msg: {
                    states: data?.states ?? [],
                },
            };
            this.broadcast(message);
        } catch (error) {
            this.log("Error fetching OpenSky data:", error);
        }
    }

    start(): void {
        // Fetch immediately
        this.fetchData();

        // Then fetch every 3 minutes
        this.intervalId = setInterval(() => {
            this.fetchData();
        }, 3 * 60 * 1000);
    }

    stop(): void {
        if (this.intervalId) {
            this.log("Stopping OpenSky polling");
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }
}

