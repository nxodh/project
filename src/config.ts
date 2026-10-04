/**
 * 게임 밸런스와 동작 수치를 한곳에서 조정하는 설정 파일.
 * 좌표 단위는 월드 픽셀(px), 시간 단위는 초(s)다.
 */

/** 화면에 보이는 논리 해상도. 창 크기와 무관하게 이 크기를 레터박스로 맞춰 그린다. */
export const VIEW = { width: 1600, height: 900 } as const;

/** 고정 물리 스텝. 프레임 속도와 무관하게 같은 결과가 나오도록 이 간격으로만 시뮬레이션한다. */
export const STEP = 1 / 120;
/** 탭 전환 등으로 프레임이 크게 밀렸을 때 한 번에 따라잡을 최대 시간. */
export const MAX_FRAME_DT = 0.25;

/**
 * 좌우로 무한히 이어지는 지형. chunkWidth 단위로 필요할 때 생성한다.
 * 배경 좌표평면의 원점은 (originX, originY)이고 1눈금(unit)은 200px이다.
 */
export const TERRAIN = {
  chunkWidth: 1600,
  groundY: 820,
  originX: 800,
  originY: 460,
  unit: 200,
  /** 내비게이션 그래프를 만드는 범위: 플레이어가 있는 청크 기준 좌우 몇 청크. */
  navChunkRadius: 2,
} as const;

export const CAMERA = {
  /** 클수록 카메라가 플레이어를 빨리 따라간다(지수 감쇠 계수). */
  followSharpness: 7,
  /**
   * 화면 가운데 좌우 이 거리 안에서는 카메라가 멈춰 있다(조준이 흔들리지 않게).
   * 플레이어가 이 범위를 벗어날 때만 그 가장자리를 따라 화면이 움직인다.
   */
  deadZone: 260,
} as const;

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
  waveHeal: 30,
} as const;

/** 조작 키(물리 키 코드). */
export const KEYS = {
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  crouch: 'KeyS',
  pause: 'Escape',
  inventory: 'KeyE',
} as const;

/** 무기 인벤토리: 핫바 슬롯 수(숫자 키 1~N)와 시작 장비. */
export const LOADOUT = {
  slots: 5,
  /** 시작 때 슬롯에 들어 있는 무기 id (순서 = 슬롯 번호). 모두 처음부터 가진 기본 함수여야 한다. */
  initial: ['linear', 'abs', 'exp', 'tan', 'circle'],
} as const;

/**
 * 함수 진화: 미분·부정적분·극한 연산으로 보유한 함수에서 새 함수를 만든다(결과는 수학적으로 맞는 함수).
 * 진화 포인트(EP)를 쓰며, 보스를 처치할 때마다 얻는다.
 */
export const EVOLUTION = {
  startPoints: 3,
  perBoss: 1,
  cost: { d: 1, int: 1, lim: 2 },
} as const;

/** 커서까지의 거리에 맞춰 곡선을 줄이는 최소 비율(곡선의 끝점이 커서에 닿는다). */
export const REACH_MIN_SCALE = 0.2;

export const COMBAT = {
  /** 쿨다운 중 짧게 누른 클릭을 기억해 두는 시간(ms). */
  fireBufferMs: 180,
  /** 무기를 바꿔 가며 쏠 때도 적용되는 최소 발사 간격. */
  globalFireInterval: 0.14,
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
  /** 공격 곡선이 화면 위·아래로 이 범위를 넘어가면 멈춘다(무한히 뻗지 않게). */
  minY: -700,
  maxY: 1000,
} as const;

