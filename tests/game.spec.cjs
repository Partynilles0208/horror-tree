const { test, expect } = require("@playwright/test");
async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("./?test=1");
  await expect(page.locator("#menu")).toBeVisible({ timeout: 45000 });
  return errors;
}
async function start(page) {
  await page.locator("#start").click();
  await expect(page.locator("#hud")).toBeVisible();
}
async function release(page) {
  await page.evaluate(() => document.exitPointerLock?.());
}
test("desktop: menu, movement, flashlight, pause, settings, saving, all objectives and win", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.screenshot({ path: "test-results/menu-desktop.png" });
  await start(page);
  const before = await page.evaluate(() => window.__dreamcore.state.player.z);
  await page.keyboard.down("w");
  await page.waitForTimeout(600);
  await page.keyboard.up("w");
  expect(
    await page.evaluate(() => window.__dreamcore.state.player.z),
  ).toBeLessThan(before - 0.2);
  await page.keyboard.press("f");
  await expect(page.locator("#lamp-label")).toHaveText("LICHT LÄDT");
  await page.keyboard.press("p");
  await expect(page.locator("#pause")).toBeVisible();
  const time = await page.evaluate(() => window.__dreamcore.state.playingTime);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__dreamcore.state.playingTime)).toBe(
    time,
  );
  await page.locator('#pause [data-panel="settings"]').click();
  await page.locator('[name="quality"]').selectOption("low");
  await page.locator("#settings .primary").click();
  await page.locator("#resume").click();
  await page.evaluate(() => window.__dreamcore.teleport(0, 17.8));
  await page.keyboard.press("e");
  await expect(page.locator("#objective")).toContainText("1 / 5");
  await page.screenshot({ path: "test-results/gameplay-forest.png" });
  await page.keyboard.press("p");
  await page.locator("#exit-menu").click();
  await expect(page.locator("#continue")).toBeVisible();
  await page.reload();
  await expect(page.locator("#continue")).toBeVisible();
  await page.locator("#continue").click();
  expect(
    await page.evaluate(() => window.__dreamcore.state.collected.length),
  ).toBe(1);
  for (const [x, z] of [
    [-31, 1.8],
    [33, -11.2],
    [-33, -31.2],
    [10, -45.2],
  ]) {
    await page.evaluate(([x, z]) => window.__dreamcore.teleport(x, z), [x, z]);
    await page.keyboard.press("e");
  }
  await expect(page.locator("#objective")).toContainText("Erinnerungsbaum");
  await page.evaluate(() => window.__dreamcore.teleport(0, -28.2));
  await page.keyboard.press("e");
  await expect(page.locator("#result-title")).toHaveText("Du bist aufgewacht.");
  expect(
    await page.evaluate(() => localStorage.getItem("horror-tree-save-v2")),
  ).toBeNull();
  expect(errors).toEqual([]);
});
test("world navigation reaches every objective and monster variants respond to sight, noise and obstacles", async ({
  page,
}) => {
  const errors = await boot(page);
  await start(page);
  const results = await page.evaluate(() => {
    const d = window.__dreamcore;
    const points = d.world.memories.map((m) => ({ x: m.x, z: m.z }));
    const reachable = points.map(
      (p) => d.nav.path({ x: 0, z: 27 }, p).length > 0,
    );
    const ms = d.monsters;
    const watcher = ms.enemies[2];
    Object.assign(watcher, {
      x: 0,
      z: 4,
      state: "chase",
      target: { x: 0, z: 10 },
      repath: 0,
    });
    const player = { x: 0, z: 10, yaw: 0, fov: 78, crouching: false };
    const old = watcher.z;
    ms.update(0.1, 20, player, { grace: false });
    const frozen = watcher.z === old;
    player.yaw = Math.PI;
    for (let i = 0; i < 6; i++)
      ms.update(0.1, 20 + i * 0.1, player, { grace: false });
    const moved = watcher.z !== old;
    ms.investigate({ x: 5, z: 5 });
    const heard = ms.enemies.some((e) => e.state === "investigate");
    return { reachable, frozen, moved, heard };
  });
  expect(results.reachable).toEqual([true, true, true, true, true]);
  expect(results.frozen).toBe(true);
  expect(results.moved).toBe(true);
  expect(results.heard).toBe(true);
  expect(errors).toEqual([]);
});
test("jumpscare, disabled jumpscares, restart and exploration mode", async ({
  page,
}) => {
  const errors = await boot(page);
  await start(page);
  await page.evaluate(() => window.__dreamcore.finish(false, "Der Hüter"));
  await expect(page.locator("#scare")).toBeVisible();
  await expect(page.locator("#scare")).toBeHidden({ timeout: 10000 });
  await page.locator("#result-menu").click();
  await page.locator('#menu [data-panel="settings"]').click();
  await page.locator('[name="jumpscares"]').uncheck();
  await page.locator('[name="difficulty"]').selectOption("explore");
  await page.locator("#settings .primary").click();
  await start(page);
  expect(await page.evaluate(() => window.__dreamcore.state.difficulty)).toBe(
    "explore",
  );
  expect(
    await page.evaluate(() =>
      window.__dreamcore.monsters.enemies.every((e) => !e.mesh.visible),
    ),
  ).toBe(true);
  await page.evaluate(() => window.__dreamcore.finish(false, "Der Hüter"));
  await expect(page.locator("#scare")).toBeHidden();
  await page.locator("#retry").click();
  await expect(page.locator("#hud")).toBeVisible();
  expect(
    await page.evaluate(() => window.__dreamcore.state.collected.length),
  ).toBe(0);
  expect(errors).toEqual([]);
});
test("touch: independent movement and look pointers, action buttons and viewport rotation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = await boot(page);
  await page.screenshot({ path: "test-results/menu-mobile.png" });
  await start(page);
  await expect(page.locator("#touch-controls")).toBeVisible();
  await page.evaluate(() => {
    const s = document.getElementById("move-stick"),
      l = document.getElementById("look-zone"),
      r = s.getBoundingClientRect(),
      p = l.getBoundingClientRect();
    const send = (el, type, id, x, y) =>
      el.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          pointerType: "touch",
          clientX: x,
          clientY: y,
          bubbles: true,
        }),
      );
    const oldCapture = Element.prototype.setPointerCapture;
    Element.prototype.setPointerCapture = function () {};
    send(s, "pointerdown", 11, r.x + 55, r.y + 10);
    send(l, "pointerdown", 12, p.x + 30, p.y + 40);
    send(l, "pointermove", 12, p.x + 100, p.y + 40);
    Element.prototype.setPointerCapture = oldCapture;
  });
  const z = await page.evaluate(() => window.__dreamcore.state.player.z);
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => window.__dreamcore.state);
  expect(state.player.z).toBeLessThan(z);
  expect(Math.abs(state.player.yaw)).toBeGreaterThan(0.05);
  await page.evaluate(() =>
    document
      .getElementById("move-stick")
      .dispatchEvent(
        new PointerEvent("pointercancel", { pointerId: 11, bubbles: true }),
      ),
  );
  await page.locator("#touch-light").tap();
  await expect(page.locator("#lamp-label")).toHaveText("LICHT LÄDT");
  await page.locator("#pause-button").tap();
  await expect(page.locator("#pause")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/pause-mobile-portrait.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
  expect(errors).toEqual([]);
});
