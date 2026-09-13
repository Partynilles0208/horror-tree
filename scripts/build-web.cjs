const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "www");
async function build() {
  await fs.access(path.join(root, "node_modules/three/build/three.module.js"));
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });
  const html = (
    await fs.readFile(path.join(root, "index.html"), "utf8")
  ).replaceAll("./node_modules/three/", "./vendor/three/");
  await fs.writeFile(path.join(out, "index.html"), html);
  for (const file of ["styles.css", "icon.svg", "src"])
    await fs.cp(path.join(root, file), path.join(out, file), {
      recursive: true,
    });
  for (const file of await fs.readdir(root))
    if (file.endsWith(".mp3"))
      await fs.copyFile(path.join(root, file), path.join(out, file));
  for (const file of ["build", "examples/jsm", "LICENSE"])
    await fs.cp(
      path.join(root, "node_modules/three", file),
      path.join(out, "vendor/three", file),
      { recursive: true },
    );
  console.log(
    "Web-Build fertig: www/ — enthält Engine, Spiel und Audio ohne CDN-Abhängigkeit.",
  );
}
build().catch((e) => {
  console.error("Build fehlgeschlagen. Zuerst npm ci ausführen.", e.message);
  process.exitCode = 1;
});
