import WebSocket, { WebSocketServer } from 'ws';

type Bounds = {
    maxLat: number;
    minLat: number;
    maxLng: number;
    minLng: number;
}

const getKeyForBounds = ({maxLat, minLat, maxLng, minLng}: Bounds): string => {
    return `${maxLat.toFixed(6)}-${minLat.toFixed(6)}-${maxLng.toFixed(6)}-${minLng.toFixed(6)}`
}

class RegionFetcher {
    private key: string;
    private refs: number;
    private lastAccessedTime: Date;

    private aisStreamConnection?: WebSocket;
    private messages: Array<string> = [];
    private listeners: Array<{
        messageIndex: number;
        ws: WebSocket | null;
    }> = [];

    public destroyed: boolean = false;

    private log(...any) {
        console.log("Fetcher: ", this.key, ...any)
    }

    constructor(bounds: Bounds) {
        this.key = getKeyForBounds(bounds);
        this.refs = 0;
        this.lastAccessedTime = new Date();
        const {maxLat, minLat, maxLng, minLng} = bounds;

        const apiKey = process.env.AISSTREAM_API_KEY;
        if (!apiKey) {
            console.error("AISStream API Key not provided. Not starting WebsocketServer")
            return;
        }

        const aisStreamConnection = new WebSocket("wss://stream.aisstream.io/v0/stream");
        aisStreamConnection.on('open', () => {
                this.log("Opened connection to AISStream")
            aisStreamConnection!.send(JSON.stringify({
                "APIKey": apiKey,
                "BoundingBoxes": [[[maxLat, minLng], [minLat, maxLng]]],
                "FilterMessageTypes": ["PositionReport"],
            }))
        });
        aisStreamConnection.on('error', (error) => {
            this.log('Error from AISStream:', error)
        });
        aisStreamConnection.on('message', (e) => {
            this.messages.push(JSON.stringify({t: 'AISStream', msg: JSON.parse(e.toString())}));
            this.broadcastMessage(this.messages.length - 1);
        });
        this.aisStreamConnection = aisStreamConnection;
    }

    broadcastMessage(index: number) {
        let i = 0;
        this.log("broadcasting msgIndex", index)
        for (const {ws, messageIndex} of this.listeners) {
            if (ws && index === messageIndex) {
                // This listener is all the way caught up, try to send them the message
                const j = i
                setTimeout(() => {
                    this.log("sending", messageIndex, "to", j)
                    ws.send(this.messages[messageIndex])
                    this.listeners[j].messageIndex = messageIndex + 1;
                }, 0)
            }
            i++;
        }
    }

    addRef(ws: WebSocket) {
        this.refs += 1;
        this.lastAccessedTime = new Date();
        const i = this.listeners.length;
        this.listeners.push({
            messageIndex: 0,
            ws,
        })
        setTimeout(() => {
            // Send all the messages we already have!
            let messageIndex = this.listeners[i].messageIndex;
            this.log("catching up client", i)
            while (messageIndex < this.messages.length) {
                this.log("sending", messageIndex, "to", i)
                ws.send(this.messages[messageIndex])
                messageIndex++;
                this.listeners[i].messageIndex = messageIndex;
            }
            this.log("finished catching up", i)
        }, 0)
    }

    removeRef(ws: WebSocket) {
        this.refs -= 1;
        for (let i = 0; i < this.listeners.length; i++) {
            if (this.listeners[i].ws === ws) {
                this.listeners[i].ws = null;
            }
        }
        if (this.refs === 0) {
            const lastRefRemovalTime = new Date();
            this.lastAccessedTime = lastRefRemovalTime;
            setTimeout(() => {
                if (this.lastAccessedTime === lastRefRemovalTime) {
                    this.destroy();
                }
            }, 15 * 60 * 1000)
        }
    }

    destroy() {
        this.aisStreamConnection?.close();
        this.destroyed = true;
    }
}

const fetchersByBounds = new Map<string, RegionFetcher>();

const registerBounds = (ws: WebSocket, bounds: Bounds) => {
    const key = getKeyForBounds(bounds);
    console.log("registering key", key)

    if (!fetchersByBounds.has(key)) {
        fetchersByBounds.set(key, new RegionFetcher(bounds));
    }
    let fetcher = fetchersByBounds.get(key)!;
    if (fetcher.destroyed) {
        console.log("resetting a previously-destroyed fetcher")
        fetchersByBounds.set(key, new RegionFetcher(bounds));
        fetcher = fetchersByBounds.get(key)!;
    }
    fetcher.addRef(ws);
    return () => {
        fetcher.removeRef(ws);
    }
}

export const setupWebsocketServer = () => {
    const socketServer = new WebSocketServer({port: 5174}); 
    socketServer.on('connection', ws => {        
        console.log('client connected');

        let disconnectFn: null | (() => void) = null;

        ws.send(JSON.stringify({t: 'START', msg: 'connection established'}));
        ws.on('close', (code, reason) => {
            console.log('client disconnected.', code, reason);
            disconnectFn?.()
        })
        ws.on('error', () => {
            console.log('websocket error');
        })
        ws.on('message', data => {
            const rawMsg = JSON.parse(data.toString());
            console.log("got message from client:", rawMsg);
            disconnectFn = registerBounds(ws, rawMsg as Bounds);
        })
    })
}