import test from "node:test";
import assert from "node:assert/strict";
import {
  Navigation,
  lineBlocked,
  collides,
  moveBody,
  sanitizeSettings,
  validSave,
} from "../src/core.js";
const wall = { minX: -1, maxX: 1, minZ: -8, maxZ: 8 };
test("navigation walks around a wall instead of through it", () => {
  const nav = new Navigation([wall]);
  const start = { x: -9, z: 1 },
    end = { x: 9, z: 1 },
    route = nav.path(start, end);
  assert.ok(route.length > 10);
  let last = start;
  for (const point of route) {
    assert.equal(collides(point.x, point.z, 0.52, [wall]), false);
    assert.equal(lineBlocked(last, point, [wall]), false);
    last = point;
  }
  assert.ok(Math.abs(last.x - end.x) < 2);
});
test("diagonal paths cannot cut through a closed corner", () => {
  const walls = [
    { minX: -1, maxX: 1, minZ: -62, maxZ: 62 },
    { minX: -62, maxX: 62, minZ: -1, maxZ: 1 },
  ];
  assert.deepEqual(
    new Navigation(walls).path({ x: -7, z: -7 }, { x: 7, z: 7 }),
    [],
  );
});
test("a fast movement cannot tunnel through a wall", () => {
  const p = { x: -5, z: 0 };
  moveBody(p, 30, 0, [wall]);
  assert.ok(p.x <= -1.37);
  assert.equal(collides(p.x, p.z, 0.38, [wall]), false);
});
test("line of sight respects walls in both directions and along parallel rays", () => {
  assert.equal(lineBlocked({ x: -4, z: 0 }, { x: 4, z: 0 }, [wall]), true);
  assert.equal(lineBlocked({ x: 4, z: 0 }, { x: -4, z: 0 }, [wall]), true);
  assert.equal(lineBlocked({ x: 3, z: -10 }, { x: 3, z: 10 }, [wall]), false);
});
test("settings and saves reject corrupt or impossible data", () => {
  const s = sanitizeSettings({
    quality: "ultra",
    music: 200,
    fov: Infinity,
    effects: "no",
  });
  assert.equal(s.music, 100);
  assert.equal(s.quality, "auto");
  assert.equal(s.fov, 78);
  assert.equal(s.effects, true);
  assert.equal(
    validSave({
      version: 2,
      player: { x: Infinity, z: 0, yaw: 0 },
      collected: [],
      difficulty: "normal",
    }),
    null,
  );
  const save = validSave({
    version: 2,
    player: { x: 0, z: 0, yaw: 0 },
    collected: [1, 1, 8, "2"],
    difficulty: "normal",
  });
  assert.deepEqual(save.collected, [1]);
  assert.equal(validSave(null), null);
});
