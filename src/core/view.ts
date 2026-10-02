import { VIEW } from '../config';
import type { Vec2 } from './geometry';

/**
 * 논리 화면(1600×900)을 창 크기에 맞춰 레터박스로 배치하는 뷰 변환.
 * 렌더링과 마우스 좌표 변환이 같은 값을 쓰므로 창 크기·화면 배율이 바뀌어도 조준점이 일치한다.
 * 월드 좌표 = 화면 좌표 + 카메라 위치.
 */
export class View {
  /** CSS 픽셀 기준 논리 화면 → 실제 화면 배율. */
  scale = 1;
  /** CSS 픽셀 기준 레터박스 여백. */
  offsetX = 0;
  offsetY = 0;
  dpr = 1;
  cssWidth = 0;
  cssHeight = 0;
  /** 크기가 바뀔 때마다 증가. */
  version = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.sync();
  }

  /** 캔버스 크기와 기기 픽셀 비율을 확인하고 바뀌었으면 백버퍼와 변환을 갱신한다. */
  sync(): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    const changed =
      pxW !== this.canvas.width ||
      pxH !== this.canvas.height ||
      dpr !== this.dpr ||
      cssW !== this.cssWidth ||
      cssH !== this.cssHeight;
    if (!changed) return false;
    this.canvas.width = pxW;
    this.canvas.height = pxH;
    this.dpr = dpr;
    this.cssWidth = cssW;
    this.cssHeight = cssH;
    this.scale = Math.min(cssW / VIEW.width, cssH / VIEW.height);
    this.offsetX = (cssW - VIEW.width * this.scale) / 2;
    this.offsetY = (cssH - VIEW.height * this.scale) / 2;
    this.version++;
    return true;
  }

  /** 마우스 clientX/Y → 논리 화면 좌표. 호출 시점의 캔버스 위치를 사용한다. */
  clientToView(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    // getBoundingClientRect 크기와 내부 기준 크기가 다르면(CSS 변형 등) 비율로 보정한다.
    const sx = this.cssWidth / (rect.width || 1);
    const sy = this.cssHeight / (rect.height || 1);
    const cssX = (clientX - rect.left) * sx;
    const cssY = (clientY - rect.top) * sy;
    return {
      x: (cssX - this.offsetX) / this.scale,
      y: (cssY - this.offsetY) / this.scale,
    };
  }

  /** 논리 화면 좌표 → clientX/Y (테스트와 디버그용). */
  viewToClient(x: number, y: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const sx = (rect.width || 1) / this.cssWidth;
    const sy = (rect.height || 1) / this.cssHeight;
    return {
      x: rect.left + (this.offsetX + x * this.scale) * sx,
      y: rect.top + (this.offsetY + y * this.scale) * sy,
    };
  }

  /**
   * 그리기 변환 설정. (camX, camY)는 화면 왼쪽 위에 오는 월드 좌표, shake는 흔들림(px).
   * 카메라를 0으로 두면 논리 화면 좌표(HUD)로 그린다.
   */
  applyViewTransform(ctx: CanvasRenderingContext2D, camX = 0, camY = 0, shakeX = 0, shakeY = 0): void {
    const k = this.dpr * this.scale;
    ctx.setTransform(
      k,
      0,
      0,
      k,
      this.dpr * this.offsetX + (shakeX - camX) * k,
      this.dpr * this.offsetY + (shakeY - camY) * k,
    );
  }

  applyScreenTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
}
