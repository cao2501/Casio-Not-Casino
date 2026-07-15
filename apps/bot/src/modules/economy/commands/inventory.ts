import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

const TYPE_EMOJI: Record<string, string> = {
  ROLE: '🎭',
  CUSTOM: '🎁',
};

function sortCustomLast(items: any[], category: string): void {
  if (category === 'RING') {
    const idx = items.findIndex(x => x.name.toLowerCase() === 'custom');
    if (idx !== -1) {
      const [customItem] = items.splice(idx, 1);
      items.push(customItem);
    }
  }
}

export default class InventoryCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('🎒 Quản lý kho đồ cá nhân')
    .addSubcommand(s => s
      .setName('view')
      .setDescription('🎒 Xem kho đồ cá nhân của bạn')
    )
    .addSubcommand(s => s
      .setName('give')
      .setDescription('🎁 Tặng/Chuyển vật phẩm trong kho đồ cho người khác')
      .addStringOption(o => o.setName('category').setDescription('Danh mục sản phẩm').setRequired(true).addChoices(
        { name: '📦 Vật phẩm', value: 'GENERAL' },
        { name: '💍 Nhẫn cưới', value: 'RING' },
      ))
      .addIntegerOption(o => o.setName('id').setDescription('ID sản phẩm (Số thứ tự hiển thị trong /inventory)').setRequired(true).setMinValue(1))
      .addUserOption(o => o.setName('user').setDescription('Người nhận').setRequired(true))
      .addIntegerOption(o => o.setName('quantity').setDescription('Số lượng muốn tặng (mặc định: 1)').setMinValue(1))
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const guildId = interaction.guildId!;
    await ensureGuild(guildId, interaction.guild!.name);
    
    // Defer immediately!
    await interaction.deferReply();

    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const purchases = await kernel.db.itemPurchase.findMany({
        where: { guildId, userId: interaction.user.id },
        include: { item: true }
      });

      const generalShopItems = await kernel.db.shopItem.findMany({
        where: { guildId, category: 'GENERAL', enabled: true },
        orderBy: { price: 'asc' },
      });

      const ringShopItems = await kernel.db.shopItem.findMany({
        where: { guildId, category: 'RING', enabled: true },
        orderBy: { price: 'asc' },
      });
      sortCustomLast(ringShopItems, 'RING');

      const formatLine = (p: any, shopItems: any[]) => {
        const idx = shopItems.findIndex(x => x.id === p.item.id);
        const displayId = idx !== -1 ? String(idx + 1).padStart(2, '0') : 'N/A';
        const emoji = p.item.emoji || TYPE_EMOJI[p.item.type] || '🛒';
        return `${emoji} **${p.item.name}** (x${p.quantity}) - ID sản phẩm: \`#${displayId}\``;
      };

      const generalPurchases = purchases.filter(p => p.item.category === 'GENERAL');
      const ringPurchases = purchases.filter(p => p.item.category === 'RING');

      const embed = new EmbedBuilder()
        .setColor(0xff7bb5)
        .setTitle(`🎒 Kho Đồ Cá Nhân — ${interaction.user.username}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

      const generalLines = generalPurchases.map(p => formatLine(p, generalShopItems)).join('\n');
      const ringLines = ringPurchases.map(p => formatLine(p, ringShopItems)).join('\n');

      embed.addFields(
        { name: '📦 Kho Đồ Vật Phẩm', value: generalLines || '*Trống*', inline: false },
        { name: '💍 Kho Đồ Nhẫn Cưới', value: ringLines || '*Trống*', inline: false }
      );

      await interaction.editReply({ embeds: [embed] });

    } else if (sub === 'give') {
      const category = interaction.options.getString('category', true);
      const displayId = interaction.options.getInteger('id', true);
      const targetUser = interaction.options.getUser('user', true);
      const quantity = interaction.options.getInteger('quantity') ?? 1;

      if (targetUser.id === interaction.user.id) {
        return void interaction.editReply('❌ Bạn không thể tự chuyển đồ cho chính mình.');
      }
      if (targetUser.bot) {
        return void interaction.editReply('❌ Bạn không thể chuyển đồ cho bot.');
      }
      if (quantity <= 0) {
        return void interaction.editReply('❌ Số lượng chuyển phải lớn hơn 0.');
      }

      // Find shop items in this category
      const shopItems = await kernel.db.shopItem.findMany({
        where: { guildId, category, enabled: true },
        orderBy: { price: 'asc' },
      });
      sortCustomLast(shopItems, category);

      const item = shopItems[displayId - 1];
      if (!item) {
        return void interaction.editReply(`❌ Không tìm thấy sản phẩm số **#${String(displayId).padStart(2, '0')}** trong danh mục **${category === 'RING' ? 'Nhẫn cưới' : 'Vật phẩm'}**.`);
      }

      // Check if sender has the item
      const purchase = await kernel.db.itemPurchase.findFirst({
        where: { guildId, userId: interaction.user.id, itemId: item.id },
      });

      if (!purchase || purchase.quantity < quantity) {
        return void interaction.editReply(`❌ Bạn không đủ số lượng **${item.name}** trong kho đồ để tặng (Hiện có: ${purchase?.quantity ?? 0}).`);
      }

      // Deduct from sender
      if (purchase.quantity === quantity) {
        await kernel.db.itemPurchase.delete({ where: { id: purchase.id } });
      } else {
        await kernel.db.itemPurchase.update({
          where: { id: purchase.id },
          data: { quantity: purchase.quantity - quantity },
        });
      }

      // Add to receiver
      const targetPurchase = await kernel.db.itemPurchase.findFirst({
        where: { guildId, userId: targetUser.id, itemId: item.id },
      });

      if (targetPurchase) {
        await kernel.db.itemPurchase.update({
          where: { id: targetPurchase.id },
          data: { quantity: targetPurchase.quantity + quantity },
        });
      } else {
        await kernel.db.itemPurchase.create({
          data: {
            guildId,
            userId: targetUser.id,
            itemId: item.id,
            quantity,
          },
        });
      }

      const itemEmoji = item.emoji || TYPE_EMOJI[item.type] || '🎁';

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🎁 Tặng Quà Thành Công')
        .setDescription(`Bạn đã tặng vật phẩm từ kho đồ cho người khác!`)
        .addFields(
          { name: '👤 Người gửi', value: `<@${interaction.user.id}>`, inline: true },
          { name: '👤 Người nhận', value: `<@${targetUser.id}>`, inline: true },
          { name: '📦 Vật phẩm', value: `${itemEmoji} **${item.name}** (x${quantity})`, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}
