import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';

const log = createModuleLogger('poker');

export default class PokerModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'poker',
    displayName: 'Poker',
    version: '1.0.0',
    description: 'Chơi game Poker Texas Hold\'em 1v1 vs Bot, hỗ trợ cược bằng Coins hoặc VND',
    dependencies: [],
    requiredPermissions: [],
    defaultEnabled: true,
    premium: false,
  };

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Poker module loaded');
  }

  async onUnload(): Promise<void> {
    log.info('Poker module unloaded');
  }

  async onReload(kernel: Kernel): Promise<void> {
    await this.onUnload();
    await this.onLoad(kernel);
  }
}
