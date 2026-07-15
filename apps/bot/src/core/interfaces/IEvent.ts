import { ClientEvents } from 'discord.js';
import { Kernel } from '../Kernel';

export interface IEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(kernel: Kernel, ...args: ClientEvents[K]): Promise<void>;
}
