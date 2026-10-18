// Minimal OpenAI-compatible transcription mock for wiring tests.
// POST /v1/audio/transcriptions (Bearer auth, multipart file) -> { text }
import http from "node:http";

const PORT = Number(process.env.MOCK_STT_PORT || 4545);
const server = http.createServer((req, res) => {
  if (req.method === "POST" && (req.url || "").includes("/audio/transcriptions")) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "missing bearer" } }));
      return;
    }
    let size = 0;
    req.on("data", (c) => (size += c.length));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          text: "mock transcript from custom provider endpoint wiring verified",
          received_bytes: size,
        }),
      );
    });
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});
server.listen(PORT, "127.0.0.1", () => console.log(`mock-stt listening on ${PORT}`));
