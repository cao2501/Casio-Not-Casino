import EventEmitter3 from 'eventemitter3';

// Typed events that modules can emit/listen to
export interface BotEvents {
  // Moderation events
  'moderation:warn': { guildId: string; userId: string; moderatorId: string; reason: string; points: number };
  'moderation:ban': { guildId: string; userId: string; moderatorId: string; reason: string };
  'moderation:kick': { guildId: string; userId: string; moderatorId: string; reason: string };
  'moderation:timeout': { guildId: string; userId: string; moderatorId: string; duration: number; reason: string };
  'moderation:unban': { guildId: string; userId: string; moderatorId: string };
  'moderation:automod': { guildId: string; userId: string; channelId: string; type: string; action: string };

  // Leveling events
  'leveling:xp_gain': { guildId: string; userId: string; xp: number; total: number };
  'leveling:level_up': { guildId: string; userId: string; oldLevel: number; newLevel: number };
  'leveling:prestige': { guildId: string; userId: string; prestige: number };

  // Economy events
  'economy:transaction': { guildId: string; userId: string; amount: number; type: string };

  // Ticket events
  'ticket:create': { guildId: string; ticketId: string; userId: string; channelId: string };
  'ticket:close': { guildId: string; ticketId: string; userId: string };
  'ticket:claim': { guildId: string; ticketId: string; moderatorId: string };

  // Giveaway events
  'giveaway:start': any;
  'giveaway:end': { guildId: string; giveawayId: string; winners: string[] };
  'giveaway:enter': { guildId: string; giveawayId: string; userId: string };

  // Mission events
  'mission:progress': { guildId: string; userId: string; missionId: string; progress: number };
  'mission:complete': { guildId: string; userId: string; missionId: string };

  // Achievement events
  'achievement:unlock': { userId: string; achievementId: string; guildId?: string };

  // Module events
  'module:loaded': { name: string };
  'module:unloaded': { name: string };
  'module:error': { name: string; error: Error };

  // Guild events
  'guild:setup': { guildId: string };

  // Custom events
  'poll:start': any;
  'ai:clear_history': { userId: string };
  'antinuke:lockdown': { guildId: string; reason: string; perpetratorId: string };
}

export class EventBus extends EventEmitter3<BotEvents> {
  private static instance: EventBus;

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emit<K extends keyof BotEvents>(event: K, data: BotEvents[K]): boolean {
    return super.emit(event, data);
  }

  on<K extends keyof BotEvents>(event: K, listener: (data: BotEvents[K]) => void): this {
    return super.on(event, listener);
  }

  once<K extends keyof BotEvents>(event: K, listener: (data: BotEvents[K]) => void): this {
    return super.once(event, listener);
  }

  off<K extends keyof BotEvents>(event: K, listener: (data: BotEvents[K]) => void): this {
    return super.off(event, listener);
  }
}

export const eventBus = EventBus.getInstance();
