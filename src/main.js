import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildWorld } from "./world.js";
import { Monsters } from "./monsters.js";
import { Input } from "./input.js";
import { Soundscape } from "./audio.js";
import {
  sanitizeSettings,
  readStorage,
  writeStorage,
  validSave,
  SPAWN,
  PORTAL,
  Navigation,
  collides,
  moveBody,
  distance,
  clamp,
} from "./core.js";

const $ = (id) => document.getElementById(id),
  SETTINGS_KEY = "horror-tree-settings-v2",
  SAVE_KEY = "horror-tree-save-v2";
const settings = sanitizeSettings(readStorage(SETTINGS_KEY));
if (
  matchMedia("(prefers-reduced-motion: reduce)").matches &&
  !readStorage(SETTINGS_KEY)
)
  settings.effects = false;
let mode = "menu",
  returnTo = "menu",
  difficulty = settings.difficulty,
  playingTime = 0,
  visualTime = 0,
  subtitleUntil = 0,
  echoCooldown = 0,
  grace = 15,
  autoSave = 0,
  footstep = 0,
  scareUntil = 0,
  saveSupported = true;
let collected = new Set(),
  currentTarget = null,
  threat = 0,
  stamina = 100,
  battery = 100,
  lamp = true,
  quality = "medium",
  pixelRatio = 1,
  slowFrames = 0,
  frames = 0,
  lastFrame = performance.now(),
  fatal = false;
