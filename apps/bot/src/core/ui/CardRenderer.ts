import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import { Theme } from './Theme';
import { CanvasRenderer } from './CanvasRenderer';
import { BotClient } from '../Client';

const getBotName = () => BotClient.instance?.user?.username ?? 'Gamma Beta 2.0';

export class CardRenderer {
  /**
   * 1. Draw Welcome Card (Welcome Card style)
   */
  public static async drawWelcomeCard(
    avatarUrl: string,
    username: string,
    serverName: string,
    memberCount: number
  ): Promise<Buffer> {
    const width = 800;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // 2. Decorative elements (Accent Gold side border or bar)
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 16, height, 8, Theme.colors.accentGold);

    // 3. Circular Avatar
    await CanvasRenderer.drawCircularAvatar(ctx, avatarUrl, 120, height / 2, 70, Theme.colors.accentGold, 3);

    // 4. Texts
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 22px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('CHÀO MỪNG THÀNH VIÊN MỚI', 230, 80);

    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 36px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    // Truncate username if too long
    const displayUser = username.length > 18 ? username.slice(0, 15) + '...' : username;
    ctx.fillText(displayUser, 230, 135);

    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = '500 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`Đến với server: ${serverName}`, 230, 185);

    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = 'normal 15px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`Bạn là thành viên thứ #${memberCount}`, 230, 230);

