import * as THREE from "three";
import { distance, lineBlocked, moveBody, random, clamp } from "./core.js";
const specs = [
  {
    name: "Der Hüter",
    type: "keeper",
    x: -20,
    z: -17,
    speed: 2.7,
    vision: 23,
    hearing: 15,
  },
  {
    name: "Der Fadengänger",
    type: "spider",
    x: 40,
    z: -28,
    speed: 3.5,
    vision: 12,
    hearing: 30,
  },
  {
    name: "Der Beobachter",
    type: "watcher",
    x: -28,
    z: -42,
    speed: 4.7,
    vision: 28,
    hearing: 8,
  },
];
function model(type) {
  const root = new THREE.Group(),
    limbs = [];
  const skin = new THREE.MeshStandardMaterial({
    color: type === "spider" ? "#24292e" : "#182728",
    roughness: 0.96,
  });
  const eyes = new THREE.MeshBasicMaterial({
    color: type === "spider" ? "#d9c5ad" : "#d5f7d4",
  });
  function mesh(geometry, material, x, y, z, parent = root) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  if (type === "spider") {
    const body = mesh(new THREE.SphereGeometry(0.65, 14, 10), skin, 0, 0.82, 0);
    body.scale.set(1, 0.65, 1.2);
    mesh(new THREE.SphereGeometry(0.32, 14, 10), skin, 0, 0.75, 0.65);
    for (const x of [-0.14, 0.14])
      mesh(new THREE.SphereGeometry(0.055, 8, 6), eyes, x, 0.85, 0.93);
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1,
        k = i % 4;
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.35, 0.8, (k - 1.5) * 0.32);
      root.add(pivot);
      const upper = mesh(
        new THREE.CylinderGeometry(0.028, 0.065, 1.1, 5),
        skin,
        side * 0.45,
        0.3,
        0,
        pivot,
      );
      upper.rotation.z = -side * 0.85;
      const lower = mesh(
        new THREE.CylinderGeometry(0.018, 0.035, 1.2, 5),
        skin,
        side * 0.9,
        0.02,
        0,
        pivot,
      );
      lower.rotation.z = side * 0.3;
      limbs.push({ mesh: pivot, phase: (k * Math.PI) / 2 + side });
    }
  } else {
    const height = type === "watcher" ? 3.8 : 3.2;
    mesh(
      new THREE.CylinderGeometry(0.26, 0.48, height * 0.44, 8),
      skin,
      0,
      height * 0.55,
      0,
    );
    const head = mesh(
      new THREE.SphereGeometry(0.35, 14, 12),
      skin,
      0,
      height * 0.9,
      0,
    );
    head.scale.set(0.8, 1.4, 0.75);
    for (const x of [-0.105, 0.105]) {
      const e = mesh(
        new THREE.SphereGeometry(0.047, 8, 8),
        eyes,
        x,
        height * 0.91,
        0.24,
      );
      e.scale.x = 1.5;
    }
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.22, height * 0.34, 0);
      root.add(leg);
      mesh(
        new THREE.CylinderGeometry(0.09, 0.06, height * 0.34, 6),
        skin,
        0,
        -height * 0.17,
        0,
        leg,
      );
      limbs.push({ mesh: leg, phase: side < 0 ? 0 : Math.PI });
      const arm = new THREE.Group();
      arm.position.set(side * 0.35, height * 0.72, 0);
      root.add(arm);
      mesh(
        new THREE.CylinderGeometry(0.075, 0.04, height * 0.49, 6),
        skin,
        side * 0.08,
        -height * 0.24,
        0,
        arm,
      );
      limbs.push({ mesh: arm, phase: side < 0 ? Math.PI : 0 });
    }
    if (type === "keeper")
      for (const side of [-1, 1]) {
        const branch = mesh(
          new THREE.CylinderGeometry(0.015, 0.075, 1.5, 5),
          skin,
          side * 0.44,
          height + 0.2,
          0,
        );
        branch.rotation.z = -side * 0.7;
      }
  }
  root.userData.limbs = limbs;
  return root;
}
export class Monsters {
  constructor(scene, navigation) {
    this.scene = scene;
    this.nav = navigation;
    this.rng = random(808);
    this.enemies = specs.map((s, i) => {
      const mesh = model(s.type);
      scene.add(mesh);
      return {
        ...s,
        index: i,
        mesh,
        path: [],
        state: "patrol",
        target: { x: s.x, z: s.z },
        timer: 0,
        repath: 0,
        yaw: 0,
        phase: i * 3,
      };
    });
    this.reset("normal");
  }
  reset(difficulty) {
    this.difficulty = difficulty;
    this.enemies.forEach((e, i) => {
      const s = specs[i],
        spawn = this.nav.point(this.nav.nearest(s));
      Object.assign(e, {
        x: spawn.x,
        z: spawn.z,
        state: "patrol",
        target: this.pickPatrol(e),
        timer: 0,
        repath: 0,
        path: [],
        yaw: 0,
      });
      e.mesh.visible = difficulty !== "explore";
      e.mesh.position.set(e.x, 0, e.z);
    });
  }
  pickPatrol(e) {
    const anchor = specs[e.index];
    for (let i = 0; i < 12; i++) {
      const p = {
        x: clamp(anchor.x + (this.rng() - 0.5) * 38, -56, 56),
        z: clamp(anchor.z + (this.rng() - 0.5) * 32, -56, 56),
      };
      const idx = this.nav.nearest(p);
      if (idx >= 0) return this.nav.point(idx);
    }
    return { ...anchor };
  }
  investigate(point) {
    if (this.difficulty === "explore") return;
    for (const e of this.enemies)
      if (distance(e, point) < 38) {
        e.state = "investigate";
        e.target = { x: point.x, z: point.z };
        e.timer = 8;
        e.repath = 0;
      }
  }
  update(
    dt,
    time,
    player,
    { noise = 0, light = false, collected = 0, grace = false } = {},
  ) {
    if (this.difficulty === "explore")
      return { threat: 0, caught: null, state: "quiet", name: "" };
    let threat = 0,
      caught = null,
      state = "quiet",
      name = "";
    for (const e of this.enemies) {
      const d = distance(e, player),
        blocked = lineBlocked(e, player, this.nav.obstacles);
      const dx = (player.x - e.x) / (d || 1),
        dz = (player.z - e.z) / (d || 1);
      const facing = dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw);
      const range =
        e.vision * (player.crouching ? 0.65 : 1) * (light ? 1.2 : 1);
      const sees =
        !grace &&
        !blocked &&
        d < range &&
        (facing > -0.1 || d < 5 || e.type === "watcher");
      const hears =
        !grace && noise > 0 && d < e.hearing * noise * (blocked ? 0.45 : 1);
      if (sees) {
        e.state = "chase";
        e.target = { x: player.x, z: player.z };
        e.timer = 6;
      } else if (hears) {
        e.state = "investigate";
        e.target = { x: player.x, z: player.z };
        e.timer = 6;
      } else if (e.state !== "patrol") {
        e.timer -= dt;
        if (e.timer <= 0) {
          e.state = "patrol";
          e.target = this.pickPatrol(e);
          e.repath = 0;
        }
      }
      const playerDot =
        (-Math.sin(player.yaw) * (e.x - player.x) -
          Math.cos(player.yaw) * (e.z - player.z)) /
        (d || 1);
      const frozen =
        e.type === "watcher" &&
        !blocked &&
        d < 34 &&
        playerDot > Math.cos((player.fov * Math.PI) / 360 + 0.1);
      if (distance(e, e.target) < 1.4) {
        if (e.state === "chase" && !sees) {
          e.state = "search";
          e.timer = 4;
        } else if (e.state === "patrol") {
          e.target = this.pickPatrol(e);
          e.repath = 0;
        } else if (e.state === "investigate") {
          e.state = "search";
          e.timer = 4;
        }
      }
      e.repath -= dt;
      if (e.repath <= 0 && !frozen) {
        e.path = this.nav.path(e, e.target);
        e.repath = 0.8 + e.index * 0.15;
      }
      const walking = !frozen && e.state !== "search" && e.path.length > 0;
      if (walking) {
        while (e.path.length && distance(e, e.path[0]) < 0.55) e.path.shift();
        const dest = e.path[0];
        if (dest) {
          const len = distance(e, dest),
            hard = this.difficulty === "hard" ? 1.2 : 1;
          const speed =
            (e.state === "patrol" ? 1.15 : e.speed + collected * 0.1) * hard;
          const step = Math.min(len, speed * dt);
          e.yaw = Math.atan2(dest.x - e.x, dest.z - e.z);
          moveBody(
            e,
            ((dest.x - e.x) / (len || 1)) * step,
            ((dest.z - e.z) / (len || 1)) * step,
            this.nav.obstacles,
            0.52,
          );
        }
      }
      if (e.state === "search") e.yaw += dt * 0.55;
      e.mesh.position.set(
        e.x,
        e.type === "watcher" ? Math.sin(time * 2) * 0.045 : 0,
        e.z,
      );
      e.mesh.rotation.y = e.yaw;
      for (const l of e.mesh.userData.limbs) {
        if (e.type === "spider")
          l.mesh.rotation.y = walking ? Math.sin(time * 9 + l.phase) * 0.35 : 0;
        else
          l.mesh.rotation.x = walking
            ? Math.sin(time * (e.state === "patrol" ? 3 : 6) + l.phase) * 0.32
            : 0;
      }
      const t = grace
        ? 0
        : Math.max(0, 1 - d / 23) *
          (blocked ? 0.3 : 1) *
          (e.state === "chase" ? 1 : 0.55);
      if (t > threat) {
        threat = t;
        state = frozen ? "watching" : e.state;
        name = e.name;
      }
      if (!grace && d < 1.1 && !blocked && !frozen) caught = e.name;
    }
    return { threat, caught, state, name };
  }
}
