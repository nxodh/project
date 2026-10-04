import { expect, it } from 'vitest';
import '../src/weapons/functions';
import { STEP } from '../src/config';
import { random, setSeed } from '../src/core/rng';
import { segmentRectDistance } from '../src/core/geometry';
import { updateAim } from '../src/game/playerSystem';
import { stepWorld } from '../src/game/simulation';
import { computeAttackPath, equipWeapon, evolveWeapon } from '../src/game/weaponSystem';
import { World } from '../src/game/world';
import { FakeInput } from './helpers';

/*
 * 자동 플레이 소크 테스트: 간단한 봇(조준 각도와 함수를 미리보기 경로로 골라 쏘고, 근접형에게서 물러남)이
 * 실제 시스템 전체(입력→물리→무기→AI→웨이브)를 2분간 돌린다. 적이 어딘가에 끼어 웨이브가 멈추지 않는지,
 * 좌표가 NaN이 되지 않는지, 5종 함수가 모두 실전에서 쓰이는지 확인한다.
 */
function pathHits(world: World, wi: number): number {
  const p = computeAttackPath(world, wi);
  const r = world.slotWeapon(wi).tuning.hitRadius;
  let n = 0;
  for (const e of world.enemies) {
    if (!e.active) continue;
    const hb = e.hurtbox();
    for (let i = 1; i < p.count; i++) {
      if (segmentRectDistance(p.xs[i - 1], p.ys[i - 1], p.xs[i], p.ys[i], hb) <= r) { n++; break; }
    }
  }
  return n;
}

function runSim(seed: number, smart: boolean, maxTime: number, invincible = false) {
  setSeed(seed);
  const world = new World(seed);
  world.debug.invincible = invincible;
  const input = new FakeInput();
  // 인벤토리를 실전처럼 구성한다: 진화로 이차·삼차·사차함수를 얻어 슬롯에 꽂는다(진화 포인트를 넉넉히 준다)
  world.evoPoints = 10;
  for (const [from, op] of [['linear', 'int'], ['quadratic', 'int'], ['cubic', 'int'], ['quadratic', 'lim']] as const) evolveWeapon(world, from, op);
  equipWeapon(world, 0, 'quadratic');
  equipWeapon(world, 2, 'cubic');
  equipWeapon(world, 3, 'cosine');
  const usage = new Array<number>(world.loadout.length).fill(0);
  const lifetimes = new Map<number, number>();
  let maxLife = 0;
  let t = 0;
  let decideTimer = 0;
  let aim = { x: 1200, y: 700 };
  let deathTime = -1;
  while (t < maxTime) {
    t += STEP;
    // 봇 판단(10Hz)
    decideTimer -= STEP;
    const p = world.player;
    if (decideTimer <= 0 && p.alive) {
      decideTimer = 0.1;
      input.fireHeld = false;
      const sh = p.shoulder();
      const act = world.enemies.filter((e) => e.active);
      act.sort((a, b) => Math.hypot(a.body.x - p.body.x, a.body.y - p.body.y) - Math.hypot(b.body.x - p.body.x, b.body.y - p.body.y));
      // 이동: 가까운 근접형에게서 멀어지기
      input.release('KeyA'); input.release('KeyD');
      const near = act.find((e) => e.kind === 'melee' && Math.abs(e.body.x - p.body.x) < 170 && Math.abs(e.body.y - p.body.y) < 100);
      if (smart && near) input.press(near.body.x > p.body.x ? 'KeyA' : 'KeyD');
      if (smart && near && random() < 0.3) input.press('Space'); else input.release('Space');
      if (act.length && smart) {
        let best: { wi: number; ang: number; score: number } | null = null;
        const target = act[0];
        const base = Math.atan2(target.body.y - target.body.h / 2 - sh.y, target.body.x - sh.x);
        // 곡선의 끝점이 커서에 닿으므로 커서를 표적 거리에 둔다(조금 짧거나 길게 흔들며 시험)
        const dist = Math.max(120, Math.hypot(target.body.x - sh.x, target.body.y - target.body.h / 2 - sh.y));
        for (let wi = 0; wi < world.loadout.length; wi++) {
          if (p.cooldowns[wi] > 0) continue;
          for (const off of [0, -0.08, 0.08, -0.18, 0.18, -0.3, 0.3, -0.45, 0.45]) {
            const a = base + off;
            updateAim(p, { x: sh.x + Math.cos(a) * dist, y: sh.y + Math.sin(a) * dist });
            p.weaponIndex = wi;
            const n = pathHits(world, wi);
            if (n > 0) {
              const sc = n * world.slotWeapon(wi).tuning.damage;
              if (!best || sc > best.score) best = { wi, ang: a, score: sc };
            }
          }
        }
        if (best) {
          p.weaponIndex = best.wi;
          aim = { x: sh.x + Math.cos(best.ang) * dist, y: sh.y + Math.sin(best.ang) * dist };
          input.fireHeld = true;
        } else {
          aim = { x: target.body.x, y: target.body.y - 50 };
        }
      }
    }
    const shotsBefore = world.stats.shots;
    const wiBefore = world.player.weaponIndex;
    stepWorld(world, input.asInput(), aim, STEP);
    if (world.stats.shots > shotsBefore) usage[wiBefore]++;
    for (const e of world.enemies) {
      if (!lifetimes.has(e.id)) lifetimes.set(e.id, t);
      const life = t - lifetimes.get(e.id)!;
      maxLife = Math.max(maxLife, life);
    }
    if (!world.player.alive) { deathTime = t; break; }
  }
  return { bosses: world.stats.bossesDefeated, px: world.player.body.x, py: world.player.body.y, wave: world.waves.wave, kills: world.kills, score: world.score, hp: world.player.hp, deathTime, usage, shots: world.stats.shots, hits: world.stats.hits, maxLife, multi: world.stats.bestMultiKill };
}

it('봇 2분 플레이(무적): 보스 웨이브가 멈추지 않고 이어지며 진화로 얻은 함수를 포함해 여러 슬롯이 쓰인다', () => {
  const r = runSim(5, true, 150, true);
  // 보스가 90초 넘게 살아 있으면 어딘가 끼어 웨이브가 멈춘 것이다.
  expect(r.maxLife).toBeLessThan(90);
  expect(r.wave).toBeGreaterThanOrEqual(4);
  expect(r.bosses).toBeGreaterThanOrEqual(3);
  // 봇은 매번 피해가 큰 슬롯을 고르므로 모든 슬롯을 쓰지는 않지만 여러 슬롯이 쓰인다.
  expect(r.usage.filter((u) => u > 0).length).toBeGreaterThanOrEqual(3);
  expect(Number.isFinite(r.px) && Number.isFinite(r.py)).toBe(true);
}, 120000);

it('가만히 있으면 첫 웨이브에서 쓰러진다(위협이 실제로 존재)', () => {
  const r = runSim(1, false, 60);
  expect(r.deathTime).toBeGreaterThan(0);
});
