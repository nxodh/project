import { TERRAIN, VIEW } from '../config';
import { bossPhaseOf } from '../game/bossAI';
import { enemiesRemaining } from '../game/waves';
import type { World } from '../game/world';
import type { FunctionWeaponDef } from '../weapons/types';
import { PALETTE } from './colors';
import { mathX, mathY } from './worldRenderer';

const SLOT_W = 128;
const SLOT_H = 62;
const SLOT_GAP = 6;
const SLOT_Y = 830;
const BAR_Y = 820;

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
  color: string,
): void {
  if (def.trace) {
    // 매개변수 곡선(원): 상자 안에 비율을 유지해 그린다.
    const size = Math.min(w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const M = 48;
    for (let i = 0; i <= M; i++) {
      const { u, v } = def.trace(i / M);
      const px = cx + (u - 0.5) * size;
      const py = cy - v * 0.5 * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
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
  ctx.globalAlpha *= 0.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 2, sy(0));
  ctx.lineTo(x + w + 2, sy(0));
  ctx.moveTo(sx(0), y - 2);
  ctx.lineTo(sx(0), y + h + 2);
  ctx.stroke();
  ctx.globalAlpha /= 0.4;
  ctx.strokeStyle = color;
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
  const n = world.loadout.length;
  const total = n * SLOT_W + (n - 1) * SLOT_GAP;
  const x0 = (VIEW.width - total) / 2;
  world.loadout.forEach((_slot, i) => {
    const def = world.slotWeapon(i);
    const selected = i === p.weaponIndex;
    const x = x0 + i * (SLOT_W + SLOT_GAP);
    const y = SLOT_Y - (selected ? 4 : 0);
    // 선택된 슬롯은 흑백 반전(흰 바탕·검은 글자)
    const fg = selected ? '#000000' : '#ffffff';
    roundRect(ctx, x, y, SLOT_W, SLOT_H, 7);
    ctx.fillStyle = selected ? '#ffffff' : 'rgba(10,10,10,0.92)';
    ctx.fill();
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = selected ? '#ffffff' : PALETTE.panelLine;
    ctx.stroke();

    // 재사용 대기: 위에서부터 회색으로 덮고 남은 시간 표시
    const cd = p.cooldowns[i];
    const frac = def.tuning.cooldown > 0 ? cd / def.tuning.cooldown : 0;
    if (frac > 0) {
      ctx.save();
      roundRect(ctx, x, y, SLOT_W, SLOT_H, 7);
      ctx.clip();
      ctx.fillStyle = selected ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, y, SLOT_W, SLOT_H * frac);
      ctx.restore();
    }

    ctx.globalAlpha = selected ? 1 : 0.72;
    ctx.font = `bold 11px ${PALETTE.font}`;
    ctx.fillStyle = fg;
    ctx.fillText(String(i + 1), x + 6, y + 14);
    ctx.font = `bold 11px ${PALETTE.font}`;
    ctx.fillText(def.name, x + 17, y + 14);
    drawFunctionIcon(ctx, def, x + 22, y + 20, SLOT_W - 44, 20, fg);
    ctx.font = `italic 12px ${PALETTE.mathFont}`;
    ctx.textAlign = 'center';
    ctx.fillText(def.formula, x + SLOT_W / 2, y + 56);
    ctx.textAlign = 'left';
    if (frac > 0) {
      ctx.font = `bold 10px ${PALETTE.font}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${cd.toFixed(1)}`, x + SLOT_W - 5, y + 30);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  });
}

function drawWeaponInfo(ctx: CanvasRenderingContext2D, world: World): void {
  const def = world.currentWeapon;
  const t = def.tuning;
  const x = 22;
  const y = 846;
  ctx.font = `bold 14px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.text;
  const title = `${def.name} · ${def.shape}`;
  ctx.fillText(title, x, y);
  const w = ctx.measureText(title).width;
  ctx.font = `italic 17px ${PALETTE.mathFont}`;
  ctx.fillText(def.formula, x + w + 10, y + 1);
  ctx.font = `11px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(def.role, x, y + 20);
  ctx.fillText(`피해 ${t.damage} · 사거리 ${t.range} · 대기 ${t.cooldown.toFixed(2)}s · 두께 ${t.hitRadius * 2}`, x, y + 38);
}

function drawControls(ctx: CanvasRenderingContext2D): void {
  const x = VIEW.width - 22;
  ctx.textAlign = 'right';
  ctx.font = `11px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('A/D 이동 · Space 점프 · S 숙이기', x, 846);
  ctx.fillText('마우스 조준 · 좌클릭 공격(누르면 연사)', x, 864);
  ctx.fillText('1~5 / 휠 슬롯 · E 인벤토리·진화 · Esc 일시 정지', x, 882);
  ctx.textAlign = 'left';
}

function drawTopBar(ctx: CanvasRenderingContext2D, world: World): void {
  const p = world.player;
  const x = 30;
  const y = 26;
  ctx.font = `bold 13px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('HP', x, y + 13);
  const bw = 250;
  const frac = p.hp / p.maxHp;
  roundRect(ctx, x + 28, y, bw, 16, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const low = frac <= 0.35;
  if (frac > 0) {
    roundRect(ctx, x + 30, y + 2, (bw - 4) * frac, 12, 2);
    // 체력이 낮으면 깜빡인다(흑백이므로 색 대신 깜빡임으로 경고)
    ctx.fillStyle = low && Math.floor(world.time * 6) % 2 === 0 ? '#8a8a8a' : '#ffffff';
    ctx.fill();
  }
  ctx.font = `bold 12px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, x + 28 + bw + 10, y + 13);

  ctx.font = `bold 22px ${PALETTE.font}`;
  ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, x, y + 48);
  // 좌표평면 위 현재 위치
  ctx.font = `italic 14px ${PALETTE.mathFont}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`P(${mathX(p.body.x).toFixed(2)}, ${mathY(p.body.y).toFixed(2)})`, x, y + 70);

  // 웨이브
  const w = world.waves;
  ctx.textAlign = 'center';
  ctx.font = `bold 24px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(w.wave > 0 ? `WAVE ${w.wave}` : 'READY', VIEW.width / 2, y + 18);
  ctx.font = `13px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.textDim;
  const sub =
    w.phase === 'intermission'
      ? `다음 보스까지 ${Math.max(0, w.timer).toFixed(1)}초 · E로 장비 정비`
      : `남은 보스 ${enemiesRemaining(world)}`;
  ctx.fillText(sub, VIEW.width / 2, y + 38);

  // 처치 수
  ctx.textAlign = 'right';
  ctx.font = `bold 15px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`처치 ${world.kills}`, VIEW.width - 30, y + 13);
  ctx.font = `12px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.textDim;
  const acc = world.stats.shots > 0 ? Math.round((world.stats.hits / world.stats.shots) * 100) : 0;
  ctx.fillText(`발사 ${world.stats.shots} · 명중 ${world.stats.hits} (${acc}%)`, VIEW.width - 30, y + 32);
  ctx.fillText(`보스 처치 ${world.stats.bossesDefeated} · 진화 포인트 ${world.evoPoints}`, VIEW.width - 30, y + 50);
  ctx.textAlign = 'left';
}

function drawBossBar(ctx: CanvasRenderingContext2D, world: World): void {
  const boss = world.boss;
  if (!boss) return;
  const w = 620;
  const x = (VIEW.width - w) / 2;
  const y = 94;
  const appear = Math.min(1, 1 - boss.spawnTimer / boss.spawnDuration);
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.textAlign = 'center';
  ctx.font = `bold 14px ${PALETTE.font}`;
  ctx.fillStyle = PALETTE.text;
  const phase = bossPhaseOf(boss) + 1;
  ctx.fillText(`함수의 군주 · ${phase}단계${boss.castName ? `  —  ${boss.castName}` : ''}`, VIEW.width / 2, y - 6);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(x, y, w, 12);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, 13);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 2, y + 2, (w - 4) * Math.max(0, boss.hp / boss.maxHp), 8);
  // 단계 경계 눈금(60%, 30%)
  ctx.fillStyle = '#000000';
  for (const f of [0.6, 0.3]) ctx.fillRect(x + w * f - 1, y + 1, 2, 10);
  ctx.restore();
}

