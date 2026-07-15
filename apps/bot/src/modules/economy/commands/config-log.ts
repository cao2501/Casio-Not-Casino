import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';

export default class ConfigLogCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('config-log')
    .setDescription('⚙️ Cài đặt kênh gửi nhật ký giao dịch VND của máy chủ')
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Kênh văn bản muốn nhận nhật ký log VND')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const guildId = interaction.guildId!;
    const channel = interaction.options.getChannel('channel', true);

    await interaction.deferReply({ ephemeral: true });

    // Cập nhật cấu hình kênh log trong cơ sở dữ liệu
    await kernel.db.logChannel.upsert({
      where: {
        guildId_eventType: {
          guildId,
          eventType: 'VND_TRANSACTION'
        }
      },
      update: {
        channelId: channel.id,
        enabled: true
      },
      create: {
        guildId,
        eventType: 'VND_TRANSACTION',
        channelId: channel.id,
        enabled: true
      }
    });

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Cấu Hình Kênh Nhật Ký VND')
      .setColor(0x57F287)
      .setDescription(`✅ Đã thiết lập kênh nhận log giao dịch VND thành công!\n\n📍 Kênh log: <#${channel.id}>\n\n*Từ bây giờ, tất cả giao dịch nạp tiền, rút tiền, thắng/thua game bằng VNĐ sẽ được tự động gửi thông báo chi tiết vào kênh này.*`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
