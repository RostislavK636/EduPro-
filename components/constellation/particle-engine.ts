export type BackgroundSettings = {
  density: number;
  distance: number;
  speed: number;
  color: string;
  animated: boolean;
};
export const defaultBackground: BackgroundSettings = {
  density: 82,
  distance: 140,
  speed: 35,
  color: "#64F5DA",
  animated: true,
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  r: number;
};
export class ParticleEngine {
  private ctx: CanvasRenderingContext2D | null;
  private points: Particle[] = [];
  private width = 1;
  private height = 1;
  private frame = 0;
  private last = 0;
  private running = false;
  private observer: ResizeObserver;
  private pointer = { x: -10000, y: -10000, active: false };
  private impulse: { x: number; y: number; r: number } | null = null;
  private motion = matchMedia("(prefers-reduced-motion: reduce)");
  private samples = 0;
  private elapsed = 0;
  private cap = 110;
  constructor(
    private canvas: HTMLCanvasElement,
    private settings: BackgroundSettings,
  ) {
    this.ctx = canvas.getContext("2d");
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(document.documentElement);
    window.addEventListener("pointermove", this.move, { passive: true });
    window.addEventListener("pointerdown", this.click, { passive: true });
    document.addEventListener("visibilitychange", this.visibility);
    this.motion.addEventListener("change", this.visibility);
    window.addEventListener("blur", this.blur);
    this.resize();
    this.visibility();
  }
  private move = (e: PointerEvent) => {
    this.pointer = { x: e.clientX, y: e.clientY, active: true };
  };
  private click = (e: PointerEvent) => {
    if (innerWidth < 700 || !this.settings.animated || this.motion.matches)
      return;
    this.impulse = { x: e.clientX, y: e.clientY, r: 1 };
  };
  private blur = () => {
    this.pointer.active = false;
  };
  private visibility = () => {
    this.stop();
    if (!document.hidden && this.settings.animated && !this.motion.matches)
      this.start();
    else this.draw(0);
  };
  update(settings: BackgroundSettings) {
    this.settings = settings;
    this.resize();
    this.visibility();
  }
  private resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.8);
    this.canvas.width = this.width * ratio;
    this.canvas.height = this.height * ratio;
    this.ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    const mobile = this.width < 700;
    const n = Math.min(
      this.cap,
      mobile
        ? Math.min(30, this.settings.density)
        : Math.max(60, Math.min(110, this.settings.density)),
    );
    this.points = Array.from(
      { length: n },
      (_, i) =>
        this.points[i] || {
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          fx: 0,
          fy: 0,
          r: Math.random() * 1.3 + 0.7,
        },
    );
    for (const p of this.points) {
      p.x = Math.min(p.x, this.width);
      p.y = Math.min(p.y, this.height);
    }
    this.draw(0);
  }
  private start() {
    if (!this.ctx || this.running) return;
    this.running = true;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.loop);
  }
  private stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }
  private loop = (time: number) => {
    if (!this.running) return;
    const delta = Math.min(2, (time - this.last) / 16.667);
    this.elapsed += time - this.last;
    this.samples++;
    this.last = time;
    this.draw(delta);
    if (this.samples >= 120) {
      if (this.elapsed / this.samples > 35 && this.points.length > 60) {
        this.cap = Math.max(60, this.points.length - 10);
        this.resize();
      }
      this.samples = 0;
      this.elapsed = 0;
    }
    this.frame = requestAnimationFrame(this.loop);
  };
  private draw(delta: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    const reach = this.settings.distance;
    const speed = this.settings.speed / 35;
    const grid = new Map<string, Particle[]>();
    const rgb =
      this.settings.color
        .match(/[a-f\d]{2}/gi)
        ?.map((x) => parseInt(x, 16))
        .join(",") || "100,245,218";
    for (const p of this.points) {
      if (delta) {
        if (this.pointer.active && this.width > 700) {
          const dx = this.pointer.x - p.x,
            dy = this.pointer.y - p.y,
            d = Math.hypot(dx, dy);
          if (d < 170 && d > 1) {
            const f = (1 - d / 170) * 0.013;
            p.fx += (dx / d) * f * delta;
            p.fy += (dy / d) * f * delta;
          }
        }
        if (this.impulse) {
          const dx = p.x - this.impulse.x,
            dy = p.y - this.impulse.y,
            d = Math.hypot(dx, dy);
          if (Math.abs(d - this.impulse.r) < 22 && d > 1) {
            p.fx += (dx / d) * 0.12;
            p.fy += (dy / d) * 0.12;
          }
        }
        p.fx *= Math.pow(0.97, delta);
        p.fy *= Math.pow(0.97, delta);
        p.x += (p.vx * speed + p.fx) * delta;
        p.y += (p.vy * speed + p.fy) * delta;
        if (p.x < 0) p.x = this.width;
        if (p.x > this.width) p.x = 0;
        if (p.y < 0) p.y = this.height;
        if (p.y > this.height) p.y = 0;
      }
      const key = `${Math.floor(p.x / reach)},${Math.floor(p.y / reach)}`;
      const cell = grid.get(key) || [];
      cell.push(p);
      grid.set(key, cell);
    }
    if (this.impulse && delta) {
      this.impulse.r += 4 * delta;
      if (this.impulse.r > 240) this.impulse = null;
    }
    const visited = new Set<Particle>();
    for (const p of this.points) {
      const cx = Math.floor(p.x / reach),
        cy = Math.floor(p.y / reach);
      visited.add(p);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const q of grid.get(`${cx + dx},${cy + dy}`) || []) {
            if (visited.has(q)) continue;
            const d = Math.hypot(p.x - q.x, p.y - q.y);
            if (d < reach) {
              ctx.strokeStyle = `rgba(${rgb},${(1 - d / reach) * 0.17})`;
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
            }
          }
      ctx.fillStyle = `rgba(${rgb},.42)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  destroy() {
    this.stop();
    this.observer.disconnect();
    window.removeEventListener("pointermove", this.move);
    window.removeEventListener("pointerdown", this.click);
    document.removeEventListener("visibilitychange", this.visibility);
    this.motion.removeEventListener("change", this.visibility);
    window.removeEventListener("blur", this.blur);
  }
}
