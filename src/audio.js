export class Soundscape {
  constructor(settings) {
    this.settings = settings;
    this.enabled = false;
    this.loops = {};
    this.shots = new Set();
    this.paused = true;
    this.threat = 0;
    this.track = "dreamcore1.mp3";
  }
  unlock() {
    this.enabled = true;
    this.paused = false;
    this.setLoop("music", this.track, true);
    this.setLoop("heart", "herzschlag.mp3", true);
    this.apply();
  }
  setLoop(key, src, active) {
    let a = this.loops[key];
    if (!a) {
      a = new Audio(new URL("../" + src, import.meta.url).href);
      a.loop = true;
      a.preload = "none";
      this.loops[key] = a;
    }
    if (active && !this.paused && this.enabled) {
      a.play().catch(() => {});
    } else a.pause();
  }
  apply() {
    for (const [key, a] of Object.entries(this.loops))
      a.volume =
        key === "music"
          ? (this.settings.music / 100) * 0.5
          : (this.settings.sound / 100) * this.threat * 0.24;
  }
  update(threat) {
    this.threat = threat;
    this.apply();
  }
  shot(src, volume = 0.45, rate = 1) {
    if (
      !this.enabled ||
      this.paused ||
      this.settings.sound === 0 ||
      this.shots.size > 8
    )
      return;
    const a = new Audio(new URL("../" + src, import.meta.url).href);
    a.volume = Math.min(1, (volume * this.settings.sound) / 100);
    a.playbackRate = rate;
    this.shots.add(a);
    const done = () => this.shots.delete(a);
    a.onended = done;
    a.onerror = done;
    a.play().catch(done);
  }
  pause() {
    this.paused = true;
    for (const a of Object.values(this.loops)) a.pause();
    for (const a of this.shots) a.pause();
    this.shots.clear();
  }
  resume() {
    if (!this.enabled) return;
    this.paused = false;
    for (const a of Object.values(this.loops)) a.play().catch(() => {});
    this.apply();
  }
}
