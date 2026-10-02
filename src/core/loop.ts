import { MAX_FRAME_DT, STEP } from '../config';

/**
 * 고정 타임스텝 누산기. 렌더링 프레임 간격이 얼마든 시뮬레이션은 항상 STEP 간격으로만 진행된다.
 * (30fps든 144fps든 같은 입력이면 같은 궤적이 나온다.)
 */
export class FixedStepper {
  private acc = 0;

  constructor(
    readonly step: number = STEP,
    readonly maxFrame: number = MAX_FRAME_DT,
  ) {}

  /** frameDt만큼 시간을 흘리고 실행한 스텝 수를 돌려준다. */
  advance(frameDt: number, stepFn: (dt: number) => void): number {
    this.acc += Math.min(Math.max(frameDt, 0), this.maxFrame);
    let steps = 0;
    while (this.acc >= this.step) {
      stepFn(this.step);
      this.acc -= this.step;
      steps++;
    }
    return steps;
  }

  reset(): void {
    this.acc = 0;
  }
}

export function startLoop(onFrame: (frameDt: number) => void): void {
  let last = performance.now();
  const frame = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    onFrame(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