/** 함수 무기(플레이어·적 공통) 하나의 전투 수치. */
export interface WeaponTuning {
  /** 한 번 맞혔을 때의 피해량. */
  damage: number;
  /** 같은 무기를 다시 쏠 수 있을 때까지의 시간(적 패턴에서는 사용하지 않음). */
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
 * 플레이어 함수 무기 밸런스 테이블. 곡선 모양(정의역, 함수식)은 src/weapons/functions.ts에 있다.
 * DPS(피해/대기)만 보면 비슷하게 맞추고, 대신 곡선 모양·두께·사거리로 쓰임새를 나눴다.
 */
export const WEAPON_TUNING = {
  // ── 기본 함수(처음부터 보유): 계보의 뿌리이거나 다른 함수로 만들 수 없는 함수
  // 너프: 피해 12→8, 대기 0.17→0.24, 사거리 980→720, 판정 4→3.5 (DPS 70 → 33)
  linear: { damage: 8, cooldown: 0.24, range: 720, amplitude: 0, speed: 3600, hold: 0.05, fade: 0.14, hitRadius: 3.5, knockback: 90 },
  abs: { damage: 32, cooldown: 0.8, range: 420, amplitude: 62, speed: 1500, hold: 0.2, fade: 0.26, hitRadius: 12, knockback: 340 },
  exp: { damage: 46, cooldown: 0.9, range: 340, amplitude: 260, speed: 1350, hold: 0.14, fade: 0.24, hitRadius: 9, knockback: 380 },
  tan: { damage: 36, cooldown: 1.0, range: 460, amplitude: 220, speed: 1500, hold: 0.16, fade: 0.24, hitRadius: 8, knockback: 260 },
  circle: { damage: 34, cooldown: 0.65, range: 340, amplitude: 170, speed: 1200, hold: 0.22, fade: 0.26, hitRadius: 10, knockback: 280 },
  // ── 다항함수 계보: 일차 →∫ 이차 →∫ 삼차 →∫ 사차
  quadratic: { damage: 24, cooldown: 0.65, range: 600, amplitude: 150, speed: 1700, hold: 0.14, fade: 0.22, hitRadius: 7, knockback: 230 },
  cubic: { damage: 26, cooldown: 0.7, range: 540, amplitude: 170, speed: 1700, hold: 0.14, fade: 0.22, hitRadius: 7, knockback: 230 },
  quartic: { damage: 30, cooldown: 0.75, range: 560, amplitude: 180, speed: 1650, hold: 0.16, fade: 0.24, hitRadius: 8, knockback: 260 },
  // ── 극한으로 만든 초월함수
  expdecay: { damage: 20, cooldown: 0.5, range: 560, amplitude: 150, speed: 1900, hold: 0.12, fade: 0.2, hitRadius: 6, knockback: 160 },
  cosine: { damage: 16, cooldown: 0.34, range: 620, amplitude: 60, speed: 1900, hold: 0.12, fade: 0.2, hitRadius: 6, knockback: 140 },
  sine: { damage: 18, cooldown: 0.38, range: 620, amplitude: 60, speed: 1900, hold: 0.12, fade: 0.2, hitRadius: 6, knockback: 150 },
  log: { damage: 22, cooldown: 0.55, range: 520, amplitude: 150, speed: 1700, hold: 0.14, fade: 0.22, hitRadius: 7, knockback: 200 },
  well: { damage: 30, cooldown: 0.8, range: 460, amplitude: 110, speed: 1400, hold: 0.2, fade: 0.26, hitRadius: 12, knockback: 320 },
  // ── 미분·적분으로 만든 함수
  negsine: { damage: 17, cooldown: 0.36, range: 620, amplitude: 60, speed: 1900, hold: 0.12, fade: 0.2, hitRadius: 6, knockback: 150 },
  negcosine: { damage: 17, cooldown: 0.36, range: 620, amplitude: 60, speed: 1900, hold: 0.12, fade: 0.2, hitRadius: 6, knockback: 150 },
  reciprocal: { damage: 22, cooldown: 0.55, range: 520, amplitude: 150, speed: 1700, hold: 0.14, fade: 0.22, hitRadius: 7, knockback: 200 },
  xlnx: { damage: 26, cooldown: 0.6, range: 520, amplitude: 150, speed: 1600, hold: 0.14, fade: 0.22, hitRadius: 8, knockback: 220 },
  secsq: { damage: 34, cooldown: 0.9, range: 420, amplitude: 200, speed: 1300, hold: 0.16, fade: 0.24, hitRadius: 9, knockback: 280 },
  neglncos: { damage: 30, cooldown: 0.8, range: 440, amplitude: 170, speed: 1400, hold: 0.16, fade: 0.24, hitRadius: 9, knockback: 260 },
  sgn: { damage: 26, cooldown: 0.55, range: 420, amplitude: 120, speed: 1500, hold: 0.16, fade: 0.22, hitRadius: 10, knockback: 240 },
  xabs: { damage: 28, cooldown: 0.7, range: 460, amplitude: 150, speed: 1600, hold: 0.14, fade: 0.22, hitRadius: 8, knockback: 230 },
} satisfies Record<string, WeaponTuning>;

/**
 * 적이 쓰는 함수 공격 패턴의 수치. 모양은 src/weapons/enemyPatterns.ts.
 * 적 곡선은 예고선(점선)을 먼저 보여 준 뒤 발사되고, 플레이어보다 느리게 뻗어 피할 여지를 준다.
 */
export const ENEMY_PATTERN_TUNING = {
  sineWave: { damage: 9, cooldown: 0, range: 720, amplitude: 46, speed: 640, hold: 0.25, fade: 0.25, hitRadius: 6, knockback: 0 },
  lobArc: { damage: 11, cooldown: 0, range: 600, amplitude: 170, speed: 720, hold: 0.2, fade: 0.2, hitRadius: 7, knockback: 0 },
  bossSine: { damage: 9, cooldown: 0, range: 1050, amplitude: 70, speed: 560, hold: 0.25, fade: 0.25, hitRadius: 8, knockback: 0 },
  bossLob: { damage: 10, cooldown: 0, range: 700, amplitude: 260, speed: 600, hold: 0.25, fade: 0.25, hitRadius: 9, knockback: 0 },
  bossRoof: { damage: 12, cooldown: 0, range: 760, amplitude: 150, speed: 680, hold: 0.25, fade: 0.25, hitRadius: 13, knockback: 0 },
  bossExp: { damage: 13, cooldown: 0, range: 520, amplitude: 380, speed: 660, hold: 0.2, fade: 0.25, hitRadius: 10, knockback: 0 },
  bossLine: { damage: 8, cooldown: 0, range: 1150, amplitude: 0, speed: 900, hold: 0.15, fade: 0.2, hitRadius: 5, knockback: 0 },
  bossTan: { damage: 11, cooldown: 0, range: 700, amplitude: 300, speed: 650, hold: 0.25, fade: 0.25, hitRadius: 9, knockback: 0 },
} satisfies Record<string, WeaponTuning>;

/** 적 머리 모양(흑백 화면에서 종류를 구분하는 표식). */
export type HeadShape = 'filled' | 'square' | 'diamond' | 'triangle' | 'boss';

interface EnemyBase {
  hp: number;
  speed: number;
  width: number;
  height: number;
  score: number;
  /** 흑백 톤(회색 단계). */
  color: string;
  head: HeadShape;
  /** 넉백 저항(1이면 그대로, 0.5면 절반만 밀림). */
  knockbackTaken: number;
}

/** 거리를 두고 공격하는 적(탄환/함수 곡선)의 공통 수치. */
export interface CasterStats extends EnemyBase {
  preferredDistance: number;
  minDistance: number;
  maxFireDistance: number;
  fireInterval: number;
  telegraph: number;
  /** 발사 직전 이 시간 동안은 조준을 고정한다(숙이기/이동으로 피할 여지). */
  aimLockTime: number;
}

export const ENEMIES = {
  melee: {
    hp: 40,
    speed: 165,
    width: 26,
    height: 92,
    score: 100,
    color: '#a6a6a6',
    head: 'filled' as HeadShape,
    knockbackTaken: 1,
    attackRange: 50,
    windup: 0.38,
    strikeTime: 0.1,
    recover: 0.55,
    damage: 12,
  },
  /** 일차함수 사수: 직선 탄환. */
  ranged: {
    hp: 30,
    speed: 120,
    width: 24,
    height: 90,
    score: 150,
    color: '#8a8a8a',
    head: 'square' as HeadShape,
    knockbackTaken: 1.15,
    preferredDistance: 430,
    minDistance: 290,
    maxFireDistance: 1000,
    fireInterval: 2.4,
    telegraph: 0.6,
    aimLockTime: 0.22,
    bulletSpeed: 470,
    bulletRadius: 5,
    damage: 10,
  },
  /** 사인 술사: 사인파 곡선. */
  sine: {
    hp: 34,
    speed: 110,
    width: 24,
    height: 90,
    score: 180,
    color: '#c8c8c8',
    head: 'diamond' as HeadShape,
    knockbackTaken: 1.1,
    preferredDistance: 470,
    minDistance: 300,
    maxFireDistance: 760,
    fireInterval: 3.2,
    telegraph: 0.85,
    aimLockTime: 0.3,
  },
  /** 포물선 투척병: 플레이어 위치에 떨어지는 포물선. 엄폐물 너머로도 닿는다. */
  lobber: {
    hp: 38,
    speed: 105,
    width: 26,
    height: 88,
    score: 200,
    color: '#959595',
    head: 'triangle' as HeadShape,
    knockbackTaken: 1,
    preferredDistance: 520,
    minDistance: 320,
    maxFireDistance: 820,
    fireInterval: 3.4,
    telegraph: 0.85,
    aimLockTime: 0.35,
  },
  boss: {
    hp: 780,
    speed: 92,
    width: 50,
    height: 176,
    score: 3000,
    color: '#ffffff',
    head: 'boss' as HeadShape,
    knockbackTaken: 0.06,
    contactDamage: 7,
    preferredDistance: 540,
    /** 단계별(체력 비율 경계) 공격 간격과 예고 시간. */
    phases: [
      { above: 0.6, interval: 3.2, telegraph: 1.25 },
      { above: 0.3, interval: 2.7, telegraph: 1.1 },
      { above: 0, interval: 2.3, telegraph: 1.0 },
    ],
    /** 처치 시 체력 회복. */
    heal: 40,
  },
  /** 적이 플랫폼을 오를 때 쓰는 점프 속도와 공중 이동 속도. */
  jumpVelocity: 900,
  airSpeed: 260,
  /** 피격 시 AI가 멈추는 경직 시간. */
  hitStun: 0.14,
  /** 생성 예고(포털) 시간. 이 동안은 공격하지 않고 피격되지 않는다. */
  spawnTelegraph: 0.7,
  bossSpawnTelegraph: 1.6,
  /** 플레이어에게서 이만큼 멀어진 적은 없애고 대기열로 되돌려 근처에서 다시 나오게 한다. */
  despawnDistance: 2600,
} as const;

export const WAVES = {
  firstDelay: 2.0,
  intermission: 3.6,
  /** 모든 웨이브는 보스 한 마리뿐이다(잡몹 웨이브 없음). */
  hpMultiplier: (wave: number) => 1 + 0.16 * (wave - 1),
  speedMultiplier: (wave: number) => Math.min(1.45, 1 + 0.045 * (wave - 1)),
  damageMultiplier: (wave: number) => 1 + 0.05 * (wave - 1),
  fireIntervalMultiplier: (wave: number) => Math.max(0.6, 1 - 0.04 * (wave - 1)),
  scoreMultiplier: (wave: number) => 1 + 0.1 * (wave - 1),
  /** n번째 웨이브 보스의 체력 배율(완만하게 오른다). */
  bossHpMultiplier: (bossIndex: number) => 1 + 0.13 * (bossIndex - 1),
  /** 스폰 위치 제약: 보스를 제외한 적(테스트·디버그 생성용)의 최소 거리, 바로 위/아래 수평 거리, 최대 수평 거리. */
  minSpawnDistance: 300,
  noSpawnAboveHalfWidth: 140,
  maxSpawnDistanceX: 1300,
} as const;

/** 한 번의 공격으로 여러 적을 처치했을 때 추가 점수(추가 처치 1명당). */
export const MULTI_KILL_BONUS = 60;

export const FX = {
  shakeHit: 2.0,
  shakeKill: 3.6,
  shakeHurt: 6.5,
  shakeBoss: 7,
  shakeMax: 9,
  shakeDecay: 9,
} as const;
