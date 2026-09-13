const childProcess = require("node:child_process");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const ROOT_DIR = __dirname;
const DEFAULT_PORT = Number(process.env.PORT || 5177);
const HOST = "127.0.0.1";
const OPEN_BROWSER = !process.argv.includes("--no-open") && process.env.NO_OPEN !== "1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".wasm": "application/wasm",
  ".3ds": "application/octet-stream",
  ".blend": "application/octet-stream",
  ".zip": "application/zip",
};

function getRequestedPort() {
  const portFlagIndex = process.argv.indexOf("--port");
  if (portFlagIndex >= 0) {
    const value = Number(process.argv[portFlagIndex + 1]);
    if (Number.isInteger(value) && value > 0) return value;
  }
  return DEFAULT_PORT;
}

function resolveRequestPath(requestUrl) {
  const parsed = new URL(requestUrl, `http://${HOST}`);
  const decodedPath = decodeURIComponent(parsed.pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT_DIR, relativePath);
  const relativeToRoot = path.relative(ROOT_DIR, filePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return filePath;
}

async function serveFile(request, response) {
  const filePath = resolveRequestPath(request.url);
  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const data = request.method === "HEAD" ? null : await fs.readFile(finalPath);
    const extension = path.extname(finalPath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=3600",
    });
    response.end(data);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500, {
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end(error.code === "ENOENT" ? "Not found" : "Server error");
  }
}

function openBrowser(url) {
  if (!OPEN_BROWSER) return;

  const child = childProcess.spawn("cmd", ["/c", "start", "", url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function startServer(port, options = {}) {
  const shouldOpenBrowser = options.openBrowser ?? OPEN_BROWSER;
  const server = http.createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    serveFile(request, response);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && port < 65535) {
      startServer(port + 1, options);
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });

  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}/?autostart=1`;
    console.log(`Horror Tree laeuft auf ${url}`);
    console.log("Zum Beenden dieses Fensters Strg+C druecken.");
    if (typeof options.onReady === "function") {
      options.onReady({ server, url, port });
    }
    if (shouldOpenBrowser) openBrowser(url);
  });

  return server;
}

if (require.main === module) {
  startServer(getRequestedPort());
}

module.exports = {
  getRequestedPort,
  startServer,
};
