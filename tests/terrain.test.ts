import { describe, expect, it } from 'vitest';
import '../src/weapons/functions';
import { CAMERA, STEP, TERRAIN, VIEW } from '../src/config';
import { stepWorld } from '../src/game/simulation';
import { World } from '../src/game/world';
import { Arena, generateChunk } from '../src/world/arena';
import { moveBody, makeBody } from '../src/world/physics';
import { FakeInput } from './helpers';

describe('무한 지형', () => {
  it('같은 시드면 같은 지형, 다른 시드면 다른 지형이 나온다', () => {
    const a = new Arena(42);
    const b = new Arena(42);
    const c = new Arena(43);
    for (const k of [-7, -1, 3, 12]) expect(a.chunk(k)).toEqual(b.chunk(k));
    const differs = [1, 2, 3, 4, 5, 6].some((k) => JSON.stringify(a.chunk(k)) !== JSON.stringify(c.chunk(k)));
    expect(differs).toBe(true);
  });

  it('시작 청크(0)는 항상 같은 원래 아레나 배치다', () => {
    expect(generateChunk(1, 0)).toEqual(generateChunk(999, 0));
    expect(generateChunk(1, 0).some((s) => s.kind === 'ledge' && s.x === 700)).toBe(true);
  });

  it('아무리 멀리 가도 바닥이 있다(좌우 모두)', () => {
    const arena = new Arena(5);
    for (const x of [-1e6, -40000, 12345, 1e6]) {
      const hit = arena.raycast(x, 0, x, 2000);
      expect(hit).not.toBeNull();
      expect(hit!.y).toBeLessThanOrEqual(TERRAIN.groundY);
    }
  });

  it('청크 경계를 걸어서 지나가도 걸리지 않는다', () => {
    const arena = new Arena(9);
    const b = makeBody(TERRAIN.chunkWidth - 100, TERRAIN.groundY, 26, 92);
    // 숙여야 지나가는 턱이 없는 높이(점프 중)로 이동 시험 대신, 바닥 위를 걷되 지형에 막히면 실패
    let blockedOnSeam = false;
    for (let i = 0; i < 120; i++) {
      b.vx = 300;
      moveBody(b, arena, STEP);
      if (b.wallDir !== 0 && Math.abs(b.x - TERRAIN.chunkWidth) < 20) blockedOnSeam = true;
    }
    expect(blockedOnSeam).toBe(false);
    expect(b.y).toBe(TERRAIN.groundY);
  });

  it('지형 위의 모든 발판은 바닥과 겹치지 않고 청크 안에 있다', () => {
    for (const seed of [1, 2, 3]) {
      for (let k = -30; k <= 30; k++) {
        for (const s of generateChunk(seed, k)) {
          if (s.kind === 'ground') continue;
          expect(s.x).toBeGreaterThanOrEqual(k * TERRAIN.chunkWidth);
          expect(s.x + s.w).toBeLessThanOrEqual((k + 1) * TERRAIN.chunkWidth);
          expect(s.y + s.h).toBeLessThan(TERRAIN.groundY);
        }
      }
    }
  });
});

describe('카메라', () => {
  it('플레이어를 따라 움직이고, 화면 좌표 + 카메라 = 월드 좌표', () => {
    const world = new World(1);
    const input = new FakeInput();
    input.press('KeyD');
    for (let i = 0; i < 6 / STEP; i++) {
      // 낮은 턱을 넘도록 주기적으로 점프
      if (i % 60 === 0) input.press('Space');
      if (i % 60 === 30) input.release('Space');
      stepWorld(world, input.asInput(), { x: world.player.body.x + 300, y: 700 }, STEP);
    }
    const p = world.player.body;
    expect(p.x).toBeGreaterThan(1600); // 첫 청크를 넘어 계속 달린다
    const expected = p.x + Math.max(-1, Math.min(1, p.vx / 330)) * CAMERA.lookAhead - VIEW.width / 2;
    expect(Math.abs(world.camera.x - expected)).toBeLessThan(120);
    const v = { x: 640, y: 300 };
    const w = world.viewToWorld(v);
    expect(w.x - world.camera.x).toBeCloseTo(640, 9);
    expect(w.y - world.camera.y).toBeCloseTo(300, 9);
  });

  it('플레이어가 다른 청크로 가면 내비게이션 범위가 따라오고 면 id가 다시 계산된다', () => {
    const world = new World(1);
    world.player.body.x = 9000;
    world.player.body.y = TERRAIN.groundY;
    world.updateTerrain();
    expect(world.nav.windowX1).toBeLessThan(9000);
    expect(world.nav.windowX2).toBeGreaterThan(9000);
    const s = world.nav.surface(world.player.lastSurfaceId);
    expect(s.y).toBe(TERRAIN.groundY);
    expect(9000).toBeGreaterThanOrEqual(s.x1);
    expect(9000).toBeLessThanOrEqual(s.x2);
  });
});
