import type { FunctionWeaponDef } from '../weapons/types';
import { InventoryView, type InventoryModel } from './inventory';

export interface GameOverStats {
  score: number;
  wave: number;
  kills: number;
  best: number;
  newBest: boolean;
  accuracy: number;
  bosses: number;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} 요소가 없습니다.`);
  return el;
}

/** 시작·일시 정지·게임 오버 화면(DOM). 버튼 클릭이 캔버스로 전달되지 않아 공격이 나가지 않는다. */
export class Overlays {
  onStart: () => void = () => {};
  onResume: () => void = () => {};
  onRestart: () => void = () => {};

  private readonly start = $('overlay-start');
  private readonly pause = $('overlay-pause');
  private readonly over = $('overlay-gameover');
  private readonly inventoryEl = $('overlay-inventory');
  readonly inventory = new InventoryView();

  constructor(weapons: readonly FunctionWeaponDef[]) {
    $('btn-start').addEventListener('click', () => this.onStart());
    $('btn-resume').addEventListener('click', () => this.onResume());
    $('btn-pause-restart').addEventListener('click', () => this.onRestart());
    $('btn-restart').addEventListener('click', () => this.onRestart());

    const list = $('weapon-list');
    list.innerHTML = '';
    weapons.forEach((w) => {
      const li = document.createElement('li');
      li.style.setProperty('--c', w.color);
      li.innerHTML = `<kbd>·</kbd><b>${w.name}</b><i>${w.formula}</i><span>${w.role}</span>`;
      list.appendChild(li);
    });
  }

  private show(el: HTMLElement | null): void {
    // 숨겨지는 버튼에 포커스가 남아 있으면 Space(점프)가 버튼을 누르므로 먼저 해제한다.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    for (const o of [this.start, this.pause, this.over, this.inventoryEl]) o.hidden = o !== el;
    document.body.classList.toggle('playing', el === null);
    const btn = el?.querySelector('button');
    if (btn instanceof HTMLButtonElement) btn.focus({ preventScroll: true });
  }

  showStart(): void {
    this.show(this.start);
  }

  showPause(): void {
    this.show(this.pause);
  }

  showInventory(model: InventoryModel): void {
    this.show(this.inventoryEl);
    this.inventory.open(model);
  }

  showGameOver(stats: GameOverStats): void {
    $('go-score').textContent = stats.score.toLocaleString('en-US');
    $('go-wave').textContent = String(stats.wave);
    $('go-kills').textContent = String(stats.kills);
    $('go-acc').textContent = `${stats.accuracy}%`;
    $('go-bosses').textContent = String(stats.bosses);
    $('go-best').textContent = stats.newBest ? '최고 기록 갱신!' : `최고 점수 ${stats.best.toLocaleString('en-US')}`;
    this.show(this.over);
  }

  hideAll(): void {
    this.show(null);
  }
}
