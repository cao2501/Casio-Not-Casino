import {
  Interaction, StringSelectMenuInteraction,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { createModuleLogger } from '../../../core/logger/Logger';

const log = createModuleLogger('economy');

export default class ShopInteractionEvent implements IEvent<'interactionCreate'> {
  name = 'interactionCreate' as const;

  async execute(kernel: Kernel, interaction: Interaction): Promise<void> {
    // ─── Select Menu: shop detail ─────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'shop:detail') {
      await this.handleDetailSelect(kernel, interaction as StringSelectMenuInteraction);
      return;
    }

    // ─── Button: shop buy confirm ─────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('shop:buy:')) {
      await this.handleBuyConfirm(kernel, interaction);
      return;
    }
  }

  // ── Show item detail embed ─────────────────────────────────────────────
  private async handleDetailSelect(kernel: Kernel, interaction: StringSelectMenuInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    // Value format: "shop_item:<id>"
    const itemId = interaction.values[0].replace('shop_item:', '');
    const item = await kernel.db.shopItem.findUnique({ where: { id: itemId } });

    if (!item || !item.enabled) {
      return void interaction.editReply('❌ Sản phẩm không tồn tại hoặc đã bị tắt.');
    }

    const stockText = item.stock !== null
      ? (item.stock > 0 ? `${item.stock} sản phẩm` : 'Hết hàng')
      : 'Vô hạn';

    const rewardText = item.type === 'ROLE' && item.roleId
      ? `Role: <@&${item.roleId}>`
      : 'Custom — liên hệ Admin để nhận';

    const emoji = item.emoji || (item.type === 'ROLE' ? '🎭' : '🎁');

    const embed = new EmbedBuilder()
      .setColor(0xff7bb5)
      .setTitle(`${emoji} ${item.name}`)
      .setDescription(item.description || 'Không có mô tả sản phẩm.')
      .addFields(
        { name: '💰 Giá bán', value: `${item.price.toLocaleString()} ${item.currency === 'VND' ? 'VNĐ' : 'coins'}`, inline: true },
        { name: '📦 Kho hàng', value: stockText, inline: true },
        { name: '🎁 Phần thưởng', value: rewardText, inline: true }
      );

    if (item.imageUrl) {
      embed.setThumbnail(item.imageUrl);
    }

    // Buy button — disabled if out of stock
    const outOfStock = item.stock !== null && item.stock <= 0;
    const buyBtn = new ButtonBuilder()
      .setCustomId(`shop:buy:${item.id}`)
      .setLabel(outOfStock ? '❌ Hết Hàng' : '💳 Mua Ngay')
      .setStyle(outOfStock ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(outOfStock);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buyBtn);

    await interaction.editReply({ embeds: [embed], components: [row] });
  }

  // ── Handle buy button confirm ──────────────────────────────────────────
  private async handleBuyConfirm(kernel: Kernel, interaction: any): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const itemId = interaction.customId.replace('shop:buy:', '');
    const guildId = interaction.guildId!;

    const item = await kernel.db.shopItem.findUnique({ where: { id: itemId } });
    if (!item || !item.enabled) {
      return void interaction.editReply('❌ Sản phẩm không còn khả dụng.');
    }

    if (item.stock !== null && item.stock <= 0) {
      return void interaction.editReply('❌ Sản phẩm này đã hết hàng!');
    }

    const member = await kernel.db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: interaction.user.id } },
    });

    const isVnd = item.currency === 'VND';
    const balanceValue = isVnd ? (member?.vnd ?? 0) : (member?.balance ?? 0);

    if (!member || balanceValue < item.price) {
      const balanceStr = isVnd ? `${balanceValue.toLocaleString()} VNĐ` : `${balanceValue.toLocaleString()} coins`;
      const requiredStr = isVnd ? `${item.price.toLocaleString()} VNĐ` : `${item.price.toLocaleString()} coins`;
      return void interaction.editReply(
        `❌ Không đủ tiền! Cần **${requiredStr}**, bạn có **${balanceStr}**.`
      );
    }

    const newBalance = balanceValue - item.price;

    // Deduct balance (VND or Eco coins)
    await kernel.db.guildMember.update({
      where: { guildId_userId: { guildId, userId: interaction.user.id } },
      data: isVnd ? { vnd: { decrement: item.price } } : { balance: { decrement: item.price } },
    });

    log.info(`[SHOP_BUY] User ${interaction.user.id} (${interaction.user.username}) bought item ${item.name} (${item.id}) via button confirm in guild ${guildId}. Price: ${item.price} ${item.currency}. Pre-balance: ${balanceValue}, Post-balance: ${newBalance}`, { module: 'economy' });

    // Reduce stock and disable if out of stock
    if (item.stock !== null) {
      const nextStock = item.stock - 1;
      await kernel.db.shopItem.update({
        where: { id: item.id },
        data: {
          stock: nextStock,
          enabled: nextStock > 0 ? item.enabled : false,
        },
      });
    }

    // Give role
    if (item.type === 'ROLE' && item.roleId) {
      const discordMember = interaction.guild!.members.cache.get(interaction.user.id);
      await discordMember?.roles.add(item.roleId).catch(() => {});
    }

    // Log purchase / Update inventory
    const existingPurchase = await kernel.db.itemPurchase.findFirst({
      where: { itemId: item.id, guildId, userId: interaction.user.id }
    });

    if (existingPurchase) {
      await kernel.db.itemPurchase.update({
        where: { id: existingPurchase.id },
        data: { quantity: { increment: 1 } }
      });
    } else {
      await kernel.db.itemPurchase.create({
        data: { itemId: item.id, guildId, userId: interaction.user.id, quantity: 1 }
      });
    }

    let roleName = '';
    if (item.type === 'ROLE' && item.roleId) {
      const role = interaction.guild!.roles.cache.get(item.roleId);
      roleName = role ? role.name : 'Unknown Role';
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Mua Hàng Thành Công!')
      .setDescription(`<@${interaction.user.id}> đã mua thành công **${item.name}**!`)
      .addFields(
        { name: '💰 Giá thanh toán', value: `${item.price.toLocaleString()} ${item.currency === 'VND' ? 'VNĐ' : 'coins'}`, inline: true },
        { name: '💳 Số dư còn lại', value: `${newBalance.toLocaleString()} ${item.currency === 'VND' ? 'VNĐ' : 'coins'}`, inline: true }
      );

    if (roleName) {
      embed.addFields({ name: '🎁 Vai trò nhận được', value: roleName, inline: true });
    }

    await interaction.editReply({ embeds: [embed], components: [] });

    kernel.eventBus.emit('economy:transaction', {
      guildId, userId: interaction.user.id, type: 'SHOP_BUY', amount: item.price,
    });
  }
}
