const childProcess = require("node:child_process");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const ROOT_DIR = __dirname;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".wasm": "application/wasm",
};
function argument(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
function getRequestedPort() {
  const p = Number(argument("--port", process.env.PORT || 5177));
  return Number.isInteger(p) && p > 0 && p <= 65535 ? p : 5177;
}
function resolveRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(requestUrl, "http://localhost").pathname,
    );
  } catch {
    return null;
  }
  if (pathname.includes("\0") || pathname.includes("\\")) return null;
  const relative =
    pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (relative.split("/").some((p) => p.startsWith("."))) return null;
  const filePath = path.resolve(ROOT_DIR, relative),
    back = path.relative(ROOT_DIR, filePath);
  return back.startsWith("..") || path.isAbsolute(back) ? null : filePath;
}
async function serveFile(request, response) {
  const filePath = resolveRequestPath(request.url);
  if (!filePath) {
    response.writeHead(400);
    response.end("Invalid path");
    return;
  }
  try {
    const stat = await fs.stat(filePath),
      finalPath = stat.isDirectory()
        ? path.join(filePath, "index.html")
        : filePath;
    const data =
      request.method === "HEAD" ? null : await fs.readFile(finalPath);
    response.writeHead(200, {
      "Content-Type":
        MIME_TYPES[path.extname(finalPath).toLowerCase()] ||
        "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(data);
  } catch (e) {
    response.writeHead(
      e.code === "ENOENT" || e.code === "ENOTDIR" ? 404 : 500,
      { "Content-Type": "text/plain; charset=utf-8" },
    );
    response.end(
      e.code === "ENOENT" || e.code === "ENOTDIR"
        ? "Not found"
        : "Server error",
    );
  }
}
function openBrowser(url) {
  const [command, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  const child = childProcess.spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", () => console.log(`Bitte im Browser öffnen: ${url}`));
  child.unref();
}
function startServer(port, options = {}) {
  const host =
    options.host || argument("--host", process.env.HOST || "127.0.0.1");
  const shouldOpen =
    options.openBrowser ??
    (!process.argv.includes("--no-open") && process.env.NO_OPEN !== "1");
  const server = http.createServer((req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end("Method not allowed");
      return;
    }
    void serveFile(req, res);
  });
  let attempts = 0;
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && attempts++ < 10 && port < 65535) {
      console.log(`Port ${port} belegt, versuche ${port + 1}.`);
      server.listen(++port, host);
    } else {
      console.error(`Server konnte nicht starten: ${error.message}`);
      process.exitCode = 1;
    }
  });
  server.on("listening", () => {
    const actualPort = server.address().port,
      url = `http://127.0.0.1:${actualPort}/`;
    console.log(`Horror Tree: ${url}`);
    if (host === "0.0.0.0")
      console.log(`Im WLAN: http://<IP dieses Computers>:${actualPort}/`);
    options.onReady?.({ server, url, port: actualPort });
    if (shouldOpen) openBrowser(url);
  });
  server.listen(port, host);
  return server;
}
if (require.main === module) startServer(getRequestedPort());
module.exports = { getRequestedPort, resolveRequestPath, startServer };
