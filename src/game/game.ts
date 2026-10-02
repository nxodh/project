import { FX, STEP } from '../config';
import type { Vec2 } from '../core/geometry';
import type { Input } from '../core/input';
import { FixedStepper } from '../core/loop';
import type { View } from '../core/view';
import type { Renderer } from '../render/renderer';
import type { Overlays } from '../ui/overlays';
import { updateAttacks, updateBullets } from './combat';
import { updateEnemies } from './enemyAI';
import { updateAim, updatePlayer } from './playerSystem';
import { canFire, computeAttackPath, updateWeapons } from './weaponSystem';
import { updateWaves } from './waves';
import { World } from './world';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

const BEST_KEY = 'fx-arena-best-score';

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    /* 저장소를 쓸 수 없는 환경이면 무시 */
  }
}

/**
 * 게임 상태 머신과 프레임 처리. 입력·물리·무기·AI·웨이브 갱신은 고정 스텝으로,
 * 렌더링은 화면 프레임마다 한 번 수행한다.
 */
export class Game {
  state: GameState = 'title';
  world = new World();
  /** 실시간 경과(배경 장식용). */
  clock = 0;
  /** 실행한 고정 스텝 수(디버그). */
  totalSteps = 0;
  /** 시간 배율(디버그·테스트용, 0이면 정지 상태에서 수동 스텝만 진행). */
  timeScale = 1;
  private readonly stepper = new FixedStepper();

  constructor(
    private readonly view: View,
    private readonly input: Input,
    private readonly renderer: Renderer,
    private readonly ui: Overlays,
  ) {
    input.onFocusLost = () => {
      if (this.state === 'playing') this.pause();
    };
    ui.onStart = () => this.startNewRun();
    ui.onRestart = () => this.startNewRun();
    ui.onResume = () => this.resume();
    ui.showStart();
  }

  /** 마우스 커서의 월드 좌표. 렌더링과 같은 뷰 변환을 사용한다. */
  aimPoint(): Vec2 {
    if (!this.input.hasMouse) {
      const p = this.world.player;
      return { x: p.body.x + p.facing * 300, y: p.body.y - 68 };
    }
    return this.view.clientToWorld(this.input.mouseClientX, this.input.mouseClientY);
  }

  frame(frameDt: number): void {
    this.view.sync();
    this.clock += Math.min(frameDt, 0.1);

    if (this.input.consumePress('Escape')) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }

    const aim = this.aimPoint();
    if (this.state === 'playing') {
      updateAim(this.world.player, aim);
      this.stepper.advance(frameDt * this.timeScale, (dt) => this.step(dt, aim));
    } else {
      this.input.clearPresses();
    }
    this.render(aim);
  }

  /** 현재 조준으로 고정 스텝을 n번 실행한다(디버그·테스트용). */
  stepManually(n: number): void {
    const aim = this.aimPoint();
    for (let i = 0; i < n && this.state === 'playing'; i++) this.step(STEP, aim);
  }

  /** 고정 스텝 하나. */
  step(dt: number, aim: Vec2): void {
    const w = this.world;
    this.totalSteps++;
    w.time += dt;
    updateAim(w.player, aim);
    updatePlayer(w, this.input, dt);
    updateWeapons(w, this.input, dt);
    updateEnemies(w, dt);
    updateAttacks(w, dt);
    updateBullets(w, dt);
    updateWaves(w, dt);
    w.fx.update(dt);
    w.shake = Math.max(0, w.shake - w.shake * FX.shakeDecay * dt - 0.5 * dt);
    if (w.banner) {
      w.banner.age += dt;
      if (w.banner.age >= w.banner.duration) w.banner = null;
    }
    if (w.gameOverTimer > 0) {
      w.gameOverTimer -= dt;
      if (w.gameOverTimer <= 0) this.gameOver();
    }
  }

  private render(aim: Vec2): void {
    const w = this.world;
    const playing = this.state === 'playing';
    const showAim = (playing || this.state === 'paused') && w.player.alive;
    this.renderer.render(w, {
      aim,
      preview: showAim ? computeAttackPath(w) : null,
      previewReady: canFire(w),
      showCrosshair: playing && this.input.hasMouse,
      showGameplayHud: this.state !== 'title',
      clock: this.clock,
    });
  }

  startNewRun(): void {
    this.world = new World();
    this.input.reset();
    this.stepper.reset();
    this.state = 'playing';
    this.ui.hideAll();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.reset();
    this.ui.showPause();
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.reset();
    this.stepper.reset();
    this.ui.hideAll();
  }

  private gameOver(): void {
    const w = this.world;
    this.state = 'gameover';
    this.input.reset();
    const prevBest = loadBest();
    const newBest = w.score > prevBest;
    if (newBest) saveBest(w.score);
    this.ui.showGameOver({
      score: w.score,
      wave: w.waves.wave,
      kills: w.kills,
      best: Math.max(prevBest, w.score),
      newBest: newBest && w.score > 0,
      accuracy: w.stats.shots > 0 ? Math.round((w.stats.hits / w.stats.shots) * 100) : 0,
    });
  }
}
