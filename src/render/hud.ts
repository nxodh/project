import { WORLD } from '../config';
import { enemiesRemaining } from '../game/waves';
import type { World } from '../game/world';
import type { FunctionWeaponDef } from '../weapons/types';
import { mix, PALETTE, withAlpha } from './colors';

const SLOT_W = 116;
const SLOT_H = 62;
const SLOT_GAP = 8;
const SLOT_Y = 830;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 슬롯 아이콘: 함수의 실제 그래프(정의역 전체)를 작은 좌표축 위에 그린다. */
export function drawFunctionIcon(
  ctx: CanvasRenderingContext2D,
  def: FunctionWeaponDef,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number,
): void {
  const [x0, x1] = def.domain;
  const N = 64;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (let i = 0; i <= N; i++) {
    const v = def.fn(x0 + ((x1 - x0) * i) / N);
    ymin = Math.min(ymin, v);
    ymax = Math.max(ymax, v);
  }
  ymin = Math.min(ymin, 0);
  ymax = Math.max(ymax, 0);
  if (ymax - ymin < 1e-6) ymax = ymin + 1;
  const xmin = Math.min(x0, 0);
  const xmax = Math.max(x1, 0);
  const sx = (v: number) => x + ((v - xmin) / (xmax - xmin)) * w;
  const sy = (v: number) => y + h - ((v - ymin) / (ymax - ymin)) * h;

  ctx.save();
  ctx.strokeStyle = `rgba(160,180,230,${0.35 * alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 2, sy(0));
  ctx.lineTo(x + w + 2, sy(0));
  ctx.moveTo(sx(0), y - 2);
  ctx.lineTo(sx(0), y + h + 2);
  ctx.stroke();
  ctx.strokeStyle = withAlpha(def.color, alpha);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const xv = x0 + ((x1 - x0) * i) / N;
    const px = sx(xv);
    const py = sy(def.fn(xv));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSlots(ctx: CanvasRenderingContext2D, world: World): void {
  const p = world.player;
  const n = world.weapons.length;
  const total = n * SLOT_W + (n - 1) * SLOT_GAP;
  const x0 = (WORLD.width - total) / 2;
  world.weapons.forEach((def, i) => {
    const selected = i === p.weaponIndex;
    const x = x0 + i * (SLOT_W + SLOT_GAP);
    const y = SLOT_Y - (selected ? 4 : 0);
    roundRect(ctx, x, y, SLOT_W, SLOT_H, 8);
    ctx.fillStyle = selected ? mix('#0c1222', def.color, 0.16) : 'rgba(8,12,22,0.86)';
    ctx.fill();
    ctx.lineWidth = selected ? 2.2 : 1;
    ctx.strokeStyle = selected ? def.color : 'rgba(140,160,210,0.25)';
    ctx.stroke();

    // 재사용 대기: 위에서부터 어둡게 덮고 남은 시간 표시
    const cd = p.cooldowns[i];
    const frac = def.tuning.cooldown > 0 ? cd / def.tuning.cooldown : 0;
    if (frac > 0) {
      ctx.save();
      roundRect(ctx, x, y, SLOT_W, SLOT_H, 8);
      ctx.clip();
      ctx.fillStyle = 'rgba(2,4,10,0.6)';
      ctx.fillRect(x, y, SLOT_W, SLOT_H * frac);
      ctx.restore();
    }

    const a = selected ? 1 : 0.6;
    ctx.font = `bold 13px ${PALETTE.font}`;
    ctx.fillStyle = selected ? def.color : PALETTE.textDim;
    ctx.fillText(String(i + 1), x + 8, y + 17);
    ctx.font = `bold 12px ${PALETTE.font}`;
    ctx.fillStyle = withAlpha(PALETTE.text, a);
    ctx.fillText(def.name, x + 22, y + 17);
    ctx.font = `italic 14px ${PALETTE.mathFont}`;
    ctx.fillStyle = withAlpha(def.color, selected ? 1 : 0.7);
    ctx.fillText(def.formula, x + 8, y + 50);
    drawFunctionIcon(ctx, def, x + SLOT_W - 44, y + 26, 34, 26, a);

    if (frac > 0) {
      ctx.font = `bold 12px ${PALETTE.font}`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'right';
      ctx.fillText(`${cd.toFixed(1)}s`, x + SLOT_W - 8, y + 17);
      ctx.textAlign = 'left';
    }
  });
}

function drawWeaponInfo(ctx: CanvasRenderingContext2D, world: World): void {
  const def = world.currentWeapon;
  const t = def.tuning;
  const x = 40;
  const y = 846;
  ctx.font = `bold 15px ${PALETTE.font}`;
  ctx.fillStyle = def.color;
  ctx.fillText(`${def.name} · ${def.shape}`, x, y);
  const nameW = ctx.measureText(`${def.name} · ${def.shape}`).width;
  ctx.font = `italic 20px ${PALETTE.mathFont}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(def.formula, x + nameW + 14, y + 1);
  ctx.font = `12px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(def.role, x, y + 21);
  ctx.fillText(`피해 ${t.damage}  ·  사거리 ${t.range}  ·  대기 ${t.cooldown.toFixed(2)}s  ·  두께 ${t.hitRadius * 2}`, x, y + 39);
}

function drawControls(ctx: CanvasRenderingContext2D): void {
  const x = WORLD.width - 40;
  ctx.textAlign = 'right';
  ctx.font = `12px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('A/D 이동 · W 점프 · S 숙이기', x, 846);
  ctx.fillText('마우스 조준 · 좌클릭 공격(누르면 연사)', x, 864);
  ctx.fillText('1~5 / 휠 함수 교체 · Esc 일시 정지', x, 882);
  ctx.textAlign = 'left';
}

