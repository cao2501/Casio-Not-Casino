import { BotClient } from './Client';
import { ModuleLoader } from './loader/ModuleLoader';
import { EventBus, eventBus } from './eventbus/EventBus';
import { CacheManager, cache } from './cache/CacheManager';
import { Scheduler, scheduler } from './scheduler/Scheduler';
import { ServiceRegistry, registry } from './registry/ServiceRegistry';
import { logger } from './logger/Logger';
import { prisma } from '../database/PrismaClient';
import { AttachmentBuilder, PermissionFlagsBits, GuildMember, Collection } from 'discord.js';
import { getModuleConfig } from '../database/helpers';
import { UIBuilders } from './ui/UIBuilders';
import { GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import { DashboardServer } from './dashboard/DashboardServer';

export class Kernel {
  public readonly client: BotClient;
  public readonly eventBus: EventBus;
  public readonly cache: CacheManager;
  public readonly scheduler: Scheduler;
  public readonly registry: ServiceRegistry;
  public readonly loader: ModuleLoader;
  public readonly db: typeof prisma;
  public readonly ownerIds: string[];

  constructor() {
    this.client = new BotClient();
    this.eventBus = eventBus;
    this.cache = cache;
    this.scheduler = scheduler;
    this.registry = registry;
    this.loader = new ModuleLoader(this);
    this.db = prisma;
    this.ownerIds = (process.env.OWNER_IDS || '').split(',').filter(Boolean);
  }

  async boot(): Promise<void> {
    logger.info('═══════════════════════════════════════════');
    logger.info('   🤖 Enterprise Discord Bot — Starting    ');
    logger.info('═══════════════════════════════════════════');

    // Register custom fonts (Roboto font registered as 'Segoe UI' to fix spacing on Linux)
    const fontsPath = path.join(__dirname, '..', '..', 'fonts');
    const robotoRegular = path.join(fontsPath, 'Roboto-Regular.ttf');
    const robotoBold = path.join(fontsPath, 'Roboto-Bold.ttf');
    if (fs.existsSync(robotoRegular)) {
      GlobalFonts.registerFromPath(robotoRegular, 'Segoe UI');
      logger.info('🎨 Registered custom font Segoe UI (Regular) from Roboto');
    }
    if (fs.existsSync(robotoBold)) {
      GlobalFonts.registerFromPath(robotoBold, 'Segoe UI');
      logger.info('🎨 Registered custom font Segoe UI (Bold) from Roboto');
    }

    // 1. Connect to database
    logger.info('📦 Connecting to database...');
    await this.db.$connect();
    await this.db.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
    logger.info('✅ Database connected & WAL mode activated');

    // 2. Load all modules
    logger.info('🔧 Loading modules...');
    await this.loader.loadAll();
    logger.info(`✅ ${this.client.modules.size} modules loaded`);
    logger.info(`✅ ${this.client.commands.size} commands registered`);

    // 3. Setup core event handlers
    this.setupCoreEvents();

    // 4. Setup graceful shutdown
    this.setupShutdown();

    // 5. Start Dashboard Server
    logger.info('🌐 Starting Dashboard server...');
    DashboardServer.start(this);

    // 6. Login to Discord
    logger.info('🔑 Logging into Discord...');
    await this.client.login(process.env.BOT_TOKEN);
  }

  private setupCoreEvents(): void {
    this.client.once('clientReady', async () => {
      logger.info(`═══════════════════════════════════════════`);
      logger.info(`✅ Bot online as: ${this.client.user!.tag}`);
      logger.info(`📡 Guilds: ${this.client.guilds.cache.size}`);
      logger.info(`🧩 Commands: ${this.client.commands.size}`);
      logger.info(`📦 Modules: ${this.client.modules.size}`);
      logger.info(`═══════════════════════════════════════════`);

      this.client.user!.setPresence({
        activities: [{ name: '⚡ Enterprise Bot | /help', type: 0 }],
        status: 'online',
      });

      // Deploy commands if CLIENT_ID is set
      if (process.env.CLIENT_ID) {
        await this.client.deployCommands();
      }
    });

    this.client.on('interactionCreate', async interaction => {
      // Pass non-command interactions to module event handlers too
      if (!interaction.isChatInputCommand()) {
        // Dispatch to module events that handle interactionCreate
        const moduleEvents = this.client.events.get('interactionCreate') ?? [];
        for (const evt of moduleEvents) {
          try { await (evt as any).execute(this, interaction); } catch {}
        }
        return;
      }

      const command = this.client.commands.get(interaction.commandName);
      if (!command) return;

      // Custom command permissions check
      const isOwner = this.ownerIds.includes(interaction.user.id);
      const isAdmin = (interaction.member as GuildMember).permissions?.has(PermissionFlagsBits.Administrator);
      
      if (!isOwner && !isAdmin && interaction.guildId) {
        try {
          const { config } = await getModuleConfig<any>(interaction.guildId, 'command_permissions');
          
          let rules = null;
          if (interaction.isChatInputCommand()) {
            const group = interaction.options.getSubcommandGroup(false);
            const sub = interaction.options.getSubcommand(false);
            if (group && sub) {
              rules = config.permissions?.[`${interaction.commandName} ${group} ${sub}`];
            } else if (sub) {
              rules = config.permissions?.[`${interaction.commandName} ${sub}`];
            }
          }

          if (!rules) {
            rules = config.permissions?.[interaction.commandName];
          }

          if (rules) {
            const member = interaction.member as GuildMember;
            const memberRoles = member.roles.cache.map(r => r.id);
            const allowed = rules.allowedRoles || [];
            const denied = rules.deniedRoles || [];

            if (denied.length > 0 && memberRoles.some(rId => denied.includes(rId))) {
              const errorEmbed = UIBuilders.createErrorEmbed('Từ Chối Quyền Hạn', '❌ Vai trò của bạn bị cấm sử dụng lệnh này.');
              const buffer = await UIBuilders.convertToCanvasCard(errorEmbed, interaction.user.displayAvatarURL({ extension: 'png' }), interaction.user.username, interaction.guild?.name);
              const file = new AttachmentBuilder(buffer, { name: 'error.png' });
              return void interaction.reply({ files: [file], ephemeral: true });
            }

            if (allowed.length > 0 && !memberRoles.some(rId => allowed.includes(rId))) {
              const errorEmbed = UIBuilders.createErrorEmbed('Từ Chối Quyền Hạn', '❌ Bạn không có vai trò phù hợp để sử dụng lệnh này.');
              const buffer = await UIBuilders.convertToCanvasCard(errorEmbed, interaction.user.displayAvatarURL({ extension: 'png' }), interaction.user.username, interaction.guild?.name);
              const file = new AttachmentBuilder(buffer, { name: 'error.png' });
              return void interaction.reply({ files: [file], ephemeral: true });
            }
          }
        } catch (err) {
          logger.error('Failed to verify command permissions:', err);
        }
      }

      // Maintenance mode check (non-owners blocked)
      if (this.cache.get<boolean>('maintenance_mode') && !this.ownerIds.includes(interaction.user.id)) {
        await interaction.reply({ content: '🔧 Bot đang bảo trì. Vui lòng thử lại sau.', ephemeral: true });
        return;
      }

      // Cooldown check
      if (!this.client.cooldowns.has(interaction.commandName)) {
        this.client.cooldowns.set(interaction.commandName, new Collection());
      }
      const now = Date.now();
      const timestamps = this.client.cooldowns.get(interaction.commandName)!;
      const cooldown = (command.cooldown ?? 3) * 1000;
      if (timestamps.has(interaction.user.id)) {
        const expiry = timestamps.get(interaction.user.id)! + cooldown;
        if (now < expiry) {
          const remaining = ((expiry - now) / 1000).toFixed(1);
          await interaction.reply({
            content: `⏱️ Vui lòng chờ **${remaining}s** trước khi dùng lệnh này lại.`,
            ephemeral: true,
          });
          return;
        }
      }
      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldown);

      // Owner only check
      if (command.ownerOnly && !this.ownerIds.includes(interaction.user.id)) {
        await interaction.reply({ content: '❌ Lệnh này chỉ dành cho owner bot.', ephemeral: true });
        return;
      }

      try {
        await command.execute(interaction, this);
      } catch (error) {
        logger.error(`Command error: /${interaction.commandName}`, { error, userId: interaction.user.id });
        const msg = { content: '❌ Có lỗi xảy ra khi thực thi lệnh. Vui lòng thử lại.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg);
        } else {
          await interaction.reply(msg);
        }
      }
    });

    // Dispatch Discord events to module handlers
    const discordEvents = [
      'messageCreate', 'messageDelete', 'messageUpdate',
      'guildMemberAdd', 'guildMemberRemove', 'guildMemberUpdate',
      'voiceStateUpdate', 'messageReactionAdd', 'messageReactionRemove',
      'channelCreate', 'channelDelete', 'roleCreate', 'roleDelete',
    ] as const;

    for (const eventName of discordEvents) {
      this.client.on(eventName as any, async (...args: any[]) => {
        const handlers = this.client.events.get(eventName) ?? [];
        for (const handler of handlers) {
          try { await (handler as any).execute(this, ...args); } catch (err) {
            logger.error(`Event handler error [${eventName}]`, { error: err });
          }
        }
      });
    }

    this.client.on('error', error => logger.error('Discord client error', { error }));
    this.client.on('warn', warn => logger.warn('Discord client warning', { warn }));

    this.client.on('guildCreate', async guild => {
      logger.info(`Joined guild: ${guild.name} (${guild.id})`);
      // Auto-setup guild in DB
      try {
        await this.db.guild.upsert({
          where: { id: guild.id },
          create: { id: guild.id, name: guild.name, ownerId: guild.ownerId },
          update: { name: guild.name },
        });
      } catch {}
    });
  }

  private setupShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      DashboardServer.stop();
      this.scheduler.stopAll();
      await this.db.$disconnect();
      this.client.destroy();
      logger.info('✅ Graceful shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', error => {
      logger.error('Uncaught Exception', { error });
    });
    process.on('unhandledRejection', reason => {
      logger.error('Unhandled Rejection', { reason });
    });
  }

  isOwner(userId: string): boolean {
    return this.ownerIds.includes(userId);
  }

  get uptime(): number {
    return this.client.uptime ?? 0;
  }
}
