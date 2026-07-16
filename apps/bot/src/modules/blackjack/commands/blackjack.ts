import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureMember, getModuleConfig, getGameConfig } from '../../../database/helpers';
import { CardDrawer, Card } from '../../../core/ui/CardDrawer';
import { SpecialLogger } from '../../../core/logger/SpecialLogger';

export default class BlackjackCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 Chơi game bài Blackjack (Xì Dách) đấu với Bot')
    .addIntegerOption(opt =>
      opt
        .setName('bet')
        .setDescription('Số tiền đặt cược')
        .setRequired(true)
        .setMinValue(1)
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const bet = interaction.options.getInteger('bet', true);

    await interaction.deferReply();

    const activeLock = kernel.cache.get(`active_game:${userId}`);
    if (activeLock) {
      const lockTime = typeof activeLock === 'number' ? activeLock : 0;
      if (Date.now() - lockTime > 120000) {
        kernel.cache.del(`active_game:${userId}`);
      } else {
        const remainingSec = Math.ceil((120000 - (Date.now() - lockTime)) / 1000);
        return void interaction.editReply({ content: `❌ Bạn đang ở trong một phiên chơi khác chưa hoàn thành! Vui lòng hoàn thành ván đó hoặc đợi **${remainingSec}** giây để phiên cũ tự hủy.` });
      }
    }

    // Lấy cấu hình tiền cược cá nhân của user
    const { config } = await getModuleConfig<Record<string, 'COIN' | 'VND'>>(guildId, 'casino_user_prefs');
    const currency = config[userId] ?? 'COIN';

    // Đọc cấu hình game global từ dashboard
    const gameConfig = await getGameConfig();

    // Kiểm tra min/max bet
    if (bet < gameConfig.blackjack.minBet || bet > gameConfig.blackjack.maxBet) {
      const formattedMin = currency === 'VND' ? `${gameConfig.blackjack.minBet.toLocaleString('vi-VN')} ₫` : `${gameConfig.blackjack.minBet.toLocaleString()} Coins`;
      const formattedMax = currency === 'VND' ? `${gameConfig.blackjack.maxBet.toLocaleString('vi-VN')} ₫` : `${gameConfig.blackjack.maxBet.toLocaleString()} Coins`;
      return void interaction.editReply({
        content: `❌ Tiền cược không hợp lệ! Mức cược cho phép từ **${formattedMin}** đến **${formattedMax}**.`
      });
    }

    // 1. Kiểm tra tài khoản người dùng
    await ensureMember(guildId, userId);
    const member = await kernel.db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } }
    });

    if (!member) {
      return void interaction.editReply({ content: '❌ Không tìm thấy thông tin tài khoản của bạn.' });
    }

    const balance = currency === 'VND' ? member.vnd : member.balance;
    if (balance < bet) {
      const formattedBalance = currency === 'VND' 
        ? `${balance.toLocaleString('vi-VN')} ₫` 
        : `${balance.toLocaleString()} Coins`;
      return void interaction.editReply({
        content: `❌ Bạn không đủ số dư để đặt cược!\nSố dư hiện tại: **${formattedBalance}**`
      });
    }

    // Kích hoạt khóa phòng chơi sau khi kiểm tra số dư thành công
    kernel.cache.set(`active_game:${userId}`, Date.now(), 1800);

    // Biến để lưu trữ tiền cược hiện tại (có thể tăng lên khi Double)
    let currentBet = bet;

    // Helper trừ/cộng tiền
    const updateBalance = async (amount: number, isWin: boolean) => {
      const dataUpdate = currency === 'VND'
        ? { vnd: isWin ? { increment: amount } : { decrement: amount } }
        : { balance: isWin ? { increment: amount } : { decrement: amount } };
      
      const nextMember = await kernel.db.guildMember.update({
        where: { guildId_userId: { guildId, userId } },
        data: dataUpdate
      });

      if (currency === 'VND') {
        const txId = SpecialLogger.generateTxId(isWin ? 'BUY' : 'PAY');
        const action = isWin ? 'CASINO_WIN' : 'CASINO_LOSE';
        const details = isWin
          ? `Thắng Blackjack. Nhận +${amount.toLocaleString('vi-VN')} VNĐ. Số dư mới: ${nextMember.vnd.toLocaleString('vi-VN')} VNĐ.`
          : `Cược Blackjack. Bị trừ -${amount.toLocaleString('vi-VN')} VNĐ. Số dư mới: ${nextMember.vnd.toLocaleString('vi-VN')} VNĐ.`;
        await SpecialLogger.logVnd(kernel, guildId, userId, interaction.user.username, action, amount, txId, details);
      }
    };

    // Khởi đầu game: khấu trừ tiền cược trước để tránh trốn game
    await updateBalance(currentBet, false);

    // 2. Thiết lập bài tây & xáo bài
    const createDeck = (): Card[] => {
      const suits: Card['suit'][] = ['H', 'D', 'C', 'S'];
      const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      const deck: Card[] = [];
      for (const s of suits) {
        for (const v of values) {
          deck.push({ suit: s, value: v });
        }
      }
      return deck;
    };

    const shuffle = (deck: Card[]): Card[] => {
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      return deck;
    };

    const calculateScore = (cards: Card[]): number => {
      let score = 0;
      let aces = 0;
      for (const card of cards) {
        if (card.value === 'A') {
          aces += 1;
          score += 11;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
          score += 10;
        } else {
          score += parseInt(card.value);
        }
      }
      while (score > 21 && aces > 0) {
        score -= 10;
        aces -= 1;
      }
      return score;
    };

    let deck = shuffle(createDeck());
    let playerHand: Card[] = [deck.pop()!, deck.pop()!];
    let dealerHand: Card[] = [deck.pop()!, deck.pop()!];

    let playerScore = calculateScore(playerHand);
    let dealerScore = calculateScore(dealerHand);

    // Kiểm tra Xì Bàn & Xì Dách ngay từ đầu
    enum InitialCombo {
      NORMAL = 0,
      XI_DACH = 1,
      XI_BAN = 2
    }

    const getInitialCombo = (hand: Card[]): InitialCombo => {
      if (hand.length !== 2) return InitialCombo.NORMAL;
      const aceCount = hand.filter(c => c.value === 'A').length;
      if (aceCount === 2) return InitialCombo.XI_BAN;
      const hasAce = hand.some(c => c.value === 'A');
      const has10Card = hand.some(c => ['10', 'J', 'Q', 'K'].includes(c.value));
      if (hasAce && has10Card) return InitialCombo.XI_DACH;
      return InitialCombo.NORMAL;
    };

    const playerCombo = getInitialCombo(playerHand);
    const dealerCombo = getInitialCombo(dealerHand);

    if (playerCombo !== InitialCombo.NORMAL || dealerCombo !== InitialCombo.NORMAL) {
      let outcome = '';
      let winColor = 0xF6C453;
      let wonAmount = 0;

      if (playerCombo > dealerCombo) {
        const comboName = playerCombo === InitialCombo.XI_BAN ? 'Xì Bàn (Đôi AA)' : 'Xì Dách';
        outcome = `THẮNG (${comboName.toUpperCase()}!)`;
        winColor = 0x57F287; // Xanh
        const multiplier = playerCombo === InitialCombo.XI_BAN ? 3 : 2.5; // Xì bàn ăn gấp 2, Xì Dách ăn gấp 1.5
        wonAmount = Math.floor(currentBet * multiplier);
        await updateBalance(wonAmount, true);
      } else if (dealerCombo > playerCombo) {
        const comboName = dealerCombo === InitialCombo.XI_BAN ? 'Xì Bàn (Đôi AA)' : 'Xì Dách';
        outcome = `THUA (CÁI ${comboName.toUpperCase()})`;
        winColor = 0xED4245; // Đỏ
      } else {
        const comboName = playerCombo === InitialCombo.XI_BAN ? 'Xì Bàn (Đôi AA)' : 'Xì Dách';
        outcome = `HÒA (CẢ HAI CÙNG ${comboName.toUpperCase()})`;
        winColor = 0x5865F2;
        await updateBalance(currentBet, true); // hoàn tiền
      }

      const buffer = await CardDrawer.drawBlackjackTable(
        playerHand,
        dealerHand,
        playerScore,
        dealerScore,
        currentBet,
        currency,
        outcome,
        false
      );

      const attachment = new AttachmentBuilder(buffer, { name: 'blackjack.png' });
      const embed = new EmbedBuilder()
        .setTitle('🃏 Kết Quả Blackjack')
        .setColor(winColor)
        .setDescription(`Trò chơi kết thúc ngay lập tức!\n👉 Kết quả: **${outcome}**`)
        .setImage('attachment://blackjack.png')
        .setTimestamp();

      kernel.cache.del(`active_game:${userId}`);
      return void interaction.editReply({ embeds: [embed], files: [attachment] });
    }

    // 3. Render bàn chơi ban đầu
    const getTableBuffer = async (outcome?: string, isOngoing = true) => {
      return CardDrawer.drawBlackjackTable(
        playerHand,
        dealerHand,
        playerScore,
        dealerScore,
        currentBet,
        currency,
        outcome,
        isOngoing
      );
    };

    let buffer = await getTableBuffer();
    let attachment = new AttachmentBuilder(buffer, { name: 'blackjack.png' });

    // Tạo các nút hành động
    const getButtons = (canDouble: boolean) => {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('bj:hit').setLabel('Rút bài (Hit)').setStyle(ButtonStyle.Primary).setEmoji('➕').setDisabled(playerHand.length >= 5),
        new ButtonBuilder().setCustomId('bj:stand').setLabel('Dừng (Stand)').setStyle(ButtonStyle.Success).setEmoji('✋')
      );
      if (canDouble && playerHand.length < 5) {
        row.addComponents(
          new ButtonBuilder().setCustomId('bj:double').setLabel('Gấp đôi (Double)').setStyle(ButtonStyle.Danger).setEmoji('💰')
        );
      }
      return [row];
    };

    // Kiểm tra xem người chơi còn đủ tiền để Double Down hay không
    // Cần lấy lại số dư thực tế sau khi đã bị trừ lượt cược đầu tiên
    const checkCanDouble = async (): Promise<boolean> => {
      const currentMember = await kernel.db.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });
      if (!currentMember) return false;
      const currentBalance = currency === 'VND' ? currentMember.vnd : currentMember.balance;
      return currentBalance >= bet;
    };

    let canDouble = await checkCanDouble();
    let buttons = getButtons(canDouble);

    const mainEmbed = new EmbedBuilder()
      .setTitle('🃏 Blackjack Table')
      .setColor(0xF6C453)
      .setDescription(`Hãy chọn hành động của bạn. Tiền cược: **${currency === 'VND' ? `${currentBet.toLocaleString('vi-VN')} ₫` : `${currentBet.toLocaleString()} Coins`}**`)
      .setImage('attachment://blackjack.png')
      .setTimestamp();

    const msg = await interaction.editReply({
      embeds: [mainEmbed],
      files: [attachment],
      components: buttons
    });

    // 4. Tạo collector để lắng nghe tương tác nút nhấn
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: i => i.user.id === userId,
      idle: 60000
    });

    let gameEnded = false;

    collector.on('collect', async i => {
      if (gameEnded) return;
      await i.deferUpdate();

      if (i.customId === 'bj:hit') {
        playerHand.push(deck.pop()!);
        playerScore = calculateScore(playerHand);

        if (playerScore > 21) {
          // BUST! Thua ngay lập tức
          gameEnded = true;
          collector.stop('bust');
          return;
        }

        if (playerHand.length >= 5) {
          // Rút đủ 5 lá -> Ngũ Linh tự động Stand
          gameEnded = true;
          collector.stop('stand');
          return;
        }

        // Cập nhật giao diện
        buffer = await getTableBuffer();
        attachment = new AttachmentBuilder(buffer, { name: 'blackjack.png' });
        // Không cho phép Double sau khi đã rút ít nhất 1 lá
        buttons = getButtons(false);

        await interaction.editReply({
          files: [attachment],
          components: buttons
        });
      } else if (i.customId === 'bj:double') {
        // Gấp đôi tiền cược
        await updateBalance(bet, false); // Trừ tiếp lượng cược thứ 2
        currentBet += bet;

        playerHand.push(deck.pop()!);
        playerScore = calculateScore(playerHand);

        gameEnded = true;
        collector.stop('double');
      } else if (i.customId === 'bj:stand') {
        gameEnded = true;
        collector.stop('stand');
      }
    });

    collector.on('end', async (_, reason) => {
      // 5. Lượt của Dealer và tính toán kết quả cuối cùng
      if ((reason === 'time' || reason === 'idle') && !gameEnded) {
        // Hết giờ tự động dừng bài (Stand)
        gameEnded = true;
      }

      // Dealer rút bài khi người chơi không bị bust và điểm Dealer < 17 (tối đa 5 lá)
      if (playerScore <= 21) {
        const isBiased = Math.random() < gameConfig.blackjack.botWinRate;
        while (dealerScore < 17 && dealerHand.length < 5) {
          if (isBiased) {
            let bestCardIndex = -1;
            for (let i = deck.length - 1; i >= 0; i--) {
              const testHand = [...dealerHand, deck[i]];
              const testScore = calculateScore(testHand);
              if (testScore <= 21) {
                if (testScore > playerScore) {
                  // Thắng luôn player, ưu tiên cao nhất
                  if (bestCardIndex === -1 || (21 - testScore) < (21 - calculateScore([...dealerHand, deck[bestCardIndex]]))) {
                    bestCardIndex = i;
                  }
                } else if (bestCardIndex === -1 && testScore >= 17) {
                  // Điểm an toàn >= 17
                  bestCardIndex = i;
                }
              }
            }
            if (bestCardIndex !== -1) {
              dealerHand.push(deck.splice(bestCardIndex, 1)[0]);
            } else {
              dealerHand.push(deck.pop()!);
            }
          } else {
            dealerHand.push(deck.pop()!);
          }
          dealerScore = calculateScore(dealerHand);
        }
      }

      // Đánh giá kết quả
      let outcome = '';
      let winColor = 0xF6C453;

      const playerNguLinh = playerHand.length === 5 && playerScore <= 21;
      const dealerNguLinh = dealerHand.length === 5 && dealerScore <= 21;

      if (playerNguLinh || dealerNguLinh) {
        if (playerNguLinh && dealerNguLinh) {
          if (playerScore < dealerScore) {
            outcome = `BẠN THẮNG! (Cả hai cùng Ngũ Linh nhưng bạn ít điểm hơn: ${playerScore} vs ${dealerScore})`;
            winColor = 0x57F287;
            await updateBalance(currentBet * 2, true);
          } else if (dealerScore < playerScore) {
            outcome = `BẠN THUA! (Cả hai cùng Ngũ Linh nhưng cái ít điểm hơn: ${dealerScore} vs ${playerScore})`;
            winColor = 0xED4245;
          } else {
            outcome = `HÒA! (Cả hai cùng Ngũ Linh với cùng ${playerScore} điểm)`;
            winColor = 0x5865F2;
            await updateBalance(currentBet, true);
          }
        } else if (playerNguLinh) {
          outcome = 'BẠN THẮNG (NGŨ LINH!)';
          winColor = 0x57F287;
          await updateBalance(currentBet * 2, true);
        } else {
          outcome = 'BẠN THUA (CÁI NGŨ LINH!)';
          winColor = 0xED4245;
        }
      } else if (playerScore > 21) {
        outcome = 'QUÁ 21 ĐIỂM (BUST! THUA)';
        winColor = 0xED4245; // Đỏ
      } else if (dealerScore > 21) {
        outcome = 'CÁI BUST! BẠN THẮNG';
        winColor = 0x57F287; // Xanh
        await updateBalance(currentBet * 2, true); // Nhận lại 2x tiền cược
      } else if (playerScore > dealerScore) {
        outcome = 'BẠN THẮNG!';
        winColor = 0x57F287;
        await updateBalance(currentBet * 2, true);
      } else if (playerScore < dealerScore) {
        outcome = 'BẠN THUA (ĐIỂM THẤP HƠN)';
        winColor = 0xED4245;
      } else {
        outcome = 'HÒA (PUSH)';
        winColor = 0x5865F2; // Blurple
        await updateBalance(currentBet, true); // Trả lại tiền cược
      }

      // Render lại giao diện kết thúc
      buffer = await CardDrawer.drawBlackjackTable(
        playerHand,
        dealerHand,
        playerScore,
        dealerScore,
        currentBet,
        currency,
        outcome,
        false // Dealer không còn úp bài nữa
      );

      attachment = new AttachmentBuilder(buffer, { name: 'blackjack.png' });
      const finalEmbed = new EmbedBuilder()
        .setTitle('🃏 Kết Quả Blackjack')
        .setColor(winColor)
        .setDescription(`Kết quả trò chơi: **${outcome}**\nTiền cược: **${currency === 'VND' ? `${currentBet.toLocaleString('vi-VN')} ₫` : `${currentBet.toLocaleString()} Coins`}**`)
        .setImage('attachment://blackjack.png')
        .setTimestamp();

      kernel.cache.del(`active_game:${userId}`);

      await interaction.editReply({
        embeds: [finalEmbed],
        files: [attachment],
        components: [] // Xóa toàn bộ nút
      });
    });
  }
}