/** 화면 밖에 있는 적의 방향과 거리를 화면 가장자리에 화살표로 표시한다. */
function drawOffscreenMarkers(ctx: CanvasRenderingContext2D, world: World): void {
  const cam = world.camera;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    const vx = e.body.x - cam.x;
    if (vx >= -10 && vx <= VIEW.width + 10) continue;
    const left = vx < 0;
    const x = left ? 16 : VIEW.width - 16;
    const y = Math.min(BAR_Y - 30, Math.max(110, e.body.y - e.body.h / 2 - cam.y));
    const size = e.kind === 'boss' ? 11 : 7;
    ctx.fillStyle = e.kind === 'boss' ? '#ffffff' : 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(left ? x - size : x + size, y);
    ctx.lineTo(left ? x + size : x - size, y - size);
    ctx.lineTo(left ? x + size : x - size, y + size);
    ctx.closePath();
    ctx.fill();
    const dist = Math.round(Math.abs(left ? vx : vx - VIEW.width) / TERRAIN.unit);
    ctx.font = `10px ${PALETTE.font}`;
    ctx.textAlign = left ? 'left' : 'right';
    ctx.fillText(`${dist}`, left ? x + size + 3 : x - size - 3, y + 4);
    ctx.textAlign = 'left';
  }
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
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(b.title, VIEW.width / 2, 206);
  ctx.fillStyle = b.color;
  ctx.fillText(b.title, VIEW.width / 2, 206);
  ctx.font = `16px ${PALETTE.font}`;
  ctx.lineWidth = 4;
  ctx.strokeText(b.subtitle, VIEW.width / 2, 236);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(b.subtitle, VIEW.width / 2, 236);
  ctx.restore();
}

export function drawHud(ctx: CanvasRenderingContext2D, world: World, showGameplayHud: boolean): void {
  // 화면 아래 띠를 HUD 영역으로 사용한다.
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, BAR_Y + 2, VIEW.width, VIEW.height - BAR_Y - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(0, BAR_Y + 2, VIEW.width, 1);
  drawSlots(ctx, world);
  drawWeaponInfo(ctx, world);
  drawControls(ctx);
  if (showGameplayHud) {
    drawTopBar(ctx, world);
    drawBossBar(ctx, world);
    drawOffscreenMarkers(ctx, world);
    drawBanner(ctx, world);
  }
}
