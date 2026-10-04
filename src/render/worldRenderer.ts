import { ENEMIES, PLAYER, TERRAIN, VIEW } from '../config';
import type { Vec2 } from '../core/geometry';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import type { World } from '../game/world';
import type { CurveAttack } from '../weapons/attack';
import { forEachSegmentInRange, pointAtLength, type CurvePath } from '../weapons/curve';
import type { FunctionWeaponDef } from '../weapons/types';
import type { Solid } from '../world/arena';
import { PALETTE, withAlpha } from './colors';
import { drawStickman, poseFor } from './stickman';

/* ───────────── 배경: 무한히 이어지는 좌표평면 ───────────── */

/** 월드 x → 좌표평면의 x값(눈금 단위). */
export function mathX(x: number): number {
  return (x - TERRAIN.originX) / TERRAIN.unit;
}

/** 월드 y → 좌표평면의 y값(위가 +). */
export function mathY(y: number): number {
  return (TERRAIN.originY - y) / TERRAIN.unit;
}

function formatTick(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/**
 * 카메라가 보는 범위만큼 격자·좌표축·눈금을 그린다. 배경의 좌표는 실제 월드 좌표와 같으므로
 * 아무리 멀리 가도 격자와 눈금 숫자가 끊기지 않고 이어진다.
 */
export function drawCoordinatePlane(ctx: CanvasRenderingContext2D, cam: Vec2): void {
  const x0 = cam.x - 40;
  const x1 = cam.x + VIEW.width + 40;
  const y0 = cam.y - 40;
  const y1 = cam.y + VIEW.height + 40;
  const { originX: ox, originY: oy, unit } = TERRAIN;

  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  const gridLines = (step: number, style: string) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = ox + Math.ceil((x0 - ox) / step) * step; x <= x1; x += step) {
      ctx.moveTo(x + 0.5, y0);
      ctx.lineTo(x + 0.5, y1);
    }
    for (let y = oy + Math.ceil((y0 - oy) / step) * step; y <= y1; y += step) {
      ctx.moveTo(x0, y + 0.5);
      ctx.lineTo(x1, y + 0.5);
    }
    ctx.stroke();
  };
  gridLines(unit / 5, PALETTE.gridMinor);
  gridLines(unit, PALETTE.gridMajor);

  // x축과 눈금
  ctx.strokeStyle = PALETTE.axis;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, oy);
  ctx.lineTo(x1, oy);
  ctx.stroke();
  ctx.font = `12px ${PALETTE.mathFont}`;
  ctx.textAlign = 'center';
  for (let x = ox + Math.ceil((x0 - ox) / (unit / 2)) * (unit / 2); x <= x1; x += unit / 2) {
    const v = (x - ox) / unit;
    const major = Math.abs(v - Math.round(v)) < 1e-6;
    ctx.fillStyle = PALETTE.axis;
    ctx.fillRect(x - 0.5, oy - (major ? 5 : 3), 1, major ? 10 : 6);
    if (major && Math.abs(v) > 1e-6) {
      ctx.fillStyle = PALETTE.tickLabel;
      ctx.fillText(formatTick(Math.round(v)), x, oy + 18);
    }
  }
  ctx.font = `italic 16px ${PALETTE.mathFont}`;
  ctx.fillStyle = PALETTE.axisLabel;
  ctx.fillText('x', cam.x + VIEW.width - 18, oy - 10);

  // y축(보일 때)과 눈금. y축이 화면 밖이면 왼쪽 가장자리에 y눈금 숫자를 띄워 둔다.
  const yAxisVisible = ox > cam.x + 10 && ox < cam.x + VIEW.width - 10;
  const labelX = yAxisVisible ? ox + 10 : cam.x + 12;
  if (yAxisVisible) {
    ctx.strokeStyle = PALETTE.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox, y0);
    ctx.lineTo(ox, y1);
    ctx.stroke();
    ctx.font = `italic 16px ${PALETTE.mathFont}`;
    ctx.fillStyle = PALETTE.axisLabel;
    ctx.textAlign = 'left';
    ctx.fillText('y', ox + 10, cam.y + 128);
    ctx.font = `12px ${PALETTE.mathFont}`;
    ctx.fillStyle = PALETTE.tickLabel;
    ctx.fillText('O', ox + 6, oy + 18);
  }
  ctx.textAlign = 'left';
  ctx.font = `12px ${PALETTE.mathFont}`;
  for (let y = oy + Math.ceil((y0 - oy) / unit) * unit; y <= y1; y += unit) {
    const v = Math.round((oy - y) / unit);
    if (v === 0) continue;
    if (yAxisVisible) {
      ctx.fillStyle = PALETTE.axis;
      ctx.fillRect(ox - 5, y - 0.5, 10, 1);
    }
    ctx.fillStyle = PALETTE.tickLabel;
    ctx.fillText(String(v), labelX, y + 4);
  }
}

