import type { Vec2 } from '../core/geometry';

export type StickPose = 'stand' | 'run' | 'jump' | 'fall' | 'crouch';

export interface StickmanOptions {
  /** 발밑 중앙. */
  x: number;
  y: number;
  /** 기준 키(서 있을 때 92 기준) 배율. */
  scale: number;
  facing: 1 | -1;
  pose: StickPose;
  walkPhase: number;
  color: string;
  lineWidth: number;
  /** 조준 방향(단위 벡터). 주는 경우 앞팔이 이 방향을 향한다. */
  aim?: Vec2;
  /** 어깨 → 손 길이(무기 손잡이 위치). */
  armReach?: number;
  /** 무기를 그린다: 손에서 aim 방향으로 length만큼. */
  weapon?: { length: number; color: string; glow: string; recoil: number };
  /**
   * 앞팔 각도(라디안, 바라보는 방향 기준 로컬 좌표: 0=정면, +π/2=아래, −π/2=위).
   * 근접형 적의 공격 준비/휘두르기 자세에 쓴다.
   */
  armAngle?: number;
  /** 손에 든 칼날(팔 방향으로 뻗음). */
  blade?: { length: number; color: string };
  /** 머리 내부 채우기 색(배경과 구분). */
  headFill?: string;
  alpha?: number;
}

/** 2관절 IK: 시작점 a와 끝점 b, 두 마디 길이 l1, l2, 굽는 방향(bendSign)으로 관절 위치를 구한다. */
function solveJoint(a: Vec2, b: Vec2, l1: number, l2: number, bendSign: number): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let d = Math.hypot(dx, dy);
  const maxD = l1 + l2 - 0.01;
  if (d > maxD) d = maxD;
  if (d < 0.01) return { x: a.x, y: a.y - l1 };
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = dx / Math.hypot(dx, dy);
  const uy = dy / Math.hypot(dx, dy);
  return { x: a.x + ux * along - uy * h * bendSign, y: a.y + uy * along + ux * h * bendSign };
}

function line(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, c?: Vec2): void {
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  if (c) ctx.lineTo(c.x, c.y);
}

export interface StickJoints {
  head: Vec2;
  headR: number;
  neck: Vec2;
  shoulder: Vec2;
  hip: Vec2;
  hand: Vec2;
  muzzle: Vec2 | null;
}

