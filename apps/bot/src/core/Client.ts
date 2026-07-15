import { Client, GatewayIntentBits, Partials, Collection, REST, Routes } from 'discord.js';
import { ICommand } from './interfaces/ICommand';
import { IEvent } from './interfaces/IEvent';
import { IModule } from './interfaces/IModule';
import { logger } from './logger/Logger';

export class BotClient extends Client {
  public readonly commands = new Collection<string, ICommand>();
  public readonly cooldowns = new Collection<string, Collection<string, number>>();
  public readonly modules = new Collection<string, IModule>();
  public readonly events = new Collection<string, IEvent[]>();
  /** Maps command name -> module name for dashboard grouping */
  public readonly commandModuleMap = new Collection<string, string>();
  public startTime = Date.now();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.AutoModerationConfiguration,
        GatewayIntentBits.AutoModerationExecution,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
      ],
    });
  }

  async deployCommands(): Promise<void> {
    const token = process.env.BOT_TOKEN!;
    const clientId = process.env.CLIENT_ID!;

    if (!clientId) {
      logger.warn('CLIENT_ID not set — skipping global command deployment');
      return;
    }

    const rest = new REST().setToken(token);
    const commandData = this.commands.map(cmd => cmd.data.toJSON());

    try {
      logger.info(`Deploying ${commandData.length} slash commands...`);
      
      if (process.env.NODE_ENV === 'development') {
        // Clear global commands to prevent duplicates in dev guild
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        logger.info('Cleared global commands (Dev mode)');

        // Deploy instantly to each guild the bot is in
        const guilds = Array.from(this.guilds.cache.values());
        for (const guild of guilds) {
          try {
            await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: commandData });
            logger.info(`✅ Deployed ${commandData.length} commands instantly to guild: ${guild.name} (${guild.id})`);
          } catch (err) {
            logger.warn(`Failed to deploy commands instantly to guild ${guild.name} (${guild.id}):`, err);
          }
        }
      } else {
        // Deploy globally for production
        await rest.put(Routes.applicationCommands(clientId), { body: commandData });
        logger.info(`✅ Deployed ${commandData.length} commands globally`);
        
        // Also clear guild-level commands so they don't override/duplicate in production
        const guilds = Array.from(this.guilds.cache.values());
        for (const guild of guilds) {
          try {
            await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: [] });
          } catch {}
        }
      }
    } catch (error) {
      logger.error('Failed to deploy commands', { error });
    }
  }

  get uptime(): number {
    return Date.now() - this.startTime;
  }

  get memoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }
}