export function drawTerrain(ctx: CanvasRenderingContext2D, solids: readonly Solid[], cam: Vec2): void {
  const left = cam.x - 20;
  const right = cam.x + VIEW.width + 20;
  for (const s of solids) {
    const x = Math.max(s.x, left);
    const x2 = Math.min(s.x + s.w, right);
    const y = s.y;
    const h = Math.min(s.h, cam.y + VIEW.height + 20 - s.y);
    const w = x2 - x;
    if (w <= 0 || h <= 0) continue;
    const g = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 120));
    g.addColorStop(0, PALETTE.terrainTop);
    g.addColorStop(1, PALETTE.terrainBottom);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // 빗금 무늬(월드 좌표에 고정되어 카메라가 움직여도 미끄러지지 않음)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = PALETTE.terrainHatch;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startK = Math.floor((x - h) / 12) * 12;
    for (let k = startK; k < x + w; k += 12) {
      ctx.moveTo(k, y + h);
      ctx.lineTo(k + h, y);
    }
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x + 0.5, y + 0.5, s.w - 1, s.h - 1);
    ctx.strokeStyle = withAlpha(PALETTE.terrainEdge, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x2, y + 1);
    ctx.stroke();
    if (s.kind === 'ledge') {
      // 숙여서 지나가는 낮은 턱: 아랫면에 점선 표시
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x + 4, y + s.h - 1);
      ctx.lineTo(s.x + s.w - 4, y + s.h - 1);
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

function drawBlockMark(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alpha: number): void {
  ctx.save();
  ctx.strokeStyle = withAlpha(color, alpha);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5);
  ctx.lineTo(x + 5, y + 5);
  ctx.moveTo(x + 5, y - 5);
  ctx.lineTo(x - 5, y + 5);
  ctx.stroke();
  ctx.restore();
}

