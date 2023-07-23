import https from "https";

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