const player = {
    ...SPAWN,
    yaw: 0,
    pitch: 0,
    crouching: false,
    fov: settings.fov,
  },
  canvas = $("game");
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2("#9aaeb0", 0.014);
const camera = new THREE.PerspectiveCamera(
  settings.fov,
  innerWidth / innerHeight,
  0.06,
  480,
);
camera.rotation.order = "YXZ";
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
} catch (error) {
  $("loading").hidden = true;
  $("error").hidden = false;
  $("error-detail").textContent =
    "WebGL ist nicht verfügbar. Aktiviere die Hardwarebeschleunigung oder öffne das Spiel in einem anderen Browser.";
  throw error;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
scene.add(new THREE.HemisphereLight("#b7d2ed", "#3a4a2f", 2.05));
const sun = new THREE.DirectionalLight("#ffe2bd", 3.0);
sun.position.set(-24, 44, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
Object.assign(sun.shadow.camera, {
  left: -48,
  right: 48,
  top: 48,
  bottom: -48,
  near: 1,
  far: 150,
});
sun.shadow.normalBias = 0.06;
sun.shadow.bias = -0.0004;
scene.add(sun);
const world = buildWorld(scene),
  nav = new Navigation(world.obstacles),
  monsters = new Monsters(scene, nav),
  sound = new Soundscape(settings);
const flashlight = new THREE.SpotLight("#e8f2d8", 52, 30, 0.52, 0.7, 1.5);
flashlight.position.set(0, 1.7, 0);
scene.add(flashlight, flashlight.target);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.3,
  0.55,
  0.88,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const input = new Input(canvas, settings, action);
const screens = [
  "menu",
  "hud",
  "pause",
  "settings",
  "help",
  "credits",
  "result",
];
function show(name) {
  for (const s of screens) $(s).hidden = s !== name;
  mode = name;
  const active = name === "play";
  $("hud").hidden = !active;
  input.setActive(active);
  document.body.classList.toggle("touch", input.touchSeen || settings.touch);
  $("touch-controls").hidden = !active || !(input.touchSeen || settings.touch);
  if (active) {
    sound.resume();
  } else if (name !== "menu") sound.pause();
}
function announce(text, seconds = 5) {
  $("subtitle").textContent = text;
  $("subtitle").classList.add("visible");
  subtitleUntil = playingTime + seconds;
}
function save() {
  if (!["play", "pause", "settings"].includes(mode)) return;
  saveSupported = writeStorage(SAVE_KEY, {
    version: 2,
    player: { x: player.x, z: player.z, yaw: player.yaw },
    collected: [...collected],
    difficulty,
    time: playingTime,
  });
}
function refreshContinue() {
  $("continue").hidden = !validSave(readStorage(SAVE_KEY));
}
function start(continuing = false) {
  const saved = continuing ? validSave(readStorage(SAVE_KEY)) : null;
  collected = new Set(saved?.collected || []);
  playingTime = saved?.time || 0;
  difficulty = saved?.difficulty || settings.difficulty;
  Object.assign(
    player,
    { ...SPAWN, yaw: 0, pitch: 0, crouching: false },
    saved?.player || {},
  );
  if (collides(player.x, player.z, 0.4, world.obstacles))
    Object.assign(player, SPAWN);
  stamina = 100;
  battery = 100;
  lamp = true;
  grace = 15;
  echoCooldown = 0;
  autoSave = 0;
  footstep = 0;
  threat = 0;
  scareUntil = 0;
  $("scare").hidden = true;
  monsters.reset(difficulty);
  sound.unlock();
  show("play");
  input.lock();
  announce(
    saved
      ? "Der Wald hat auf dich gewartet."
      : "Fünf Erinnerungen. Ein Ausweg.\nDie erste Glut liegt vor dir.",
    6,
  );
  save();
  updateHUD();
}
function pause() {
  if (mode !== "play") return;
  save();
  show("pause");
  document.querySelector("#pause .muted").textContent = saveSupported
    ? "Dein Fortschritt wird automatisch gespeichert."
    : "Dein Browser erlaubt keine Speicherung. Diese Runde bleibt beim Fortsetzen erhalten.";
  $("resume").focus();
}
function resume() {
  if (mode !== "pause") return;
  show("play");
  input.lock();
}
function menu() {
  save();
  $("scare").hidden = true;
  show("menu");
  refreshContinue();
  sound.pause();
  $("menu-sound").textContent = "TON AN ♫";
  $("start").focus();
}
function action(name) {
  if (name === "interact" && mode === "menu") {
    start(false);
    return;
  }
  if (name === "interact" && mode === "pause") {
    resume();
    return;
  }
  if (name === "pause") {
    if (mode === "play") pause();
    else if (mode === "pause") resume();
    else if (["settings", "help", "credits"].includes(mode)) closePanel();
    return;
  }
  if (mode !== "play") return;
  if (name === "crouch") {
    player.crouching = !player.crouching;
    return;
  }
  if (name === "light") {
    lamp = !lamp;
    sound.shot("flashligth click.mp3", 0.5);
    return;
  }
  if (name === "echo") {
    if (echoCooldown > 0) {
      announce(
        `Dein Echo kehrt in ${Math.ceil(echoCooldown)} Sekunden zurück.`,
        2,
      );
      return;
    }
    const point = {
      x: clamp(player.x - Math.sin(player.yaw) * 14, -58, 58),
      z: clamp(player.z - Math.cos(player.yaw) * 14, -58, 58),
    };
    monsters.investigate(point);
    echoCooldown = 18;
    sound.shot("glitch1.mp3", 0.3, 0.7);
    announce("Dein Echo wandert voraus. Jetzt leise verschwinden.", 3);
    return;
  }
  if (name === "interact") {
    if (collected.size === 5 && distance(player, PORTAL) < 3) {
      finish(true);
      return;
    }
    const near = world.memories.find(
      (m) => !collected.has(m.id) && distance(player, m) < 2.5,
    );
    if (!near) return;
    collected.add(near.id);
    announce(near.text, 6);
    sound.shot("drump.mp3", 0.38, 1.3);
    if (collected.size === 5)
      announce("Der Baum öffnet sich.\nKehre zu seinem Licht zurück.", 6);
    else if (collected.size === 2 && difficulty !== "explore")
      monsters.investigate(player);
    save();
    updateHUD();
  }
}
function finish(won, name = "") {
  if (mode !== "play") return;
  if (won) {
    writeStorage(SAVE_KEY, null);
    show("result");
    $("result-label").textContent = "ALLE FÜNF ERINNERUNGEN GEFUNDEN";
    $("result-title").textContent = "Du bist aufgewacht.";
    $("result-detail").textContent =
      `Du hast den Traum in ${Math.floor(playingTime / 60)}:${String(Math.floor(playingTime % 60)).padStart(2, "0")} verlassen. Irgendwo schwingt die Schaukel noch immer.`;
    $("retry").focus();
  } else {
    save();
    show("result");
    $("result-label").textContent = "DER TRAUM HÄLT DICH FEST";
    $("result-title").textContent = "Noch nicht wach.";
    $("result-detail").textContent =
      `${name} hat dich gefunden. Unterbrich die Sicht hinter Mauern und Bäumen. Deine letzte Erinnerung bleibt über „Traum fortsetzen“ erhalten.`;
    if (settings.jumpscares) {
      $("scare").hidden = false;
      scareUntil = visualTime + 1.5;
      sound.resume();
      sound.shot("jumpscare.mp3", 0.52, 0.85);
    } else $("retry").focus();
  }
}
function closePanel() {
  if (!["settings", "help", "credits"].includes(mode)) return;
  show(returnTo);
  const target = returnTo === "pause" ? $("resume") : $("start");
  target.focus();
}
for (const button of document.querySelectorAll("[data-panel]"))
  button.addEventListener("click", () => {
    if (mode === "play") save();
    returnTo = mode === "pause" ? "pause" : "menu";
    show(button.dataset.panel);
    $(button.dataset.panel).querySelector("button,select,input")?.focus();
  });
for (const b of document.querySelectorAll(".close-panel"))
  b.addEventListener("click", closePanel);
$("start").onclick = () => start(false);
$("continue").onclick = () => start(true);
$("resume").onclick = resume;
$("pause-button").onclick = pause;
$("exit-menu").onclick = menu;
$("result-menu").onclick = menu;
$("retry").onclick = () => start(false);
$("menu-sound").onclick = () => {
  if (sound.paused) {
    sound.unlock();
    $("menu-sound").textContent = "TON AUS ♫";
  } else {
    sound.pause();
    $("menu-sound").textContent = "TON AN ♫";
  }
};
for (const element of $("settings-form").elements) {
  if (!element.name) continue;
  element.type === "checkbox"
    ? (element.checked = settings[element.name])
    : (element.value = settings[element.name]);
}
$("settings-form").addEventListener("submit", (e) => e.preventDefault());
$("settings-form").addEventListener("input", () => {
  const raw = { ...settings };
  for (const e of $("settings-form").elements) {
    if (!e.name) continue;
    raw[e.name] =
      e.type === "checkbox"
        ? e.checked
        : e.type === "range"
          ? Number(e.value)
          : e.value;
  }
  Object.assign(settings, sanitizeSettings(raw));
  writeStorage(SETTINGS_KEY, settings);
  applySettings();
});
// Keep keyboard focus inside the active menu or dialog.
addEventListener("keydown", (e) => {
  if (e.code !== "Tab" || mode === "play") return;
  const section = $(mode);
  if (!section) return;
  const focusable = [
    ...section.querySelectorAll("button:not(:disabled),a,select,input"),
  ].filter((e) => !e.hidden && e.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0],
    last = focusable.at(-1);
  if (
    e.shiftKey &&
    (document.activeElement === first ||
      !section.contains(document.activeElement))
  ) {
    e.preventDefault();
    last.focus();
  } else if (
    !e.shiftKey &&
    (document.activeElement === last ||
      !section.contains(document.activeElement))
  ) {
    e.preventDefault();
    first.focus();
  }
});
function applySettings() {
  quality =
    settings.quality === "auto"
      ? input.touchSeen
        ? "medium"
        : "high"
      : settings.quality;
  pixelRatio =
    quality === "high"
      ? Math.min(devicePixelRatio, 1.65)
      : quality === "medium"
        ? Math.min(devicePixelRatio, 1.2)
        : Math.min(devicePixelRatio, 0.85);
  renderer.shadowMap.enabled = quality === "high";
  bloom.strength = quality === "high" ? 0.32 : 0.2;
  world.setQuality(quality);
  camera.fov = settings.fov;
  player.fov = settings.fov;
  camera.updateProjectionMatrix();
  document.body.classList.toggle("no-effects", !settings.effects);
  sound.apply();
  resize();
}
function resize() {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  fatal = true;
  if (mode === "play") pause();
  $("error-detail").textContent =
    "Die Grafikverbindung wurde unterbrochen. Lade das Spiel neu; dein letzter gespeicherter Fortschritt bleibt erhalten.";
  $("error").hidden = false;
});
function updateHUD() {
  $("collected").textContent = Array.from({ length: 5 }, (_, i) =>
    collected.has(i) ? "●" : "○",
  ).join(" ");
  $("objective").textContent =
    collected.size === 5
      ? "Kehre zum Erinnerungsbaum zurück."
      : `Finde die Erinnerungen · ${collected.size} / 5`;
  $("region").textContent = world.region(player);
  $("stamina").value = stamina;
  $("battery").value = battery;
  $("lamp-label").textContent = lamp && battery > 0 ? "LICHT AN" : "LICHT LÄDT";
  const remaining = world.memories
    .filter((m) => !collected.has(m.id))
    .sort((a, b) => distance(player, a) - distance(player, b));
  currentTarget = collected.size === 5 ? PORTAL : remaining[0];
  if (currentTarget) {
    const d = distance(player, currentTarget),
      targetYaw = Math.atan2(
        -(currentTarget.x - player.x),
        -(currentTarget.z - player.z),
      );
    const delta = Math.atan2(
      Math.sin(targetYaw - player.yaw),
      Math.cos(targetYaw - player.yaw),
    );
    $("direction").textContent =
      Math.abs(delta) < 0.35 ? "↑" : delta > 0 ? "←" : "→";
    $("distance").textContent =
      `${Math.round(d)} m · ${collected.size === 5 ? "BAUM" : "ERINNERUNG"}`;
  }
  const near =
    collected.size === 5 && distance(player, PORTAL) < 3
      ? "E · Aufwachen"
      : world.memories.find(
          (m) => !collected.has(m.id) && distance(player, m) < 2.5,
        );
  $("interaction").textContent =
    typeof near === "string" ? near : near ? `E · ${near.name} aufnehmen` : "";
  $("interaction").classList.toggle("visible", !!near);
}
function playFrame(dt) {
  playingTime += dt;
  grace = Math.max(0, grace - dt);
  echoCooldown = Math.max(0, echoCooldown - dt);
  const sampled = input.sample(dt);
  if (mode !== "play") return;
  player.yaw -= (sampled.lookX * 0.002 * settings.sensitivity) / 85;
  player.pitch = clamp(
    player.pitch - (sampled.lookY * 0.002 * settings.sensitivity) / 85,
    -1.35,
    1.35,
  );
  const moving = Math.hypot(sampled.x, sampled.z) > 0.05;
  const sprint = sampled.sprint && stamina > 3 && !player.crouching && moving;
  stamina = clamp(stamina + (sprint ? -24 : 16) * dt, 0, 100);
  const speed = player.crouching ? 2.1 : sprint ? 7 : 4.1;
  const dx =
      (sampled.x * Math.cos(player.yaw) + sampled.z * Math.sin(player.yaw)) *
      speed *
      dt,
    dz =
      (-sampled.x * Math.sin(player.yaw) + sampled.z * Math.cos(player.yaw)) *
      speed *
      dt;
  const before = { x: player.x, z: player.z };
  moveBody(player, dx, dz, world.obstacles);
  const actuallyMoved = distance(before, player) > 0.002;
  battery = clamp(battery + (lamp ? -1.3 : 3.5) * dt, 0, 100);
  if (battery === 0) {
    lamp = false;
    announce("Das Licht lädt sich im Dunkeln wieder auf.", 3);
  }
  const targetHeight = player.crouching ? 1.05 : 1.7;
  const bob =
    settings.effects && actuallyMoved
      ? Math.sin(playingTime * (sprint ? 13 : 8)) * (sprint ? 0.05 : 0.025)
      : 0;
  camera.position.set(
    player.x,
    THREE.MathUtils.lerp(
      camera.position.y || targetHeight,
      targetHeight,
      1 - Math.exp(-dt * 14),
    ) +
      bob * 0.2,
    player.z,
  );
  camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  flashlight.position
    .copy(camera.position)
    .add(new THREE.Vector3(0.12, -0.15, 0));
  flashlight.target.position.copy(camera.position).addScaledVector(forward, 15);
  flashlight.visible = lamp && battery > 0;
  footstep += actuallyMoved ? dt : 0;
  if (footstep > (sprint ? 0.29 : player.crouching ? 0.85 : 0.48)) {
    footstep = 0;
    sound.shot(
      "walking on grass.mp3",
      player.crouching ? 0.08 : sprint ? 0.42 : 0.22,
      sprint ? 1.15 : 0.95,
    );
  }
  const enemyState = monsters.update(dt, playingTime, player, {
    noise: actuallyMoved ? (player.crouching ? 0.12 : sprint ? 1 : 0.48) : 0,
    light: lamp,
    collected: collected.size,
    grace: grace > 0,
  });
  threat = THREE.MathUtils.lerp(
    threat,
    enemyState.threat,
    1 - Math.exp(-dt * 3),
  );
  sound.update(threat);
  $("threat-dot").style.background = threat > 0.45 ? "#e5b5a0" : "#d4e9b6";
  $("threat-text").textContent =
    difficulty === "explore"
      ? "Ein stiller Traum."
      : enemyState.state === "watching"
        ? "Erstarrt. Schau nicht weg."
        : threat > 0.5
          ? "Er kommt näher."
          : threat > 0.2
            ? "Etwas bewegt sich."
            : "Du bist nicht allein.";
  $("vignette").style.boxShadow =
    `inset 0 0 ${80 + threat * 130}px rgba(31,21,39,${threat * 0.55})`;
  if (playingTime >= subtitleUntil) $("subtitle").classList.remove("visible");
  updateHUD();
  autoSave += dt;
  if (autoSave >= 6) {
    autoSave = 0;
    save();
  }
  if (enemyState.caught) finish(false, enemyState.caught);
}
function frame(now) {
  requestAnimationFrame(frame);
  if (fatal) return;
  const elapsed = (now - lastFrame) / 1000;
  lastFrame = now;
  if (document.hidden) return;
  const dt = Math.min(Math.max(elapsed, 0), 0.05);
  visualTime += dt;
  if (mode === "menu" || mode === "pause") input.sample(dt);
  if (mode === "play") playFrame(dt);
  else if (mode === "menu") {
    camera.position.set(
      19 + Math.sin(visualTime * 0.07) * 1.7,
      5.1 + Math.sin(visualTime * 0.12) * 0.15,
      20,
    );
    camera.lookAt(0, 5, -28);
    flashlight.visible = false;
    monsters.enemies.forEach((e) => (e.mesh.visible = false));
  } else flashlight.visible = false;
  if (mode === "play")
    monsters.enemies.forEach(
      (e) => (e.mesh.visible = difficulty !== "explore"),
    );
  if (mode === "play" || mode === "menu") world.update(visualTime, collected);
  if (scareUntil && visualTime > scareUntil) {
    $("scare").hidden = true;
    scareUntil = 0;
    sound.pause();
    $("retry").focus();
  }
  // Automatic quality only responds to sustained low frame rate, never changes an explicit choice.
  if (settings.quality === "auto" && mode === "play") {
    frames++;
    if (elapsed > 0.035) slowFrames++;
    if (frames >= 150) {
      if (slowFrames > 100 && pixelRatio > 0.65) {
        pixelRatio = Math.max(0.65, pixelRatio * 0.8);
        renderer.shadowMap.enabled = false;
        resize();
      }
      frames = 0;
      slowFrames = 0;
    }
  }
  if (settings.effects && quality !== "low") composer.render();
  else renderer.render(scene, camera);
}
applySettings();
camera.position.set(19, 5.1, 20);
camera.lookAt(0, 5, -28);
world.update(0, collected);
$("loading").hidden = true;
show("menu");
refreshContinue();
requestAnimationFrame(frame);
// Opt-in diagnostics only; browser tests can validate actual gameplay without timed waits.
if (new URLSearchParams(location.search).get("test") === "1")
  window.__dreamcore = {
    get state() {
      return {
        mode,
        player: { ...player },
        collected: [...collected],
        difficulty,
        playingTime,
        stamina,
        battery,
        grace,
        quality,
        pixelRatio,
        enemyStates: monsters.enemies.map((e) => ({
          name: e.name,
          state: e.state,
          x: e.x,
          z: e.z,
        })),
        drawCalls: renderer.info.render.calls,
      };
    },
    teleport(x, z, yaw = 0) {
      if (!collides(x, z, 0.4, world.obstacles))
        Object.assign(player, { x, z, yaw });
      updateHUD();
    },
    setGrace(v) {
      grace = v;
    },
    monsters,
    world,
    nav,
    action,
    finish,
  };
