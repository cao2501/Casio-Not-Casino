import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { getModuleConfig, setModuleConfig } from '../../../database/helpers';

export default class TienCuocCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('tiencuoc')
    .setDescription('⚙️ Cài đặt loại tiền cược cá nhân cho các trò chơi')
    .addStringOption(opt =>
      opt
        .setName('set')
        .setDescription('Chọn loại tiền cược bạn muốn sử dụng')
        .setRequired(true)
        .addChoices(
          { name: 'Coins (Mặc định)', value: 'COIN' },
          { name: 'VNĐ (Tiền mặt)', value: 'VND' }
        )
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const choice = interaction.options.getString('set', true) as 'COIN' | 'VND';

    await interaction.deferReply({ ephemeral: true });

    // Lấy cấu hình casino_user_prefs hiện tại của server
    const { config } = await getModuleConfig<Record<string, 'COIN' | 'VND'>>(guildId, 'casino_user_prefs');
    
    // Cập nhật tùy chỉnh của người dùng
    const updatedPrefs = { ...config, [userId]: choice };
    await setModuleConfig(guildId, 'casino_user_prefs', updatedPrefs);

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Cài Đặt Tiền Cược Cá Nhân')
      .setColor(0x57F287)
      .setDescription(`✅ Đã thay đổi loại tiền cược mặc định của bạn thành: **${choice === 'VND' ? 'VNĐ (Tiền mặt)' : 'Coins'}**.\n\n*Từ bây giờ, các game Blackjack và Poker sẽ tự động sử dụng loại tiền này.*`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
