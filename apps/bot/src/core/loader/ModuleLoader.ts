import path from 'path';
import fs from 'fs';
import { IModule } from '../interfaces/IModule';
import { ICommand } from '../interfaces/ICommand';
import { IEvent } from '../interfaces/IEvent';
import { logger } from '../logger/Logger';
import { BotClient } from '../Client';
import type { Kernel } from '../Kernel';

export class ModuleLoader {
  private modulesDir: string;
  private kernel: Kernel;

  constructor(kernel: Kernel) {
    this.kernel = kernel;
    this.modulesDir = path.join(__dirname, '../../modules');
  }

  async loadAll(): Promise<void> {
    if (!fs.existsSync(this.modulesDir)) {
      logger.warn('No modules directory found');
      return;
    }

    const dirs = fs.readdirSync(this.modulesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    logger.info(`🔍 Found ${dirs.length} module directories`);

    for (const dir of dirs) {
      await this.loadModule(dir);
    }

    this.startAutoScanner();
  }

  async loadModule(name: string): Promise<boolean> {
    const modulePath = path.join(this.modulesDir, name, 'module.ts');
    const moduleJsPath = path.join(this.modulesDir, name, 'module.js');

    const filePath = fs.existsSync(modulePath) ? modulePath : 
                     fs.existsSync(moduleJsPath) ? moduleJsPath : null;

    if (!filePath) {
      logger.warn(`Module "${name}" has no module.ts/module.js — skipping`);
      return false;
    }

    try {
      // Clear require cache for hot reload
      const resolvedPath = require.resolve(filePath.replace('.ts', ''));
      if (require.cache[resolvedPath]) {
        delete require.cache[resolvedPath];
      }

      const moduleFile = require(filePath.replace('.ts', ''));
      const ModuleClass = moduleFile.default || moduleFile[Object.keys(moduleFile)[0]];

      if (!ModuleClass) {
        logger.error(`Module "${name}" has no default export`);
        return false;
      }

      const moduleInstance: IModule = new ModuleClass();

      // Check if already loaded — unload first
      if (this.kernel.client.modules.has(moduleInstance.manifest.name)) {
        await this.unloadModule(moduleInstance.manifest.name);
      }

      await moduleInstance.onLoad(this.kernel);
      this.kernel.client.modules.set(moduleInstance.manifest.name, moduleInstance);

      // Load commands
      await this.loadModuleCommands(name, moduleInstance.manifest.name);

      // Load events
      await this.loadModuleEvents(name, moduleInstance.manifest.name);

      logger.info(`✅ Module loaded: ${moduleInstance.manifest.displayName} v${moduleInstance.manifest.version}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to load module "${name}"`, { error });
      return false;
    }
  }

  async unloadModule(name: string): Promise<boolean> {
    const mod = this.kernel.client.modules.get(name);
    if (!mod) return false;

    try {
      await mod.onUnload();
      this.kernel.client.modules.delete(name);
      logger.info(`Module unloaded: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to unload module "${name}"`, { error });
      return false;
    }
  }

  async reloadModule(name: string): Promise<boolean> {
    logger.info(`🔄 Reloading module: ${name}`);
    const start = Date.now();

    // Clear commands and events from this module first
    const mod = this.kernel.client.modules.get(name);
    if (mod) {
      await mod.onUnload().catch(() => {});
      this.kernel.client.modules.delete(name);
    }

    // Clear all events (they'll be re-registered on reload)
    // Only safe because each reload re-populates
    this.kernel.client.events.clear();

    // Reload all modules' events to rebuild collection
    const dirs = fs.readdirSync(this.modulesDir, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name);

    for (const dir of dirs) {
      await this.loadModuleEvents(dir, dir);
    }

    const success = await this.loadModule(name);
    if (success) {
      logger.info(`Module "${name}" reloaded in ${Date.now() - start}ms`);
    }
    return success;
  }

  private async loadModuleCommands(dir: string, moduleName: string): Promise<void> {
    const cmdsDir = path.join(this.modulesDir, dir, 'commands');
    if (!fs.existsSync(cmdsDir)) return;

    const files = this.getFiles(cmdsDir, ['.ts', '.js']);

    for (const file of files) {
      try {
        const resolvedPath = require.resolve(file.replace('.ts', ''));
        if (require.cache[resolvedPath]) delete require.cache[resolvedPath];

        const cmdFile = require(file.replace('.ts', ''));
        const Command = cmdFile.default;
        if (!Command) continue;

        const cmd: ICommand = new Command();
        const name = (cmd.data as any).name;
        this.kernel.client.commands.set(name, cmd);
        this.kernel.client.commandModuleMap.set(name, moduleName); // Track module ownership
        logger.debug(`  ⚡ Command: /${name} [${moduleName}]`);
      } catch (error) {
        logger.error(`Failed to load command: ${file}`, { error });
      }
    }
  }

  async loadModuleEvents(dir: string, moduleName: string): Promise<void> {
    const evtsDir = path.join(this.modulesDir, dir, 'events');
    if (!fs.existsSync(evtsDir)) return;

    const files = this.getFiles(evtsDir, ['.ts', '.js']);

    for (const file of files) {
      try {
        const resolvedPath = require.resolve(file.replace('.ts', ''));
        if (require.cache[resolvedPath]) delete require.cache[resolvedPath];

        const evtFile = require(file.replace('.ts', ''));
        const Event = evtFile.default;
        if (!Event) continue;

        const event: IEvent = new Event();

        // Store in client.events collection (centralized dispatcher in Kernel handles routing)
        const existing = this.kernel.client.events.get(event.name) ?? [];
        // Avoid duplicate handlers on reload
        if (!existing.some(e => e.constructor.name === event.constructor.name)) {
          existing.push(event);
        }
        this.kernel.client.events.set(event.name, existing);

        logger.debug(`  📡 Event: ${event.name} [${moduleName}]`);
      } catch (error) {
        logger.error(`Failed to load event: ${file}`, { error });
      }
    }
  }

  private scannerInterval: NodeJS.Timeout | null = null;

  startAutoScanner(): void {
    if (this.scannerInterval) return;
    
    logger.info('👁️ Starting modules directory auto-scanner (polling)...');
    
    this.scannerInterval = setInterval(async () => {
      try {
        if (!fs.existsSync(this.modulesDir)) return;
        const dirs = fs.readdirSync(this.modulesDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);

        let newModuleLoaded = false;

        for (const dir of dirs) {
          const modulePath = path.join(this.modulesDir, dir, 'module.ts');
          const moduleJsPath = path.join(this.modulesDir, dir, 'module.js');
          const hasModuleFile = fs.existsSync(modulePath) || fs.existsSync(moduleJsPath);

          if (hasModuleFile) {
            const isLoaded = this.kernel.client.modules.has(dir) || 
                             Array.from(this.kernel.client.modules.values()).some(m => m.manifest.name === dir);

            if (!isLoaded) {
              logger.info(`🆕 Auto-scanner detected new module: "${dir}". Loading...`, { module: 'system' });
              const success = await this.loadModule(dir);
              if (success) {
                logger.info(`🚀 Auto-scanner successfully loaded new module: "${dir}"`, { module: 'system' });
                newModuleLoaded = true;
              }
            }
          }
        }

        if (newModuleLoaded && process.env.CLIENT_ID) {
          logger.info('🔄 Redeploying slash commands after loading new modules...', { module: 'system' });
          await this.kernel.client.deployCommands();
        }
      } catch (err) {
        logger.error('Error in module auto-scanner:', { error: err });
      }
    }, 5000);
  }

  private getFiles(dir: string, exts: string[]): string[] {
    const results: string[] = [];
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (exts.some(e => entry.name.endsWith(e))) results.push(full);
      }
    };
    walk(dir);
    return results;
  }
}
