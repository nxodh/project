import { beforeEach, describe, expect, it } from 'vitest';
import '../src/weapons/functions';
import { segmentRectDistance } from '../src/core/geometry';
import { setSeed } from '../src/core/rng';
import { Bullet } from '../src/entities/bullet';
import type { Enemy } from '../src/entities/enemy';
import { findCurveHit, updateAttacks } from '../src/game/combat';
import { computeAttackPath, fireWeapon, selectWeapon } from '../src/game/weaponSystem';
import { spawnEnemy } from '../src/game/waves';
import { World } from '../src/game/world';
import { updateAim } from '../src/game/playerSystem';
import { CurveAttack } from '../src/weapons/attack';
import { buildCurvePath, makeAimFrame } from '../src/weapons/curve';
import { getWeapons } from '../src/weapons/registry';

const STEP = 1 / 120;

function makeWorld(): World {
  const w = new World();
  w.debug.noSpawn = true;
  return w;
}

function place(world: World, kind: 'melee' | 'ranged', x: number, y: number, hp = 1000): Enemy {
  const e = spawnEnemy(world, kind, x, y, false);
  e.spawnTimer = 0;
  e.hp = hp;
  return e;
}

/** 공격이 끝날 때까지 공격만 갱신한다(적은 제자리). */
function runAttacks(world: World, dt = STEP): void {
  for (let i = 0; i < 2000 && world.attacks.length > 0; i++) updateAttacks(world, dt);
}

beforeEach(() => setSeed(1));

describe('선분-사각형 거리', () => {
  const r = { x: 0, y: 0, w: 10, h: 10 };
  it('교차하면 0, 떨어져 있으면 정확한 최단 거리', () => {
    expect(segmentRectDistance(-5, 5, 15, 5, r)).toBe(0);
    expect(segmentRectDistance(-5, 13, 15, 13, r)).toBeCloseTo(3);
    expect(segmentRectDistance(13, 14, 20, 20, r)).toBeCloseTo(5);
    expect(segmentRectDistance(3, 3, 4, 4, r)).toBe(0); // 내부
  });
});

describe('미리보기와 실제 발사', () => {
  it('같은 위치·조준에서 미리보기 경로와 발사된 공격 경로가 완전히 같다 (5종 × 여러 방향)', () => {
    const world = makeWorld();
    world.player.body.x = 760;
    world.player.body.y = 500; // 중앙 발판 위
    for (let wi = 0; wi < getWeapons().length; wi++) {
      for (let deg = 0; deg < 360; deg += 30) {
        const th = (deg * Math.PI) / 180;
        const s = world.player.shoulder();
        updateAim(world.player, { x: s.x + Math.cos(th) * 300, y: s.y + Math.sin(th) * 300 });
        selectWeapon(world, wi);
        const preview = computeAttackPath(world);
        world.player.cooldowns.fill(0);
        world.player.globalCooldown = 0;
        const attack = fireWeapon(world);
        expect(attack.path.count).toBe(preview.count);
        expect(Array.from(attack.path.xs.subarray(0, preview.count))).toEqual(
          Array.from(preview.xs.subarray(0, preview.count)),
        );
        expect(Array.from(attack.path.ys.subarray(0, preview.count))).toEqual(
          Array.from(preview.ys.subarray(0, preview.count)),
        );
        expect(attack.path.blocked).toBe(preview.blocked);
      }
    }
  });

  it('발사 후 플레이어와 조준이 움직여도 이미 발사한 곡선은 그대로다', () => {
    const world = makeWorld();
    selectWeapon(world, 2);
    updateAim(world.player, { x: 1200, y: 700 });
    const attack = fireWeapon(world);
    const before = Array.from(attack.path.xs.subarray(0, attack.path.count));
    world.player.body.x += 200;
    updateAim(world.player, { x: 0, y: 0 });
    updateAttacks(world, 0.05);
    expect(Array.from(attack.path.xs.subarray(0, attack.path.count))).toEqual(before);
  });
});

