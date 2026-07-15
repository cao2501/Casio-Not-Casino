import { CardRenderer } from '../ui/CardRenderer';

export class CanvasService {
  public static formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'Tr';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'N';
    }
    return num.toString();
  }

  public static async drawRankCard(
    avatarUrl: string,
    username: string,
    level: number,
    rank: number,
    currentXp: number,
    nextXp: number
  ): Promise<Buffer> {
    return CardRenderer.drawRankCard(avatarUrl, username, level, rank, currentXp, nextXp);
  }

  public static async drawLevelUpCard(
    avatarUrl: string,
    oldLevel: number,
    newLevel: number
  ): Promise<Buffer> {
    return CardRenderer.drawLevelUpCard(avatarUrl, oldLevel, newLevel);
  }

  public static async drawLeaderboardCard(
    guildName: string,
    type: 'xp' | 'coins' | 'voice',
    members: Array<{ username: string; avatarUrl: string; value: number; level?: number }>,
    callerRank: { rank: number; username: string; avatarUrl: string; value: number; level?: number } | null,
    guildIconUrl?: string | null
  ): Promise<Buffer> {
    return CardRenderer.drawLeaderboardCard(guildName, type, members, callerRank);
  }

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
    return CardRenderer.drawProfileCard(
      username,
      avatarUrl,
      nickname,
      joinedDiscord,
      joinedServer,
      stats,
      guildName
    );
  }
}
