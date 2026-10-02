import { ENEMIES, PLAYER, WORLD } from '../config';
import type { Vec2 } from '../core/geometry';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import type { World } from '../game/world';
import type { CurveAttack } from '../weapons/attack';
import { forEachSegmentInRange, pointAtLength, type CurvePath } from '../weapons/curve';
import type { FunctionWeaponDef } from '../weapons/types';
import type { Solid } from '../world/arena';
import { mix, PALETTE, withAlpha } from './colors';
import { drawStickman, poseFor } from './stickman';

/* ───────────── 배경 ───────────── */

export function drawBackground(ctx: CanvasRenderingContext2D, time: number): void {
  const W = WORLD.width;
  const H = WORLD.height;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PALETTE.bgTop);
  g.addColorStop(1, PALETTE.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 좌표 격자
  ctx.lineWidth = 1;
  ctx.strokeStyle = PALETTE.gridMinor;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 40) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = 20; y <= H; y += 40) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();
  ctx.strokeStyle = PALETTE.gridMajor;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 200) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = 60; y <= H; y += 200) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();

  // 좌표축 (원점: 화면 중앙)
  const ox = 800;
  const oy = 460;
  ctx.strokeStyle = PALETTE.axis;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(W - 30, oy);
  ctx.moveTo(ox, H);
  ctx.lineTo(ox, 24);
  ctx.stroke();
  ctx.fillStyle = PALETTE.axis;
  ctx.beginPath();
  ctx.moveTo(W - 30, oy - 5);
  ctx.lineTo(W - 18, oy);
  ctx.lineTo(W - 30, oy + 5);
  ctx.moveTo(ox - 5, 24);
  ctx.lineTo(ox, 12);
  ctx.lineTo(ox + 5, 24);
  ctx.fill();

  ctx.font = `italic 15px ${PALETTE.mathFont}`;
  ctx.fillStyle = 'rgba(150,180,255,0.28)';
  ctx.fillText('x', W - 44, oy - 10);
  ctx.fillText('y', ox + 10, 30);
  ctx.font = `12px ${PALETTE.mathFont}`;
  ctx.fillStyle = 'rgba(150,180,255,0.18)';
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const x = ox + i * 200;
    ctx.fillRect(x - 0.5, oy - 4, 1, 8);
    ctx.fillText(String(i), x + 4, oy + 16);
  }
  for (let j = -2; j <= 2; j++) {
    if (j === 0) continue;
    const y = oy - j * 200;
    if (y < 30 || y > H - 20) continue;
    ctx.fillRect(ox - 4, y - 0.5, 8, 1);
    ctx.fillText(String(j), ox + 8, y + 4);
  }
  ctx.fillText('O', ox + 6, oy + 16);

  // 은은하게 흐르는 배경 곡선(장식)
  ctx.strokeStyle = 'rgba(140,160,255,0.035)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = 250 + Math.sin(x / 130 + time * 0.25) * 60;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const t = x / W;
    const y = 640 - (Math.exp(t * 2.6) - 1) * 32 + Math.sin(time * 0.2) * 6;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function drawTerrain(ctx: CanvasRenderingContext2D, solids: readonly Solid[]): void {
  for (const s of solids) {
    const x = Math.max(s.x, -10);
    const y = Math.max(s.y, -10);
    const x2 = Math.min(s.x + s.w, WORLD.width + 10);
    const y2 = Math.min(s.y + s.h, WORLD.height + 10);
    const w = x2 - x;
    const h = y2 - y;
    if (w <= 0 || h <= 0) continue;
    const g = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 120));
    g.addColorStop(0, PALETTE.terrainTop);
    g.addColorStop(1, PALETTE.terrainBottom);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // 빗금 무늬
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(140,165,220,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = x - h; k < x + w; k += 12) {
      ctx.moveTo(k, y + h);
      ctx.lineTo(k + h, y);
    }
    ctx.stroke();
    ctx.restore();

    // 테두리: 윗면 강조
    ctx.strokeStyle = withAlpha(PALETTE.terrainEdge, 0.28);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (s.kind !== 'wall') {
      ctx.strokeStyle = withAlpha(PALETTE.terrainEdge, 0.85);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + 1);
      ctx.lineTo(x + w, y + 1);
      ctx.stroke();
    }
    // 숙여서 지나가는 낮은 턱: 아랫면에 주의 표시
    if (s.kind === 'platform' && s.y + s.h > 740) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,200,80,0.55)';
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h - 1);
      ctx.lineTo(x + w - 4, y + h - 1);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/* ───────────── 함수 곡선 ───────────── */