describe('곡선 충돌 판정', () => {
  const linear = () => getWeapons()[0];

  it('아직 그려지지 않은 곡선 앞부분에는 판정이 없다', () => {
    const world = makeWorld();
    const e = place(world, 'melee', 900, 820);
    const path = buildCurvePath(linear(), makeAimFrame({ x: 100, y: 770 }, { x: 1, y: 0 }), world.arena);
    const a = new CurveAttack(linear(), path);
    a.update(0.05); // 머리: 230px 지점 → 적(약 800px)에 아직 닿지 않음
    expect(findCurveHit(a, e.hurtbox())).toBeNull();
    a.update(0.15); // 머리가 적을 지나감
    expect(findCurveHit(a, e.hurtbox())).not.toBeNull();
  });

  it('한 번의 발사는 같은 적에게 한 번만 피해를 준다(공격 수명 전체 동안)', () => {
    const world = makeWorld();
    const e = place(world, 'melee', 560, 820);
    e.body.vx = 0;
    world.player.body.x = 300;
    selectWeapon(world, 3); // 절댓값: 두껍고 오래 유지
    updateAim(world.player, { x: 700, y: 760 });
    fireWeapon(world);
    const hp0 = e.hp;
    // 적을 곡선 위에 붙잡아 두고 여러 스텝 갱신
    for (let i = 0; i < 400 && world.attacks.length; i++) {
      e.body.x = 560;
      e.body.y = 820;
      e.body.vx = 0;
      e.body.vy = 0;
      updateAttacks(world, STEP);
    }
    expect(hp0 - e.hp).toBe(getWeapons()[3].tuning.damage);
  });

  it('공격은 적을 관통해 경로 위의 여러 적을 각각 한 번씩 맞힌다', () => {
    const world = makeWorld();
    world.player.body.x = 950; // 중앙의 낮은 턱 오른쪽
    const a1 = place(world, 'melee', 1150, 820);
    const a2 = place(world, 'ranged', 1300, 820);
    const a3 = place(world, 'melee', 1450, 820);
    selectWeapon(world, 0);
    updateAim(world.player, { x: 1500, y: 820 - 68 });
    fireWeapon(world);
    runAttacks(world);
    const dmg = getWeapons()[0].tuning.damage;
    for (const e of [a1, a2, a3]) expect(1000 - e.hp).toBe(dmg);
  });

  it('큰 스텝으로 머리가 한 번에 멀리 나아가도 중간의 적을 놓치지 않는다', () => {
    const world = makeWorld();
    world.player.body.x = 100;
    const e = place(world, 'melee', 600, 820);
    selectWeapon(world, 0);
    updateAim(world.player, { x: 1500, y: 820 - 68 });
    fireWeapon(world);
    // 0.2초 한 번에: 머리가 0 → 920px로 점프
    updateAttacks(world, 0.2);
    expect(1000 - e.hp).toBe(getWeapons()[0].tuning.damage);
  });

  it('곡선 두께(판정 반경) 안쪽은 맞고 바깥은 맞지 않는다', () => {
    const world = makeWorld();
    const def = getWeapons()[0];
    const r = def.tuning.hitRadius;
    const path = buildCurvePath(def, makeAimFrame({ x: 100, y: 300 }, { x: 1, y: 0 }), world.arena);
    const a = new CurveAttack(def, path);
    a.update(1 / 60);
    a.age = a.growTime + 0.001;
    // 곡선(y=300) 바로 위 r-1 / r+1 거리에 있는 상자
    expect(findCurveHit(a, { x: 500, y: 300 + r - 1, w: 20, h: 40 })).not.toBeNull();
    expect(findCurveHit(a, { x: 500, y: 300 + r + 1, w: 20, h: 40 })).toBeNull();
  });

  it('지형 뒤에 있는 적은 맞지 않는다(곡선이 지형에서 끊김)', () => {
    const world = makeWorld();
    world.player.body.x = 400;
    world.player.body.y = 820;
    // 중앙의 낮은 턱(700~900, y 732~754) 너머, 같은 높이의 적
    const e = place(world, 'melee', 1000, 820);
    selectWeapon(world, 0);
    updateAim(world.player, { x: 1000, y: 742 });
    const attack = fireWeapon(world);
    expect(attack.path.blocked).toBe(true);
    runAttacks(world);
    expect(e.hp).toBe(1000);
  });

  it('곡선은 적 탄환을 지운다', () => {
    const world = makeWorld();
    world.player.body.x = 200;
    const b = new Bullet(600, 820 - 68, -400, 0, 5, 10, '#ff8a3d');
    world.bullets.push(b);
    selectWeapon(world, 0);
    updateAim(world.player, { x: 1000, y: 820 - 68 });
    fireWeapon(world);
    updateAttacks(world, 0.2);
    expect(b.alive).toBe(false);
  });

  it('생성 예고 중인 적은 맞지 않는다', () => {
    const world = makeWorld();
    world.player.body.x = 200;
    const e = spawnEnemy(world, 'melee', 600, 820, false);
    selectWeapon(world, 0);
    updateAim(world.player, { x: 1000, y: 820 - 68 });
    fireWeapon(world);
    runAttacks(world);
    expect(e.hp).toBe(e.maxHp);
  });
});
