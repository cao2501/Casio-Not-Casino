import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { CardDrawer, Card } from '../../../core/ui/CardDrawer';

export default class RandomCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('random')
    .setDescription('🎲 Lệnh ngẫu nhiên số hoặc lá bài')
    .addSubcommand(sub =>
      sub
        .setName('number')
        .setDescription('🔢 Tạo số ngẫu nhiên trong khoảng')
        .addIntegerOption(opt => opt.setName('min').setDescription('Số nhỏ nhất (mặc định: 1)').setRequired(false))
        .addIntegerOption(opt => opt.setName('max').setDescription('Số lớn nhất (mặc định: 100)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('card')
        .setDescription('🃏 Rút lá bài ngẫu nhiên')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Số lượng lá bài (1-5 lá, mặc định: 1)').setRequired(false).setMinValue(1).setMaxValue(5))
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    if (sub === 'number') {
      const min = interaction.options.getInteger('min') ?? 1;
      const max = interaction.options.getInteger('max') ?? 100;

      if (min > max) {
        return void interaction.editReply({ content: '❌ Số nhỏ nhất không được lớn hơn số lớn nhất!' });
      }

      const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;

      const embed = new EmbedBuilder()
        .setTitle('🔢 Kết Quả Số Ngẫu Nhiên')
        .setColor(0xF6C453)
        .setDescription(`Khoảng: **${min.toLocaleString()}** đến **${max.toLocaleString()}**\n\n🎯 Số ngẫu nhiên của bạn là: **${randomNum.toLocaleString()}**`)
        .setTimestamp()
        .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}` });

      return void interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'card') {
      const amount = interaction.options.getInteger('amount') ?? 1;

      // Card decks values and suits
      const suits: Card['suit'][] = ['H', 'D', 'C', 'S'];
      const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

      const drawnCards: Card[] = [];
      for (let i = 0; i < amount; i++) {
        const randomSuit = suits[Math.floor(Math.random() * suits.length)];
        const randomValue = values[Math.floor(Math.random() * values.length)];
        drawnCards.push({ suit: randomSuit, value: randomValue });
      }

      // Khởi tạo trạng thái lật bài (tất cả ban đầu đều úp)
      const flippedStates = new Array(amount).fill(false);

      const suitsVi: Record<Card['suit'], string> = {
        H: 'Cơ ♥',
        D: 'Rô ♦',
        C: 'Chuồn ♣',
        S: 'Bích ♠',
      };

      // Helper tạo chuỗi mô tả bài
      const getCardListText = (): string => {
        return drawnCards
          .map((c, idx) => {
            if (flippedStates[idx]) {
              return `**${c.value}** ${suitsVi[c.suit]}`;
            }
            return `\`[Úp 🔒]\``;
          })
          .join(', ');
      };

      // Helper vẽ bài
      const getAttachment = async (): Promise<AttachmentBuilder> => {
        const buffer = await CardDrawer.drawRandomCards(drawnCards, flippedStates);
        // Thêm timestamp vào tên tệp để ép Discord bypass cache hiển thị ảnh cũ
        return new AttachmentBuilder(buffer, { name: `random_cards_${Date.now()}.png` });
      };

      let currentAttach = await getAttachment();

      const getButtons = () => {
        const allFlipped = flippedStates.every(v => v === true);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('rnd:draw')
            .setLabel('Rút 1 lá (Draw)')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕')
            .setDisabled(allFlipped),
          new ButtonBuilder()
            .setCustomId('rnd:reveal')
            .setLabel('Mở tất cả (Reveal)')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👁️')
            .setDisabled(allFlipped)
        );
        return [row];
      };

      const getEmbed = (fileName: string) => {
        const allFlipped = flippedStates.every(v => v === true);
        const countFlipped = flippedStates.filter(v => v === true).length;
        
        let desc = `Bạn đã chọn rút **${amount}** lá bài.\n\n`;
        if (allFlipped) {
          desc += `🎉 Đã lật ngửa toàn bộ số bài:\n👉 ${getCardListText()}`;
        } else {
          desc += `👉 Đã lật (${countFlipped}/${amount} lá):\n👉 ${getCardListText()}\n\n*Bấm nút bên dưới để rút/lật lá bài tiếp theo!*`;
        }

        return new EmbedBuilder()
          .setTitle('🃏 Rút Bài Ngẫu Nhiên (Interactive)')
          .setColor(0x155e37)
          .setDescription(desc)
          .setImage(`attachment://${fileName}`)
          .setTimestamp()
          .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}` });
      };

      const msg = await interaction.editReply({
        embeds: [getEmbed(currentAttach.name!)],
        files: [currentAttach],
        components: getButtons()
      });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        idle: 60000
      });

      collector.on('collect', async i => {
        await i.deferUpdate();

        if (i.customId === 'rnd:draw') {
          // Lật lá tiếp theo từ trái sang phải
          const nextIdx = flippedStates.indexOf(false);
          if (nextIdx !== -1) {
            flippedStates[nextIdx] = true;
          }
        } else if (i.customId === 'rnd:reveal') {
          // Lật tất cả các lá
          flippedStates.fill(true);
        }

        // Kiểm tra xem đã lật hết chưa để dừng collector
        const allFlipped = flippedStates.every(v => v === true);
        if (allFlipped) {
          collector.stop('all_flipped');
          return;
        }

        // Cập nhật lại giao diện
        currentAttach = await getAttachment();
        await interaction.editReply({
          embeds: [getEmbed(currentAttach.name!)],
          files: [currentAttach],
          components: getButtons()
        });
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'idle' || reason === 'time') {
          // Giữ nguyên trạng thái lúc hết giờ
        } else {
          flippedStates.fill(true);
        }

        currentAttach = await getAttachment();
        await interaction.editReply({
          embeds: [getEmbed(currentAttach.name!)],
          files: [currentAttach],
          components: [] // Xóa bỏ các nút bấm
        });
      });
      return;
    }
  }
}
