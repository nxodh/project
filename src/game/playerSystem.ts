import { PLAYER } from '../config';
import { approach, type Vec2 } from '../core/geometry';
import type { Input } from '../core/input';
import type { Player } from '../entities/player';
import { canFitHeight, moveBody } from '../world/physics';
import type { World } from './world';

function setCrouch(p: Player, on: boolean): void {
  p.crouching = on;
  p.body.h = on ? PLAYER.crouchHeight : PLAYER.standHeight;
}

/**
 * 조준 갱신. 이동 방향과 무관하게 어깨→커서 방향을 조준으로 삼고, 바라보는 방향도 조준을 따른다.
 */
export function updateAim(p: Player, target: Vec2): void {
  const s = p.shoulder();
  const dx = target.x - s.x;
  const dy = target.y - s.y;
  const len = Math.hypot(dx, dy);
  if (len > 4) p.aim = { x: dx / len, y: dy / len };
  if (p.aim.x > 0.02) p.facing = 1;
  else if (p.aim.x < -0.02) p.facing = -1;
}

export function updatePlayer(world: World, input: Input, dt: number): void {
  const p = world.player;
  const b = p.body;
  const arena = world.arena;

  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.recoil = Math.max(0, p.recoil - dt * 7);

  if (!p.alive) {
    b.vx = approach(b.vx, 0, PLAYER.groundFriction * dt);
    moveBody(b, arena, dt);
    return;
  }

  const intent = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
  const wantCrouch = input.isDown('KeyS');

  // 숙이기: 바닥에 있을 때만. 머리 위가 막혀 있으면 키를 떼도 일어서지 못한다.
  if (wantCrouch && b.grounded) {
    if (!p.crouching) setCrouch(p, true);
  } else if (p.crouching && canFitHeight(b, PLAYER.standHeight, arena)) {
    setCrouch(p, false);
  }

  // 점프: 입력 버퍼 + 코요테 타임, 키를 일찍 떼면 낮게 뛴다.
  if (input.consumePress('KeyW')) p.jumpBuffer = PLAYER.jumpBuffer;
  if (b.grounded) p.coyote = PLAYER.coyoteTime;
  else p.coyote = Math.max(0, p.coyote - dt);
  if (p.jumpBuffer > 0 && p.coyote > 0) {
    if (p.crouching && canFitHeight(b, PLAYER.standHeight, arena)) setCrouch(p, false);
    if (!p.crouching) {
      b.vy = -PLAYER.jumpVelocity;
      p.jumpBuffer = 0;
      p.coyote = 0;
      p.jumpHeld = true;
      world.fx.dust(b.x, b.y, 4);
    }
  }
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  if (p.jumpHeld && !input.isDown('KeyW')) {
    if (b.vy < 0) b.vy *= PLAYER.jumpCutMultiplier;
    p.jumpHeld = false;
  }
  if (b.vy >= 0) p.jumpHeld = false;

  // 수평 이동
  const maxSpeed = p.crouching ? PLAYER.crouchSpeed : PLAYER.moveSpeed;
  if (intent !== 0) {
    const accel = b.grounded ? PLAYER.groundAccel : PLAYER.airAccel;
    b.vx = approach(b.vx, intent * maxSpeed, accel * dt);
  } else {
    const friction = b.grounded ? PLAYER.groundFriction : PLAYER.airFriction;
    b.vx = approach(b.vx, 0, friction * dt);
  }

  const wasGrounded = b.grounded;
  const fallSpeed = b.vy;
  moveBody(b, arena, dt);
  if (!wasGrounded && b.grounded && fallSpeed > 450) world.fx.dust(b.x, b.y, 5);

  if (b.grounded) {
    p.walkPhase += b.vx * dt * 0.05;
    const s = world.nav.surfaceAt(b.x, b.y, b.w / 2);
    if (s) p.lastSurfaceId = s.id;
  }
}
