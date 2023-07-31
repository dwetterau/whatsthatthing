import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        host: "0.0.0.0",
        open: "/index.html",
    },
    resolve: {
        // https://medium.com/@ftaioli/using-node-js-builtin-modules-with-vite-6194737c2cd2
        alias: {
            http: "rollup-plugin-node-polyfills/polyfills/http",
            https: "rollup-plugin-node-polyfills/polyfills/http",
        },
    },
    plugins: [
        react(),
        NodeGlobalsPolyfillPlugin({ process: true, buffer: true }),
        NodeModulesPolyfillPlugin(),
    ],
});
