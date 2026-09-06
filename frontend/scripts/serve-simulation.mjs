// Disable filesystem watching for repeatable browser runs on synchronized folders.
import { createServer } from "vite";
import config from "../vite.config.ts";

const server = await createServer({
  ...config({ mode: "development", command: "serve" }),
  configFile: false,
  server: { host: "127.0.0.1", port: 5175, strictPort: true, watch: null },
});
await server.listen();
server.printUrls();
