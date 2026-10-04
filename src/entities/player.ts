import { PLAYER } from '../config';
import type { Rect, Vec2 } from '../core/geometry';
import { bodyRect, makeBody, type Body } from '../world/physics';

export class Player {
  readonly body: Body;
  hp: number = PLAYER.maxHp;
  readonly maxHp: number = PLAYER.maxHp;
  alive = true;
  crouching = false;
  /** 바라보는 방향 = 조준 방향의 좌우. 이동 방향과 무관하다. */
  facing: 1 | -1 = 1;
  /** 어깨 → 커서 단위 벡터. */
  aim: Vec2 = { x: 1, y: 0 };
  walkPhase = 0;
  invuln = 0;
  hurtFlash = 0;
  coyote = 0;
  jumpBuffer = 0;
  jumpHeld = false;
  /** 선택된 핫바 슬롯. */
  weaponIndex = 0;
  /** 어깨 → 커서 거리(곡선의 끝점이 커서에 닿도록 곡선 크기를 정한다). 조준을 갱신하기 전에는 무한대. */
  aimDist = Infinity;
  /** 슬롯별 남은 재사용 대기시간. */
  cooldowns: number[] = [];
  /** 무기를 바꿔 가며 쏠 때도 적용되는 최소 간격. */
  globalCooldown = 0;
  /** 최근 발사 반동(그리기용). */
  recoil = 0;
  /** 최근 밟고 있던 면(적 내비게이션의 목표). */
  lastSurfaceId = -1;

  constructor(x: number, y: number, slotCount: number) {
    this.body = makeBody(x, y, PLAYER.width, PLAYER.standHeight);
    this.cooldowns = new Array<number>(slotCount).fill(0);
  }

  /** 조준 회전 중심(어깨). 숙이면 낮아지고 약간 앞으로 나온다. */
  shoulder(): Vec2 {
    const b = this.body;
    if (this.crouching) return { x: b.x + 5 * this.facing, y: b.y - PLAYER.shoulderCrouch };
    return { x: b.x, y: b.y - PLAYER.shoulderStand };
  }

  /** 총구 = 함수 그래프의 시작점. */
  muzzle(): Vec2 {
    const s = this.shoulder();
    return { x: s.x + this.aim.x * PLAYER.muzzleDistance, y: s.y + this.aim.y * PLAYER.muzzleDistance };
  }

  /** 피격 판정 영역. 숙이면 실제로 높이가 낮아진다. */
  hurtbox(): Rect {
    const r = bodyRect(this.body);
    return { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 2 };
  }

  center(): Vec2 {
    return { x: this.body.x, y: this.body.y - this.body.h / 2 };
  }
}
