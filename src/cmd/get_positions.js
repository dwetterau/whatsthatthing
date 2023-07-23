import https from "https";
import WebSocket from 'ws';

const connection = new WebSocket("wss://stream.aisstream.io/v0/stream");

connection.onopen = () => {
    console.log("connection opened");

    const latmin = 40.668660370488446;
    const latmax = 40.90495021551014;
    const lomin = -74.1020965576172;
    const lomax = -73.79894256591798;

    connection.send(JSON.stringify({
        "APIKey": process.env.API_KEY,
        "BoundingBoxes": [[[latmax, lomin], [latmin, lomax]]],
    }))
}

connection.onerror = (error) => {
    console.log(`Websocket error: ${error}`)
}

connection.onmessage = (e) => {
    console.log(`got websocket data`, JSON.parse(e.data))
}



// This is for fetching from MTA websites:
/*
https.get(
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
    {
        headers: {
            'x-api-key': process.env.API_KEY,
        }
    },
    (resp) => {
        resp.on('data', (chunk) => {
            console.log("Receiving data");
        });
        resp.on('end', () => {
            console.log("finished getting data");
        })
    }
).on('error', (err) => {
    console.log("Error:", err.message);
})
*/