/** 조준 미리보기: 얇고 반투명한 점선. 지형에 막히면 막힌 지점에 X 표시. */
export function drawPreview(ctx: CanvasRenderingContext2D, path: CurvePath, ready: boolean): void {
  const color = '#ffffff';
  if (path.count < 2) {
    drawBlockMark(ctx, path.xs[0], path.ys[0], color, 0.7);
    return;
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash([6, 7]);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = withAlpha(color, ready ? 0.55 : 0.25);
  ctx.beginPath();
  tracePath(ctx, path, 0, path.length);
  ctx.stroke();
  ctx.restore();
  const end = pointAtLength(path, path.length);
  if (path.blocked) drawBlockMark(ctx, end.x, end.y, color, 0.7);
  else {
    ctx.fillStyle = withAlpha(color, ready ? 0.65 : 0.3);
    ctx.beginPath();
    ctx.arc(end.x, end.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 적의 예고선: 회색 점선이 깜빡이며, 곧 이 경로로 함수 공격이 날아온다. */
export function drawEnemyPreview(ctx: CanvasRenderingContext2D, path: CurvePath, urgency: number, time: number): void {
  if (path.count < 2) return;
  const blink = urgency > 0.7 && Math.floor(time * 16) % 2 === 0 ? 0.35 : 1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash([3, 6]);
  ctx.lineWidth = 1.4 + urgency;
  ctx.strokeStyle = withAlpha(PALETTE.enemyPreview, (0.25 + 0.45 * urgency) * blink);
  ctx.beginPath();
  tracePath(ctx, path, 0, path.length);
  ctx.stroke();
  ctx.restore();
  const end = pointAtLength(path, path.length);
  ctx.strokeStyle = withAlpha(PALETTE.enemyPreview, 0.6 * blink);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 4 + 3 * urgency, 0, Math.PI * 2);
  ctx.stroke();
}

/** 플레이어 공격: 잔상 → 넓은 발광 → 선명한 흰 중심선 → 진행 중인 머리. */
export function drawAttack(ctx: CanvasRenderingContext2D, a: CurveAttack): void {
  const path = a.path;
  if (path.count < 2) return;
  const color = '#ffffff';
  const r = a.tuning.hitRadius;
  const head = a.headLength;
  const tail = a.tailLength;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';

  const ghost = a.ghostAlpha;
  if (ghost > 0) {
    ctx.strokeStyle = withAlpha(color, 0.14 * ghost);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    tracePath(ctx, path, 0, head);
    ctx.stroke();
  }

  const alpha = a.alpha;
  if (head > tail && alpha > 0) {
    ctx.beginPath();
    tracePath(ctx, path, tail, head);
    ctx.strokeStyle = withAlpha(color, 0.08 * alpha);
    ctx.lineWidth = r * 2 + 12;
    ctx.stroke();
    ctx.strokeStyle = withAlpha(color, 0.22 * alpha);
    ctx.lineWidth = r * 2;
    ctx.stroke();
    ctx.strokeStyle = withAlpha(color, 0.95 * alpha);
    ctx.lineWidth = Math.max(2, r * 0.7);
    ctx.stroke();

    if (a.phase === 'grow') {
      const hp = pointAtLength(path, head);
      const hr = r * 2.4 + 6;
      const g = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, hr);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** 적 공격: 속이 빈 이중선(흰 테두리 + 검은 속)으로 그려 플레이어 공격과 구분한다. */
export function drawEnemyAttack(ctx: CanvasRenderingContext2D, a: CurveAttack): void {
  const path = a.path;
  if (path.count < 2) return;
  const r = a.tuning.hitRadius;
  const head = a.headLength;
  const tail = a.tailLength;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const ghost = a.ghostAlpha;
  if (ghost > 0) {
    ctx.strokeStyle = withAlpha(PALETTE.enemyCurve, 0.12 * ghost);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    tracePath(ctx, path, 0, head);
    ctx.stroke();
  }
  const alpha = a.alpha;
  if (head > tail && alpha > 0) {
    ctx.beginPath();
    tracePath(ctx, path, tail, head);
    ctx.strokeStyle = withAlpha(PALETTE.enemyCurve, 0.9 * alpha);
    ctx.lineWidth = r * 2 + 3;
    ctx.stroke();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1.5, r * 2 - 2);
    ctx.stroke();
    if (a.phase === 'grow') {
      const hp = pointAtLength(path, head);
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = PALETTE.enemyCurve;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, r + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* ───────────── 캐릭터 ───────────── */

export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, def: FunctionWeaponDef, time: number): void {
  if (!p.alive) return;
  const b = p.body;
  let alpha = 1;
  if (p.invuln > 0 && Math.floor(time * 16) % 2 === 0) alpha = 0.4;
  const color = p.hurtFlash > 0 && Math.floor(time * 24) % 2 === 0 ? PALETTE.playerHurt : PALETTE.player;

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
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
    weapon: { length: PLAYER.muzzleDistance - 22, color: def.color, glow: 'rgba(255,255,255,0.85)', recoil: p.recoil },
    headFill: PALETTE.headFill,
    alpha,
  });
}

function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, bright: boolean): void {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - w / 2 - 1.5, y - 1.5, w + 3, 7);
  ctx.fillStyle = bright ? '#ffffff' : '#bdbdbd';
  ctx.fillRect(x - w / 2, y, w * Math.min(1, Math.max(0, frac)), 4);
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, world: World): void {
  const b = e.body;
  const s = e.scale;
  const boss = e.kind === 'boss';

  if (e.spawnTimer > 0) {
    // 생성 예고: 바닥의 소환진 + 서서히 나타나는 실루엣
    const t = 1 - e.spawnTimer / e.spawnDuration;
    ctx.save();
    ctx.strokeStyle = withAlpha('#ffffff', 0.6);
    ctx.lineWidth = boss ? 3 : 2;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 1, 26 * s, 6 * Math.sqrt(s), 0, 0, Math.PI * 2 * Math.min(1, t * 1.4));
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
      lineWidth: boss ? 5 : 2.5,
      headFill: PALETTE.headFill,
      headShape: e.head,
      alpha: t * 0.5,
    });
    return;
  }

  const color = e.flash > 0 ? (boss ? '#7a7a7a' : '#ffffff') : e.color;
  const pose = poseFor(b.grounded, e.crouching, b.vx, b.vy);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 1, 15 * s, 3 * Math.sqrt(s), 0, 0, Math.PI * 2);
  ctx.fill();

  if (e.elite || boss) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(b.x, b.y - b.h / 2, 4, b.x, b.y - b.h / 2, b.h * 0.75);
    g.addColorStop(0, `rgba(255,255,255,${boss ? 0.12 : 0.1})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(b.x - b.h, b.y - b.h * 1.4, b.h * 2, b.h * 1.7);
    ctx.restore();
  }

  for (const pc of e.pending) {
    const tele = e.kind === 'boss' ? ENEMIES.boss.phases[e.bossPhase].telegraph : e.kind === 'sine' || e.kind === 'lobber' ? ENEMIES[e.kind].telegraph : 1;
    const urgency = Math.min(1, Math.max(0, 1 - e.stateTimer / tele));
    drawEnemyPreview(ctx, pc.path, urgency, world.time);
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
      blade: { length: 18, color: '#ffffff' },
      headFill: PALETTE.headFill,
      headShape: e.head,
    });
    if (e.state === 'windup') {
      // 공격 예고: 머리 위 느낌표
      const t = 1 - e.stateTimer / cfg.windup;
      ctx.fillStyle = withAlpha('#ffffff', 0.5 + 0.5 * t);
      ctx.font = `bold ${16 + t * 6}px ${PALETTE.font}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', joints.head.x, joints.head.y - 16 * s);
      ctx.textAlign = 'left';
    }
    if (e.state === 'strike') {
      const sh = joints.shoulder;
      const rr = (cfg.attackRange + 6) * s;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 5;
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
      lineWidth: boss ? 6 : e.elite ? 3.6 : 2.8,
      aim: e.aim,
      armReach: 18,
      weapon: { length: 16, color: boss ? '#ffffff' : e.color, glow: 'rgba(255,255,255,0.6)', recoil: 0 },
      headFill: PALETTE.headFill,
      headShape: e.head,
    });
    if (e.kind === 'ranged' && e.state === 'aim' && joints.muzzle) drawAimTelegraph(ctx, e, joints.muzzle, world);
  }

  if (!boss) {
    const recentlyHit = world.time - e.lastHitAt < 1.5;
    hpBar(ctx, b.x, b.y - b.h - 18 * s, 38 * s, e.hp / e.maxHp, recentlyHit);
  }
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
    ctx.strokeStyle = withAlpha('#ffffff', Math.floor(world.time * 20) % 2 ? 0.75 : 0.35);
    ctx.lineWidth = 1.6;
  } else {
    ctx.strokeStyle = withAlpha('#ffffff', 0.1 + 0.25 * t);
    ctx.setLineDash([3, 6]);
    ctx.lineWidth = 1;
  }
  ctx.beginPath();
  ctx.moveTo(muzzle.x, muzzle.y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.restore();
}

export function drawBullets(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (const b of world.bullets) {
    const len = Math.hypot(b.vx, b.vy) || 1;
    const tx = b.x - (b.vx / len) * 24;
    const ty = b.y - (b.vy / len) * 24;
    const g = ctx.createLinearGradient(tx, ty, b.x, b.y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.6)');
    ctx.strokeStyle = g;
    ctx.lineWidth = b.radius * 1.2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // 속이 빈 원: 적 탄환(플레이어 공격은 꽉 찬 흰 선)
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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
      case 'spark':
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = withAlpha(p.color, k);
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
        ctx.stroke();
        break;
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
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.restore();
}

/** 십자 조준점 + 현재 무기 재사용 대기 링(화면 좌표). */
export function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number, cooldownFrac: number): void {
  ctx.save();
  ctx.lineCap = 'round';
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
  arms(3.5, 'rgba(0,0,0,0.8)');
  arms(1.6, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = cooldownFrac > 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cooldownFrac));
  ctx.stroke();
  ctx.restore();
}
