/** 원거리형 적이 쏘는 직선 탄환. */
export class Bullet {
  alive = true;
  life = 3.5;
  /** 그리기용 이전 위치(잔상). */
  px: number;
  py: number;

  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    readonly radius: number,
    readonly damage: number,
    readonly color: string,
  ) {
    this.px = x;
    this.py = y;
  }
}
