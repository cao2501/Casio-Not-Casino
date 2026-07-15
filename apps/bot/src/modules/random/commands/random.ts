import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } from 'discord.js';
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

      // Draw the cards on canvas
      const buffer = await CardDrawer.drawRandomCards(drawnCards);
      const attachment = new AttachmentBuilder(buffer, { name: 'random_cards.png' });

      const suitsVi: Record<Card['suit'], string> = {
        H: 'Cơ ♥',
        D: 'Rô ♦',
        C: 'Chuồn ♣',
        S: 'Bích ♠',
      };
      
      const cardList = drawnCards.map(c => `**${c.value}** ${suitsVi[c.suit]}`).join(', ');

      const embed = new EmbedBuilder()
        .setTitle('🃏 Kết Quả Rút Bài Ngẫu Nhiên')
        .setColor(0x155e37)
        .setDescription(`Bạn đã rút được **${amount}** lá bài:\n👉 ${cardList}`)
        .setImage('attachment://random_cards.png')
        .setTimestamp()
        .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}` });

      return void interaction.editReply({ embeds: [embed], files: [attachment] });
    }
  }
}
