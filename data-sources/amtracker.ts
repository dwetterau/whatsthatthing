import type {
    DataSource,
    DataSourceConfig,
    BroadcastFunction,
    Logger,
    DataSourceMessage,
    MessageType,
} from "./dataSource";

export class AmtrakerSource implements DataSource<"Amtraker", void> {
    private config: DataSourceConfig;
    private broadcast: BroadcastFunction<"Amtraker">;
    private log: Logger;
    private intervalId?: NodeJS.Timeout;

    constructor(
        config: DataSourceConfig,
        broadcast: <T extends MessageType>(message: DataSourceMessage<T>) => void,
        log: Logger,
    ) {
        this.config = config;
        // Wrap the generic broadcast function with our specific type
        this.broadcast = (message: DataSourceMessage<"Amtraker">) => {
            broadcast(message);
        };
        this.log = log;
    }

    private async fetchData(): Promise<void> {
        const { maxLat, minLat, maxLng, minLng } = this.config.bounds;

        this.log("fetching Amtraker data");
        try {
            const response = await fetch(
                "https://api-v3.amtraker.com/v3/trains",
            );
            const data = await response.json();

            const filteredData: Record<string, any> = {};
            Object.keys(data).forEach((key) => {
                // This is an array of each train.
                const trainRoute = data[key].filter((train: any) => {
                    return (
                        train.lat >= minLat &&
                        train.lat <= maxLat &&
                        train.lon >= minLng &&
                        train.lon <= maxLng
                    );
                });
                if (trainRoute.length > 0) {
                    filteredData[key] = trainRoute;
                }
            });

            const message: DataSourceMessage<"Amtraker"> = {
                t: "Amtraker",
                msg: filteredData,
            };
            this.broadcast(message);
        } catch (e) {
            this.log("Error fetching Amtraker data", e);
        }
    }

    start(): void {
        // Fetch immediately
        this.fetchData();

        // Then fetch every minute
        this.intervalId = setInterval(() => {
            this.fetchData();
        }, 60 * 1000);
    }

    stop(): void {
        if (this.intervalId) {
            this.log("Stopping Amtraker polling");
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }
}

