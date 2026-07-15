import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import { Theme } from './Theme';

export class CanvasRenderer {
  public static drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillColor?: any,
    strokeColor?: any,
    strokeWidth = 1
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  }

  public static async drawCircularAvatar(
    ctx: CanvasRenderingContext2D,
    avatarUrl: string,
    x: number,
    y: number,
    radius: number,
    borderColor = '#FFFFFF',
    borderWidth = 2
  ): Promise<void> {
    // Outer shadow + border
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.arc(x, y, radius + borderWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = borderColor;
    ctx.fill();
    ctx.restore();

    // Image clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    try {
      const img = await loadImage(avatarUrl);
      (ctx as any).drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
    } catch {
      ctx.fillStyle = '#475569';
      ctx.fill();
    }
    ctx.restore();
  }

  public static drawProgressBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    ratio: number,
    trackColor = Theme.colors.secondaryCard,
    fillColor = Theme.colors.accentGold
  ): void {
    const radius = height / 2;
    const fillWidth = Math.max(height, width * Math.min(1, Math.max(0, ratio)));

    // Draw Track
    this.drawRoundedRect(ctx, x, y, width, height, radius, trackColor);
    // Draw Fill
    this.drawRoundedRect(ctx, x, y, fillWidth, height, radius, fillColor);
  }

  public static formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'Tr';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'N';
    }
    return num.toString();
  }
}
