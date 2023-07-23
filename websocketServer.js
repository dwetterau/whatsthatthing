import WebSocket, { WebSocketServer } from 'ws';

export const setupWebsocketServer = () => {
    const socketServer = new WebSocketServer({port: 5174});
    const apiKey = process.env.AISSTREAM_API_KEY;
    if (!apiKey) {
        console.error("AISStream API Key not provided. Not starting WebsocketServer")
        return;
    }

    socketServer.on('connection', ws => {
        console.log('client connected');

        let aisstreamConnection = null;

        ws.send(JSON.stringify({t: 'START', msg: 'connection established'}));
        ws.on('close', (code, reason) => {
            console.log('client disconnected.', code, reason);
            if (aisstreamConnection) {
                aisstreamConnection.close();
                console.log('closed AISStream connection')
            }
        })
        ws.on('error', () => {
            console.log('websocket error');
        })
        // TODO: If I want to respond to messages ever..
        ws.on('message', data => {
            const rawMsg = JSON.parse(data);
            console.log("got message from client:", rawMsg);
        
            // For our new connection, set up a connection to get updates from the requested region
            const {minLat, maxLat, minLng, maxLng} = rawMsg;
            aisstreamConnection = new WebSocket("wss://stream.aisstream.io/v0/stream");
            aisstreamConnection.onopen = () => {
                console.log("Opened connection to AISStream")
                aisstreamConnection.send(JSON.stringify({
                    "APIKey": apiKey,
                    "BoundingBoxes": [[[maxLat, minLng], [minLat, maxLng]]],
                    "FilterMessageTypes": ["PositionReport"],
                }))
            }
            aisstreamConnection.onerror = (error) => {
                console.log('Error from AISStream:', error)
            }
            aisstreamConnection.onmessage = (e) => {
                // Forward the response directly to the client for now to make iteration faster.
                ws.send(JSON.stringify({t: 'AISStream', msg: JSON.parse(e.data)}));    
            }
        })

    })
}