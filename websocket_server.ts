import WebSocket, { WebSocketServer } from "ws";
import {
    initializeDataSources,
    type DataSourceConfig,
    type DataSourceMessage,
    type InitializedDataSources,
    type MessageType,
} from "./data-sources";

type Bounds = {
    maxLat: number;
    minLat: number;
    maxLng: number;
    minLng: number;
};

const getKeyForBounds = ({
    maxLat,
    minLat,
    maxLng,
    minLng,
}: Bounds): string => {
    return `${maxLat.toFixed(6)}-${minLat.toFixed(6)}-${maxLng.toFixed(
        6,
    )}-${minLng.toFixed(6)}`;
};

class RegionFetcher {
    private key: string;
    private bounds: Bounds;
    private refs: number;
    private lastAccessedTime: Date;

    private messages: Array<string> = [];
    private listeners: Array<{
        messageIndex: number;
        ws: WebSocket | null;
    }> = [];

    private dataSources: InitializedDataSources;

    public destroyed: boolean = false;

    private log(...args: any[]) {
        console.log("Fetcher: ", this.key, ...args);
    }

    constructor(bounds: Bounds, aisApiKey: string) {
        this.key = getKeyForBounds(bounds);
        this.bounds = bounds;
        this.refs = 0;
        this.lastAccessedTime = new Date();

        const config: DataSourceConfig = {
            bounds: {
                maxLat: bounds.maxLat,
                minLat: bounds.minLat,
                maxLng: bounds.maxLng,
                minLng: bounds.minLng,
            },
        };

        // Create broadcast function that adds messages and broadcasts them
        const broadcast = <T extends MessageType>(
            message: DataSourceMessage<T>,
        ): void => {
            this.addAndBroadcastMessage(message);
        };

        // Create logger function
        const logger = (...args: any[]) => {
            this.log(...args);
        };

        // Initialize and start all data sources
        this.dataSources = initializeDataSources(
            config,
            broadcast,
            logger,
            aisApiKey,
        );
    }

    private addAndBroadcastMessage<T extends MessageType>(
        message: DataSourceMessage<T>,
    ) {
        this.log(
            `got ${message.t} message. Appending as message ${this.messages.length}`,
        );
        this.messages.push(JSON.stringify(message));
        this.broadcastMessage(this.messages.length - 1);
    }

    private broadcastMessage(index: number) {
        let i = 0;
        this.log("broadcasting msgIndex", index);
        for (let i = 0; i < this.listeners.length; i++) {
            this.sendMessagesToClient(i);
        }
    }

    private sendMessagesToClient(i: number) {
        setTimeout(() => {
            const ws = this.listeners[i].ws;
            let messageIndex = this.listeners[i].messageIndex;
            while (ws && messageIndex < this.messages.length) {
                this.log("sending", messageIndex, "to", i);
                ws.send(this.messages[messageIndex]);
                messageIndex++;
                this.listeners[i].messageIndex = messageIndex;
            }
        }, 0);
    }

    public addRef(ws: WebSocket) {
        this.refs += 1;
        this.lastAccessedTime = new Date();
        const i = this.listeners.length;
        this.listeners.push({
            messageIndex: 0,
            ws,
        });
        // Send all the messages we already have!
        this.log("catching up client", i);
        this.sendMessagesToClient(i);
        this.log("finished catching up", i);
    }

    public removeRef(ws: WebSocket) {
        this.refs -= 1;
        for (let i = 0; i < this.listeners.length; i++) {
            if (this.listeners[i].ws === ws) {
                this.listeners[i].ws = null;
            }
        }
        if (this.refs === 0) {
            const lastRefRemovalTime = new Date();
            this.lastAccessedTime = lastRefRemovalTime;
            setTimeout(
                () => {
                    if (this.lastAccessedTime === lastRefRemovalTime) {
                        this.destroy();
                    }
                },
                2 * 60 * 1000,
            );
        }
    }

    public destroy() {
        this.dataSources.aisStream.stop();
        this.dataSources.openSky.stop();
        this.dataSources.amtraker.stop();
        this.destroyed = true;
    }
}

const fetchersByBounds = new Map<string, RegionFetcher>();

const registerBounds = (ws: WebSocket, bounds: Bounds, aisApiKey: string) => {
    const key = getKeyForBounds(bounds);
    console.log("registering key", key);

    if (!fetchersByBounds.has(key)) {
        fetchersByBounds.set(key, new RegionFetcher(bounds, aisApiKey));
    }
    let fetcher = fetchersByBounds.get(key)!;
    if (fetcher.destroyed) {
        console.log("resetting a previously-destroyed fetcher");
        fetchersByBounds.set(key, new RegionFetcher(bounds, aisApiKey));
        fetcher = fetchersByBounds.get(key)!;
    }
    fetcher.addRef(ws);
    return () => {
        fetcher.removeRef(ws);
    };
};

// TODO: Find the bounds that overlap with what the user passes in, and then use those.
const allowedBounds: Bounds = {
    minLat: 40.6,
    maxLat: 40.9,
    minLng: -74.3,
    maxLng: -73.7,
};

export const setupWebsocketServer = (aisApiKey: string) => {
    const socketServer = new WebSocketServer({ port: 5174 });
    socketServer.on("connection", (ws) => {
        console.log("client connected");

        let disconnectFn: null | (() => void) = null;

        ws.send(JSON.stringify({ t: "START", msg: "connection established" }));
        ws.on("close", (code, reason) => {
            console.log("client disconnected.", code, reason);
            disconnectFn?.();
        });
        ws.on("error", (e) => {
            console.log("websocket error", e);
        });
        ws.on("message", (data) => {
            const rawMsg = JSON.parse(data.toString());
            console.log(
                "got message from client:",
                rawMsg,
                "using bounds",
                allowedBounds,
            );
            disconnectFn = registerBounds(ws, allowedBounds, aisApiKey);
            ws.send(JSON.stringify({ t: "Bounds", msg: allowedBounds }));
        });
    });
};
