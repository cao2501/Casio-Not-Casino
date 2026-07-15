import { EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Theme } from './Theme';
import { CardRenderer } from './CardRenderer';

export class UIBuilders {
  /**
   * Create a standardized Embed with Accent Gold color and custom timestamp footer
   */
  public static createEmbed(title?: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(Theme.colors.accentGold as any)
      .setTimestamp();
    
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    
    return embed;
  }

  /**
   * Create a standardized Success Embed (Green Accent)
   */
  public static createSuccessEmbed(title: string, description?: string): EmbedBuilder {
    return this.createEmbed(title, description)
      .setColor(Theme.colors.success as any);
  }

  /**
   * Create a standardized Error/Danger Embed (Red Accent)
   */
  public static createErrorEmbed(title: string, description?: string): EmbedBuilder {
    return this.createEmbed(title, description)
      .setColor(Theme.colors.danger as any);
  }

  /**
   * Create a standardized Info Embed (Blurple Accent)
   */
  public static createInfoEmbed(title: string, description?: string): EmbedBuilder {
    return this.createEmbed(title, description)
      .setColor(Theme.colors.info as any);
  }

  /**
   * Create a styled ButtonBuilder with automatic padding and styling
   */
  public static createButton(
    customId: string,
    label: string,
    style: ButtonStyle = ButtonStyle.Secondary,
    emoji?: string
  ): ButtonBuilder {
    const btn = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(style);
    
    if (emoji) btn.setEmoji(emoji);
    return btn;
  }

  /**
   * Helper to automatically convert an EmbedBuilder to a premium Canvas Card buffer
   */
  public static async convertToCanvasCard(
    embed: EmbedBuilder,
    userAvatarUrl?: string,
    username?: string,
    guildName?: string
  ): Promise<Buffer> {
    const data = embed.toJSON();
    const title = data.title ?? '';
    const description = data.description ?? '';
    
    let colorHex: string | undefined;
    if (data.color) {
      colorHex = `#${data.color.toString(16).padStart(6, '0')}`;
    }

    const fields = (data.fields ?? []).map(f => ({
      name: f.name,
      value: f.value,
      inline: f.inline
    }));

    const thumbnailUrl = data.thumbnail?.url;
    const author = data.author?.name;
    const footer = data.footer?.text;

    return CardRenderer.drawGenericEmbedCard(
      title,
      description,
      fields,
      thumbnailUrl,
      colorHex,
      footer,
      author,
      userAvatarUrl,
      username,
      guildName
    );
  }
}
