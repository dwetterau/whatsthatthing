import { response } from "express";
import WebSocket, { WebSocketServer } from "ws";

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

    private aisStreamConnection?: WebSocket;
    private messages: Array<string> = [];
    private listeners: Array<{
        messageIndex: number;
        ws: WebSocket | null;
    }> = [];
    private openSkyIntervalId;
    private amtrakerIntervalId;

    public destroyed: boolean = false;

    private log(...any) {
        console.log("Fetcher: ", this.key, ...any);
    }

    constructor(bounds: Bounds) {
        this.key = getKeyForBounds(bounds);
        this.bounds = bounds;
        this.refs = 0;
        this.lastAccessedTime = new Date();
        const { maxLat, minLat, maxLng, minLng } = bounds;

        const apiKey = process.env.AISSTREAM_API_KEY;
        if (!apiKey) {
            console.error(
                "AISStream API Key not provided. Not starting WebsocketServer",
            );
            return;
        }

        const aisStreamConnection = new WebSocket(
            "wss://stream.aisstream.io/v0/stream",
        );
        aisStreamConnection.on("open", () => {
            this.log("Opened connection to AISStream");
            aisStreamConnection!.send(
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
        aisStreamConnection.on("error", (error) => {
            this.log("Error from AISStream:", error);
        });
        aisStreamConnection.on("message", (e) => {
            this.addAndBroadcastMessage({
                t: "AISStream",
                msg: JSON.parse(e.toString()),
            });
        });
        this.aisStreamConnection = aisStreamConnection;

        const fetchOpenSky = async () => {
            const params = new URLSearchParams();
            params.set("lamin", minLat + "");
            params.set("lamax", maxLat + "");
            params.set("lomin", minLng + "");
            params.set("lomax", maxLng + "");

            this.log("fetching OpenSky states...");
            const response = await fetch(
                "https://opensky-network.org/api/states/all?" +
                    params.toString(),
            );
            const data = await response.json();
            this.addAndBroadcastMessage({
                t: "OpenSky",
                msg: data?.states ?? [],
            });
        };

        const fetchAmtraker = async () => {
            this.log("fetching Amtraker data");
            const response = await fetch(
                "https://api-v3.amtraker.com/v3/trains",
            );
            const data = await response.json();

            const filteredData = {};
            Object.keys(data).forEach((key) => {
                // This is an array of each train.
                const trainRoute = data[key].filter((train) => {
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
            this.addAndBroadcastMessage({
                t: "Amtraker",
                msg: filteredData,
            });
        };

        fetchOpenSky();
        this.openSkyIntervalId = setInterval(fetchOpenSky, 3 * 60 * 1000);
        fetchAmtraker();
        this.amtrakerIntervalId = setInterval(fetchAmtraker, 60 * 1000);
    }

    private addAndBroadcastMessage(message: {
        t: "AISStream" | "OpenSky" | "Amtraker";
        msg: object;
    }) {
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
        this.aisStreamConnection?.close();
        clearInterval(this.openSkyIntervalId);
        this.destroyed = true;
    }
}

const fetchersByBounds = new Map<string, RegionFetcher>();

const registerBounds = (ws: WebSocket, bounds: Bounds) => {
    const key = getKeyForBounds(bounds);
    console.log("registering key", key);

    if (!fetchersByBounds.has(key)) {
        fetchersByBounds.set(key, new RegionFetcher(bounds));
    }
    let fetcher = fetchersByBounds.get(key)!;
    if (fetcher.destroyed) {
        console.log("resetting a previously-destroyed fetcher");
        fetchersByBounds.set(key, new RegionFetcher(bounds));
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

export const setupWebsocketServer = () => {
    const socketServer = new WebSocketServer({ port: 5174 });
    socketServer.on("connection", (ws) => {
        console.log("client connected");

        let disconnectFn: null | (() => void) = null;

        ws.send(JSON.stringify({ t: "START", msg: "connection established" }));
        ws.on("close", (code, reason) => {
            console.log("client disconnected.", code, reason);
            disconnectFn?.();
        });
        ws.on("error", () => {
            console.log("websocket error");
        });
        ws.on("message", (data) => {
            const rawMsg = JSON.parse(data.toString());
            console.log(
                "got message from client:",
                rawMsg,
                "using bounds",
                allowedBounds,
            );
            disconnectFn = registerBounds(ws, allowedBounds);
            ws.send(JSON.stringify({ t: "Bounds", msg: allowedBounds }));
        });
    });
};
