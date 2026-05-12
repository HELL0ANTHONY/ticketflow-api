import http from "node:http";

const port = Number(process.env["PORT"]) || 3000;

const server = http.createServer((_req, res) => {
  console.log("Request received");

  res.writeHead(200, {
    "Content-Type": "application/json",
  });

  res.end(JSON.stringify({ message: "API running" }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`API listening on port ${port}`);
});
