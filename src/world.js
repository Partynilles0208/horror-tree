import * as THREE from "three";
import { random, MEMORY_POSITIONS, PORTAL, distance } from "./core.js";
const UP = new THREE.Vector3(0, 1, 0);
export function buildWorld(scene) {
  const rng = random(31337),
    obstacles = [],
    memories = [],
    animated = [],
    lanterns = [];
  const group = new THREE.Group();
  scene.add(group);
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const stone = mat("#b9c9bf"),
    dark = mat("#1f3030"),
    wood = mat("#28322e"),
    pink = mat("#c99fac"),
    mint = mat("#9ec1af");
  function box(x, y, z, w, h, d, material, solid = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    if (solid)
      obstacles.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
      });
    return m;
  }
  function sphere(x, y, z, r, material) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }
  function segment(a, b, r1, r2, material, parent = group) {
    const av = new THREE.Vector3(...a),
      bv = new THREE.Vector3(...b),
      diff = bv.clone().sub(av);
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r2, r1, diff.length(), 7),
      material,
    );
    m.position.copy(av).add(bv).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, diff.normalize());
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function texture(type) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (type === "tile") {
      ctx.fillStyle = "#b5c4ba";
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          ctx.fillStyle = (x + y) % 2 ? "#c8d3c6" : "#657f78";
          ctx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
        }
      for (let i = 0; i < 3000; i++) {
        ctx.fillStyle = `rgba(35,55,43,${rng() * 0.1})`;
        ctx.fillRect(rng() * 256, rng() * 256, 2, 2);
      }
    } else {
      ctx.fillStyle = "#354b3c";
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 12000; i++) {
        ctx.fillStyle = `rgba(${rng() < 0.5 ? "111,139,89" : "15,39,32"},${rng() * 0.3})`;
        ctx.fillRect(rng() * 256, rng() * 256, 1 + rng() * 3, 1 + rng() * 5);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const groundTex = texture("grass");
  groundTex.repeat.set(38, 38);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    mat("#8e9b7d", { map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const pathMat = mat("#a2a893", { roughness: 1 });
  box(0, 0.011, 3, 5, 0.025, 64, pathMat);
  box(-17, 0.012, 0, 36, 0.025, 3.5, pathMat);
  box(18, 0.013, -13, 39, 0.025, 3.5, pathMat);
  box(-30, 0.012, -17, 3.8, 0.025, 35, pathMat);
  box(4, 0.01, -43, 3, 0.02, 29, pathMat);
  // A twilight gradient and soft cloud banks, independent of external textures.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 32, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color("#485d85") },
        bottom: { value: new THREE.Color("#bcc4c1") },
      },
      vertexShader:
        "varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader:
        "varying vec3 vPosition;uniform vec3 top;uniform vec3 bottom;void main(){float h=normalize(vPosition).y;vec3 color=mix(bottom,top,smoothstep(-.06,.8,h));gl_FragColor=vec4(color,1.0);}",
    }),
  );
  scene.add(sky);
  const cloudMat = new THREE.MeshBasicMaterial({
    color: "#c7c7cf",
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    fog: false,
  });
  const clouds = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 20, 12),
    cloudMat,
    70,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 70; i++) {
    const angle = rng() * Math.PI * 2,
      rad = 180 + rng() * 90;
    dummy.position.set(
      Math.sin(angle) * rad,
      30 + rng() * 45,
      Math.cos(angle) * rad,
    );
    dummy.scale.set(15 + rng() * 24, 3 + rng() * 6, 7 + rng() * 15);
    dummy.updateMatrix();
    clouds.setMatrixAt(i, dummy.matrix);
  }
  scene.add(clouds);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(11, 32, 24),
    new THREE.MeshBasicMaterial({ color: "#e0e4cf", fog: false }),
  );
  moon.position.set(60, 75, -210);
  scene.add(moon);
  // The forest uses three instanced draw calls instead of one mesh per tree.
  const trees = [];
  for (let i = 0; i < 310; i++) {
    const x = (rng() - 0.5) * 174,
      z = (rng() - 0.5) * 174;
    const central = Math.abs(x) < 7 && z < 35 && z > -54;
    const pool = x > 16 && x < 53 && z > -39 && z < 0;
    const garden = x > -45 && x < -20 && z > -45 && z < 7;
    const eastPath = z > -17 && z < -9 && x > 0 && x < 52;
    if (
      central ||
      pool ||
      garden ||
      eastPath ||
      (x > 14 && x < 25 && z > 10 && z < 29) ||
      (Math.abs(z) < 4 && x > -37 && x < 4) ||
      MEMORY_POSITIONS.some((p) => Math.hypot(x - p.x, z - p.z) < 5)
    )
      continue;
    trees.push({ x, z, h: 7 + rng() * 9, r: 0.28 + rng() * 0.5 });
  }
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.6, 1, 1, 7),
    wood,
    trees.length,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 2),
    mat("#37564a"),
    trees.length * 2,
  );
  trunks.castShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  trees.forEach((t, i) => {
    dummy.position.set(t.x, t.h / 2, t.z);
    dummy.scale.set(t.r, t.h, t.r);
    dummy.rotation.set(0, rng() * 6.28, 0.04);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    if (Math.abs(t.x) < 61 && Math.abs(t.z) < 61)
      obstacles.push({
        minX: t.x - t.r,
        maxX: t.x + t.r,
        minZ: t.z - t.r,
        maxZ: t.z + t.r,
      });
    for (let j = 0; j < 2; j++) {
      dummy.position.set(t.x + (j - 0.5) * 1.8, t.h - 1 + j * 1.3, t.z);
      dummy.scale.set(1.8 + rng(), 1.5 + rng(), 1.8 + rng());
      dummy.rotation.set(rng(), rng(), rng());
      dummy.updateMatrix();
      crowns.setMatrixAt(i * 2 + j, dummy.matrix);
      crowns.setColorAt(
        i * 2 + j,
        new THREE.Color().setHSL(0.32 + rng() * 0.15, 0.13, 0.2 + rng() * 0.11),
      );
    }
  });
  group.add(trunks, crowns);
  // Cutout foliage gives the canopy an irregular silhouette while sharing one draw call.
  const leafCanvas = document.createElement("canvas");
  leafCanvas.width = leafCanvas.height = 128;
  const leafCtx = leafCanvas.getContext("2d");
  for (let i = 0; i < 190; i++) {
    const a = rng() * Math.PI * 2,
      r = Math.sqrt(rng()) * 56;
    leafCtx.fillStyle = ["#8b9d79", "#79916d", "#aec298"][i % 3];
    leafCtx.beginPath();
    leafCtx.ellipse(
      64 + Math.cos(a) * r,
      64 + Math.sin(a) * r,
      2 + rng() * 6,
      1 + rng() * 3,
      rng() * Math.PI,
      0,
      Math.PI * 2,
    );
    leafCtx.fill();
  }
  const leavesMap = new THREE.CanvasTexture(leafCanvas);
  leavesMap.colorSpace = THREE.SRGBColorSpace;
  const leaves = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    mat("#99ad83", { map: leavesMap, alphaTest: 0.45, side: THREE.DoubleSide }),
    trees.length * 6,
  );
  trees.forEach((t, i) => {
    for (let j = 0; j < 6; j++) {
      dummy.position.set(
        t.x + Math.sin(j * 2.1) * 1.3,
        t.h - 1 + (j % 2) * 2,
        t.z + Math.cos(j * 2.1),
      );
      dummy.scale.set(5.4, 5.4, 1);
      dummy.rotation.set((j % 2) * 0.7, (j * Math.PI) / 3, 0);
      dummy.updateMatrix();
      leaves.setMatrixAt(i * 6 + j, dummy.matrix);
    }
  });
  group.add(leaves);

  // The crooked tree is the visual anchor and the final exit.
  const tree = new THREE.Group();
  tree.position.set(0, 0, -35);
  group.add(tree);
  function branch(start, dir, len, r, depth) {
    const end = start.map((v, i) => v + dir[i] * len);
    segment(start, end, r, r * 0.56, wood, tree);
    if (depth <= 0) return;
    for (let k = 0; k < 2; k++) {
      const a = rng() * Math.PI * 2;
      const nd = [
        dir[0] * 0.3 + Math.cos(a) * 0.7,
        0.38 + rng() * 0.7,
        dir[2] * 0.3 + Math.sin(a) * 0.7,
      ];
      branch(end, nd, len * (0.62 + rng() * 0.14), r * 0.56, depth - 1);
    }
  }
  branch([0, 0, 0], [0.05, 1, 0.03], 6, 1.8, 4);
  branch([0, 1, 0], [-0.7, 0.6, 0.18], 5, 1, 3);
  branch([0, 1, 0], [0.75, 0.7, -0.15], 5, 0.9, 3);
  obstacles.push({ minX: -1.6, maxX: 1.6, minZ: -36.6, maxZ: -33.4 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    segment(
      [0, 0.4, -35],
      [Math.sin(a) * 5, 0.03, -35 + Math.cos(a) * 4],
      0.6,
      0.06,
      wood,
    );
  }
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(3.1, 0.032, 6, 80),
    new THREE.MeshBasicMaterial({ color: "#d8f5d0" }),
  );
  halo.position.set(0, 6.4, -34.8);
  group.add(halo);
  const rootLight = new THREE.PointLight("#bfffe1", 55, 24, 2);
  rootLight.position.set(0, 5, -32);
  group.add(rootLight);
  function lightPost(x, z) {
    segment([x, 0, z], [x, 3, z], 0.04, 0.035, dark);
    box(
      x,
      3,
      z,
      0.23,
      0.34,
      0.23,
      new THREE.MeshBasicMaterial({ color: "#fff4bb" }),
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 8),
      new THREE.MeshBasicMaterial({
        color: "#f8eac2",
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      }),
    );
    glow.position.set(x, 3, z);
    group.add(glow);
    lanterns.push(glow);
  }
  for (const [x, z] of [
    [-4, 19],
    [4, 9],
    [-4, -3],
    [4, -20],
    [-4, -27],
    [19, -10],
    [44, -6],
    [-28, -8],
    [-34, -26],
    [-34, -38],
  ])
    lightPost(x, z);
  // A campfire links the new world to the original Horror Tree.
  const fire = new THREE.Group();
  fire.position.set(2, 0, 19);
  group.add(fire);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28), stone);
    s.position.set(Math.sin(a) * 0.65, 0.17, Math.cos(a) * 0.65);
    fire.add(s);
  }
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.85, 6),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? "#ffd78c" : "#eb995a",
        transparent: true,
        opacity: 0.8,
      }),
    );
    f.position.set((rng() - 0.5) * 0.4, 0.6, (rng() - 0.5) * 0.4);
    fire.add(f);
    animated.push({ type: "flame", mesh: f, offset: i });
  }
  const fireLight = new THREE.PointLight("#ffb774", 30, 16, 2);
  fireLight.position.set(2, 1.5, 19);
  group.add(fireLight);
  // Tiled pool pavilion. Doorways and aisles remain wide enough for navigation.
  const tile = texture("tile");
  tile.repeat.set(12, 10);
  const tileMat = mat("#d3e1d8", { map: tile, roughness: 0.32 });
  box(34, 0.025, -20, 34, 0.05, 32, tileMat);
  const wallTile = texture("tile");
  wallTile.repeat.set(1, 2);
  const wallMat = mat("#c9d8cc", { map: wallTile, roughness: 0.55 });
  box(50, 3.5, -20, 1, 7, 32, wallMat, true);
  box(34, 3.5, -36, 32, 7, 1, wallMat, true);
  box(18, 3.5, -28, 1, 7, 16, wallMat, true);
  box(18, 3.5, -5, 1, 7, 4, wallMat, true);
  for (const x of [22, 30, 38, 46]) {
    box(x, 2.8, -4, 0.7, 5.6, 0.9, stone, true);
    box(x, 5.8, -4, 8, 0.6, 1, stone);
  }
  // Freestanding arches open toward the forest.
  function arch(x, z, rotation = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(-3.6, 0);
    shape.lineTo(-3.6, 7);
    shape.lineTo(3.6, 7);
    shape.lineTo(3.6, 0);
    shape.lineTo(2.3, 0);
    shape.lineTo(2.3, 3.6);
    shape.absarc(0, 3.6, 2.3, 0, Math.PI, false);
    shape.lineTo(-2.3, 0);
    shape.lineTo(-3.6, 0);
    const m = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.7,
        bevelEnabled: false,
        curveSegments: 18,
      }),
      stone,
    );
    m.position.set(x, 0, z);
    m.rotation.y = rotation;
    m.castShadow = true;
    group.add(m);
    if (!rotation) {
      obstacles.push(
        { minX: x - 3.6, maxX: x - 2.3, minZ: z - 0.1, maxZ: z + 0.8 },
        { minX: x + 2.3, maxX: x + 3.6, minZ: z - 0.1, maxZ: z + 0.8 },
      );
    }
    return m;
  }
  arch(30, -22);
  arch(40, -22);
  box(35, 6.7, -29, 32, 0.3, 14, stone);
  for (const [x, z] of [
    [24, -30],
    [44, -30],
  ])
    box(x, 3.1, z, 0.6, 6.2, 0.6, stone, true);
  const waterUniforms = {
    time: { value: 0 },
    tint: { value: new THREE.Color("#4f9da0") },
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader:
      "varying vec3 vPos;varying vec3 vWorld;uniform float time;void main(){vec3 p=position;p.z+=sin(p.x*1.7+time*.8)*.02+cos(p.y*1.3-time*.7)*.02;vPos=p;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}",
    fragmentShader:
      "varying vec3 vPos;varying vec3 vWorld;uniform float time;uniform vec3 tint;void main(){float w=sin(vPos.x*2.4+time)*sin(vPos.y*2.8-time*.7);float w2=sin(vPos.x*1.2+vPos.y*1.8+time*.5);vec3 norm=normalize(vec3(w*.15,1.,w2*.13));float fres=pow(1.-max(dot(normalize(cameraPosition-vWorld),norm),0.),3.);float lines=pow(abs(sin(vPos.x*2.+w2*2.)*sin(vPos.y*2.5+w*2.)),12.);float sparkle=pow(max(dot(norm,normalize(vec3(.4,1.,.3))),0.),90.);vec3 col=mix(tint*.8,vec3(.42,.61,.67),fres*.55)+lines*.32+sparkle*.2;gl_FragColor=vec4(col,.9);}",
  });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(23, 22, 48, 48),
    waterMat,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(35, 0.15, -20);
  group.add(water);
  box(35, 0.01, -20, 23, 0.02, 22, mat("#3c7375"));
  // Pastel slide: a flowing sculpted curve, with ladder rails.
  const slideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(46, 5.1, -28),
    new THREE.Vector3(41, 4.3, -29),
    new THREE.Vector3(41, 2.4, -26),
    new THREE.Vector3(46, 1, -23),
    new THREE.Vector3(44, 0.3, -18),
  ]);
  const slide = new THREE.Mesh(
    new THREE.TubeGeometry(slideCurve, 52, 0.56, 10, false),
    pink,
  );
  group.add(slide);
  segment([46, 0, -29], [46, 5, -29], 0.05, 0.05, dark);
  segment([47, 0, -29], [47, 5, -29], 0.05, 0.05, dark);
  for (let y = 0.3; y < 5; y += 0.4)
    segment([46, y, -29], [47, y, -29], 0.035, 0.035, dark);
  const poolLight = new THREE.PointLight("#c5ffec", 75, 32, 2);
  poolLight.position.set(35, 5, -24);
  group.add(poolLight);
  // An impossible window and doors with no walls.
  function door(x, z, color) {
    const m = mat(color);
    box(x - 1.1, 1.9, z, 0.25, 3.8, 0.35, m, true);
    box(x + 1.1, 1.9, z, 0.25, 3.8, 0.35, m, true);
    box(x, 3.7, z, 2.5, 0.25, 0.35, m);
    const inner = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 3.4),
      new THREE.MeshBasicMaterial({
        color: "#accbbf",
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      }),
    );
    inner.position.set(x, 1.85, z);
    group.add(inner);
    return inner;
  }
  door(-31, -2, "#c3b1b9");
  door(-34, -36, "#99b2a3");
  door(6, -51, "#cbbec6");
  const surreal = new THREE.Group();
  for (const [x, y, w, h] of [
    [-1.25, 0, 0.22, 4],
    [1.25, 0, 0.22, 4],
    [0, 2, 2.7, 0.22],
    [0, -2, 2.7, 0.22],
  ]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), pink);
    frame.position.set(x, y, 0);
    surreal.add(frame);
  }
  const dreamDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 3.9),
    new THREE.MeshBasicMaterial({
      color: "#b8ddd4",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.62,
    }),
  );
  surreal.add(dreamDoor);
  surreal.position.set(-16, 11, -45);
  surreal.rotation.z = 0.25;
  group.add(surreal);
  // The abandoned garden: swings, pastel arches and a ceilingless room.
  box(-33, 0.035, -33, 19, 0.07, 19, mat("#99a79b"));
  box(-42, 1.5, -33, 0.7, 3, 19, mint, true);
  box(-33, 1.5, -42, 19, 3, 0.7, pink, true);
  for (const x of [-38, -28]) {
    segment([x, 0, -32], [x, 5, -36], 0.1, 0.1, dark);
    segment([x, 0, -40], [x, 5, -36], 0.1, 0.1, dark);
  }
  segment([-38, 5, -36], [-28, 5, -36], 0.12, 0.12, dark);
  for (const x of [-35, -31]) {
    const swing = new THREE.Group();
    swing.position.set(x, 4.8, -36);
    segment([-0.5, 0, 0], [-0.5, -3.5, 0], 0.018, 0.018, dark, swing);
    segment([0.5, 0, 0], [0.5, -3.5, 0], 0.018, 0.018, dark, swing);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.5), pink);
    seat.position.y = -3.5;
    swing.add(seat);
    group.add(swing);
    animated.push({ type: "swing", mesh: swing, offset: x });
  }
  sphere(
    -37,
    0.65,
    -28,
    0.65,
    new THREE.MeshStandardMaterial({ color: "#ceb09d", roughness: 0.55 }),
  );
  // Clock monument.
  box(10, 2, -50, 2, 4, 1.2, stone, true);
  const clock = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 40),
    mat("#d5d0bb"),
  );
  clock.position.set(10, 4.5, -49.3);
  group.add(clock);
  const clockRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.65, 0.1, 8, 40),
    wood,
  );
  clockRim.position.copy(clock.position);
  group.add(clockRim);
  segment([10, 4.5, -49.15], [10.1, 5.7, -49.15], 0.035, 0.025, dark);
  segment([10, 4.5, -49.13], [9.2, 4, -49.13], 0.04, 0.03, dark);
  // Collectibles are distinct cassette tapes with a tall light marker.
  for (const p of MEMORY_POSITIONS) {
    const g = new THREE.Group();
    g.position.set(p.x, 1.25, p.z);
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.38, 0.12),
      mat("#efdfbc", { emissive: "#77966b", emissiveIntensity: 0.65 }),
    );
    g.add(tape);
    for (const x of [-0.15, 0.15]) {
      const reel = new THREE.Mesh(
        new THREE.TorusGeometry(0.07, 0.018, 6, 16),
        dark,
      );
      reel.position.set(x, 0.035, 0.07);
      g.add(reel);
    }
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.4, 4, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#d8f5ba",
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    beam.position.y = 1.8;
    g.add(beam);
    group.add(g);
    memories.push({ ...p, mesh: g });
    box(p.x, 0.42, p.z, 0.7, 0.84, 0.6, stone);
  }
  const portalMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.12, 8, 60),
    new THREE.MeshStandardMaterial({
      color: "#b0c7ac",
      emissive: "#b0ffd4",
      emissiveIntensity: 0.05,
    }),
  );
  portalMesh.position.set(PORTAL.x, 2, PORTAL.z);
  group.add(portalMesh);
  const portalFill = new THREE.Mesh(
    new THREE.CircleGeometry(1.75, 48),
    new THREE.MeshBasicMaterial({
      color: "#caffd8",
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    }),
  );
  portalFill.position.copy(portalMesh.position);
  group.add(portalFill);
  // Ground cover: instanced blades and stones, with clear paths around landmarks.
  const grassGeo = new THREE.ConeGeometry(0.11, 0.6, 3),
    grassMat = mat("#63765a");
  const blades = new THREE.InstancedMesh(grassGeo, grassMat, 3800);
  let count = 0;
  for (let i = 0; i < 5500 && count < 3800; i++) {
    const x = (rng() - 0.5) * 125,
      z = (rng() - 0.5) * 125;
    if (
      Math.abs(x) < 4 ||
      (x > 16 && x < 52 && z > -38 && z < 0) ||
      (x < -22 && x > -44 && z > -44 && z < 5) ||
      Math.abs(z) < 3 ||
      (Math.abs(z + 13) < 3 && x > 0)
    )
      continue;
    dummy.position.set(x, 0.15, z);
    dummy.scale.set(0.8 + rng(), 0.4 + rng(), 0.8);
    dummy.rotation.set(0, rng() * 6.28, (rng() - 0.5) * 0.4);
    dummy.updateMatrix();
    blades.setMatrixAt(count++, dummy.matrix);
  }
  blades.count = count;
  group.add(blades);
  const particlePos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    particlePos[i * 3] = (rng() - 0.5) * 110;
    particlePos[i * 3 + 1] = 0.2 + rng() * 12;
    particlePos[i * 3 + 2] = (rng() - 0.5) * 110;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
  const particleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader:
      "uniform float time;varying float alpha;void main(){vec3 p=position;p.x+=sin(time*.3+p.z)*.6;p.y+=sin(time*.7+p.x)*.4;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(50./-mv.z,1.,8.);alpha=.35+.25*sin(time+p.z);}",
    fragmentShader:
      "varying float alpha;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.7,.95,.72,pow(max(0.,1.-d),2.)*alpha);}",
  });
  const particles = new THREE.Points(pg, particleMat);
  group.add(particles);
  // World labels are drawn locally, so fonts/assets never block loading.
  function sign(text, x, z) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#acb7a4";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#627466";
    ctx.lineWidth = 7;
    ctx.strokeRect(10, 10, 492, 108);
    ctx.fillStyle = "#2c4039";
    ctx.textAlign = "center";
    ctx.font = "24px monospace";
    ctx.fillText(text, 256, 75);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.8),
      mat("#ffffff", { map, side: THREE.DoubleSide }),
    );
    m.position.set(x, 1.8, z);
    group.add(m);
    segment([x, 0, z], [x, 1.5, z], 0.045, 0.045, wood);
  }
  sign("POOLRÄUME →", 7, -10);
  sign("DU WARST SCHON HIER", -25, 4);
  sign("NICHT UMDREHEN", 7, -42);
  return {
    obstacles,
    memories,
    portal: portalMesh,
    blades,
    particles,
    lanterns,
    region(p) {
      if (p.x > 17 && p.x < 51 && p.z < 0 && p.z > -38) return "DIE POOLRÄUME";
      if (p.x < -21 && p.z < -20) return "DER VERGESSENE GARTEN";
      if (p.z < -38) return "DIE UHR OHNE ZEIT";
      if (distance(p, PORTAL) < 10) return "DER ERINNERUNGSBAUM";
      return "DER TRAUMWALD";
    },
    update(t, collected) {
      waterUniforms.time.value = t;
      particleMat.uniforms.time.value = t;
      for (const a of animated) {
        if (a.type === "flame") {
          a.mesh.scale.y = 0.8 + Math.sin(t * 7 + a.offset) * 0.25;
          a.mesh.rotation.y = t * 0.7;
        } else a.mesh.rotation.x = Math.sin(t * 0.85 + a.offset) * 0.23;
      }
      fireLight.intensity = 27 + Math.sin(t * 8) * 4;
      halo.rotation.z = Math.sin(t * 0.15) * 0.06;
      for (const p of memories) {
        p.mesh.visible = !collected.has(p.id);
        p.mesh.position.y = 1.3 + Math.sin(t * 1.7 + p.id) * 0.12;
        p.mesh.rotation.y = t * 0.6 + p.id;
      }
      const open = collected.size === 5;
      portalMesh.material.emissiveIntensity = open ? 2.2 : 0.08;
      portalFill.material.opacity = open ? 0.62 + Math.sin(t * 2) * 0.12 : 0;
      rootLight.intensity = open ? 90 : 55;
    },
    setQuality(q) {
      blades.count = q === "low" ? Math.floor(count * 0.35) : count;
      particles.geometry.setDrawRange(0, q === "low" ? 260 : 900);
    },
  };
}
