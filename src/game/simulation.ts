import { FX } from '../config';
import type { Vec2 } from '../core/geometry';
import type { Input } from '../core/input';
import { updateAttacks, updateBullets } from './combat';
import { updateEnemies } from './enemyAI';
import { updateAim, updatePlayer } from './playerSystem';
import { updateWaves } from './waves';
import { updateWeapons } from './weaponSystem';
import type { World } from './world';

/**
 * 고정 스텝 하나만큼 게임 세계를 진행한다(입력 → 지형 → 플레이어 → 무기 → 적 → 공격 판정 → 웨이브 → 카메라).
 * 실제 게임 루프와 자동 플레이 테스트가 같은 함수를 쓴다.
 * aimWorld: 커서가 가리키는 월드 좌표.
 */
export function stepWorld(world: World, input: Input, aimWorld: Vec2, dt: number): void {
  world.time += dt;
  world.updateTerrain();
  updateAim(world.player, aimWorld);
  updatePlayer(world, input, dt);
  updateWeapons(world, input, dt);
  updateEnemies(world, dt);
  updateAttacks(world, dt);
  updateBullets(world, dt);
  updateWaves(world, dt);
  world.fx.update(dt);
  world.updateCamera(dt);
  world.shake = Math.max(0, world.shake - world.shake * FX.shakeDecay * dt - 0.5 * dt);
  if (world.banner) {
    world.banner.age += dt;
    if (world.banner.age >= world.banner.duration) world.banner = null;
  }
}
