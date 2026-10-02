import { VIEW } from '../config';
import type { Vec2 } from '../core/geometry';
import type { View } from '../core/view';
import type { World } from '../game/world';
import type { CurvePath } from '../weapons/curve';
import { PALETTE } from './colors';
import { drawHud } from './hud';
import {
  drawAttack,
  drawBullets,
  drawCoordinatePlane,
  drawCrosshair,
  drawEffects,
  drawEnemy,
  drawEnemyAttack,
  drawPlayer,
  drawPreview,
  drawTerrain,
} from './worldRenderer';

export interface RenderFrame {
  /** 마우스 커서의 화면 좌표(조준점 표시 위치). */
  aimView: Vec2;
  /** 조준 미리보기 경로(없으면 그리지 않음). */
  preview: CurvePath | null;
  previewReady: boolean;
  showCrosshair: boolean;
  showGameplayHud: boolean;
  /** 실시간 경과(장식 애니메이션). */
  clock: number;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly view: View,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D 컨텍스트를 만들 수 없습니다.');
    this.ctx = ctx;
  }

  render(world: World, frame: RenderFrame): void {
    const ctx = this.ctx;
    const view = this.view;
    const cam = world.camera;

    view.applyScreenTransform(ctx);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = PALETTE.letterbox;
    ctx.fillRect(0, 0, view.cssWidth, view.cssHeight);

    // 절제된 화면 흔들림(월드만 흔들고 조준점·HUD는 고정)
    const sh = world.shake;
    const sx = sh > 0.05 ? (Math.random() - 0.5) * 2 * sh : 0;
    const sy = sh > 0.05 ? (Math.random() - 0.5) * 2 * sh : 0;

    view.applyViewTransform(ctx, cam.x, cam.y, sx, sy);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cam.x - 20, cam.y - 20, VIEW.width + 40, VIEW.height + 40);
    ctx.clip();

    drawCoordinatePlane(ctx, cam);
    drawTerrain(ctx, world.arena.solidsIn(cam.x - 40, cam.x + VIEW.width + 40), cam);

    if (frame.preview) drawPreview(ctx, frame.preview, frame.previewReady);

    const left = cam.x - 300;
    const right = cam.x + VIEW.width + 300;
    for (const e of world.enemies) if (e.body.x > left && e.body.x < right) drawEnemy(ctx, e, world);
    drawPlayer(ctx, world.player, world.currentWeapon, world.time);
    drawBullets(ctx, world);
    for (const a of world.enemyAttacks) drawEnemyAttack(ctx, a);
    for (const a of world.attacks) drawAttack(ctx, a);
    drawEffects(ctx, world);
    ctx.restore();

    view.applyViewTransform(ctx);
    drawHud(ctx, world, frame.showGameplayHud);

    if (frame.showCrosshair) {
      const p = world.player;
      const def = world.currentWeapon;
      const cd = Math.max(p.cooldowns[p.weaponIndex], p.globalCooldown);
      const frac = def.tuning.cooldown > 0 ? Math.min(1, cd / def.tuning.cooldown) : 0;
      drawCrosshair(ctx, frame.aimView.x, frame.aimView.y, frac);
    }
  }
}
