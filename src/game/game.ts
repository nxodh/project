import { KEYS, STEP } from '../config';
import type { Vec2 } from '../core/geometry';
import type { Input } from '../core/input';
import { FixedStepper } from '../core/loop';
import type { View } from '../core/view';
import type { Renderer } from '../render/renderer';
import type { Overlays } from '../ui/overlays';
import { updateAim } from './playerSystem';
import { stepWorld } from './simulation';
import { canFire, computeAttackPath } from './weaponSystem';
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
  /** 지형 시드를 고정한다(디버그·테스트용, null이면 판마다 무작위). */
  seed: number | null = null;
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

  /** 마우스 커서의 논리 화면 좌표(카메라와 무관). */
  aimView(): Vec2 {
    if (!this.input.hasMouse) {
      const p = this.world.player;
      return { x: p.body.x + p.facing * 300 - this.world.camera.x, y: p.body.y - 68 - this.world.camera.y };
    }
    return this.view.clientToView(this.input.mouseClientX, this.input.mouseClientY);
  }

  /** 마우스 커서의 월드 좌표 = 화면 좌표 + 카메라. 렌더링과 같은 변환을 사용한다. */
  aimPoint(): Vec2 {
    return this.world.viewToWorld(this.aimView());
  }

  frame(frameDt: number): void {
    this.view.sync();
    this.clock += Math.min(frameDt, 0.1);

    if (this.input.consumePress(KEYS.pause)) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }

    const aimView = this.aimView();
    if (this.state === 'playing') {
      updateAim(this.world.player, this.world.viewToWorld(aimView));
      this.stepper.advance(frameDt * this.timeScale, (dt) => this.step(dt, aimView));
    } else {
      this.input.clearPresses();
    }
    this.render(aimView);
  }

  /** 현재 조준으로 고정 스텝을 n번 실행한다(디버그·테스트용). */
  stepManually(n: number): void {
    const aimView = this.aimView();
    for (let i = 0; i < n && this.state === 'playing'; i++) this.step(STEP, aimView);
  }

  /** 고정 스텝 하나. aimView는 커서의 화면 좌표(카메라가 움직이면 월드 조준점도 함께 움직인다). */
  step(dt: number, aimView: Vec2): void {
    const w = this.world;
    this.totalSteps++;
    stepWorld(w, this.input, w.viewToWorld(aimView), dt);
    if (w.gameOverTimer > 0) {
      w.gameOverTimer -= dt;
      if (w.gameOverTimer <= 0) this.gameOver();
    }
  }

  private render(aimView: Vec2): void {
    const w = this.world;
    const playing = this.state === 'playing';
    const showAim = (playing || this.state === 'paused') && w.player.alive;
    this.renderer.render(w, {
      aimView,
      preview: showAim ? computeAttackPath(w) : null,
      previewReady: canFire(w),
      showCrosshair: playing && this.input.hasMouse,
      showGameplayHud: this.state !== 'title',
      clock: this.clock,
    });
  }

  startNewRun(): void {
    this.world = new World(this.seed ?? undefined);
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
      bosses: w.stats.bossesDefeated,
    });
  }
}
