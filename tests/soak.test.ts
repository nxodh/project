import { expect, it } from 'vitest';
import '../src/weapons/functions';
import { STEP } from '../src/config';
import { random, setSeed } from '../src/core/rng';
import { segmentRectDistance } from '../src/core/geometry';
import { updateAttacks, updateBullets } from '../src/game/combat';
import { updateEnemies } from '../src/game/enemyAI';
import { updateAim, updatePlayer } from '../src/game/playerSystem';
import { computeAttackPath, updateWeapons } from '../src/game/weaponSystem';
import { updateWaves } from '../src/game/waves';
import { World } from '../src/game/world';
import { FakeInput } from './helpers';

/*
 * 자동 플레이 소크 테스트: 간단한 봇(조준 각도와 함수를 미리보기 경로로 골라 쏘고, 근접형에게서 물러남)이
 * 실제 시스템 전체(입력→물리→무기→AI→웨이브)를 2분간 돌린다. 적이 어딘가에 끼어 웨이브가 멈추지 않는지,
 * 좌표가 NaN이 되지 않는지, 5종 함수가 모두 실전에서 쓰이는지 확인한다.
 */
function pathHits(world: World, wi: number): number {
  const p = computeAttackPath(world, wi);
  const r = world.weapons[wi].tuning.hitRadius;
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

function runSim(seed: number, smart: boolean, maxTime: number) {
  setSeed(seed);
  const world = new World();
  const input = new FakeInput();
  const usage = [0, 0, 0, 0, 0];
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
      if (smart && near && random() < 0.3) input.press('KeyW'); else input.release('KeyW');
      if (act.length && smart) {
        let best: { wi: number; ang: number; score: number } | null = null;
        const target = act[0];
        const base = Math.atan2(target.body.y - target.body.h / 2 - sh.y, target.body.x - sh.x);
        for (const wi of [4, 1, 3, 2, 0]) {
          if (p.cooldowns[wi] > 0) continue;
          for (const off of [0, -0.08, 0.08, -0.18, 0.18, -0.3, 0.3, -0.45, 0.45]) {
            const a = base + off;
            updateAim(p, { x: sh.x + Math.cos(a) * 300, y: sh.y + Math.sin(a) * 300 });
            p.weaponIndex = wi;
            const n = pathHits(world, wi);
            if (n > 0) {
              const sc = n * world.weapons[wi].tuning.damage;
              if (!best || sc > best.score) best = { wi, ang: a, score: sc };
            }
          }
        }
        if (best) {
          p.weaponIndex = best.wi;
          aim = { x: sh.x + Math.cos(best.ang) * 300, y: sh.y + Math.sin(best.ang) * 300 };
          input.fireHeld = true;
        } else {
          aim = { x: target.body.x, y: target.body.y - 50 };
        }
      }
    }
    const shotsBefore = world.stats.shots;
    updateAim(world.player, aim);
    updatePlayer(world, input.asInput(), STEP);
    const wiBefore = world.player.weaponIndex;
    updateWeapons(world, input.asInput(), STEP);
    if (world.stats.shots > shotsBefore) usage[wiBefore]++;
    updateEnemies(world, STEP);
    updateAttacks(world, STEP);
    updateBullets(world, STEP);
    updateWaves(world, STEP);
    world.fx.update(STEP);
    for (const e of world.enemies) {
      if (!lifetimes.has(e.id)) lifetimes.set(e.id, t);
      const life = t - lifetimes.get(e.id)!;
      maxLife = Math.max(maxLife, life);
    }
    if (!world.player.alive) { deathTime = t; break; }
  }
  return { px: world.player.body.x, py: world.player.body.y, wave: world.waves.wave, kills: world.kills, score: world.score, hp: world.player.hp, deathTime, usage, shots: world.stats.shots, hits: world.stats.hits, maxLife, multi: world.stats.bestMultiKill };
}

it('봇 2분 플레이: 웨이브가 멈추지 않고 모든 함수가 쓰인다', () => {
  const r = runSim(5, true, 120);
  expect(r.maxLife).toBeLessThan(40);
  expect(r.wave).toBeGreaterThanOrEqual(5);
  expect(r.kills).toBeGreaterThan(30);
  for (const u of r.usage) expect(u).toBeGreaterThan(0);
  expect(Number.isFinite(r.px) && Number.isFinite(r.py)).toBe(true);
}, 120000);

it('가만히 있으면 첫 웨이브에서 쓰러진다(위협이 실제로 존재)', () => {
  const r = runSim(1, false, 60);
  expect(r.deathTime).toBeGreaterThan(0);
});
