import { EVOLUTION } from '../config';
import { getLocalCurve } from '../weapons/curve';
import { evolutionOptions, operatorInfo } from '../weapons/operators';
import type { FunctionWeaponDef, OperatorId } from '../weapons/types';

/** 인벤토리 화면이 그릴 현재 상태(게임 쪽에서 만들어 넘긴다). */
export interface InventoryModel {
  evoPoints: number;
  slots: { index: number; def: FunctionWeaponDef; current: boolean }[];
  /** 게임에 존재하는 모든 함수. owned가 false면 아직 발견하지 못한 함수다. */
  weapons: { def: FunctionWeaponDef; owned: boolean; slot: number }[];
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} 요소가 없습니다.`);
  return el;
}

/** 곡선 모양 썸네일: 로컬 곡선을 상자에 맞춰 그린다(비율 유지). */
function drawThumb(canvas: HTMLCanvasElement, def: FunctionWeaponDef): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 96;
  const h = canvas.clientHeight || 44;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const c = getLocalCurve(def);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < c.n; i++) {
    minX = Math.min(minX, c.lx[i]);
    maxX = Math.max(maxX, c.lx[i]);
    minY = Math.min(minY, c.ly[i]);
    maxY = Math.max(maxY, c.ly[i]);
  }
  const pad = 6;
  const sw = Math.max(1, maxX - minX);
  const sh = Math.max(1, maxY - minY);
  const s = Math.min((w - 2 * pad) / sw, (h - 2 * pad) / sh);
  const ox = (w - sw * s) / 2 - minX * s;
  const oy = (h + sh * s) / 2 + minY * s;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < c.n; i++) {
    const px = ox + c.lx[i] * s;
    const py = oy - c.ly[i] * s;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // 시작점(총구)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function statLine(def: FunctionWeaponDef): string {
  const t = def.tuning;
  return `피해 ${t.damage} · 사거리 ${t.range} · 대기 ${t.cooldown.toFixed(2)}s · 두께 ${(t.hitRadius * 2).toFixed(1).replace(/\.0$/, '')}`;
}

/**
 * 인벤토리 화면(DOM): 핫바 장착과 함수 진화 작업대.
 * 보유한 함수 카드를 고르면 작업대에 미분·부정적분·극한의 결과(수식과 결과 함수 모양)가 나오고,
 * 진화 포인트를 써서 새 함수를 얻는다. 카드를 고른 뒤 슬롯을 누르거나 슬롯으로 끌어다 놓으면 장착된다.
 * 상태 변경은 직접 하지 않고 onEquip/onEvolve 콜백으로 게임에 맡기며, 게임이 render()로 다시 그린다.
 */
export class InventoryView {
  onEquip: (slot: number, weaponId: string) => void = () => {};
  onEvolve: (weaponId: string, op: OperatorId) => void = () => {};
  onClose: () => void = () => {};

  private readonly slotsEl = $('inv-slots');
  private readonly weaponsEl = $('inv-weapons');
  private readonly benchEl = $('inv-bench');
  private readonly epEl = $('inv-ep');
  private readonly countEl = $('inv-count');
  private selected: string | null = null;
  private model: InventoryModel | null = null;

  constructor() {
    $('btn-inv-close').addEventListener('click', () => this.onClose());
  }

  /** 열 때마다 선택을 초기화한다. */
  open(model: InventoryModel): void {
    this.selected = null;
    this.render(model);
  }

  render(model: InventoryModel, justUnlocked?: string): void {
    this.model = model;
    const sel = model.weapons.find((w) => w.def.id === this.selected);
    if (!sel || !sel.owned) this.selected = null;
    this.epEl.textContent = String(model.evoPoints);
    this.countEl.textContent = `${model.weapons.filter((w) => w.owned).length} / ${model.weapons.length}`;
    this.renderSlots(model);
    this.renderWeapons(model, justUnlocked);
    this.renderBench();
    this.markSelection();
  }

  private select(id: string): void {
    this.selected = this.selected === id ? null : id;
    this.markSelection();
    this.renderBench();
  }

  private markSelection(): void {
    for (const el of this.root().querySelectorAll<HTMLElement>('[data-card]')) {
      el.classList.toggle('selected', el.dataset.card === `weapon:${this.selected}`);
    }
    this.root().classList.toggle('has-selection', !!this.selected);
  }

  private root(): HTMLElement {
    return $('overlay-inventory');
  }

  private renderSlots(model: InventoryModel): void {
    this.slotsEl.innerHTML = '';
    for (const s of model.slots) {
      const el = document.createElement('div');
      el.className = 'inv-slot' + (s.current ? ' current' : '');
      el.dataset.slot = String(s.index);
      el.innerHTML = `
        <div class="inv-key"><kbd>${s.index + 1}</kbd></div>
        <canvas class="thumb"></canvas>
        <b>${s.def.name}</b>
        <i>${s.def.formula}</i>
        <small>${statLine(s.def)}</small>`;
      this.slotsEl.appendChild(el);
      drawThumb(el.querySelector('canvas')!, s.def);
      el.addEventListener('click', () => {
        if (this.selected) this.onEquip(s.index, this.selected);
      });
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.classList.add('drop');
      });
      el.addEventListener('dragleave', () => el.classList.remove('drop'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drop');
        const [kind, id] = (e.dataTransfer?.getData('text/plain') ?? '').split(':');
        if (kind === 'weapon' && id) this.onEquip(s.index, id);
      });
    }
  }

  private renderWeapons(model: InventoryModel, justUnlocked?: string): void {
    this.weaponsEl.innerHTML = '';
    for (const w of model.weapons) {
      const el = document.createElement('div');
      if (!w.owned) {
        el.className = 'inv-card locked';
        el.dataset.locked = w.def.id;
        el.innerHTML = '<span class="lock">?</span><b>미발견</b><small>미분·적분·극한으로 진화시켜 발견</small>';
        this.weaponsEl.appendChild(el);
        continue;
      }
      el.className = 'inv-card' + (w.def.id === justUnlocked ? ' new' : '');
      el.dataset.card = `weapon:${w.def.id}`;
      el.draggable = true;
      const tag = w.slot >= 0 ? `<em>슬롯 ${w.slot + 1}</em>` : w.def.starter ? '<em>기본</em>' : '';
      el.innerHTML = `${tag}<canvas class="thumb"></canvas><b>${w.def.name}</b><i>${w.def.formula}</i>`;
      this.weaponsEl.appendChild(el);
      drawThumb(el.querySelector('canvas')!, w.def);
      el.addEventListener('click', () => this.select(w.def.id));
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', `weapon:${w.def.id}`);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove';
      });
    }
  }

  /** 진화 작업대: 고른 함수에 미분·부정적분·극한을 적용한 결과. */
  private renderBench(): void {
    const m = this.model;
    const sel = m?.weapons.find((w) => w.def.id === this.selected);
    if (!m || !sel) {
      this.benchEl.innerHTML =
        '<p class="hint">보유한 함수 카드를 누르면 <b>진화 작업대</b>가 열립니다. 슬롯을 누르면 그 함수가 장착됩니다. ' +
        '미분·적분·극한의 결과는 수학적으로 맞는 함수이며, 보스를 처치하면 진화 포인트를 얻습니다. ' +
        '<b>기본</b> 표시 함수는 이 연산으로 만들 수 없거나 계보의 뿌리라서 처음부터 가지고 있습니다(이유는 함수를 고르면 나옵니다).</p>';
      return;
    }
    const base = sel.def;
    const rows = evolutionOptions(base)
      .map((o) => {
        const info = operatorInfo(o.op);
        const owned = !!o.result && m.weapons.find((w) => w.def.id === o.result!.id)?.owned;
        let state = '';
        let btn = `<button type="button" class="evolve" data-evolve="${o.op}">진화 · EP ${o.cost}</button>`;
        if (!o.edge || !o.result) {
          state = '<span class="dim">이 연산의 결과는 도감에 없는 함수라 진화할 수 없다</span>';
          btn = '<button type="button" class="evolve" disabled>없음</button>';
        } else if (o.self) {
          state = '<span class="dim">결과가 자기 자신이라 새 함수를 얻지 못한다</span>';
          btn = '<button type="button" class="evolve" disabled>자기 자신</button>';
        } else {
          state = `<canvas class="thumb mini" data-result="${o.result.id}"></canvas><span><b>${o.result.name}</b> <i>${o.result.formula}</i></span>`;
          if (owned) btn = '<button type="button" class="evolve" disabled>보유 중</button>';
          else if (m.evoPoints < o.cost) btn = `<button type="button" class="evolve" disabled>EP 부족 (${o.cost})</button>`;
        }
        return `<div class="bench-row"><span class="op-sym">${info.symbol}</span><div class="bench-math">${o.edge?.math ?? info.math}</div><div class="bench-result">${state}</div>${btn}</div>`;
      })
      .join('');
    const why = base.starter && base.starterReason ? `<p class="dim">★ 기본 함수인 이유: ${base.starterReason}</p>` : '';
    this.benchEl.innerHTML = `<div class="bench-head"><b>${base.name}</b> <i>${base.formula}</i><span class="dim"> · ${base.role}</span></div>${why}${rows}<p class="dim">${statLine(base)} · 진화 비용: 미분 ${EVOLUTION.cost.d}, 적분 ${EVOLUTION.cost.int}, 극한 ${EVOLUTION.cost.lim} EP</p>`;
    for (const o of evolutionOptions(base)) {
      if (o.result && !o.self) {
        const cv = this.benchEl.querySelector<HTMLCanvasElement>(`canvas[data-result="${o.result.id}"]`);
        if (cv) drawThumb(cv, o.result);
      }
    }
    for (const b of this.benchEl.querySelectorAll<HTMLButtonElement>('button[data-evolve]')) {
      b.addEventListener('click', () => this.onEvolve(base.id, b.dataset.evolve as OperatorId));
    }
  }
}