function tracePath(ctx: CanvasRenderingContext2D, path: CurvePath, from: number, to: number): void {
  let first = true;
  forEachSegmentInRange(path, from, to, (ax, ay, bx, by) => {
    if (first) {
      ctx.moveTo(ax, ay);
      first = false;
    }
    ctx.lineTo(bx, by);
  });
}

/** 조준 미리보기: 얇고 반투명한 점선. 지형에 막히면 막힌 지점에 X 표시. */
export function drawPreview(ctx: CanvasRenderingContext2D, path: CurvePath, def: FunctionWeaponDef, ready: boolean): void {
  if (path.count < 2) {
    drawBlockMark(ctx, path.xs[0], path.ys[0], def.color);
    return;
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash([6, 7]);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = withAlpha(def.color, ready ? 0.5 : 0.25);
  ctx.beginPath();
  tracePath(ctx, path, 0, path.length);
  ctx.stroke();
  ctx.restore();
  const end = pointAtLength(path, path.length);
  if (path.blocked) drawBlockMark(ctx, end.x, end.y, def.color);
  else {
    ctx.fillStyle = withAlpha(def.color, ready ? 0.6 : 0.3);
    ctx.beginPath();
    ctx.arc(end.x, end.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBlockMark(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = withAlpha(color, 0.7);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5);
  ctx.lineTo(x + 5, y + 5);
  ctx.moveTo(x + 5, y - 5);
  ctx.lineTo(x - 5, y + 5);
  ctx.stroke();
  ctx.restore();
}

/** 발사된 함수 공격: 잔상 → 넓은 발광 → 선명한 중심선 → 진행 중인 머리. */
export function drawAttack(ctx: CanvasRenderingContext2D, a: CurveAttack): void {
  const path = a.path;
  if (path.count < 2) return;
  const color = a.def.color;
  const r = a.tuning.hitRadius;
  const head = a.headLength;
  const tail = a.tailLength;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';

  // 잔상(판정 없음): 사라지는 동안 전체 궤적이 희미하게 남는다.
  const ghost = a.ghostAlpha;
  if (ghost > 0) {
    ctx.strokeStyle = withAlpha(color, 0.16 * ghost);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    tracePath(ctx, path, 0, head);
    ctx.stroke();
  }

  const alpha = a.alpha;
  if (head > tail && alpha > 0) {
    ctx.beginPath();
    tracePath(ctx, path, tail, head);
    ctx.strokeStyle = withAlpha(color, 0.1 * alpha);
    ctx.lineWidth = r * 2 + 12;
    ctx.stroke();
    ctx.strokeStyle = withAlpha(color, 0.3 * alpha);
    ctx.lineWidth = r * 2;
    ctx.stroke();
    ctx.strokeStyle = withAlpha(mix(color, '#ffffff', 0.35), 0.95 * alpha);
    ctx.lineWidth = Math.max(2, r * 0.7);
    ctx.stroke();

    if (a.phase === 'grow') {
      // 방금 그려진 앞부분을 더 밝게 + 머리 불꽃
      const freshFrom = Math.max(tail, head - 70);
      ctx.beginPath();
      tracePath(ctx, path, freshFrom, head);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = Math.max(1.5, r * 0.5);
      ctx.stroke();
      const hp = pointAtLength(path, head);
      const hr = r * 2.4 + 6;
      const g = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, hr);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.35, withAlpha(color, 0.6));
      g.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ───────────── 캐릭터 ───────────── */

export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, def: FunctionWeaponDef, time: number): void {
  if (!p.alive) return;
  const b = p.body;
  let alpha = 1;
  if (p.invuln > 0 && Math.floor(time * 16) % 2 === 0) alpha = 0.45;
  const color = p.hurtFlash > 0 ? mix(PALETTE.player, PALETTE.playerHurt, Math.min(1, p.hurtFlash / 0.15)) : PALETTE.player;

  // 발밑 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 1, 16, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  drawStickman(ctx, {
    x: b.x,
    y: b.y,
    scale: 1,
    facing: p.facing,
    pose: poseFor(b.grounded, p.crouching, b.vx, b.vy),
    walkPhase: p.walkPhase,
    color,
    lineWidth: 3.2,
    aim: p.aim,
    armReach: 22,
    weapon: { length: PLAYER.muzzleDistance - 22, color: def.color, glow: withAlpha(def.color, 0.85), recoil: p.recoil },
    headFill: PALETTE.headFill,
    alpha,
  });
}

function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, color: string): void {
  ctx.fillStyle = 'rgba(5,8,16,0.75)';
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.min(1, Math.max(0, frac)), 4);
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, world: World): void {
  const b = e.body;
  const s = e.standHeight / 92;

  if (e.spawnTimer > 0) {
    // 생성 예고: 바닥의 소환진 + 서서히 나타나는 실루엣
    const t = 1 - e.spawnTimer / ENEMIES.spawnTelegraph;
    ctx.save();
    ctx.strokeStyle = withAlpha(e.color, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 1, 26 * s, 6, 0, 0, Math.PI * 2 * Math.min(1, t * 1.4));
    ctx.stroke();
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(b.x - 20 * s, b.y);
    ctx.lineTo(b.x - 20 * s, b.y - b.h * t);
    ctx.moveTo(b.x + 20 * s, b.y);
    ctx.lineTo(b.x + 20 * s, b.y - b.h * t);
    ctx.stroke();
    ctx.restore();
    drawStickman(ctx, {
      x: b.x,
      y: b.y,
      scale: s,
      facing: e.facing,
      pose: 'stand',
      walkPhase: 0,
      color: e.color,
      lineWidth: 2.5,
      headFill: PALETTE.headFill,
      alpha: t * 0.5,
    });
    return;
  }

  const color = e.flash > 0 ? '#ffffff' : e.color;
  const pose = poseFor(b.grounded, e.crouching, b.vx, b.vy);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 1, 15 * s, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (e.elite) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(b.x, b.y - b.h / 2, 4, b.x, b.y - b.h / 2, b.h * 0.7);
    g.addColorStop(0, withAlpha(e.color, 0.22));
    g.addColorStop(1, withAlpha(e.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(b.x - b.h, b.y - b.h * 1.3, b.h * 2, b.h * 1.6);
    ctx.restore();
  }

  let joints;
  if (e.kind === 'melee') {
    let armAngle: number | undefined;
    const cfg = ENEMIES.melee;
    if (e.state === 'windup') {
      const t = 1 - e.stateTimer / cfg.windup;
      armAngle = 0.9 + (-2.4 - 0.9) * t;
    } else if (e.state === 'strike') {
      const t = 1 - e.stateTimer / cfg.strikeTime;
      armAngle = -2.4 + (0.8 + 2.4) * (1 - (1 - t) * (1 - t));
    } else if (e.state === 'recover') {
      armAngle = 0.8;
    } else {
      armAngle = 0.5 + Math.sin(e.walkPhase) * 0.5;
    }
    joints = drawStickman(ctx, {
      x: b.x,
      y: b.y,
      scale: s,
      facing: e.facing,
      pose,
      walkPhase: e.walkPhase,
      color,
      lineWidth: e.elite ? 3.8 : 3,
      armAngle,
      armReach: 24,
      blade: { length: 18, color: e.flash > 0 ? '#ffffff' : '#ffb3c0' },
      headFill: PALETTE.headFill,
    });
    if (e.state === 'windup') {
      // 공격 예고: 머리 위 느낌표
      const t = 1 - e.stateTimer / cfg.windup;
      ctx.fillStyle = withAlpha('#ff3b5c', 0.5 + 0.5 * t);
      ctx.font = `bold ${16 + t * 6}px ${PALETTE.font}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', joints.head.x, joints.head.y - 16 * s);
      ctx.textAlign = 'left';
    }
    if (e.state === 'strike') {
      // 베기 궤적
      const sh = joints.shoulder;
      const rr = (cfg.attackRange + 6) * s;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = withAlpha('#ff3b5c', 0.55);
      ctx.lineWidth = 6;
      ctx.beginPath();
      if (e.facing > 0) ctx.arc(sh.x, sh.y, rr, -1.6, 0.9);
      else ctx.arc(sh.x, sh.y, rr, Math.PI + 1.6, Math.PI - 0.9, true);
      ctx.stroke();
      ctx.restore();
    }
  } else {
    joints = drawStickman(ctx, {
      x: b.x,
      y: b.y,
      scale: s,
      facing: e.facing,
      pose,
      walkPhase: e.walkPhase,
      color,
      lineWidth: e.elite ? 3.6 : 2.8,
      aim: e.aim,
      armReach: 18,
      weapon: { length: 16, color: e.color, glow: withAlpha(e.color, 0.6), recoil: 0 },
      headFill: PALETTE.headFill,
    });
    if (e.state === 'aim' && joints.muzzle) drawAimTelegraph(ctx, e, joints.muzzle, world);
  }

  // 체력바
  const frac = e.hp / e.maxHp;
  const recentlyHit = world.time - e.lastHitAt < 1.5;
  hpBar(ctx, b.x, b.y - b.h - 16 * s, 38 * s, frac, recentlyHit ? '#ffffff' : withAlpha(e.color, 0.9));
}

function drawAimTelegraph(ctx: CanvasRenderingContext2D, e: Enemy, muzzle: Vec2, world: World): void {
  const cfg = ENEMIES.ranged;
  const t = 1 - e.stateTimer / cfg.telegraph;
  const len = 900;
  const ex = muzzle.x + e.aim.x * len;
  const ey = muzzle.y + e.aim.y * len;
  const hit = world.arena.raycast(muzzle.x, muzzle.y, ex, ey);
  const tx = hit ? hit.x : ex;
  const ty = hit ? hit.y : ey;
  ctx.save();
  if (e.aimLocked) {
    ctx.strokeStyle = withAlpha(e.color, Math.floor(world.time * 20) % 2 ? 0.75 : 0.4);
    ctx.lineWidth = 1.6;
  } else {
    ctx.strokeStyle = withAlpha(e.color, 0.12 + 0.25 * t);
    ctx.setLineDash([3, 6]);
    ctx.lineWidth = 1;
  }
  ctx.beginPath();
  ctx.moveTo(muzzle.x, muzzle.y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.restore();
  // 총구 충전
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = withAlpha(e.color, 0.35 + 0.5 * t);
  ctx.beginPath();
  ctx.arc(muzzle.x, muzzle.y, 2 + 4 * t, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBullets(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of world.bullets) {
    const len = Math.hypot(b.vx, b.vy) || 1;
    const tx = b.x - (b.vx / len) * 22;
    const ty = b.y - (b.vy / len) * 22;
    const g = ctx.createLinearGradient(tx, ty, b.x, b.y);
    g.addColorStop(0, withAlpha(b.color, 0));
    g.addColorStop(1, withAlpha(b.color, 0.7));
    ctx.strokeStyle = g;
    ctx.lineWidth = b.radius * 1.6;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#fff3e6';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(b.color, 0.35);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ───────────── 파티클·글자 ───────────── */

export function drawEffects(ctx: CanvasRenderingContext2D, world: World): void {
  const fx = world.fx;
  ctx.save();
  ctx.lineCap = 'round';
  for (const p of fx.particles) {
    const k = Math.max(0, p.life / p.maxLife);
    switch (p.kind) {
      case 'spark': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = withAlpha(p.color, k);
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
        ctx.stroke();
        break;
      }
      case 'stick': {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = withAlpha(p.color, Math.min(1, k * 1.6));
        ctx.lineWidth = 3;
        const dx = Math.cos(p.rot) * p.size * 0.5;
        const dy = Math.sin(p.rot) * p.size * 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x - dx, p.y - dy);
        ctx.lineTo(p.x + dx, p.y + dy);
        ctx.stroke();
        break;
      }
      case 'ring': {
        ctx.globalCompositeOperation = p.gravity > 0 ? 'source-over' : 'lighter';
        ctx.strokeStyle = withAlpha(p.color, p.gravity > 0 ? Math.min(1, k * 1.6) : k * 0.8);
        ctx.lineWidth = p.gravity > 0 ? 3 : 2;
        const rad = p.gravity > 0 ? p.size : p.size * (1.6 - k * 0.6);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'dust':
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = withAlpha(p.color, k * 0.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.5 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'portal':
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = withAlpha(p.color, k * 0.7);
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        break;
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center';
  for (const t of fx.texts) {
    const k = Math.max(0, t.life / t.maxLife);
    ctx.font = `bold ${t.size}px ${PALETTE.font}`;
    ctx.fillStyle = 'rgba(3,5,10,0.6)';
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.fillText(t.text, t.x + 1, t.y + 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.restore();
}

/** 십자 조준점 + 현재 무기 재사용 대기 링. */
export function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, cooldownFrac: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(3,5,10,0.7)';
  ctx.lineWidth = 3.5;
  const arms = (lw: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x - 13, y);
    ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + 13, y);
    ctx.moveTo(x, y - 13);
    ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x, y + 13);
    ctx.stroke();
  };
  arms(3.5, 'rgba(3,5,10,0.7)');
  arms(1.6, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
  // 쿨다운 링
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = withAlpha(color, 0.2);
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = withAlpha(color, cooldownFrac > 0 ? 0.9 : 0.55);
  ctx.beginPath();
  const ready = 1 - cooldownFrac;
  ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ready);
  ctx.stroke();
  ctx.restore();
}