function drawTopBar(ctx: CanvasRenderingContext2D, world: World): void {
  const p = world.player;
  // 체력
  const x = 36;
  const y = 28;
  ctx.font = `bold 13px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('HP', x, y + 13);
  const bw = 260;
  const frac = p.hp / p.maxHp;
  roundRect(ctx, x + 30, y, bw, 16, 4);
  ctx.fillStyle = 'rgba(8,12,22,0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,210,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (frac > 0) {
    roundRect(ctx, x + 32, y + 2, (bw - 4) * frac, 12, 3);
    ctx.fillStyle = frac > 0.35 ? PALETTE.hpGood : PALETTE.hpLow;
    if (p.hurtFlash > 0) ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.font = `bold 12px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, x + 30 + bw + 10, y + 13);

  ctx.font = `bold 22px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, x, y + 50);

  // 웨이브
  const w = world.waves;
  ctx.textAlign = 'center';
  ctx.font = `bold 24px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(w.wave > 0 ? `WAVE ${w.wave}` : 'READY', WORLD.width / 2, y + 18);
  ctx.font = `13px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.textDim;
  const sub =
    w.phase === 'intermission'
      ? `다음 웨이브까지 ${Math.max(0, w.timer).toFixed(1)}초`
      : `남은 적 ${enemiesRemaining(world)}`;
  ctx.fillText(sub, WORLD.width / 2, y + 40);

  // 처치 수
  ctx.textAlign = 'right';
  ctx.font = `bold 15px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`처치 ${world.kills}`, WORLD.width - 36, y + 13);
  ctx.font = `12px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.textDim;
  const acc = world.stats.shots > 0 ? Math.round((world.stats.hits / world.stats.shots) * 100) : 0;
  ctx.fillText(`발사 ${world.stats.shots} · 명중 ${world.stats.hits} (${acc}%)`, WORLD.width - 36, y + 32);
  ctx.textAlign = 'left';
}

function drawBanner(ctx: CanvasRenderingContext2D, world: World): void {
  const b = world.banner;
  if (!b) return;
  const t = b.age / b.duration;
  if (t >= 1) return;
  const alpha = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = `bold 46px ${PALETTE.font}`;
  ctx.fillStyle = 'rgba(3,5,10,0.6)';
  ctx.fillText(b.title, WORLD.width / 2 + 2, 196);
  ctx.fillStyle = b.color;
  ctx.fillText(b.title, WORLD.width / 2, 194);
  ctx.font = `16px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(b.subtitle, WORLD.width / 2, 224);
  ctx.restore();
}

export function drawHud(ctx: CanvasRenderingContext2D, world: World, showGameplayHud: boolean): void {
  // 바닥 띠를 HUD 영역으로 사용한다.
  ctx.fillStyle = 'rgba(4,7,14,0.55)';
  ctx.fillRect(0, 822, WORLD.width, WORLD.height - 822);
  drawSlots(ctx, world);
  drawWeaponInfo(ctx, world);
  drawControls(ctx);
  if (showGameplayHud) {
    drawTopBar(ctx, world);
    drawBanner(ctx, world);
  }
}
