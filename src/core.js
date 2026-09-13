export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function random(seed = 7142026) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const DEFAULTS = Object.freeze({
  quality: "auto",
  difficulty: "normal",
  music: 40,
  sound: 65,
  sensitivity: 85,
  fov: 78,
  jumpscares: true,
  effects: true,
  touch: false,
});
export function sanitizeSettings(raw = {}) {
  raw = raw && typeof raw === "object" ? raw : {};
  const out = { ...DEFAULTS };
  for (const k of ["quality", "difficulty"])
    if (
      (k === "quality"
        ? ["auto", "low", "medium", "high"]
        : ["normal", "hard", "explore"]
      ).includes(raw[k])
    )
      out[k] = raw[k];
  for (const [k, lo, hi] of [
    ["music", 0, 100],
    ["sound", 0, 100],
    ["sensitivity", 20, 180],
    ["fov", 60, 100],
  ])
    if (Number.isFinite(raw[k])) out[k] = clamp(raw[k], lo, hi);
  for (const k of ["jumpscares", "effects", "touch"])
    if (typeof raw[k] === "boolean") out[k] = raw[k];
  return out;
}
export const MEMORY_POSITIONS = Object.freeze([
  {
    id: 0,
    x: 0,
    z: 16,
    name: "Die erste Glut",
    text: "Du erinnerst dich an Wärme.\nAber nicht an dieses Feuer.",
  },
  {
    id: 1,
    x: -31,
    z: 0,
    name: "Das Fenster",
    text: "Hinter jedem Fenster liegt derselbe Himmel.",
  },
  {
    id: 2,
    x: 33,
    z: -13,
    name: "Der letzte Badetag",
    text: "Das Wasser ist warm.\nHier war seit Jahren niemand.",
  },
  {
    id: 3,
    x: -33,
    z: -33,
    name: "Der vergessene Garten",
    text: "Jemand hat die Schaukel angestoßen.",
  },
  {
    id: 4,
    x: 10,
    z: -47,
    name: "Die Uhr ohne Zeit",
    text: "Alle Uhren stehen still.\nNur deine Schritte gehen weiter.",
  },
]);
export const PORTAL = Object.freeze({ x: 0, z: -30 });
export const SPAWN = Object.freeze({ x: 0, z: 27 });
export function validSave(raw) {
  if (
    !raw ||
    raw.version !== 2 ||
    !Array.isArray(raw.collected) ||
    !raw.player ||
    !["normal", "hard", "explore"].includes(raw.difficulty)
  )
    return null;
  if (
    ![raw.player.x, raw.player.z, raw.player.yaw].every(Number.isFinite) ||
    Math.abs(raw.player.x) > 62 ||
    Math.abs(raw.player.z) > 62
  )
    return null;
  return {
    version: 2,
    player: { x: raw.player.x, z: raw.player.z, yaw: raw.player.yaw },
    collected: [
      ...new Set(
        raw.collected.filter((id) => Number.isInteger(id) && id >= 0 && id < 5),
      ),
    ],
    difficulty: raw.difficulty,
    time: Number.isFinite(raw.time) ? clamp(raw.time, 0, 1e7) : 0,
  };
}
export function readStorage(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key, value) {
  try {
    value === null
      ? localStorage.removeItem(key)
      : localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function collides(x, z, r, obstacles) {
  if (x - r < -62 || x + r > 62 || z - r < -62 || z + r > 62) return true;
  return obstacles.some(
    (b) =>
      Math.hypot(x - clamp(x, b.minX, b.maxX), z - clamp(z, b.minZ, b.maxZ)) <
      r,
  );
}
export function moveBody(body, dx, dz, obstacles, radius = 0.38) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.22));
  for (let i = 0; i < steps; i++) {
    if (!collides(body.x + dx / steps, body.z, radius, obstacles))
      body.x += dx / steps;
    if (!collides(body.x, body.z + dz / steps, radius, obstacles))
      body.z += dz / steps;
  }
}
export function lineBlocked(a, b, obstacles) {
  return obstacles.some((o) => {
    let lo = 0,
      hi = 1;
    for (const [p, d, mn, mx] of [
      [a.x, b.x - a.x, o.minX, o.maxX],
      [a.z, b.z - a.z, o.minZ, o.maxZ],
    ]) {
      if (Math.abs(d) < 1e-8) {
        if (p < mn || p > mx) return false;
      } else {
        let t1 = (mn - p) / d,
          t2 = (mx - p) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        lo = Math.max(lo, t1);
        hi = Math.min(hi, t2);
        if (lo > hi) return false;
      }
    }
    return hi >= 0 && lo <= 1;
  });
}
class MinHeap {
  constructor() {
    this.items = [];
  }
  push(v) {
    const a = this.items;
    a.push(v);
    let i = a.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (a[p].f <= v.f) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = v;
  }
  pop() {
    const a = this.items,
      top = a[0],
      last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1].f < a[c].f) c++;
        if (a[c].f >= last.f) break;
        a[i] = a[c];
        i = c;
      }
      a[i] = last;
    }
    return top;
  }
}
export class Navigation {
  constructor(obstacles, cell = 2) {
    this.obstacles = obstacles;
    this.cell = cell;
    this.n = 64;
    this.blocked = new Uint8Array(this.n * this.n);
    for (let z = 0; z < this.n; z++)
      for (let x = 0; x < this.n; x++) {
        const p = this.point(z * this.n + x);
        this.blocked[z * this.n + x] = collides(p.x, p.z, 0.68, obstacles)
          ? 1
          : 0;
      }
  }
  point(i) {
    return {
      x: (i % this.n) * this.cell - 64 + this.cell / 2,
      z: Math.floor(i / this.n) * this.cell - 64 + this.cell / 2,
    };
  }
  index(p) {
    return (
      clamp(Math.floor((p.z + 64) / this.cell), 0, this.n - 1) * this.n +
      clamp(Math.floor((p.x + 64) / this.cell), 0, this.n - 1)
    );
  }
  nearest(p) {
    let i = this.index(p);
    if (!this.blocked[i]) return i;
    const x = i % this.n,
      z = Math.floor(i / this.n);
    for (let r = 1; r < 8; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const nx = x + dx,
            nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= this.n || nz >= this.n) continue;
          i = nz * this.n + nx;
          if (!this.blocked[i]) return i;
        }
    return -1;
  }
  path(a, b) {
    const start = this.nearest(a),
      end = this.nearest(b);
    if (start < 0 || end < 0) return [];
    if (start === end) return [this.point(end)];
    const n = this.n,
      goal = this.point(end),
      cost = new Float64Array(n * n).fill(Infinity),
      parent = new Int32Array(n * n).fill(-1),
      closed = new Uint8Array(n * n),
      heap = new MinHeap();
    cost[start] = 0;
    heap.push({ i: start, f: 0 });
    while (heap.items.length) {
      const { i } = heap.pop();
      if (closed[i]) continue;
      if (i === end) {
        const path = [];
        for (let k = end; k !== start; k = parent[k]) path.push(this.point(k));
        return path.reverse();
      }
      closed[i] = 1;
      const x = i % n,
        z = Math.floor(i / n);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        const nx = x + dx,
          nz = z + dz,
          j = nz * n + nx;
        if (
          nx < 0 ||
          nz < 0 ||
          nx >= n ||
          nz >= n ||
          this.blocked[j] ||
          closed[j]
        )
          continue;
        if (dx && dz && (this.blocked[z * n + nx] || this.blocked[nz * n + x]))
          continue;
        if (lineBlocked(this.point(i), this.point(j), this.obstacles)) continue;
        const g = cost[i] + (dx && dz ? 1.4142 : 1);
        if (g >= cost[j]) continue;
        cost[j] = g;
        parent[j] = i;
        const p = this.point(j);
        heap.push({
          i: j,
          f: g + Math.hypot(p.x - goal.x, p.z - goal.z) / this.cell,
        });
      }
    }
    return [];
  }
}
