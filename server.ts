import * as fs from 'fs';
import * as path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer as createViteServer } from 'vite'

import { setupWebsocketServer } from './websocketServer.js';

// This is running a vite server in middleware mode, mostly so that we can connect to 3rd party services
// on the server.

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function createServer() {
  const app = express()

  // Create Vite server in middleware mode and configure the app type as
  // 'custom', disabling Vite's own HTML serving logic so parent server
  // can take control
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  })

  // Use vite's connect instance as middleware. If you use your own
  // express router (express.Router()), you should use router.use
  app.use(vite.middlewares)

  const flightInfoCache = new Map<string, any>();
  app.use('/api/flightInfo', async (req, res) => {
    if (req.method === 'GET') {
      console.log("got request for /api/flightInfo", req.method, req.query);
      const apiKey = process.env.AVIATION_STACK_API_KEY;
      const {icao} = req.query;
      if (typeof icao !== 'string') {
          res.sendStatus(400);
          return;
      }
      const query = icao.toUpperCase();
      const getFlightData = async () => {
        if (flightInfoCache.has(query)) {
          const responseOrPending = flightInfoCache.get(query);

          const sleep = (ms: number) => {
            return new Promise(resolve => setTimeout(resolve, ms))
          }
          if (responseOrPending === 'pending') {
            await sleep(200);
            return await getFlightData();
          } else {
            console.log("returning cached request for query", query)
            return responseOrPending;
          }
        }
        flightInfoCache.set(query, 'pending');
        try {
          console.log("performing actual aviationstack request for query", query)
          const response = await fetch(`http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_icao=${query}`);
          const data = await response.json();
          flightInfoCache.set(query, data);
        } catch (e) {
          console.log("error querying for flight data", e.message);
          flightInfoCache.set(query, 'error')
        }
        return flightInfoCache.get(query);
      }

      const data = await getFlightData();
      res.setHeader('Content-Type', 'text/plain');
      res.send(JSON.stringify(data));
    }
  })

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl
    
    try{
        // 1. Read index.html
        let template = fs.readFileSync(
        path.resolve(__dirname, 'index.html'),
        'utf-8',
        )

        // 2. Apply Vite HTML transforms. This injects the Vite HMR client,
        //    and also applies HTML transforms from Vite plugins, e.g. global
        //    preambles from @vitejs/plugin-react
        template = await vite.transformIndexHtml(url, template)

        // 6. Send the original? HTML back.
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
    } catch (e) {
        next(e)
    }
  })
  setupWebsocketServer();
  console.log("server listening...")
  app.listen(5173)
}

createServer()