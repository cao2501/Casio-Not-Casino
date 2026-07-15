import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';

const log = createModuleLogger('random');

export default class RandomModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'random',
    displayName: 'Random',
    version: '1.0.0',
    description: 'Tạo số ngẫu nhiên hoặc rút lá bài ngẫu nhiên dưới dạng Canvas',
    dependencies: [],
    requiredPermissions: [],
    defaultEnabled: true,
    premium: false,
  };

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Random module loaded');
  }

  async onUnload(): Promise<void> {
    log.info('Random module unloaded');
  }

  async onReload(kernel: Kernel): Promise<void> {
    await this.onUnload();
    await this.onLoad(kernel);
  }
}
