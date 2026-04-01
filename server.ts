/**
 * server.ts — Custom Express server wrapping Next.js
 * Run this on Railway instead of Vercel for always-on performance
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  }).listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
    console.log(`> Environment: ${process.env.NODE_ENV}`);
  });
});
