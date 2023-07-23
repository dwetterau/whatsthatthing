import fs from 'fs';
import path from 'path'
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

  app.listen(5173)
}

createServer()