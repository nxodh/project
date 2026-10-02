import type { Input } from '../src/core/input';

/** 테스트용 가짜 입력. 실제 Input과 같은 소비(consume) 규칙을 따른다. */
export class FakeInput {
  down = new Set<string>();
  presses = new Set<string>();
  fireHeld = false;
  buffered = false;
  wheel = 0;

  press(code: string): void {
    this.presses.add(code);
    this.down.add(code);
  }
  release(code: string): void {
    this.down.delete(code);
  }
  isDown(code: string): boolean {
    return this.down.has(code);
  }
  consumePress(code: string): boolean {
    const had = this.presses.has(code);
    this.presses.delete(code);
    return had;
  }
  hasBufferedFire(): boolean {
    return this.buffered;
  }
  clearBufferedFire(): void {
    this.buffered = false;
  }
  consumeWheelSteps(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }
  clearPresses(): void {
    this.presses.clear();
  }
  reset(): void {
    this.down.clear();
    this.presses.clear();
    this.fireHeld = false;
    this.buffered = false;
  }
  asInput(): Input {
    return this as unknown as Input;
  }
}
