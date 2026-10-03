import { getLocalCurve } from '../weapons/curve';
import { OPERATORS, operatorInfo, type OperatorId } from '../weapons/operators';
import type { FunctionWeaponDef } from '../weapons/types';

/** 인벤토리 화면이 그릴 현재 상태(게임 쪽에서 만들어 넘긴다). */
export interface InventoryModel {
  slots: {
    index: number;
    /** 연산자가 적용된 최종 무기. */
    def: FunctionWeaponDef;
    baseId: string;
    op: OperatorId | null;
    /** 이 슬롯의 무기에 연산자를 붙일 수 있는가. */
    operable: boolean;
    current: boolean;
  }[];
  weapons: { def: FunctionWeaponDef; slot: number; operable: boolean }[];
}

type Selection = { kind: 'weapon' | 'op'; id: string } | null;

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
 * 인벤토리 화면(DOM). 카드를 고른 뒤 슬롯을 누르거나, 카드를 슬롯으로 끌어다 놓아 무기와 연산자를 갈아 끼운다.
 * 상태 변경은 직접 하지 않고 onEquip/onOperator 콜백으로 게임에 맡기며, 게임이 render()로 다시 그린다.
 */
export class InventoryView {
  onEquip: (slot: number, weaponId: string) => void = () => {};
  onOperator: (slot: number, op: OperatorId | null) => void = () => {};
  onClose: () => void = () => {};

  private readonly slotsEl = $('inv-slots');
  private readonly weaponsEl = $('inv-weapons');
  private readonly opsEl = $('inv-ops');
  private readonly detailEl = $('inv-detail');
  private selection: Selection = null;
  private model: InventoryModel | null = null;

  constructor() {
    $('btn-inv-close').addEventListener('click', () => this.onClose());
    this.renderOps();
  }

  /** 열 때마다 선택을 초기화한다. */
  open(model: InventoryModel): void {
    this.selection = null;
    this.render(model);
  }

  render(model: InventoryModel): void {
    this.model = model;
    this.renderSlots(model);
    this.renderWeapons(model);
    this.markSelection();
    this.showDetail(null);
  }

  private select(sel: Selection): void {
    const same = this.selection && sel && this.selection.kind === sel.kind && this.selection.id === sel.id;
    this.selection = same ? null : sel;
    this.markSelection();
    this.showDetail(this.selection);
  }

  private markSelection(): void {
    const sel = this.selection;
    for (const el of this.root().querySelectorAll<HTMLElement>('[data-card]')) {
      el.classList.toggle('selected', !!sel && el.dataset.card === `${sel.kind}:${sel.id}`);
    }
    this.root().classList.toggle('has-selection', !!sel);
  }

  private root(): HTMLElement {
    return $('overlay-inventory');
  }

  private showDetail(sel: Selection): void {
    const m = this.model;
    if (!sel || !m) {
      this.detailEl.innerHTML =
        '<p class="hint">카드를 눌러 고른 뒤 슬롯을 누르거나, 슬롯으로 끌어다 놓으세요. 연산자 칸을 다시 누르면 연산자가 떼어집니다.</p>';
      return;
    }
    if (sel.kind === 'weapon') {
      const w = m.weapons.find((x) => x.def.id === sel.id)!.def;
      this.detailEl.innerHTML = `<b>${w.name}</b> <i>${w.formula}</i><p>${w.role}</p><p class="dim">${statLine(w)}</p>`;
    } else {
      const o = operatorInfo(sel.id as OperatorId);
      this.detailEl.innerHTML = `<b>${o.name}</b> <i>${o.symbol}</i><p>${o.math}</p><p class="dim">${o.effect}</p>`;
    }
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
        <small>${statLine(s.def)}</small>
        <button type="button" class="socket${s.op ? ' filled' : ''}${s.operable ? '' : ' locked'}" data-socket="${s.index}" tabindex="-1">${
          s.op ? operatorInfo(s.op).symbol : s.operable ? '＋ 연산자' : '연산자 불가'
        }</button>`;
      this.slotsEl.appendChild(el);
      drawThumb(el.querySelector('canvas')!, s.def);
      el.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('[data-socket]')) return;
        this.dropOnSlot(s.index, this.selection);
      });
      el.querySelector('[data-socket]')!.addEventListener('click', () => {
        if (this.selection?.kind === 'op') this.dropOnSlot(s.index, this.selection);
        else if (s.op) this.onOperator(s.index, null);
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
        if (kind === 'weapon' || kind === 'op') this.dropOnSlot(s.index, { kind, id });
      });
    }
  }

  private dropOnSlot(slot: number, sel: Selection): void {
    if (!sel) return;
    if (sel.kind === 'weapon') this.onEquip(slot, sel.id);
    else this.onOperator(slot, sel.id as OperatorId);
    this.selection = null;
  }

  private card(kind: 'weapon' | 'op', id: string, html: string, def?: FunctionWeaponDef): HTMLElement {
    const el = document.createElement('div');
    el.className = 'inv-card';
    el.dataset.card = `${kind}:${id}`;
    el.draggable = true;
    el.innerHTML = html;
    if (def) drawThumb(el.querySelector('canvas')!, def);
    el.addEventListener('click', () => this.select({ kind, id }));
    el.addEventListener('mouseenter', () => {
      if (!this.selection) this.showDetail({ kind, id });
    });
    el.addEventListener('mouseleave', () => {
      if (!this.selection) this.showDetail(null);
    });
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', `${kind}:${id}`);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove';
    });
    return el;
  }

  private renderWeapons(model: InventoryModel): void {
    this.weaponsEl.innerHTML = '';
    for (const w of model.weapons) {
      const tag = w.slot >= 0 ? `<em>슬롯 ${w.slot + 1}</em>` : '';
      const el = this.card(
        'weapon',
        w.def.id,
        `${tag}<canvas class="thumb"></canvas><b>${w.def.name}</b><i>${w.def.formula}</i>${w.operable ? '' : '<small>연산자 불가(매개변수 곡선)</small>'}`,
        w.def,
      );
      this.weaponsEl.appendChild(el);
    }
  }

  private renderOps(): void {
    this.opsEl.innerHTML = '';
    for (const o of OPERATORS) {
      this.opsEl.appendChild(
        this.card('op', o.id, `<span class="op-sym">${o.symbol}</span><b>${o.name}</b><small>${o.math}</small>`),
      );
    }
  }
}