    return canvas.toBuffer('image/png');
  }

  /**
   * 2. Draw Goodbye Card
   */
  public static async drawGoodbyeCard(
    avatarUrl: string,
    username: string,
    joinedAt: Date | null,
    timeSpentStr: string
  ): Promise<Buffer> {
    const width = 800;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Decorative side bar (Danger Red)
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 16, height, 8, Theme.colors.danger);

    // Avatar
    await CanvasRenderer.drawCircularAvatar(ctx, avatarUrl, 120, height / 2, 70, Theme.colors.danger, 3);

    // Texts
    ctx.fillStyle = Theme.colors.danger;
    ctx.font = 'bold 22px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('THÀNH VIÊN ĐÃ RỜI PHÒNG', 230, 80);

    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 36px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const displayUser = username.length > 18 ? username.slice(0, 15) + '...' : username;
    ctx.fillText(displayUser, 230, 135);

    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = '500 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const joinedStr = joinedAt ? joinedAt.toLocaleDateString('vi-VN') : 'Không rõ';
    ctx.fillText(`Ngày gia nhập: ${joinedStr}`, 230, 185);

    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = 'normal 15px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`Thời gian gắn bó: ${timeSpentStr}`, 230, 230);

    return canvas.toBuffer('image/png');
  }

  /**
   * 3. Draw Level Up Card
   */
  public static async drawLevelUpCard(
    avatarUrl: string,
    oldLevel: number,
    newLevel: number
  ): Promise<Buffer> {
    const width = 550;
    const height = 180;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Accent left strip
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 12, height, 6, Theme.colors.accentGold);

    // Circular Avatar
    await CanvasRenderer.drawCircularAvatar(ctx, avatarUrl, 75, height / 2, 45, Theme.colors.accentGold, 2);

    // Title
    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 24px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('Thăng Cấp Chat!', 145, 65);

    // Large level transition text
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 44px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`LV.${oldLevel} -> ${newLevel}`, 145, 128);

    return canvas.toBuffer('image/png');
  }

  /**
   * 4. Draw Rank Card
   */
  public static async drawRankCard(
    avatarUrl: string,
    username: string,
    level: number,
    rank: number,
    currentXp: number,
    nextXp: number
  ): Promise<Buffer> {
    const width = 800;
    const height = 220;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Title
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('LEVEL PROFILE', 40, 42);

    // Avatar
    await CanvasRenderer.drawCircularAvatar(ctx, avatarUrl, 100, 130, 60, Theme.colors.accentGold, 2.5);

    // Username
    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 30px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const displayUser = username.length > 20 ? username.slice(0, 17) + '...' : username;
    ctx.fillText(`@${displayUser}`, 180, 100);

    // Level & Rank badge
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 22px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`LV.${level}`, 180, 142);

    ctx.fillStyle = Theme.colors.info;
    ctx.font = 'bold 20px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`HẠNG #${rank}`, 300, 142);

    // XP text (align right)
    const ratio = Math.min(1, currentXp / (nextXp || 1));
    const xpText = `${currentXp.toLocaleString()} / ${nextXp.toLocaleString()} XP`;
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(xpText, width - 40, 142);
    ctx.textAlign = 'left'; // Reset

    // Progress Bar
    CanvasRenderer.drawProgressBar(ctx, 180, 164, width - 220, 14, ratio, Theme.colors.secondaryCard, Theme.colors.accentGold);

    return canvas.toBuffer('image/png');
  }

  /**
   * 5. Draw Leaderboard Card
   */
  public static async drawLeaderboardCard(
    guildName: string,
    type: string,
    members: Array<{ username: string; avatarUrl: string; value: number; level?: number }>,
    callerRank: { rank: number; username: string; avatarUrl: string; value: number; level?: number } | null
  ): Promise<Buffer> {
    const width = 800;

    // Remaining rows (ranks 4-10)
    const remaining = members.slice(3, 10);

    // Dynamic height calculation to avoid ugly empty space at the bottom
    const headerHeight = 460;
    const rowHeight = 75;
    const callerSectionHeight = callerRank ? 130 : 0;
    const footerPadding = 70;
    const height = headerHeight + (remaining.length * rowHeight) + callerSectionHeight + footerPadding;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Header label (small muted uppercase)
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = 'bold 14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('BẢNG XẾP HẠNG SERVER', 40, 55);

    // Large Title with Emoji
    const typeLabels: Record<string, string> = {
      xp: 'Cấp Độ Chat (Tất cả)',
      coins: 'Tài Sản Coins',
      voice: 'Thời Gian Voice (Tất cả)',
      chat_weekly: 'Top Chat Tuần',
      chat_monthly: 'Top Chat Tháng',
      voice_weekly: 'Top Voice Tuần',
      voice_monthly: 'Top Voice Tháng',
    };
    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 42px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(typeLabels[type] ?? 'Leaderboard', 40, 110);

    // Draw Podium (Top 3)
    const top3 = members.slice(0, 3);
    const podiumCenter = 400;
    
    // Balanced horizontal placement: no overlaps, Rank 1 elevated
    const podiumOrder = [
      { rankVal: 2, item: top3[1], x: 130, y: 200, w: 160, h: 210, avatarColor: '#C9CDD2', badgeColor: '#9EA3A9' },
      { rankVal: 1, item: top3[0], x: 310, y: 170, w: 180, h: 240, avatarColor: '#F6C453', badgeColor: '#F6C453' },
      { rankVal: 3, item: top3[2], x: 510, y: 200, w: 160, h: 210, avatarColor: '#D7A15C', badgeColor: '#CD7F32' },
    ];

    for (const p of podiumOrder) {
      if (!p.item) continue;

      // Draw Podium Card
      CanvasRenderer.drawRoundedRect(
        ctx,
        p.x,
        p.y,
        p.w,
        p.h,
        Theme.borderRadius.medium,
        Theme.colors.card,
        p.rankVal === 1 ? Theme.colors.accentGold : 'rgba(255,255,255,0.06)',
        p.rankVal === 1 ? 1.5 : 1
      );

      const avatarX = p.x + p.w / 2;
      const avatarY = p.y + (p.rankVal === 1 ? 70 : 65);

      // Draw Crown above Rank 1
      if (p.rankVal === 1) {
        ctx.fillStyle = Theme.colors.accentGold;
        ctx.beginPath();
        const cx = avatarX;
        const cy = p.y - 10;
        ctx.moveTo(cx - 20, cy + 12);
        ctx.lineTo(cx - 25, cy - 8);  // left peak
        ctx.lineTo(cx - 10, cy + 2);  // left valley
        ctx.lineTo(cx, cy - 18);      // center peak
        ctx.lineTo(cx + 10, cy + 2);  // right valley
        ctx.lineTo(cx + 25, cy - 8);  // right peak
        ctx.lineTo(cx + 20, cy + 12); // bottom right
        ctx.closePath();
        ctx.fill();

        // Tips circles
        ctx.fillStyle = '#FFE185';
        ctx.beginPath();
        ctx.arc(cx - 25, cy - 8, 3, 0, Math.PI * 2);
        ctx.moveTo(cx, cy - 18);
        ctx.arc(cx, cy - 18, 3, 0, Math.PI * 2);
        ctx.moveTo(cx + 25, cy - 8);
        ctx.arc(cx + 25, cy - 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Avatar
      await CanvasRenderer.drawCircularAvatar(ctx, p.item.avatarUrl, avatarX, avatarY, 40, p.avatarColor, 2);

      // Draw Circular Rank Badge overlapping avatar bottom center
      const badgeRadius = 12;
      const badgeY = avatarY + 34;
      ctx.beginPath();
      ctx.arc(avatarX, badgeY, badgeRadius, 0, Math.PI * 2);
      ctx.fillStyle = p.badgeColor;
      ctx.fill();

      ctx.fillStyle = '#0F1012';
      ctx.font = 'bold 12px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.rankVal.toString(), avatarX, badgeY + 4);

      // Username text
      ctx.fillStyle = Theme.colors.textPrimary;
      ctx.font = 'bold 14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      const displayUser = p.item.username.length > 15 ? p.item.username.slice(0, 12) + '...' : p.item.username;
      ctx.fillText(`@${displayUser}`, avatarX, p.y + p.h - 50);

      // Score Value text
      const scoreText = p.item.level !== undefined ? `LV.${p.item.level}` :
                        type.startsWith('voice') ? `${p.item.value.toLocaleString()} phút` :
                        type.startsWith('chat') ? `${p.item.value.toLocaleString()} tin` :
                        CanvasRenderer.formatNumber(p.item.value);
      ctx.fillStyle = Theme.colors.accentGold;
      ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
      ctx.fillText(scoreText, avatarX, p.y + p.h - 25);
      
      ctx.textAlign = 'left'; // Reset alignment
    }

    // Draw remaining members (Ranks 4-10)
    let listY = headerHeight;
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const rankNum = i + 4;
      const itemX = 40;
      const itemW = width - 80;
      const itemH = 60;

      // Row card background
      CanvasRenderer.drawRoundedRect(ctx, itemX, listY, itemW, itemH, Theme.borderRadius.small, Theme.colors.card);

      // Rank number
      ctx.fillStyle = Theme.colors.textMuted;
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(rankNum.toString(), itemX + 35, listY + 36);

      // Avatar
      await CanvasRenderer.drawCircularAvatar(ctx, item.avatarUrl, itemX + 105, listY + 30, 18, 'rgba(255,255,255,0.06)', 1.5);

      // Username
      ctx.fillStyle = Theme.colors.textPrimary;
      ctx.font = 'bold 15px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`@${item.username}`, itemX + 145, listY + 36);

      // Score
      ctx.fillStyle = Theme.colors.accentGold;
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'right';
      const rowScoreText = item.level !== undefined ? `LV.${item.level}` :
                           type.startsWith('voice') ? `${item.value.toLocaleString()} phút` :
                           type.startsWith('chat') ? `${item.value.toLocaleString()} tin` :
                           CanvasRenderer.formatNumber(item.value);
      ctx.fillText(rowScoreText, itemX + itemW - 30, listY + 36);
      ctx.textAlign = 'left'; // Reset

      listY += rowHeight;
    }

    // Draw Caller's Rank Card
    if (callerRank) {
      ctx.fillStyle = Theme.colors.accentGold;
      ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      ctx.fillText('XẾP HẠNG CỦA BẠN', 40, listY + 30);

      const callerY = listY + 50;
      const itemX = 40;
      const itemW = width - 80;
      const itemH = 60;

      // User card with highlight gold border
      CanvasRenderer.drawRoundedRect(
        ctx,
        itemX,
        callerY,
        itemW,
        itemH,
        Theme.borderRadius.small,
        'rgba(246, 196, 83, 0.04)',
        Theme.colors.accentGold,
        1.5
      );

      ctx.fillStyle = Theme.colors.accentGold;
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(callerRank.rank.toString(), itemX + 35, callerY + 36);

      // Avatar
      await CanvasRenderer.drawCircularAvatar(ctx, callerRank.avatarUrl, itemX + 105, callerY + 30, 18, Theme.colors.accentGold, 1.5);

      // Username
      ctx.fillStyle = Theme.colors.textPrimary;
      ctx.font = 'bold 15px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`@${callerRank.username}`, itemX + 145, callerY + 36);

      // Score
      ctx.fillStyle = Theme.colors.accentGold;
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'right';
      const callerScoreText = callerRank.level !== undefined ? `LV.${callerRank.level}` :
                              type.startsWith('voice') ? `${callerRank.value.toLocaleString()} phút` :
                              type.startsWith('chat') ? `${callerRank.value.toLocaleString()} tin` :
                              CanvasRenderer.formatNumber(callerRank.value);
      ctx.fillText(callerScoreText, itemX + itemW - 30, callerY + 36);
      ctx.textAlign = 'left';

      listY += callerSectionHeight;
    }

    // Draw Footer
    const footerY = height - 30;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, footerY - 15);
    ctx.lineTo(width - 40, footerY - 15);
    ctx.stroke();

    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = '13px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' (GMT +7)';
    ctx.fillText(`Cập nhật: ${nowStr}`, 40, footerY + 5);

    ctx.textAlign = 'right';
    ctx.fillText(`${guildName} • ${getBotName().toUpperCase()}`, width - 40, footerY + 5);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
  }

  /**
   * 6. Draw Profile/Stats Card
   */
  public static async drawProfileCard(
    username: string,
    avatarUrl: string,
    nickname: string | null,
    joinedDiscord: Date,
    joinedServer: Date,
    stats: {
      totalMsg: number;
      msg1d: number;
      msg7d: number;
      msg30d: number;
      totalVoiceMin: number;
      voice1d: number;
      voice7d: number;
      voice30d: number;
      chatRank: number;
      voiceRank: number;
      topChatChannel: string;
      topChatCount: number;
      topVoiceChannel: string;
      topVoiceMin: number;
    },
    guildName: string
  ): Promise<Buffer> {
    const width = 1000;
    const height = 750;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Profile header
    await CanvasRenderer.drawCircularAvatar(ctx, avatarUrl, 80, 80, 40, Theme.colors.accentGold, 2);

    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 28px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(nickname || username, 140, 72);

    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = '15px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`@${username}`, 140, 96);

    // Joined Dates
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = 'bold 16px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('THỜI GIAN GIA NHẬP', 560, 52);

    ctx.font = '14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillStyle = Theme.colors.textSecondary;
    const discDate = joinedDiscord.toLocaleDateString('vi-VN');
    const servDate = joinedServer.toLocaleDateString('vi-VN');
    ctx.fillText(`Discord: ${discDate}`, 560, 80);
    ctx.fillText(`Server:  ${servDate}`, 560, 105);

    // Middle Stats Cards
    const cardY = 150;
    const cardW = 440;
    const cardH = 260;

    // Messages Stats Card (Left)
    CanvasRenderer.drawRoundedRect(ctx, 40, cardY, cardW, cardH, Theme.borderRadius.medium, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('HOẠT ĐỘNG CHAT', 60, cardY + 35);

    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 36px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`${CanvasRenderer.formatNumber(stats.totalMsg)} Tin nhắn`, 60, cardY + 95);

    ctx.font = '15px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.fillText('1 Ngày', 60, cardY + 145);
    ctx.fillText('7 Ngày', 60, cardY + 180);
    ctx.fillText('30 Ngày', 60, cardY + 215);

    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.textAlign = 'right';
    ctx.fillText(`${stats.msg1d} tin`, 400, cardY + 145);
    ctx.fillText(`${stats.msg7d} tin`, 400, cardY + 180);
    ctx.fillText(`${stats.msg30d} tin`, 400, cardY + 215);
    ctx.textAlign = 'left';

    // Voice Stats Card (Right)
    CanvasRenderer.drawRoundedRect(ctx, 520, cardY, cardW, cardH, Theme.borderRadius.medium, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('HOẠT ĐỘNG VOICE', 540, cardY + 35);

    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 36px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const hrs = (stats.totalVoiceMin / 60).toFixed(1).replace(/\.0$/, '');
    ctx.fillText(`${hrs} Giờ thoại`, 540, cardY + 95);

    ctx.font = '15px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.fillText('1 Ngày', 540, cardY + 145);
    ctx.fillText('7 Ngày', 540, cardY + 180);
    ctx.fillText('30 Ngày', 540, cardY + 215);

    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.textAlign = 'right';
    ctx.fillText(`${(stats.voice1d / 60).toFixed(1)} giờ`, 880, cardY + 145);
    ctx.fillText(`${(stats.voice7d / 60).toFixed(1)} giờ`, 880, cardY + 180);
    ctx.fillText(`${(stats.voice30d / 60).toFixed(1)} giờ`, 880, cardY + 215);
    ctx.textAlign = 'left';

    // Bottom Stats Section
    const botY = 440;

    // Ranks Section
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('XẾP HẠNG SERVER', 40, botY + 25);

    const miniW = 210;
    const miniH = 120;

    // Chat Rank Box
    CanvasRenderer.drawRoundedRect(ctx, 40, botY + 45, miniW, miniH, Theme.borderRadius.small, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = '14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('Hạng Chat', 60, botY + 75);
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 28px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`#${stats.chatRank}`, 60, botY + 115);

    // Voice Rank Box
    CanvasRenderer.drawRoundedRect(ctx, 270, botY + 45, miniW, miniH, Theme.borderRadius.small, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = '14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('Hạng Voice', 290, botY + 75);
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 28px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`#${stats.voiceRank}`, 290, botY + 115);

    // Top Channels Section
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('TOP KÊNH TƯƠNG TÁC', 520, botY + 25);

    const rowW = 440;
    const rowH = 55;

    // Top Chat channel
    CanvasRenderer.drawRoundedRect(ctx, 520, botY + 45, rowW, rowH, 10, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = '14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('Chat', 540, botY + 77);
    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 16px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`# ${stats.topChatChannel}`, 600, botY + 77);
    ctx.textAlign = 'right';
    ctx.fillText(`${stats.topChatCount} tin`, 940, botY + 77);
    ctx.textAlign = 'left';

    // Top Voice channel
    CanvasRenderer.drawRoundedRect(ctx, 520, botY + 110, rowW, rowH, 10, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = '14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('Voice', 540, botY + 142);
    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 16px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const displayVoiceCh = stats.topVoiceChannel.length > 20 ? stats.topVoiceChannel.slice(0, 17) + '...' : stats.topVoiceChannel;
    ctx.fillText(displayVoiceCh, 600, botY + 142);
    ctx.textAlign = 'right';
    ctx.fillText(`${(stats.topVoiceMin / 60).toFixed(1)} giờ`, 940, botY + 142);
    ctx.textAlign = 'left';

    // Footer
    const footerY = height - 50;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, footerY - 20);
    ctx.lineTo(width - 40, footerY - 20);
    ctx.stroke();

    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = '14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' (GMT +7)';
    ctx.fillText(`🕒 ${nowStr}`, 40, footerY);

    ctx.textAlign = 'right';
    ctx.fillText(`${guildName} • ${getBotName().toUpperCase()}`, width - 40, footerY);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
  }

  /**
   * 7. Draw Economy Card
   */
  public static async drawEconomyCard(
    username: string,
    avatarUrl: string,
    wallet: number,
    bank: number,
    gems: number,
    dailyStreak: number
  ): Promise<Buffer> {
    const width = 650;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Accent strip
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 14, height, 7, Theme.colors.accentGold);

    // Avatar
    await CanvasRenderer.drawCircularAvatar(ctx, avatarUrl, 85, 80, 45, Theme.colors.accentGold, 2);

    // Username
    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 24px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(username, 155, 70);

    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = '14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`Điểm danh hằng ngày: ${dailyStreak} ngày liên tục`, 155, 100);

    // Balance Boxes
    const boxY = 140;
    const boxW = 270;
    const boxH = 120;

    // Wallet Balance
    CanvasRenderer.drawRoundedRect(ctx, 40, boxY, boxW, boxH, Theme.borderRadius.medium, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 15px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('Tiền mặt (Wallet)', 60, boxY + 35);
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 26px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`${wallet.toLocaleString()}`, 60, boxY + 85);

    // Bank Balance
    CanvasRenderer.drawRoundedRect(ctx, 340, boxY, boxW, boxH, Theme.borderRadius.medium, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 15px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('Ngân hàng (Bank)', 360, boxY + 35);
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 26px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`${bank.toLocaleString()}`, 360, boxY + 85);

    // Gems (top right)
    ctx.fillStyle = Theme.colors.info;
    ctx.font = 'bold 20px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${gems.toLocaleString()} Gems`, width - 40, 70);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
  }

  /**
   * 7b. Draw Economy Action Card
   */
  public static async drawEconomyActionCard(
    title: string,
    username: string,
    avatarUrl: string,
    type: 'SUCCESS' | 'ERROR' | 'INFO',
    message: string,
    details?: string
  ): Promise<Buffer> {
    const width = 600;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Accent left strip
    let accentColor = Theme.colors.accentGold;
    if (type === 'SUCCESS') accentColor = Theme.colors.success;
    if (type === 'ERROR') accentColor = Theme.colors.danger;
    if (type === 'INFO') accentColor = Theme.colors.info;
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 14, height, 7, accentColor);

    // Title Header
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = 'bold 14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(title.toUpperCase(), 40, 45);

    // Avatar
    await CanvasRenderer.drawCircularAvatar(ctx, avatarUrl, 75, 115, 35, accentColor, 2);

    // Message Text
    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 17px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    
    const textX = 135;
    const textY = 95;
    const maxTextWidth = width - textX - 40;
    
    const words = message.split(' ');
    let line = '';
    let currentY = textY;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextWidth && n > 0) {
        ctx.fillText(line, textX, currentY);
        line = words[n] + ' ';
        currentY += 24;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, textX, currentY);

    // Details/Subtext
    if (details) {
      ctx.fillStyle = Theme.colors.textSecondary;
      ctx.font = 'normal 13px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      ctx.fillText(details, textX, currentY + 28);
    }

    return canvas.toBuffer('image/png');
  }

  /**
   * 8. Draw Shop List Card
   */
  public static async drawShopListCard(
    guildName: string,
    items: Array<{ name: string; price: number; type: string; stock: number | null; description: string | null; currency?: string; emoji?: string | null }>
  ): Promise<Buffer> {
    const width = 800;
    const height = Math.max(300, 160 + items.length * 85);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Accent left strip
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 16, height, 8, Theme.colors.accentGold);

    // Header Title
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('CỬA HÀNG SERVER', 40, 50);

    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 36px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(guildName, 40, 95);

    // Draw List of Items
    let listY = 140;
    const TYPE_EMOJI: Record<string, string> = {
      ROLE: '🎭',
      CUSTOM: '🎁',
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemX = 40;
      const itemW = width - 80;
      const itemH = 70;

      // Draw Row card
      CanvasRenderer.drawRoundedRect(ctx, itemX, listY, itemW, itemH, Theme.borderRadius.small, Theme.colors.card);

      // Accent border based on type
      const accentColor = item.type === 'ROLE' ? Theme.colors.accentGold : Theme.colors.info;
      CanvasRenderer.drawRoundedRect(ctx, itemX, listY, 6, itemH, 3, accentColor);

      // Icon & Name
      const emoji = item.emoji || (item.type === 'ROLE' ? '🎭' : '🎁');
      ctx.fillStyle = Theme.colors.textPrimary;
      ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      ctx.fillText(`#${i + 1}  ${emoji}  ${item.name}`, itemX + 25, listY + 30);

      // Description
      ctx.fillStyle = Theme.colors.textMuted;
      ctx.font = 'normal 13px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      const desc = item.description || 'Không có mô tả sản phẩm.';
      const truncatedDesc = desc.length > 50 ? desc.slice(0, 47) + '...' : desc;
      ctx.fillText(truncatedDesc, itemX + 25, listY + 52);

      // Price Info (Right aligned)
      ctx.fillStyle = Theme.colors.accentGold;
      ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      ctx.textAlign = 'right';
      const currencyStr = item.currency === 'VND' ? 'VNĐ' : 'coins';
      ctx.fillText(`${item.price.toLocaleString()} ${currencyStr}`, itemX + itemW - 25, listY + 30);

      // Stock Info (Right aligned)
      ctx.fillStyle = Theme.colors.textSecondary;
      ctx.font = '500 13px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      const stockText = item.stock !== null ? `Còn lại: ${item.stock}` : 'Vô hạn';
      ctx.fillText(stockText, itemX + itemW - 25, listY + 52);
      ctx.textAlign = 'left'; // Reset alignment

      listY += 85;
    }

    // Draw Footer
    const footerY = height - 30;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, footerY - 15);
    ctx.lineTo(width - 40, footerY - 15);
    ctx.stroke();

    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = '12px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' (GMT +7)';
    ctx.fillText(`Cập nhật: ${nowStr}`, 40, footerY + 5);

    ctx.textAlign = 'right';
    ctx.fillText(`${guildName} • ${getBotName().toUpperCase()}`, width - 40, footerY + 5);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
  }

  /**
   * 9. Draw Shop Buy Success Card
   */
  public static async drawShopBuyCard(
    username: string,
    avatarUrl: string,
    itemName: string,
    price: number,
    remainingBalance: number,
    isRole: boolean,
    roleName?: string,
    currency?: string
  ): Promise<Buffer> {
    const width = 650;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Success Green left strip
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 14, height, 7, Theme.colors.success);

    // Avatar
    await CanvasRenderer.drawCircularAvatar(ctx, avatarUrl, 85, 80, 45, Theme.colors.success, 2);

    // Title
    ctx.fillStyle = Theme.colors.success;
    ctx.font = 'bold 22px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('MUA HÀNG THÀNH CÔNG!', 155, 60);

    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(username, 155, 95);

    // Info Boxes
    const boxY = 140;
    const boxW = 270;
    const boxH = 120;

    // Item Bought Info
    CanvasRenderer.drawRoundedRect(ctx, 40, boxY, boxW, boxH, Theme.borderRadius.medium, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('Sản phẩm', 60, boxY + 35);
    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const displayItemName = itemName.length > 20 ? itemName.slice(0, 17) + '...' : itemName;
    ctx.fillText(displayItemName, 60, boxY + 70);
    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = 'normal 12px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const currencyStr = currency === 'VND' ? 'VNĐ' : 'coins';
    ctx.fillText(`Giá: ${price.toLocaleString()} ${currencyStr}`, 60, boxY + 95);

    // Wallet Balance Info
    CanvasRenderer.drawRoundedRect(ctx, 340, boxY, boxW, boxH, Theme.borderRadius.medium, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(currency === 'VND' ? 'Số dư VNĐ' : 'Còn lại (Wallet)', 360, boxY + 35);
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 22px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`${remainingBalance.toLocaleString()} ${currencyStr}`, 360, boxY + 70);

    // Reward Details (Top Right)
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'normal 13px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.textAlign = 'right';
    if (isRole && roleName) {
      ctx.fillText(`Đã trao role: ${roleName}`, width - 40, 60);
    } else {
      ctx.fillText('Liên hệ Admin nhận quà', width - 40, 60);
    }
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
  }

  /**
   * 10. Draw User Inventory Card
   */
  public static async drawInventoryCard(
    username: string,
    avatarUrl: string,
    purchases: Array<{ name: string; quantity: number; type: string; description: string | null }>
  ): Promise<Buffer> {
    const width = 800;
    const height = Math.max(300, 160 + purchases.length * 85);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Accent left strip
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 16, height, 8, Theme.colors.accentGold);

    // User Profile Header
    await CanvasRenderer.drawCircularAvatar(ctx, avatarUrl, 75, 75, 40, Theme.colors.accentGold, 2);

    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 26px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('KHO ĐỒ CỦA BẠN', 140, 65);

    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = '14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`@${username} • Có ${purchases.length} loại vật phẩm`, 140, 92);

    // Draw List of Purchased Items
    let listY = 140;
    const TYPE_EMOJI: Record<string, string> = {
      ROLE: '🎭',
      CUSTOM: '🎁',
    };

    if (purchases.length === 0) {
      ctx.fillStyle = Theme.colors.textMuted;
      ctx.font = 'italic 16px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      ctx.fillText('Kho đồ trống trơn. Dùng /shop buy để mua vật phẩm!', 40, 180);
    } else {
      for (let i = 0; i < purchases.length; i++) {
        const item = purchases[i];
        const itemX = 40;
        const itemW = width - 80;
        const itemH = 70;

        // Draw Row card
        CanvasRenderer.drawRoundedRect(ctx, itemX, listY, itemW, itemH, Theme.borderRadius.small, Theme.colors.card);

        // Accent border based on type
        const accentColor = item.type === 'ROLE' ? Theme.colors.accentGold : Theme.colors.info;
        CanvasRenderer.drawRoundedRect(ctx, itemX, listY, 6, itemH, 3, accentColor);

        // Icon & Name
        ctx.fillStyle = Theme.colors.textPrimary;
        ctx.font = 'bold 18px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
        ctx.fillText(`${item.name}`, itemX + 25, listY + 30);

        // Description
        ctx.fillStyle = Theme.colors.textMuted;
        ctx.font = 'normal 13px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
        const desc = item.description || 'Không có mô tả.';
        const truncatedDesc = desc.length > 50 ? desc.slice(0, 47) + '...' : desc;
        ctx.fillText(truncatedDesc, itemX + 25, listY + 52);

        // Quantity Info (Right aligned)
        ctx.fillStyle = Theme.colors.accentGold;
        ctx.font = 'bold 20px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${item.quantity}`, itemX + itemW - 25, listY + 42);
        ctx.textAlign = 'left'; // Reset

        listY += 85;
      }
    }

    // Draw Footer
    const footerY = height - 30;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, footerY - 15);
    ctx.lineTo(width - 40, footerY - 15);
    ctx.stroke();

    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = '12px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' (GMT +7)';
    ctx.fillText(`Cập nhật: ${nowStr}`, 40, footerY + 5);

    ctx.textAlign = 'right';
    ctx.fillText(`Kho Đồ Cá Nhân`, width - 40, footerY + 5);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
  }

  /**
   * 11. Draw Shop Item Detail Card
   */
  public static async drawShopDetailCard(
    itemName: string,
    price: number,
    stockText: string,
    rewardText: string,
    description: string | null,
    imageUrl: string | null,
    currency?: string
  ): Promise<Buffer> {
    const width = 700;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Accent Gold left strip
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 16, height, 8, Theme.colors.accentGold);

    // Title
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 24px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`${itemName}`, 40, 60);

    // Image layout parameters
    const hasImage = !!imageUrl;
    const maxTextWidth = hasImage ? 380 : 620;

    // Description text
    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'normal 15px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const descText = description || 'Không có mô tả cho sản phẩm này.';
    
    const descLines = this.wrapText(ctx, descText, maxTextWidth);
    let descY = 110;
    // Draw up to 4 lines of description to prevent overflow
    for (let i = 0; i < Math.min(descLines.length, 4); i++) {
      ctx.fillText(descLines[i], 40, descY);
      descY += 22;
    }

    // Details grid
    const infoY = 220;

    // Box 1: Price
    CanvasRenderer.drawRoundedRect(ctx, 40, infoY, 180, 65, Theme.borderRadius.small, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 12px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('GIÁ BÁN', 55, infoY + 23);
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 16px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    const currencyStr = currency === 'VND' ? 'VNĐ' : 'coins';
    ctx.fillText(`${price.toLocaleString()} ${currencyStr}`, 55, infoY + 48);

    // Box 2: Stock
    CanvasRenderer.drawRoundedRect(ctx, 230, infoY, 180, 65, Theme.borderRadius.small, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 12px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('KHO HÀNG', 245, infoY + 23);
    ctx.fillStyle = Theme.colors.textPrimary;
    ctx.font = 'bold 16px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(stockText, 245, infoY + 48);

    // Box 3: Reward (Below)
    CanvasRenderer.drawRoundedRect(ctx, 40, infoY + 80, 370, 60, Theme.borderRadius.small, Theme.colors.card);
    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 11px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText('PHẦN THƯỞNG KHI MUA', 55, infoY + 103);
    ctx.fillStyle = Theme.colors.info;
    ctx.font = 'bold 14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    // Truncate reward text if needed
    const displayReward = rewardText.length > 45 ? rewardText.slice(0, 42) + '...' : rewardText;
    ctx.fillText(displayReward, 55, infoY + 128);

    // Draw Image if exists
    if (hasImage) {
      try {
        ctx.save();
        // Create clipping region for rounded image corners
        ctx.beginPath();
        const imgX = 450;
        const imgY = 110;
        const imgW = 210;
        const imgH = 230;
        const radius = Theme.borderRadius.medium;
        
        ctx.moveTo(imgX + radius, imgY);
        ctx.lineTo(imgX + imgW - radius, imgY);
        ctx.quadraticCurveTo(imgX + imgW, imgY, imgX + imgW, imgY + radius);
        ctx.lineTo(imgX + imgW, imgY + imgH - radius);
        ctx.quadraticCurveTo(imgX + imgW, imgY + imgH, imgX + imgW - radius, imgY + imgH);
        ctx.lineTo(imgX + radius, imgY + imgH);
        ctx.quadraticCurveTo(imgX, imgY + imgH, imgX, imgY + imgH - radius);
        ctx.lineTo(imgX, imgY + radius);
        ctx.quadraticCurveTo(imgX, imgY, imgX + radius, imgY);
        ctx.closePath();
        ctx.clip();

        const img = await loadImage(imageUrl!);
        ctx.drawImage(img, imgX, imgY, imgW, imgH);
        ctx.restore();

        // Draw dynamic outline
        CanvasRenderer.drawRoundedRect(ctx, imgX, imgY, imgW, imgH, radius, undefined, 'rgba(255, 255, 255, 0.08)', 1.5);
      } catch (err) {
        console.error('Failed to load shop item image:', err);
      }
    }

    return canvas.toBuffer('image/png');
  }

  /**
   * 12. Draw Generic Embed Card (Translates standard embeds to Canvas Cards)
   */
  public static async drawGenericEmbedCard(
    title: string,
    description: string,
    fields: Array<{ name: string; value: string; inline?: boolean }>,
    thumbnailUrl?: string,
    colorHex?: string,
    footer?: string,
    author?: string,
    userAvatarUrl?: string,
    username?: string,
    guildName?: string
  ): Promise<Buffer> {
    const width = 600;

    // 1. Setup temporary canvas for text measurement
    const tempCanvas = createCanvas(width, 100);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = 'normal 14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';

    // 2. Wrap Description Text
    const hasThumbnail = !!thumbnailUrl;
    const descWidth = hasThumbnail ? 380 : 520;
    const descLines = description ? this.wrapText(tempCtx, description, descWidth) : [];
    const descHeight = descLines.length * 20;

    // 3. Compute dynamic height
    let contentY = 40;
    
    let titleHeight = 0;
    if (author) titleHeight += 25;
    if (title) titleHeight += 35;
    if (author || title) {
      contentY += titleHeight + 15;
    }

    let descY = contentY;
    if (description) {
      contentY += descHeight + 20;
    }

    const fieldPositions: Array<{ name: string; value: string; x: number; y: number; w: number; h: number }> = [];
    if (fields.length > 0) {
      let fieldY = contentY;
      
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        
        tempCtx.font = 'normal 13px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
        const valLines = this.wrapText(tempCtx, field.value, 500);
        const valHeight = valLines.length * 18;
        const boxH = Math.max(55, 30 + valHeight);

        fieldPositions.push({
          name: field.name,
          value: field.value,
          x: 40,
          y: fieldY,
          w: 520,
          h: boxH
        });
        
        fieldY += boxH + 10;
      }
      contentY = fieldY + 10;
    }

    let footerY = 0;
    if (footer || userAvatarUrl) {
      footerY = contentY + 20;
      contentY += 45;
    }

    const height = Math.max(160, contentY + 30);

    // Create target canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw Background
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, Theme.colors.background);

    // Left Border Highlight
    const borderCol = colorHex ?? Theme.colors.accentGold;
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 14, height, 7, borderCol);

    // Draw Author Name
    let currentDrawY = 40;
    if (author) {
      ctx.fillStyle = Theme.colors.textMuted;
      ctx.font = 'bold 12px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      ctx.fillText(author.toUpperCase(), 40, currentDrawY + 12);
      currentDrawY += 25;
    }

    // Draw Title
    if (title) {
      ctx.fillStyle = Theme.colors.textPrimary;
      ctx.font = 'bold 22px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      ctx.fillText(title, 40, currentDrawY + 18);
      currentDrawY += 35;
    }
    
    if (author || title) currentDrawY += 15;

    // Draw Thumbnail
    if (hasThumbnail) {
      try {
        const thumbX = width - 120;
        const thumbY = 40;
        const thumbSize = 80;
        
        ctx.save();
        ctx.beginPath();
        const radius = Theme.borderRadius.small;
        ctx.moveTo(thumbX + radius, thumbY);
        ctx.lineTo(thumbX + thumbSize - radius, thumbY);
        ctx.quadraticCurveTo(thumbX + thumbSize, thumbY, thumbX + thumbSize, thumbY + radius);
        ctx.lineTo(thumbX + thumbSize, thumbY + thumbSize - radius);
        ctx.quadraticCurveTo(thumbX + thumbSize, thumbY + thumbSize, thumbX + thumbSize - radius, thumbY + thumbSize);
        ctx.lineTo(thumbX + radius, thumbY + thumbSize);
        ctx.quadraticCurveTo(thumbX, thumbY + thumbSize, thumbX, thumbY + thumbSize - radius);
        ctx.lineTo(thumbX, thumbY + radius);
        ctx.quadraticCurveTo(thumbX, thumbY, thumbX + radius, thumbY);
        ctx.closePath();
        ctx.clip();
        
        const img = await loadImage(thumbnailUrl!);
        ctx.drawImage(img, thumbX, thumbY, thumbSize, thumbSize);
        ctx.restore();
        
        CanvasRenderer.drawRoundedRect(ctx, thumbX, thumbY, thumbSize, thumbSize, radius, undefined, 'rgba(255, 255, 255, 0.08)', 1);
      } catch (err) {
        console.error('Failed to load thumbnail image:', err);
      }
    }

    // Draw Description
    if (description) {
      ctx.fillStyle = Theme.colors.textSecondary;
      ctx.font = 'normal 14px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      
      let lineY = descY + 14;
      for (const line of descLines) {
        ctx.fillText(line, 40, lineY);
        lineY += 20;
      }
    }

    // Draw Fields
    for (const f of fieldPositions) {
      CanvasRenderer.drawRoundedRect(ctx, f.x, f.y, f.w, f.h, Theme.borderRadius.small, Theme.colors.card);
      CanvasRenderer.drawRoundedRect(ctx, f.x, f.y, f.w, f.h, Theme.borderRadius.small, undefined, 'rgba(255, 255, 255, 0.05)', 1);
      CanvasRenderer.drawRoundedRect(ctx, f.x, f.y, 5, f.h, 2.5, borderCol);

      ctx.fillStyle = Theme.colors.textMuted;
      ctx.font = 'bold 12px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      ctx.fillText(f.name, f.x + 18, f.y + 20);

      ctx.fillStyle = Theme.colors.textPrimary;
      ctx.font = 'normal 13px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      const fValLines = this.wrapText(ctx, f.value, f.w - 36);
      
      let valY = f.y + 36;
      for (const valLine of fValLines) {
        ctx.fillText(valLine, f.x + 18, valY);
        valY += 18;
      }
    }

    // Draw Footer
    if (footer || userAvatarUrl) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, footerY - 5);
      ctx.lineTo(width - 40, footerY - 5);
      ctx.stroke();

      let footerX = 40;
      if (userAvatarUrl) {
        await CanvasRenderer.drawCircularAvatar(ctx, userAvatarUrl, 50, footerY + 12, 10, 'rgba(255,255,255,0.06)', 1);
        footerX = 70;
      }

      ctx.fillStyle = Theme.colors.textMuted;
      ctx.font = '12px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
      
      const footerText = footer ?? (username ? `Yêu cầu bởi @${username}` : `${guildName ?? 'Server'} • ${getBotName().toUpperCase()}`);
      ctx.fillText(footerText, footerX, footerY + 16);
    }

    return canvas.toBuffer('image/png');
  }

  /**
   * 13. Draw VND Balance Card (Bank-themed card for real money balance)
   */
  public static async drawVndCard(
    avatarUrl: string,
    username: string,
    balance: number,
    guildName: string
  ): Promise<Buffer> {
    const width = 600;
    const height = 250;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Draw luxury dark green gradient background
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0a1d15');
    grad.addColorStop(0.5, '#122c20');
    grad.addColorStop(1, '#0e2319');
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, grad);

    // 2. Draw subtle premium abstract lines pattern
    ctx.strokeStyle = 'rgba(246, 196, 83, 0.04)';
    ctx.lineWidth = 2;
    for (let i = -100; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 150, height);
      ctx.stroke();
    }

    // 3. Draw a gold-accented gradient curve on the right
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(width - 150, 0);
    ctx.bezierCurveTo(width - 50, 80, width - 80, 180, width, height);
    ctx.lineTo(width, 0);
    ctx.closePath();
    ctx.clip();
    const goldGrad = ctx.createLinearGradient(width - 100, 0, width, height);
    goldGrad.addColorStop(0, 'rgba(246, 196, 83, 0.15)');
    goldGrad.addColorStop(1, 'rgba(246, 196, 83, 0.02)');
    ctx.fillStyle = goldGrad;
    ctx.fillRect(width - 150, 0, 150, height);
    ctx.restore();

    // 4. Draw card borders
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, undefined, 'rgba(246, 196, 83, 0.12)', 1.5);
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 12, height, 6, Theme.colors.accentGold);

    // 5. Draw chip-like icon / header
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 12px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(`${getBotName().toUpperCase()} VIP PLATINUM`, 40, 45);

    // Draw card brand logo
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Outfit", sans-serif';
    ctx.fillText('VND CARD', width - 140, 45);

    // 6. Draw User Avatar and Info
    const avatarX = 40;
    const avatarY = 85;
    const avatarSize = 90;
    try {
      await CanvasRenderer.drawCircularAvatar(ctx, avatarUrl, avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'rgba(246, 196, 83, 0.3)', 3);
    } catch (err) {
      console.error('Failed to load avatar in drawVndCard:', err);
    }

    // 7. Draw Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", Arial, sans-serif';
    ctx.fillText(username, avatarX + avatarSize + 20, avatarY + 30);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'normal 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('CHỦ SỞ HỮU THẺ', avatarX + avatarSize + 20, avatarY + 50);

    // 8. Draw VND Balance
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'normal 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('SỐ DƯ KHẢ DỤNG', avatarX + avatarSize + 20, avatarY + 80);

    const formattedVnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(balance);
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 30px "Outfit", "Segoe UI", sans-serif';
    ctx.fillText(formattedVnd, avatarX + avatarSize + 20, avatarY + 115);

    // 9. Draw Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillText(guildName.toUpperCase() + ` • ${getBotName().toUpperCase()} ENTERPRISE`, 40, height - 25);

    return canvas.toBuffer('image/png');
  }

  /**
   * 14. Draw Deposit Invoice Card with Embedded QR Code
   */
  public static async drawDepositCard(
    avatarUrl: string,
    username: string,
    code: string,
    amount: number,
    qrBuffer: Buffer
  ): Promise<Buffer> {
    const width = 800;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Draw premium dark banking theme background
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0a1523');
    grad.addColorStop(0.5, '#0e2035');
    grad.addColorStop(1, '#081220');
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, grad);

    // Subtle diagonal geometric patterns
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width + height; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - height, height);
      ctx.stroke();
    }

    // 2. Draw card borders and highlight
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, width, height, Theme.borderRadius.large, undefined, 'rgba(246, 196, 83, 0.12)', 1.5);
    CanvasRenderer.drawRoundedRect(ctx, 0, 0, 15, height, 6, Theme.colors.accentGold);

    // 3. Bill / Invoice Header
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`HÓA ĐƠN NẠP TIỀN TỰ ĐỘNG (${getBotName().toUpperCase()} BANKING)`, 45, 45);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'normal 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Hệ thống xử lý tự động qua SePay Webhooks', 45, 65);

    // Draw user avatar and info in header
    try {
      await CanvasRenderer.drawCircularAvatar(ctx, avatarUrl, width - 80, 45, 20, 'rgba(255,255,255,0.2)', 1.5);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`@${username}`, width - 110, 50);
    } catch {}

    ctx.textAlign = 'left'; // reset text alignment

    // 4. Left Panel: Invoice Details Box
    const detailX = 45;
    const detailY = 95;
    const detailW = 440;
    const detailH = 310;
    const detailBg = ctx.createLinearGradient(detailX, detailY, detailX, detailY + detailH);
    detailBg.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
    detailBg.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
    CanvasRenderer.drawRoundedRect(ctx, detailX, detailY, detailW, detailH, 12, detailBg, 'rgba(255, 255, 255, 0.05)', 1);

    // Detail lines
    const startTextX = detailX + 25;
    let textY = detailY + 40;

    // Amount Line
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'normal 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('SỐ TIỀN CẦN CHUYỂN', startTextX, textY);
    
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 26px "Outfit", "Segoe UI", sans-serif';
    const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    ctx.fillText(formattedAmount, startTextX, textY + 30);
    
    textY += 65;

    // Transfer Memo (CRITICAL!)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'normal 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('NỘI DUNG CHUYỂN KHOẢN (BẮT BUỘC CHÍNH XÁC)', startTextX, textY);

    // Draw high contrast box for memo code
    const codeBoxY = textY + 10;
    const codeBoxW = 200;
    const codeBoxH = 45;
    CanvasRenderer.drawRoundedRect(ctx, startTextX, codeBoxY, codeBoxW, codeBoxH, 8, 'rgba(246, 196, 83, 0.08)', 'rgba(246, 196, 83, 0.3)', 1);
    
    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 20px "Outfit", "Segoe UI", sans-serif';
    ctx.fillText(code, startTextX + 18, codeBoxY + 30);

    textY += 80;

    // Bank account info
    const bankId = process.env.BANK_ID ?? 'VietinBank';
    const bankAccount = process.env.BANK_ACCOUNT ?? '1234567890';
    const accountName = process.env.BANK_ACCOUNT_NAME ?? 'ADMIN';

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'normal 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('THÔNG TIN NGÂN HÀNG THỤ HƯỞNG', startTextX, textY);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${bankId} - STK: ${bankAccount}`, startTextX, textY + 22);
    ctx.fillText(`TÊN: ${accountName.toUpperCase()}`, startTextX, textY + 42);

    textY += 75;

    // Note / warning
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = 'italic 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText('(*) Giao dịch được xử lý tự động sau 10-30s kể từ khi chuyển khoản.', startTextX, textY);

    // 5. Right Panel: QR Code Box
    const qrPanelX = 515;
    const qrPanelY = 95;
    const qrSize = 240;
    
    // Draw white background card for QR Code
    CanvasRenderer.drawRoundedRect(ctx, qrPanelX, qrPanelY, qrSize, qrSize + 30, 16, '#ffffff');

    // Draw the QR Code image buffer inside
    try {
      const qrImg = await loadImage(qrBuffer);
      ctx.drawImage(qrImg, qrPanelX + 15, qrPanelY + 15, qrSize - 30, qrSize - 30);
    } catch (err) {
      console.error('Failed to render QR Code image inside drawDepositCard:', err);
      // Fallback text if QR load fails
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Không thể load QR', qrPanelX + 60, qrPanelY + 120);
    }

    // Label under QR Code
    ctx.fillStyle = '#081220';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText('QUÉT MÃ QR ĐỂ CHUYỂN KHOẢN', qrPanelX + 35, qrPanelY + qrSize + 15);

    return canvas.toBuffer('image/png');
  }

  private static wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] {
    const paragraphs = text.split('\n');
    const lines: string[] = [];
    
    for (const paragraph of paragraphs) {
      const words = paragraph.split(' ');
      let currentLine = words[0];
      if (!currentLine) {
        lines.push('');
        continue;
      }
      
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
    }
    return lines;
  }
}
