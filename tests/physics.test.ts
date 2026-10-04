import { describe, expect, it } from 'vitest';
import '../src/weapons/functions';
import { PHYSICS, PLAYER, STEP } from '../src/config';
import { FixedStepper } from '../src/core/loop';
import { updateAim, updatePlayer } from '../src/game/playerSystem';
import { World } from '../src/game/world';
import { FakeInput } from './helpers';

function run(world: World, input: FakeInput, seconds: number, each?: (t: number) => void): void {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) {
    each?.(i * STEP);
    updatePlayer(world, input.asInput(), STEP);
  }
}

function settle(world: World, input: FakeInput): void {
  run(world, input, 0.1);
}

describe('고정 타임스텝', () => {
  it('프레임 속도가 달라도(30/60/144fps, 불규칙) 같은 시간에 같은 위치에 도달한다', () => {
    const results: Array<{ x: number; y: number; steps: number }> = [];
    const frameSets = [
      Array(30).fill(1 / 30),
      Array(60).fill(1 / 60),
      Array(144).fill(1 / 144),
      Array.from({ length: 90 }, (_, i) => (i % 3 === 0 ? 1 / 25 : 1 / 90)),
    ];
    for (const frames of frameSets) {
      const world = new World(1);
      const input = new FakeInput();
      settle(world, input);
      input.press('KeyD');
      input.press('Space');
      const stepper = new FixedStepper();
      let steps = 0;
      let elapsed = 0;
      for (const dt of frames) {
        elapsed += dt;
        steps += stepper.advance(dt, (h) => updatePlayer(world, input.asInput(), h));
      }
      // 같은 스텝 수가 될 때까지 맞춤(누산기 나머지 차이 보정)
      while (steps < 118) steps += stepper.advance(STEP, (h) => updatePlayer(world, input.asInput(), h));
      expect(elapsed).toBeGreaterThan(0.75);
      results.push({ x: world.player.body.x, y: world.player.body.y, steps });
    }
    const minSteps = Math.min(...results.map((r) => r.steps));
    expect(minSteps).toBeGreaterThanOrEqual(118);
    // 스텝 수를 맞춰 다시 비교: 고정 스텝이므로 결과가 완전히 같아야 한다
    const replay = (steps: number) => {
      const world = new World(1);
      const input = new FakeInput();
      settle(world, input);
      input.press('KeyD');
      input.press('Space');
      for (let i = 0; i < steps; i++) updatePlayer(world, input.asInput(), STEP);
      return { x: world.player.body.x, y: world.player.body.y };
    };
    for (const r of results) {
      const ref = replay(r.steps);
      expect(r.x).toBe(ref.x);
      expect(r.y).toBe(ref.y);
    }
  });

  it('긴 멈춤 뒤에도 한 번에 따라잡는 시간은 제한된다', () => {
    const s = new FixedStepper();
    const n = s.advance(5, () => {});
    expect(n).toBeLessThanOrEqual(Math.ceil(0.25 / STEP));
  });
});

describe('이동·점프·착지', () => {
  it('A/D로 좌우 이동하고 최고 속도에 도달한다', () => {
    const world = new World(1);
    const input = new FakeInput();
    settle(world, input);
    const x0 = world.player.body.x;
    input.press('KeyA');
    run(world, input, 0.4);
    expect(world.player.body.x).toBeLessThan(x0 - 80);
    expect(world.player.body.vx).toBeCloseTo(-PLAYER.moveSpeed, 0);
    input.release('KeyA');
    run(world, input, 0.3);
    expect(world.player.body.vx).toBe(0);
  });

  it('Space 점프: 최고 높이 ≈ v²/2g, 바닥에 착지', () => {
    const world = new World(1);
    const input = new FakeInput();
    settle(world, input);
    const y0 = world.player.body.y;
    input.press('Space');
    let minY = y0;
    run(world, input, 1.2, () => (minY = Math.min(minY, world.player.body.y)));
    const expected = (PLAYER.jumpVelocity * PLAYER.jumpVelocity) / (2 * PHYSICS.gravity);
    expect(y0 - minY).toBeGreaterThan(expected - 10);
    expect(y0 - minY).toBeLessThan(expected + 2);
    expect(world.player.body.grounded).toBe(true);
    expect(world.player.body.y).toBe(y0);
  });

  it('W 키로는 더 이상 점프하지 않는다(점프 = Space)', () => {
    const world = new World(1);
    const input = new FakeInput();
    settle(world, input);
    const y0 = world.player.body.y;
    input.press('KeyW');
    run(world, input, 0.5);
    expect(world.player.body.y).toBe(y0);
  });

  it('점프 키를 일찍 떼면 낮게 뛴다', () => {
    const world = new World(1);
    const input = new FakeInput();
    settle(world, input);
    const y0 = world.player.body.y;
    input.press('Space');
    let minY = y0;
    run(world, input, 1.2, (t) => {
      if (t > 0.06) input.release('Space');
      minY = Math.min(minY, world.player.body.y);
    });
    expect(y0 - minY).toBeLessThan(100);
  });

  it('이동 방향과 조준 방향은 독립적이다(왼쪽으로 가면서 오른쪽 조준)', () => {
    const world = new World(1);
    const input = new FakeInput();
    settle(world, input);
    input.press('KeyA');
    run(world, input, 0.3, () => updateAim(world.player, { x: 1500, y: 700 }));
    expect(world.player.body.vx).toBeLessThan(0);
    expect(world.player.facing).toBe(1);
    expect(world.player.aim.x).toBeGreaterThan(0);
  });
});

describe('숙이기', () => {
  it('숙이면 실제 피격 영역 높이가 낮아진다', () => {
    const world = new World(1);
    const input = new FakeInput();
    settle(world, input);
    const standH = world.player.hurtbox().h;
    input.press('KeyS');
    run(world, input, 0.05);
    expect(world.player.crouching).toBe(true);
    expect(world.player.body.h).toBe(PLAYER.crouchHeight);
    expect(world.player.hurtbox().h).toBeLessThan(standH - 30);
    // 발 위치는 그대로
    expect(world.player.body.y).toBe(world.arena.groundY);
    input.release('KeyS');
    run(world, input, 0.05);
    expect(world.player.crouching).toBe(false);
  });

  it('서 있으면 낮은 턱에 막히고, 숙이면 통과하며, 턱 아래서는 일어설 수 없다', () => {
    const world = new World(1);
    const input = new FakeInput();
    world.player.body.x = 600;
    settle(world, input);
    // 서서 오른쪽으로: 턱(x 700~900, 아래 틈 66px)에 막힘
    input.press('KeyD');
    run(world, input, 1.0);
    expect(world.player.body.x).toBeLessThan(700 - PLAYER.width / 2 + 0.01);
    // 숙여서 아래로 들어감
    input.press('KeyS');
    run(world, input, 1.0);
    expect(world.player.body.x).toBeGreaterThan(720);
    expect(world.player.body.x).toBeLessThan(880);
    // 턱 아래에서 S를 떼도 일어서지 못하고 점프도 못한다
    input.release('KeyD');
    input.release('KeyS');
    input.press('Space');
    run(world, input, 0.3);
    expect(world.player.crouching).toBe(true);
    expect(world.player.body.y).toBe(world.arena.groundY);
    // 턱을 벗어나면 일어선다
    input.press('KeyD');
    run(world, input, 1.5);
    expect(world.player.body.x).toBeGreaterThan(900);
    expect(world.player.crouching).toBe(false);
  });
});
