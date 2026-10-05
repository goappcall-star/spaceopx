import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "node:path";
const server = await createServer({
  configFile: false,
  plugins: [react(), tailwind()],
  resolve: { alias: { "@": path.resolve("src") } },
  server: { host: "127.0.0.1", port: 5183, strictPort: true },
});
await server.listen();
console.log("Menu harness: http://127.0.0.1:5183/tests/sidebar/index.html");
