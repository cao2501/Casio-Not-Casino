import { Kernel } from '../Kernel';

export interface ModuleManifest {
  name: string;
  displayName: string;
  version: string;
  description: string;
  dependencies: string[];
  requiredPermissions: bigint[];
  defaultEnabled: boolean;
  premium: boolean;
}

export interface IModule {
  readonly manifest: ModuleManifest;
  onLoad(kernel: Kernel): Promise<void>;
  onUnload(): Promise<void>;
  onReload(kernel: Kernel): Promise<void>;
}
