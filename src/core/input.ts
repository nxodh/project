/**
 * 키보드·마우스 입력 상태. 물리 키 위치(e.code)를 사용하므로 한글 입력 상태에서도 WASD가 동작한다.
 * 눌림(edge) 입력은 고정 스텝 로직이 '소비'할 때까지 유지되어 프레임 속도와 무관하게 누락되지 않는다.
 */
const GAME_KEYS = new Set([
  'KeyA',
  'KeyD',
  'KeyW',
  'KeyS',
  'Space',
  'Escape',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

/** 휠 한 칸으로 인정할 누적 deltaY(px). 트랙패드의 작은 델타를 모아 한 칸으로 만든다. */
const WHEEL_STEP = 40;
const WHEEL_MIN_INTERVAL_MS = 70;

export class Input {
  mouseClientX = 0;
  mouseClientY = 0;
  hasMouse = false;

  /** 창 포커스를 잃었을 때 호출(입력은 이미 초기화된 상태). */
  onFocusLost: (() => void) | null = null;

  private down = new Set<string>();
  private presses = new Set<string>();
  private mouseHeld = false;
  private firePressAt = -Infinity;
  private wheelAcc = 0;
  private wheelSteps = 0;
  private lastWheelStepAt = -Infinity;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.attach();
  }

  private attach(): void {
    window.addEventListener('keydown', (e) => {
      if (!GAME_KEYS.has(e.code)) return;
      // 오버레이 버튼에 포커스가 있을 때 Space/Enter가 버튼을 누르도록 놔둔다.
      const target = e.target as HTMLElement | null;
      if (e.code === 'Space' && target && target.tagName === 'BUTTON') return;
      e.preventDefault();
      if (!e.repeat) this.presses.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault();
      this.down.delete(e.code);
    });

    window.addEventListener('pointermove', (e) => {
      this.mouseClientX = e.clientX;
      this.mouseClientY = e.clientY;
      this.hasMouse = true;
      // 창 밖에서 버튼을 뗀 경우 mouseup을 놓칠 수 있으므로 buttons 비트로 보정한다.
      if (this.mouseHeld && (e.buttons & 1) === 0) this.mouseHeld = false;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      // 커서 위치는 pointermove(소수점 좌표)만 기준으로 삼는다. mousedown의 clientX는 정수로
      // 반올림될 수 있어 덮어쓰면 클릭 순간 조준이 미리보기와 미세하게 어긋난다.
      if (!this.hasMouse) {
        this.mouseClientX = e.clientX;
        this.mouseClientY = e.clientY;
        this.hasMouse = true;
      }
      if (e.button !== 0) return;
      e.preventDefault();
      this.mouseHeld = true;
      this.firePressAt = this.now();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseHeld = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 40;
        else if (e.deltaMode === 2) dy *= 400;
        this.wheelAcc += dy;
        const t = this.now();
        if (Math.abs(this.wheelAcc) >= WHEEL_STEP && t - this.lastWheelStepAt >= WHEEL_MIN_INTERVAL_MS) {
          this.wheelSteps += Math.sign(this.wheelAcc);
          this.wheelAcc = 0;
          this.lastWheelStepAt = t;
        }
      },
      { passive: false },
    );
    window.addEventListener('selectstart', (e) => e.preventDefault());
    window.addEventListener('dragstart', (e) => e.preventDefault());

    const lost = () => {
      this.reset();
      this.onFocusLost?.();
    };
    window.addEventListener('blur', lost);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') lost();
    });
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** 해당 키가 눌린 적이 있으면 true를 돌려주고 기록을 지운다. */
  consumePress(code: string): boolean {
    if (!this.presses.has(code)) return false;
    this.presses.delete(code);
    return true;
  }

  /** 아직 처리되지 않은 눌림 기록만 지운다(일시 정지 중 입력이 쌓이지 않게). */
  clearPresses(): void {
    this.presses.clear();
    this.firePressAt = -Infinity;
    this.wheelSteps = 0;
    this.wheelAcc = 0;
  }

  get fireHeld(): boolean {
    return this.mouseHeld;
  }

  /** maxAgeMs 이내에 좌클릭을 누른 기록이 있는지(짧은 클릭 버퍼). */
  hasBufferedFire(maxAgeMs: number): boolean {
    return this.now() - this.firePressAt <= maxAgeMs;
  }

  clearBufferedFire(): void {
    this.firePressAt = -Infinity;
  }

  consumeWheelSteps(): number {
    const s = this.wheelSteps;
    this.wheelSteps = 0;
    return s;
  }

  /** 모든 입력 상태를 초기화한다(포커스 손실, 재시작). 마우스 위치는 유지한다. */
  reset(): void {
    this.down.clear();
    this.mouseHeld = false;
    this.clearPresses();
  }
}
