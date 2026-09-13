const test = require("node:test"),
  assert = require("node:assert/strict"),
  http = require("node:http");
const { resolveRequestPath, startServer } = require("../server.js");
test("malformed and hidden paths fail without throwing", () => {
  assert.equal(resolveRequestPath("/%E0%A4%A"), null);
  assert.equal(resolveRequestPath("/.git/config"), null);
  assert.equal(resolveRequestPath("/%2e%2e%2fpackage.json"), null);
  assert.ok(resolveRequestPath("/src/main.js").endsWith("src/main.js"));
});
test("server handles invalid requests and serves module MIME types", async (t) => {
  let server;
  const info = await new Promise((resolve) => {
    server = startServer(0, { openBrowser: false, onReady: resolve });
  });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${info.port}`;
  assert.equal(
    (await fetch(base + "/src/main.js")).headers.get("content-type"),
    "text/javascript; charset=utf-8",
  );
  assert.equal((await fetch(base + "/%E0%A4%A")).status, 400);
  assert.equal((await fetch(base + "/missing")).status, 404);
  assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
  assert.equal((await fetch(base + "/")).status, 200);
});
test("occupied-port retry keeps the returned server object and reports the actual port", async (t) => {
  const blocker = http.createServer();
  await new Promise((resolve) => blocker.listen(0, "127.0.0.1", resolve));
  t.after(() => blocker.close());
  const port = blocker.address().port;
  let server;
  const info = await new Promise((resolve) => {
    server = startServer(port, { openBrowser: false, onReady: resolve });
  });
  t.after(() => server.close());
  assert.equal(server, info.server);
  assert.ok(info.port > port);
  assert.equal((await fetch(info.url)).status, 200);
});
