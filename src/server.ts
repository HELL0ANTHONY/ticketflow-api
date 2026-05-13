import http from "node:http";

import { env } from "./config/env.js";

const server = http.createServer((_req, res) => {
  console.log("Request received");

  res.writeHead(200, {
    "Content-Type": "application/json",
  });

  res.end(JSON.stringify({ message: "API running" }));
});

server.listen(env.port, "0.0.0.0", () => {
  console.log(`API listening on port ${env.port}`);
});
