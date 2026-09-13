// A small server for checking the exact static export, including project subpaths.
const http = require("node:http"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const root = path.resolve(__dirname, "../www");
http
  .createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      p = p.replace(/^\/horror-tree\//, "/");
      if (p === "/" || p === "/horror-tree") p = "/index.html";
      const dest = path.resolve(root, "." + p);
      if (!dest.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await fs.readFile(dest);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".mp3": "audio/mpeg",
          ".svg": "image/svg+xml",
          ".json": "application/json",
        }[path.extname(dest)] || "application/octet-stream",
      );
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(5178, "127.0.0.1", () =>
    console.log("Static export: http://127.0.0.1:5178/horror-tree/"),
  );
