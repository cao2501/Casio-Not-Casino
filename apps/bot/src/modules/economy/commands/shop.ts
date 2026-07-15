import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';
import { createModuleLogger } from '../../../core/logger/Logger';
import { SpecialLogger } from '../../../core/logger/SpecialLogger';

const log = createModuleLogger('economy');

const TYPE_EMOJI: Record<string, string> = {
  ROLE: '🎭',
  CUSTOM: '🎁',
};

export async function seedDefaultRings(kernel: Kernel, guildId: string): Promise<void> {
  const defaultRings = [
    { name: 'Stardust', price: 500000, type: 'CUSTOM', category: 'RING', currency: 'VND', description: 'Nhẫn cưới Stardust tinh tú lấp lánh' },
    { name: 'Illusion', price: 700000, type: 'CUSTOM', category: 'RING', currency: 'VND', description: 'Nhẫn cưới Illusion ảo ảnh lung linh' },
    { name: 'Nebula Core', price: 900000, type: 'CUSTOM', category: 'RING', currency: 'VND', description: 'Nhẫn cưới Nebula Core lõi tinh vân' },
    { name: 'Constellation', price: 1200000, type: 'CUSTOM', category: 'RING', currency: 'VND', description: 'Nhẫn cưới Constellation chòm sao lãng mạn' },
    { name: 'Horizon', price: 1500000, type: 'CUSTOM', category: 'RING', currency: 'VND', description: 'Nhẫn cưới Horizon chân trời vĩnh cửu' },
    { name: 'Singularity', price: 2000000, type: 'CUSTOM', category: 'RING', currency: 'VND', description: 'Nhẫn cưới Singularity điểm kỳ dị tối thượng' },
    { name: 'Custom', price: 2500000, type: 'CUSTOM', category: 'RING', currency: 'VND', description: 'Nhẫn cưới Custom thiết kế riêng biệt' },
  ];

  for (const ring of defaultRings) {
    const existing = await kernel.db.shopItem.findFirst({
      where: { guildId, name: ring.name, category: 'RING' }
    });
    if (!existing) {
      await kernel.db.shopItem.create({
        data: {
          guildId,
          name: ring.name,
          price: ring.price,
          type: ring.type,
          category: ring.category,
          currency: ring.currency,
          description: ring.description,
        }
      });
    }
  }
}

export function sortCustomLast(items: any[], category: string): void {
  if (category === 'RING') {
    const idx = items.findIndex(x => x.name.toLowerCase() === 'custom');
    if (idx !== -1) {
      const [customItem] = items.splice(idx, 1);
      items.push(customItem);
    }
  }
}

