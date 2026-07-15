import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
import ShopInteractionEvent from './events/shopInteraction';

const log = createModuleLogger('economy');

export default class EconomyModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'economy', displayName: 'Economy', version: '1.0.0',
    description: 'Currency system: balance, daily/weekly/monthly, work, crime, rob, shop, inventory',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Economy module loaded');

    // Register shop interaction event (select menu + button)
    const events = kernel.client.events.get('interactionCreate') ?? [];
    events.push(new ShopInteractionEvent());
    kernel.client.events.set('interactionCreate', events);
  }

  async onUnload(): Promise<void> { log.info('Economy module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}
