import express from 'express';
import session from 'express-session';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import { Kernel } from '../Kernel';
import { getGameConfig, setGameConfig, getModuleConfig, setModuleConfig } from '../../database/helpers';
import { logger } from '../logger/Logger';

declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
  }
}

export class DashboardServer {
  private static app = express();
  private static server: http.Server;
  private static io: SocketServer;
  private static kernel: Kernel;

  public static start(kernel: Kernel): void {
    this.kernel = kernel;
    const port = parseInt(process.env.DASHBOARD_PORT || '3002', 10);
    const sessionSecret = process.env.SESSION_SECRET || 'kini-dashboard-secret-123';
    const adminPassword = process.env.SESSION_SECRET || 'admin'; // Sử dụng SESSION_SECRET làm mật khẩu admin

    this.server = http.createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Middlewares
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(
      session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
      })
    );

    // Serve static files
    const publicPath = path.join(__dirname, 'public');
    this.app.use(express.static(publicPath));

    // Authentication Middleware
    const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.session && req.session.authenticated) {
        next();
      } else {
        res.status(401).json({ error: 'Chưa đăng nhập' });
      }
    };

    // APIs
    this.app.post('/api/auth/login', (req, res) => {
      const { password } = req.body;
      if (password === adminPassword) {
        req.session.authenticated = true;
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'Mật khẩu không chính xác' });
      }
    });

    this.app.post('/api/auth/logout', (req, res) => {
      req.session.destroy(err => {
        if (err) {
          return res.status(500).json({ error: 'Không thể đăng xuất' });
        }
        res.json({ success: true });
      });
    });

    this.app.get('/api/auth/status', (req, res) => {
      res.json({ authenticated: !!(req.session && req.session.authenticated) });
    });

    this.app.get('/api/status', requireAuth, async (req, res) => {
      try {
        const uptime = process.uptime();
        const guildsCount = this.kernel.client.guilds.cache.size;
        const usersCount = this.kernel.client.users.cache.size;
        const commandsCount = this.kernel.client.commands.size;
        const memoryUsage = process.memoryUsage();
        
        // Count total users in database
        const totalDbMembers = await this.kernel.db.guildMember.count();

        res.json({
          uptime,
          guildsCount,
          usersCount,
          commandsCount,
          totalDbMembers,
          memory: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024)
          },
          maintenanceMode: !!this.kernel.cache.get('maintenance_mode')
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
    this.app.post('/api/status/maintenance', requireAuth, (req, res) => {
      const { enable } = req.body;
      if (enable) {
        this.kernel.cache.set('maintenance_mode', true, 0); // ttl = 0 means never expire
      } else {
        this.kernel.cache.del('maintenance_mode');
      }
      res.json({ success: true, maintenanceMode: !!this.kernel.cache.get('maintenance_mode') });
    });
    this.app.get('/api/settings', requireAuth, async (req, res) => {
      try {
        const settings = await getGameConfig();
        res.json(settings);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/settings', requireAuth, async (req, res) => {
      try {
        const { blackjack, poker } = req.body;
        await setGameConfig({ blackjack, poker });
        res.json({ success: true, message: 'Cập nhật cấu hình thành công' });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/leaderboard', requireAuth, async (req, res) => {
      try {
        // Top 10 users by Coins
        const topCoins = await this.kernel.db.guildMember.findMany({
          orderBy: { balance: 'desc' },
          take: 10,
          select: {
            userId: true,
            balance: true,
            vnd: true
          }
        });

        // Top 10 users by VND
        const topVnd = await this.kernel.db.guildMember.findMany({
          orderBy: { vnd: 'desc' },
          take: 10,
          select: {
            userId: true,
            balance: true,
            vnd: true
          }
        });

        // Resolve usernames
        const resolveUsernames = async (list: typeof topCoins) => {
          return Promise.all(
            list.map(async item => {
              let username = 'Unknown';
              try {
                const user = await this.kernel.client.users.fetch(item.userId);
                username = user.username;
              } catch {
                const dbUser = await this.kernel.db.user.findUnique({ where: { id: item.userId } });
                username = dbUser?.username || item.userId;
              }
              return {
                userId: item.userId,
                username,
                balance: item.balance,
                vnd: item.vnd
              };
            })
          );
        };

        res.json({
          topCoins: await resolveUsernames(topCoins),
          topVnd: await resolveUsernames(topVnd)
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/permissions/guilds', requireAuth, async (req, res) => {
      try {
        const guilds = this.kernel.client.guilds.cache.map(g => ({
          id: g.id,
          name: g.name,
          iconUrl: g.iconURL()
        }));
        res.json(guilds);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/permissions/:guildId/roles', requireAuth, async (req, res) => {
      try {
        const guildId = req.params.guildId as string;
        const guild = await this.kernel.client.guilds.fetch(guildId);
        if (!guild) {
          return res.status(404).json({ error: 'Không tìm thấy máy chủ' });
        }
        const roles = guild.roles.cache
          .filter(r => r.name !== '@everyone' && !r.managed)
          .map(r => ({
            id: r.id,
            name: r.name,
            color: r.hexColor
          }));
        res.json(roles);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/permissions/:guildId/commands', requireAuth, async (req, res) => {
      try {
        const guildId = req.params.guildId as string;
        const commands = this.kernel.client.commands.map(cmd => ({
          name: cmd.data.name,
          description: cmd.data.description
        }));
        const { config } = await getModuleConfig<any>(guildId, 'command_permissions');
        const permissions = config?.permissions || {};
        res.json({ commands, permissions });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/permissions/:guildId', requireAuth, async (req, res) => {
      try {
        const guildId = req.params.guildId as string;
        const { permissions } = req.body;
        await setModuleConfig(guildId, 'command_permissions', { permissions });
        res.json({ success: true, message: 'Cập nhật phân quyền thành công' });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Frontend routes fallback to index.html or dashboard.html
    this.app.get('/', (req, res) => {
      if (req.session && req.session.authenticated) {
        res.redirect('/dashboard.html');
      } else {
        res.sendFile(path.join(publicPath, 'index.html'));
      }
    });

    this.app.get('/dashboard.html', (req, res) => {
      if (req.session && req.session.authenticated) {
        res.sendFile(path.join(publicPath, 'dashboard.html'));
      } else {
        res.redirect('/');
      }
    });

    // Socket.io Real-time Bot Stats
    this.io.on('connection', socket => {
      logger.info('🔌 Dashboard Socket Client connected');
      
      const interval = setInterval(async () => {
        try {
          const uptime = process.uptime();
          const guildsCount = this.kernel.client.guilds.cache.size;
          const usersCount = this.kernel.client.users.cache.size;
          const memoryUsage = process.memoryUsage();
          
          socket.emit('bot_stats', {
            uptime,
            guildsCount,
            usersCount,
            memory: {
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
              rss: Math.round(memoryUsage.rss / 1024 / 1024)
            },
            maintenanceMode: !!this.kernel.cache.get('maintenance_mode')
          });
        } catch {}
      }, 3000);

      socket.on('disconnect', () => {
        clearInterval(interval);
      });
    });

    this.server.listen(port, () => {
      logger.info(`🌐 Dashboard Server is running at http://localhost:${port}`);
    });
  }

  public static stop(): void {
    if (this.server) {
      this.server.close();
      logger.info('🌐 Dashboard Server stopped');
    }
  }
}
