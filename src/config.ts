/**
 * 게임 밸런스와 동작 수치를 한곳에서 조정하는 설정 파일.
 * 좌표 단위는 월드 픽셀(px), 시간 단위는 초(s)다.
 */

/** 논리 해상도. 화면 크기와 무관하게 이 크기의 월드를 레터박스로 맞춰 그린다. */
export const WORLD = { width: 1600, height: 900 } as const;

/** 고정 물리 스텝. 프레임 속도와 무관하게 같은 결과가 나오도록 이 간격으로만 시뮬레이션한다. */
export const STEP = 1 / 120;
/** 탭 전환 등으로 프레임이 크게 밀렸을 때 한 번에 따라잡을 최대 시간. */
export const MAX_FRAME_DT = 0.25;

export const PHYSICS = {
  gravity: 2200,
  maxFallSpeed: 1300,
} as const;

export const PLAYER = {
  width: 26,
  standHeight: 92,
  crouchHeight: 56,
  moveSpeed: 330,
  crouchSpeed: 150,
  groundAccel: 3400,
  airAccel: 2200,
  groundFriction: 3800,
  airFriction: 700,
  jumpVelocity: 900,
  /** 점프 키를 일찍 떼면 상승 속도에 곱해지는 값(가변 점프). */
  jumpCutMultiplier: 0.45,
  coyoteTime: 0.08,
  jumpBuffer: 0.12,
  maxHp: 100,
  invulnTime: 0.9,
  hurtFlashTime: 0.3,
  knockbackX: 340,
  knockbackY: 300,
  /** 발끝에서 어깨(조준 회전 중심)까지의 높이. */
  shoulderStand: 68,
  shoulderCrouch: 38,
  /** 어깨에서 총구까지의 거리(팔 + 무기 길이). */
  muzzleDistance: 40,
  spawnX: 520,
  /** 웨이브를 클리어할 때마다 회복하는 체력. */
  waveHeal: 20,
} as const;

export const COMBAT = {
  /** 쿨다운 중 짧게 누른 클릭을 기억해 두는 시간(ms). */
  fireBufferMs: 180,
  /** 무기를 바꿔 가며 쏠 때도 적용되는 최소 발사 간격. */
  globalFireInterval: 0.12,
  /**
   * 왼쪽을 조준하면 함수 그래프를 좌우 반전한다(캐릭터가 뒤돌아보는 것과 같음).
   * true: 어느 쪽을 보든 그래프의 수학적 '위(+y)'가 화면 위쪽으로 향한다.
   * false: 그래프를 조준 각도만큼 순수 회전만 한다(왼쪽 조준 시 위아래가 뒤집힘).
   */
  mirrorWhenAimingLeft: true,
  /** 곡선을 나누는 선분의 목표 길이(px). 작을수록 촘촘하다. */
  sampleSpacing: 4,
  /** 사라지는 단계에서 이 비율까지 진행되는 동안은 판정이 남는다. */
  damageActiveFadeFraction: 0.6,
  /** 판정이 없는 희미한 잔상이 남아 있는 시간. */
  ghostTime: 0.3,
  /** 함수 곡선이 적 탄환을 지울 수 있는지. */
  curvesBlockBullets: true,
} as const;

/** 함수 무기 하나의 전투 수치. */
export interface WeaponTuning {
  /** 한 번 맞혔을 때의 피해량. */
  damage: number;
  /** 같은 무기를 다시 쏠 수 있을 때까지의 시간. */
  cooldown: number;
  /** 사거리 L: 조준축 방향으로 뻗는 길이(px). */
  range: number;
  /** 곡률/높이 A: 조준축에서 수직으로 벗어나는 최대 거리(px). 0이면 직선. */
  amplitude: number;
  /** 곡선이 그려지는 진행 속도(px/s, 곡선 길이 기준). */
  speed: number;
  /** 다 그려진 뒤 유지되는 시간. */
  hold: number;
  /** 꼬리부터 사라지는 데 걸리는 시간. */
  fade: number;
  /** 판정 반경(곡선 두께의 절반, px). */
  hitRadius: number;
  /** 적중 시 곡선 진행 방향으로 밀어내는 힘. */
  knockback: number;
}

/**
 * 함수 무기 밸런스 테이블. 곡선 모양(정의역, 함수식)은 src/weapons/functions.ts에 있다.
 */
