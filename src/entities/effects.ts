/**
 * 순수 시각 효과(파티클, 떠오르는 숫자). 게임 판정에 영향을 주지 않으므로 Math.random을 쓴다.
 */
export type ParticleKind = 'spark' | 'stick' | 'ring' | 'dust' | 'portal';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  rot: number;
  vrot: number;
  gravity: number;
  drag: number;
}

export interface FloatText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 700;

export class Effects {
  readonly particles: Particle[] = [];
  readonly texts: FloatText[] = [];

  private add(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(p);
  }

  sparks(
    x: number,
    y: number,
    color: string,
    count: number,
    speed: number,
    dirX = 0,
    dirY = 0,
    spread = Math.PI,
  ): void {
    const base = dirX || dirY ? Math.atan2(dirY, dirX) : 0;
    const fullCircle = !(dirX || dirY);
    for (let i = 0; i < count; i++) {
      const a = fullCircle ? Math.random() * Math.PI * 2 : base + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.75);
      const life = 0.18 + Math.random() * 0.25;
      this.add({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        color,
        size: 1.2 + Math.random() * 1.8,
        rot: 0,
        vrot: 0,
        gravity: 500,
        drag: 3.5,
      });
    }
  }

  ring(x: number, y: number, color: string, size: number, life = 0.3): void {
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life, maxLife: life, color, size, rot: 0, vrot: 0, gravity: 0, drag: 0 });
  }

  dust(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const life = 0.25 + Math.random() * 0.2;
      this.add({
        kind: 'dust',
        x: x + (Math.random() - 0.5) * 16,
        y,
        vx: (Math.random() - 0.5) * 120,
        vy: -20 - Math.random() * 50,
        life,
        maxLife: life,
        color: '#8a97b8',
        size: 2 + Math.random() * 2,
        rot: 0,
        vrot: 0,
        gravity: 120,
        drag: 4,
      });
    }
  }

  /** 스틱맨이 쓰러질 때 팔다리 막대가 흩어지는 효과. */
  stickDebris(x: number, feetY: number, height: number, color: string, pushX: number, pushY: number): void {
    const s = height / 92;
    const parts: Array<[number, number, number]> = [
      // [중심 y 오프셋, 길이, 기본 각도]
      [-54 * s, 28 * s, Math.PI / 2], // 몸통
      [-60 * s, 24 * s, 0.6], // 팔
      [-60 * s, 24 * s, -0.6],
      [-20 * s, 26 * s, 1.3], // 다리
      [-20 * s, 26 * s, 1.9],
    ];
    for (const [oy, len, rot] of parts) {
      const life = 0.7 + Math.random() * 0.4;
      this.add({
        kind: 'stick',
        x: x + (Math.random() - 0.5) * 10,
        y: feetY + oy,
        vx: pushX * (0.4 + Math.random() * 0.6) + (Math.random() - 0.5) * 220,
        vy: pushY * 0.5 - 200 - Math.random() * 260,
        life,
        maxLife: life,
        color,
        size: len,
        rot,
        vrot: (Math.random() - 0.5) * 18,
        gravity: 1400,
        drag: 0.6,
      });
    }
    // 머리
    const life = 0.8;
    this.add({
      kind: 'ring',
      x,
      y: feetY - 82 * s,
      vx: pushX * 0.5,
      vy: -300,
      life,
      maxLife: life,
      color,
      size: 10 * s,
      rot: 0,
      vrot: 0,
      gravity: 1400,
      drag: 0.6,
    });
  }

  /** 적 생성 예고 소용돌이. */
  portal(x: number, y: number, color: string): void {
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 26 + Math.random() * 14;
      const life = 0.35;
      this.add({
        kind: 'portal',
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r * 1.6,
        vx: -Math.cos(a) * r * 2.4,
        vy: -Math.sin(a) * r * 3.6,
        life,
        maxLife: life,
        color,
        size: 2,
        rot: 0,
        vrot: 0,
        gravity: 0,
        drag: 0,
      });
    }
  }

  text(x: number, y: number, text: string, color: string, size = 16, life = 0.7): void {
    this.texts.push({ x, y, vy: -70, text, color, size, life, maxLife: life });
    if (this.texts.length > 60) this.texts.shift();
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }
    for (const t of this.texts) {
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= Math.max(0, 1 - 3 * dt);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      if (this.texts[i].life <= 0) this.texts.splice(i, 1);
    }
  }
}
