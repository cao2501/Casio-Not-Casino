import {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
} from 'discord.js';
import { Kernel } from '../Kernel';

export interface ICommand {
  data: any;
  cooldown?: number; // seconds
  ownerOnly?: boolean;
  guildOnly?: boolean;
  execute(
    interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
    kernel: Kernel
  ): Promise<void>;
}