/** 스틱맨을 그리고 주요 관절 위치를 돌려준다. */
export function drawStickman(ctx: CanvasRenderingContext2D, o: StickmanOptions): StickJoints {
  const s = o.scale;
  const f = o.facing;
  const X = (lx: number) => o.x + lx * f * s;
  const Y = (ly: number) => o.y + ly * s;
  const P = (lx: number, ly: number): Vec2 => ({ x: X(lx), y: Y(ly) });

  const crouch = o.pose === 'crouch';
  const hip = crouch ? P(-3, -20) : P(0, -40);
  const shoulder = crouch ? P(5, -38) : P(0, -68);
  const neck = crouch ? P(6, -40) : P(0, -70);
  const headR = 10 * s;
  const head = crouch ? P(9, -48) : P(0, -81);

  // 다리
  const legL1 = 22 * s;
  const legL2 = 22 * s;
  let footA: Vec2;
  let footB: Vec2;
  const ph = o.walkPhase;
  switch (o.pose) {
    case 'run': {
      const sa = Math.sin(ph);
      const sb = Math.sin(ph + Math.PI);
      footA = P(sa * 15, -Math.max(0, Math.cos(ph)) * 9);
      footB = P(sb * 15, -Math.max(0, Math.cos(ph + Math.PI)) * 9);
      break;
    }
    case 'jump':
      footA = P(8, -14);
      footB = P(-8, -6);
      break;
    case 'fall':
      footA = P(10, -2);
      footB = P(-9, 0);
      break;
    case 'crouch':
      footA = P(12, 0);
      footB = P(-10, 0);
      break;
    default:
      footA = P(7, 0);
      footB = P(-7, 0);
  }
  // 무릎은 바라보는 쪽(앞)으로 굽힌다.
  const kneeA = solveJoint(hip, footA, legL1, legL2, -f);
  const kneeB = solveJoint(hip, footB, legL1, legL2, -f);

  // 팔
  const armReach = (o.armReach ?? 22) * s;
  let hand: Vec2;
  let offHand: Vec2;
  let muzzle: Vec2 | null = null;
  if (o.aim) {
    const recoil = (o.weapon?.recoil ?? 0) * 4 * s;
    hand = { x: shoulder.x + o.aim.x * (armReach - recoil), y: shoulder.y + o.aim.y * (armReach - recoil) };
    if (o.weapon) {
      const wl = o.weapon.length * s;
      muzzle = { x: hand.x + o.aim.x * wl, y: hand.y + o.aim.y * wl };
      // 반대 손은 무기 중간을 받친다.
      offHand = { x: hand.x + o.aim.x * wl * 0.45, y: hand.y + o.aim.y * wl * 0.45 };
    } else {
      offHand = P(-8 + Math.sin(ph + Math.PI) * 6, -46);
    }
  } else if (o.armAngle !== undefined) {
    const a = o.armAngle;
    hand = { x: shoulder.x + Math.cos(a) * armReach * f, y: shoulder.y + Math.sin(a) * armReach };
    offHand = P(-9, -48);
  } else {
    const swingA = o.pose === 'run' ? Math.sin(ph + Math.PI) * 10 : 2;
    hand = P(swingA, -46);
    offHand = P(-swingA, -46);
  }
  const elbow = solveJoint(shoulder, hand, 13 * s, 13 * s, f);
  const offElbow = solveJoint(shoulder, offHand, 13 * s, 13 * s, f);

  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = o.color;
  ctx.lineWidth = o.lineWidth;

  // 뒤쪽 팔·다리를 조금 어둡게 그려 입체감을 준다.
  ctx.globalAlpha *= 0.6;
  ctx.beginPath();
  line(ctx, hip, kneeB, footB);
  line(ctx, shoulder, offElbow, offHand);
  ctx.stroke();
  ctx.globalAlpha /= 0.6;

  ctx.beginPath();
  line(ctx, neck, hip);
  line(ctx, hip, kneeA, footA);
  ctx.stroke();

  // 무기
  if (o.weapon && muzzle) {
    ctx.save();
    ctx.lineWidth = o.lineWidth + 2.5 * s;
    ctx.strokeStyle = '#2a3247';
    ctx.beginPath();
    line(ctx, hand, muzzle);
    ctx.stroke();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = o.weapon.color;
    ctx.beginPath();
    line(ctx, hand, muzzle);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(muzzle.x, muzzle.y, 0, muzzle.x, muzzle.y, 9 * s);
    g.addColorStop(0, o.weapon.glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(muzzle.x, muzzle.y, 9 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  line(ctx, shoulder, elbow, hand);
  ctx.stroke();

  if (o.blade) {
    const dx = hand.x - shoulder.x;
    const dy = hand.y - shoulder.y;
    const len = Math.hypot(dx, dy) || 1;
    const bl = o.blade.length * s;
    ctx.save();
    ctx.strokeStyle = o.blade.color;
    ctx.lineWidth = Math.max(1.5, o.lineWidth - 0.5);
    ctx.beginPath();
    ctx.moveTo(hand.x, hand.y);
    ctx.lineTo(hand.x + (dx / len) * bl, hand.y + (dy / len) * bl);
    ctx.stroke();
    ctx.restore();
  }

  // 머리
  ctx.beginPath();
  ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
  if (o.headFill) {
    ctx.fillStyle = o.headFill;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();

  return { head, headR, neck, shoulder, hip, hand, muzzle };
}

export function poseFor(grounded: boolean, crouching: boolean, vx: number, vy: number): StickPose {
  if (crouching) return 'crouch';
  if (!grounded) return vy < 0 ? 'jump' : 'fall';
  return Math.abs(vx) > 25 ? 'run' : 'stand';
}