export default class ShopCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('shop')
    .setDescription('🏪 Cửa Hàng Server')
    .addSubcommand(s => s.setName('list').setDescription('📋 Xem tất cả sản phẩm trong cửa hàng')
      .addStringOption(o => o.setName('category').setDescription('Danh mục cửa hàng (mặc định: GENERAL)').addChoices(
        { name: '📦 Vật phẩm', value: 'GENERAL' },
        { name: '💍 Nhẫn cưới', value: 'RING' },
      ))
    )
    .addSubcommand(s => s.setName('buy').setDescription('💳 Mua sản phẩm — dùng /shop list để xem ID')
      .addStringOption(o => o.setName('category').setDescription('Danh mục cửa hàng').setRequired(true).addChoices(
        { name: '📦 Vật phẩm', value: 'GENERAL' },
        { name: '💍 Nhẫn cưới', value: 'RING' },
      ))
      .addIntegerOption(o => o.setName('id').setDescription('ID sản phẩm (số thứ tự hiển thị trong /shop list)').setRequired(true).setMinValue(1))
    )
    .addSubcommand(s => s.setName('add').setDescription('[Admin] Thêm sản phẩm')
      .addStringOption(o => o.setName('name').setDescription('Tên sản phẩm').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Giá bán').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('type').setDescription('Loại vật phẩm').setRequired(true).addChoices(
        { name: '🎭 Role', value: 'ROLE' },
        { name: '🎁 Custom', value: 'CUSTOM' },
      ))
      .addStringOption(o => o.setName('category').setDescription('Danh mục (mặc định: GENERAL)').addChoices(
        { name: '📦 Vật phẩm thường', value: 'GENERAL' },
        { name: '💍 Nhẫn cưới', value: 'RING' },
      ))
      .addStringOption(o => o.setName('currency').setDescription('Loại tiền tệ (mặc định: ECO)').addChoices(
        { name: '💰 Coins (Eco)', value: 'ECO' },
        { name: '💳 VNĐ (Nạp)', value: 'VND' },
      ))
      .addRoleOption(o => o.setName('role').setDescription('Role thưởng (nếu loại = Role)'))
      .addStringOption(o => o.setName('description').setDescription('Mô tả sản phẩm'))
      .addIntegerOption(o => o.setName('stock').setDescription('Số lượng (0 = không giới hạn)'))
      .addStringOption(o => o.setName('image').setDescription('URL hình ảnh sản phẩm'))
      .addAttachmentOption(o => o.setName('file').setDescription('Tải lên ảnh từ máy (tùy chọn)'))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji hiển thị trước tên sản phẩm (tùy chọn)'))
    )
    .addSubcommand(s => s.setName('remove').setDescription('[Admin] Xóa sản phẩm')
      .addStringOption(o => o.setName('name').setDescription('Tên sản phẩm').setRequired(true))
    )
    .addSubcommand(s => s.setName('edit').setDescription('[Admin] Chỉnh sửa sản phẩm')
      .addStringOption(o => o.setName('category').setDescription('Danh mục sản phẩm').setRequired(true).addChoices(
        { name: '📦 Vật phẩm', value: 'GENERAL' },
        { name: '💍 Nhẫn cưới', value: 'RING' },
      ))
      .addIntegerOption(o => o.setName('id').setDescription('ID sản phẩm (Số thứ tự hiển thị trong /shop list)').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('name').setDescription('Tên mới cho sản phẩm'))
      .addIntegerOption(o => o.setName('price').setDescription('Giá mới'))
      .addIntegerOption(o => o.setName('stock').setDescription('Số lượng mới (0 = không giới hạn)'))
      .addBooleanOption(o => o.setName('enabled').setDescription('Bật/Tắt'))
      .addStringOption(o => o.setName('image').setDescription('URL hình ảnh mới (hoặc "none" để xóa)'))
      .addAttachmentOption(o => o.setName('file').setDescription('Tải lên ảnh mới từ máy (tùy chọn)'))
      .addStringOption(o => o.setName('description').setDescription('Mô tả/Giới thiệu sản phẩm mới (hoặc "none" để xóa)'))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji tùy chỉnh hiển thị bên trái tên (hoặc "none" để xóa)'))
    )
    .addSubcommand(s => s.setName('give').setDescription('[Admin] Tặng vật phẩm từ cửa hàng cho người dùng')
      .addStringOption(o => o.setName('category').setDescription('Danh mục sản phẩm').setRequired(true).addChoices(
        { name: '📦 Vật phẩm', value: 'GENERAL' },
        { name: '💍 Nhẫn cưới', value: 'RING' },
      ))
      .addIntegerOption(o => o.setName('id').setDescription('ID sản phẩm (Số thứ tự hiển thị trong /shop list)').setRequired(true).setMinValue(1))
      .addUserOption(o => o.setName('user').setDescription('Người nhận').setRequired(true))
      .addIntegerOption(o => o.setName('quantity').setDescription('Số lượng muốn tặng (mặc định: 1)').setMinValue(1))
    );

  async execute(interaction: any, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const isEphemeral = sub !== 'list';
    await interaction.deferReply({ ephemeral: isEphemeral });

    const guildId = interaction.guildId!;
    await ensureGuild(guildId, interaction.guild!.name);
    await seedDefaultRings(kernel, guildId);

    // ─── LIST ────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const category = interaction.options.getString('category') ?? 'GENERAL';

      const items = await kernel.db.shopItem.findMany({
        where: { guildId, enabled: true, category },
        orderBy: { price: 'asc' },
      });
      sortCustomLast(items, category);

      if (!items.length) {
        return void interaction.editReply({
          content: `🏪 Cửa hàng danh mục **${category === 'RING' ? 'Nhẫn Cưới' : 'Vật Phẩm'}** hiện đang trống.`,
        });
      }

      const categoryTitle = category === 'RING' ? '💍 Cửa Hàng Nhẫn Cưới' : '📦 Cửa Hàng Vật Phẩm';
      const embed = new EmbedBuilder()
        .setColor(0xff7bb5)
        .setTitle(`${categoryTitle} — ${interaction.guild!.name}`)
        .setDescription('Chọn sản phẩm dưới thanh menu để xem chi tiết và mua hoặc dùng `/shop buy <category> <id>`!');

      const listLines = items.map((item, idx) => {
        const idStr = String(idx + 1).padStart(2, '0');
        const emoji = item.emoji || TYPE_EMOJI[item.type] || '🛒';
        const priceStr = `${item.price.toLocaleString()} ${item.currency === 'VND' ? 'VNĐ' : 'coins'}`;
        const stockStr = item.stock !== null ? `${item.stock}` : 'Vô hạn';
        return `**#${idStr}** ${emoji} **${item.name}**\n` +
               `• Giá: **${priceStr}** | Kho: *${stockStr}*\n` +
               `• Giới thiệu: *${item.description || 'Không có mô tả.'}*\n`;
      });

      const chunks = [];
      let currentChunk = '';
      for (const line of listLines) {
        if (currentChunk.length + line.length > 2000) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          currentChunk += line + '\n';
        }
      }
      if (currentChunk) chunks.push(currentChunk);

      chunks.forEach((chunk, i) => {
        embed.addFields({ name: i === 0 ? 'Danh Sách Sản Phẩm' : 'Tiếp theo', value: chunk });
      });

      // Select menu
      const selectOptions = items.slice(0, 25).map((item, idx) => {
        const idStr = String(idx + 1).padStart(2, '0');
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(`#${idStr} ${item.name}`)
          .setDescription(`💰 ${item.price.toLocaleString()} ${item.currency === 'VND' ? 'VNĐ' : 'coins'}`)
          .setValue(`shop_item:${item.id}`);

        const emojiVal = item.emoji || TYPE_EMOJI[item.type] || '🛒';
        try {
          option.setEmoji(emojiVal);
        } catch {
          option.setEmoji('🛒');
        }
        return option;
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('shop:detail')
        .setPlaceholder('🔍 Chọn sản phẩm để xem chi tiết...')
        .addOptions(selectOptions);

      const rowMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.editReply({
        embeds: [embed],
        components: [rowMenu]
      });

    // ─── BUY ─────────────────────────────────────────────────────────────────
    } else if (sub === 'buy') {
      const category = interaction.options.getString('category', true);
      const itemIndex = interaction.options.getInteger('id', true); // 1-based

      const allItems = await kernel.db.shopItem.findMany({
        where: { guildId, enabled: true, category },
        orderBy: { price: 'asc' },
      });
      sortCustomLast(allItems, category);

      const item = allItems[itemIndex - 1];
      if (!item) {
        return void interaction.editReply(
          `❌ Không tìm thấy sản phẩm **#${String(itemIndex).padStart(2, '0')}** trong danh mục này. Dùng \`/shop list\` để xem danh sách.`
        );
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
          `❌ Không đủ tiền! Cần **${requiredStr}**, bạn hiện có **${balanceStr}**.`
        );
      }

      const newBalance = balanceValue - item.price;

      // Deduct balance
      await kernel.db.guildMember.update({
        where: { guildId_userId: { guildId, userId: interaction.user.id } },
        data: isVnd ? { vnd: { decrement: item.price } } : { balance: { decrement: item.price } },
      });

      log.info(`[SHOP_BUY] User ${interaction.user.id} (${interaction.user.username}) bought item ${item.name} (${item.id}) in guild ${guildId}. Price: ${item.price} ${item.currency}. Pre-balance: ${balanceValue}, Post-balance: ${newBalance}`, { module: 'economy' });

      if (isVnd) {
        const txId = SpecialLogger.generateTxId('BUY');
        await SpecialLogger.logVnd(
          kernel,
          guildId,
          interaction.user.id,
          interaction.user.username,
          'SHOP_BUY',
          item.price,
          txId,
          `Mua vật phẩm "${item.name}" (ID sản phẩm: #${itemIndex}) từ Cửa Hàng. Số dư mới: ${newBalance.toLocaleString()} VNĐ.`
        );
      }

      // Reduce stock
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

      // Add to inventory
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
        const discordMember = interaction.guild!.members.cache.get(interaction.user.id);
        await discordMember?.roles.add(item.roleId).catch(() => {});
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

      await interaction.editReply({ embeds: [embed] });
      kernel.eventBus.emit('economy:transaction', { guildId, userId: interaction.user.id, type: 'SHOP_BUY', amount: item.price });

    // ─── ADD ─────────────────────────────────────────────────────────────────
    } else if (sub === 'add') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return void interaction.editReply({ content: '❌ Cần quyền Manage Server.' });
      }
      const name = interaction.options.getString('name', true);
      const price = interaction.options.getInteger('price', true);
      const type = interaction.options.getString('type', true);
      const category = interaction.options.getString('category') ?? 'GENERAL';
      const currency = interaction.options.getString('currency') ?? 'ECO';
       const role = interaction.options.getRole('role');
      const description = interaction.options.getString('description');
      const stockOpt = interaction.options.getInteger('stock');
      const stock = (stockOpt && stockOpt > 0) ? stockOpt : null;
      const imageString = interaction.options.getString('image');
      const imageFile = interaction.options.getAttachment('file');
      const imageUrl = imageFile ? imageFile.url : imageString;
      const emoji = interaction.options.getString('emoji');

      const existing = await kernel.db.shopItem.findFirst({ where: { guildId, name } });
      if (existing) return void interaction.editReply({ content: `❌ Sản phẩm **${name}** đã tồn tại.` });

      await kernel.db.shopItem.create({
        data: { guildId, name, price, type, category, currency, roleId: role?.id ?? null, description: description ?? null, stock, imageUrl, emoji },
      });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Thêm Sản Phẩm Thành Công')
        .addFields(
          { name: '🏷️ Tên', value: name, inline: true },
          { name: '💰 Giá', value: `${price.toLocaleString()} ${currency === 'VND' ? 'VNĐ' : 'coins'}`, inline: true },
          { name: '🗂️ Danh mục', value: category === 'RING' ? 'Nhẫn cưới' : 'Vật phẩm', inline: true },
          { name: '📦 Kho hàng', value: stock ? `${stock}` : '∞ Không giới hạn', inline: true },
        );

      if (imageUrl) embed.setImage(imageUrl);

      await interaction.editReply({ embeds: [embed] });

    // ─── REMOVE ──────────────────────────────────────────────────────────────
    } else if (sub === 'remove') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return void interaction.editReply({ content: '❌ Cần quyền Manage Server.' });
      }
      const name = interaction.options.getString('name', true);
      const item = await kernel.db.shopItem.findFirst({ where: { guildId, name } });
      if (!item) return void interaction.editReply({ content: `❌ Sản phẩm **${name}** không tồn tại.` });
      await kernel.db.shopItem.delete({ where: { id: item.id } });
      await interaction.editReply({ content: `✅ Đã xóa sản phẩm **${name}**.` });

    // ─── EDIT ────────────────────────────────────────────────────────────────
    } else if (sub === 'edit') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return void interaction.editReply({ content: '❌ Cần quyền Manage Server.' });
      }
      const category = interaction.options.getString('category', true);
      const itemIndex = interaction.options.getInteger('id', true); // 1-based

      const itemsInCat = await kernel.db.shopItem.findMany({
        where: { guildId, category },
        orderBy: { price: 'asc' },
      });
      sortCustomLast(itemsInCat, category);

      const item = itemsInCat[itemIndex - 1];
      if (!item) {
        return void interaction.editReply({ content: `❌ Không tìm thấy sản phẩm số **#${String(itemIndex).padStart(2, '0')}** trong danh mục **${category === 'RING' ? 'Nhẫn cưới' : 'Vật phẩm'}**.` });
      }

      const newName = interaction.options.getString('name');
      const price = interaction.options.getInteger('price');
      const stockOpt = interaction.options.getInteger('stock');
      const enabled = interaction.options.getBoolean('enabled');
      const imageString = interaction.options.getString('image');
      const imageFile = interaction.options.getAttachment('file');
      const image = imageFile ? imageFile.url : imageString;
      const description = interaction.options.getString('description');
      const emoji = interaction.options.getString('emoji');

      const updates: any = {};
      if (newName) {
        const existing = await kernel.db.shopItem.findFirst({
          where: {
            guildId,
            name: newName,
            NOT: { id: item.id }
          }
        });
        if (existing) {
          return void interaction.editReply({ content: `❌ Tên sản phẩm **${newName}** đã tồn tại ở sản phẩm khác.` });
        }
        updates.name = newName;
      }
      if (price !== null) updates.price = price;
      if (stockOpt !== null) updates.stock = stockOpt > 0 ? stockOpt : null;
      if (enabled !== null) updates.enabled = enabled;
      if (image !== null) updates.imageUrl = image === 'none' ? null : image;
      if (description !== null) updates.description = description === 'none' ? null : description;
      if (emoji !== null) updates.emoji = emoji === 'none' ? null : emoji;

      await kernel.db.shopItem.update({ where: { id: item.id }, data: updates });
      await interaction.editReply({ content: `✅ Đã cập nhật sản phẩm **${updates.name || item.name}** (ID: #${String(itemIndex).padStart(2, '0')}).` });

    // ─── GIVE ────────────────────────────────────────────────────────────────
    } else if (sub === 'give') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return void interaction.editReply({ content: '❌ Cần quyền Manage Server.' });
      }
      const category = interaction.options.getString('category', true);
      const itemIndex = interaction.options.getInteger('id', true); // 1-based
      const targetUser = interaction.options.getUser('user', true);
      const quantity = interaction.options.getInteger('quantity') ?? 1;

      if (targetUser.bot) {
        return void interaction.editReply({ content: '❌ Không thể tặng vật phẩm cho bot.' });
      }
      if (quantity <= 0) {
        return void interaction.editReply({ content: '❌ Số lượng tặng phải lớn hơn 0.' });
      }

      const itemsInCat = await kernel.db.shopItem.findMany({
        where: { guildId, category, enabled: true },
        orderBy: { price: 'asc' },
      });
      sortCustomLast(itemsInCat, category);

      const item = itemsInCat[itemIndex - 1];
      if (!item) {
        return void interaction.editReply({ content: `❌ Không tìm thấy sản phẩm số **#${String(itemIndex).padStart(2, '0')}** trong danh mục **${category === 'RING' ? 'Nhẫn cưới' : 'Vật phẩm'}**.` });
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

      const itemEmoji = item.emoji || (category === 'RING' ? '💍' : '📦');

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🎁 Tặng Vật Phẩm Từ Shop (Admin)')
        .setDescription(`Admin đã chuyển trực tiếp vật phẩm từ cửa hàng vào kho đồ của người dùng!`)
        .addFields(
          { name: '👤 Người nhận', value: `<@${targetUser.id}>`, inline: true },
          { name: '📦 Vật phẩm', value: `${itemEmoji} **${item.name}** (x${quantity})`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}
