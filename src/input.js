import { clamp } from "./core.js";
export class Input {
  constructor(canvas, settings, actions) {
    this.canvas = canvas;
    this.settings = settings;
    this.actions = actions;
    this.keys = new Set();
    this.active = false;
    this.look = { x: 0, y: 0 };
    this.stick = { x: 0, y: 0 };
    this.run = false;
    this.crouch = false;
    this.gamepadPrevious = [];
    this.pointerIds = { move: null, look: null };
    this.touchSeen = matchMedia("(pointer: coarse)").matches;
    addEventListener("keydown", (e) => {
      if (e.target.closest("input,select,textarea")) return;
      if (
        [
          "Tab",
          "Space",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code) &&
        this.active
      )
        e.preventDefault();
      if (!e.repeat) {
        const a = {
          KeyE: "interact",
          KeyF: "light",
          KeyQ: "echo",
          Escape: "pause",
          KeyP: "pause",
          KeyC: "crouch",
        }[e.code];
        if (a && (this.active || a === "pause")) this.actions(a);
      }
      this.keys.add(e.code);
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => {
      this.clear();
      if (this.active) this.actions("pause");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.clear();
        if (this.active) this.actions("pause");
      }
    });
    document.addEventListener("pointerlockchange", () => {
      if (!document.pointerLockElement && this.active) {
        this.clear();
        this.actions("pause");
      }
    });
    document.addEventListener("mousemove", (e) => {
      if (this.active && document.pointerLockElement === canvas) {
        this.look.x += e.movementX;
        this.look.y += e.movementY;
      }
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.active) return;
      if (e.pointerType === "mouse") {
        this.lock();
        this.pointerIds.look = e.pointerId;
        this.last = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (
        this.active &&
        this.pointerIds.look === e.pointerId &&
        !document.pointerLockElement
      ) {
        this.look.x += e.clientX - this.last.x;
        this.look.y += e.clientY - this.last.y;
        this.last = { x: e.clientX, y: e.clientY };
      }
    });
    const endCanvas = () => {
      this.pointerIds.look = null;
    };
    canvas.addEventListener("pointerup", endCanvas);
    canvas.addEventListener("pointercancel", endCanvas);
    const stick = document.getElementById("move-stick"),
      look = document.getElementById("look-zone");
    stick.addEventListener("pointerdown", (e) => {
      if (!this.active || this.pointerIds.move !== null) return;
      e.preventDefault();
      this.pointerIds.move = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      this.moveStick(e);
    });
    stick.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.pointerIds.move) this.moveStick(e);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      stick.addEventListener(name, (e) => {
        if (e.pointerId !== this.pointerIds.move) return;
        this.pointerIds.move = null;
        this.stick = { x: 0, y: 0 };
        document.getElementById("stick-thumb").style.transform = "";
      });
    look.addEventListener("pointerdown", (e) => {
      if (!this.active || this.pointerIds.look !== null) return;
      e.preventDefault();
      this.touchSeen = true;
      this.pointerIds.look = e.pointerId;
      this.last = { x: e.clientX, y: e.clientY };
      look.setPointerCapture(e.pointerId);
    });
    look.addEventListener("pointermove", (e) => {
      if (!this.active || e.pointerId !== this.pointerIds.look) return;
      this.look.x += (e.clientX - this.last.x) * 1.6;
      this.look.y += (e.clientY - this.last.y) * 1.6;
      this.last = { x: e.clientX, y: e.clientY };
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      look.addEventListener(name, (e) => {
        if (e.pointerId === this.pointerIds.look) this.pointerIds.look = null;
      });
    for (const [id, action] of [
      ["touch-interact", "interact"],
      ["touch-light", "light"],
      ["touch-crouch", "crouch"],
      ["touch-echo", "echo"],
    ])
      document.getElementById(id).addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (this.active) this.actions(action);
      });
    const sprint = document.getElementById("touch-sprint");
    sprint.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!this.active) return;
      this.run = true;
      sprint.setPointerCapture(e.pointerId);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      sprint.addEventListener(name, () => (this.run = false));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  moveStick(e) {
    const r = document.getElementById("move-stick").getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / 42,
      y = (e.clientY - r.top - r.height / 2) / 42;
    const len = Math.max(1, Math.hypot(x, y));
    x /= len;
    y /= len;
    this.stick = { x, y };
    document.getElementById("stick-thumb").style.transform =
      `translate(${x * 34}px,${y * 34}px)`;
  }
  lock() {
    if (
      !this.active ||
      this.touchSeen ||
      this.settings.touch ||
      document.pointerLockElement
    )
      return;
    try {
      const p = this.canvas.requestPointerLock?.();
      p?.catch(() => {});
    } catch {
      /* Drag-to-look remains available. */
    }
  }
  clear() {
    this.keys.clear();
    this.run = false;
    this.stick = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.pointerIds = { move: null, look: null };
    document.getElementById("stick-thumb").style.transform = "";
  }
  setActive(v) {
    this.active = v;
    this.clear();
    if (!v && document.pointerLockElement) document.exitPointerLock();
  }
  sample(dt) {
    const k = this.keys;
    let x =
      (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) -
      (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) +
      this.stick.x;
    let z =
      (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) -
      (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) +
      this.stick.y;
    let sprint = this.run || k.has("ShiftLeft") || k.has("ShiftRight");
    const pad = Array.from(navigator.getGamepads?.() || []).find(
      (p) => p?.connected,
    );
    if (pad) {
      const axis = (v) => (Math.abs(v) < 0.16 ? 0 : v);
      x += axis(pad.axes[0] || 0);
      z += axis(pad.axes[1] || 0);
      this.look.x += axis(pad.axes[2] || 0) * dt * 900;
      this.look.y += axis(pad.axes[3] || 0) * dt * 700;
      sprint ||= !!pad.buttons[4]?.pressed;
      for (const [i, a] of [
        [0, "interact"],
        [1, "crouch"],
        [2, "light"],
        [3, "echo"],
        [9, "pause"],
      ])
        if (pad.buttons[i]?.pressed && !this.gamepadPrevious[i])
          this.actions(a);
      this.gamepadPrevious = pad.buttons.map((b) => b.pressed);
    } else this.gamepadPrevious = [];
    const len = Math.max(1, Math.hypot(x, z));
    const look = this.look;
    this.look = { x: 0, y: 0 };
    return {
      x: x / len,
      z: z / len,
      sprint,
      lookX: clamp(look.x, -1500, 1500),
      lookY: clamp(look.y, -1000, 1000),
    };
  }
}