export const WEAPON_TUNING = {
  linear: {
    damage: 12,
    cooldown: 0.17,
    range: 980,
    amplitude: 0,
    speed: 4600,
    hold: 0.05,
    fade: 0.14,
    hitRadius: 4,
    knockback: 110,
  },
  quadratic: {
    damage: 30,
    cooldown: 0.6,
    range: 560,
    amplitude: 190,
    speed: 1700,
    hold: 0.14,
    fade: 0.22,
    hitRadius: 7,
    knockback: 230,
  },
  sine: {
    damage: 18,
    cooldown: 0.36,
    range: 620,
    amplitude: 60,
    speed: 1900,
    hold: 0.12,
    fade: 0.2,
    hitRadius: 6,
    knockback: 150,
  },
  abs: {
    damage: 26,
    cooldown: 0.95,
    range: 380,
    amplitude: 62,
    speed: 1500,
    hold: 0.2,
    fade: 0.26,
    hitRadius: 12,
    knockback: 340,
  },
  exp: {
    damage: 50,
    cooldown: 0.85,
    range: 340,
    amplitude: 260,
    speed: 1350,
    hold: 0.14,
    fade: 0.24,
    hitRadius: 9,
    knockback: 380,
  },
} satisfies Record<string, WeaponTuning>;

export interface EnemyStats {
  hp: number;
  speed: number;
  width: number;
  height: number;
  score: number;
  color: string;
  /** 넉백 저항(1이면 그대로, 0.5면 절반만 밀림). */
  knockbackTaken: number;
}

export const ENEMIES = {
  melee: {
    hp: 40,
    speed: 165,
    width: 26,
    height: 92,
    score: 100,
    color: '#ff3b5c',
    knockbackTaken: 1,
    attackRange: 50,
    windup: 0.38,
    strikeTime: 0.1,
    recover: 0.55,
    damage: 12,
  },
  ranged: {
    hp: 30,
    speed: 120,
    width: 24,
    height: 90,
    score: 150,
    color: '#ff8a3d',
    knockbackTaken: 1.15,
    preferredDistance: 430,
    minDistance: 290,
    maxFireDistance: 1000,
    fireInterval: 2.4,
    telegraph: 0.6,
    /** 발사 직전 이 시간 동안은 조준을 고정한다(숙이기/이동으로 피할 여지). */
    aimLockTime: 0.22,
    bulletSpeed: 470,
    bulletRadius: 5,
    damage: 10,
  },
  /** 적이 플랫폼을 오를 때 쓰는 점프 속도와 공중 이동 속도. */
  jumpVelocity: 900,
  airSpeed: 260,
  /** 피격 시 AI가 멈추는 경직 시간. */
  hitStun: 0.14,
  /** 생성 예고(포털) 시간. 이 동안은 공격하지 않고 피격되지 않는다. */
  spawnTelegraph: 0.7,
} as const;

export const WAVES = {
  firstDelay: 2.0,
  intermission: 3.2,
  spawnInterval: 0.75,
  /** 웨이브 n의 적 구성. */
  meleeCount: (wave: number) => 2 + wave,
  rangedCount: (wave: number) => 1 + Math.floor((wave - 1) / 2),
  /** 동시에 살아 있을 수 있는 최대 적 수. */
  maxAlive: (wave: number) => Math.min(10, 4 + wave),
  hpMultiplier: (wave: number) => 1 + 0.16 * (wave - 1),
  speedMultiplier: (wave: number) => Math.min(1.45, 1 + 0.045 * (wave - 1)),
  damageMultiplier: (wave: number) => 1 + 0.06 * (wave - 1),
  fireIntervalMultiplier: (wave: number) => Math.max(0.55, 1 - 0.06 * (wave - 1)),
  scoreMultiplier: (wave: number) => 1 + 0.1 * (wave - 1),
  /** 정예 적(체력·크기 증가) 등장 확률. */
  eliteChance: (wave: number) => (wave < 4 ? 0 : Math.min(0.35, 0.08 * (wave - 3))),
  /** 스폰 위치 제약: 플레이어와의 최소 거리, 바로 위/아래로 판단하는 수평 거리. */
  minSpawnDistance: 300,
  noSpawnAboveHalfWidth: 140,
} as const;

/** 한 번의 공격으로 여러 적을 처치했을 때 추가 점수(추가 처치 1명당). */
export const MULTI_KILL_BONUS = 60;

export const FX = {
  shakeHit: 2.0,
  shakeKill: 3.6,
  shakeHurt: 6.5,
  shakeMax: 8,
  shakeDecay: 9,
} as const;
