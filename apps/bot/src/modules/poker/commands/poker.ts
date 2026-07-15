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

interface EvaluatedHand {
  rank: number;
  rankName: string;
  score: number;
}

export default class PokerCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('poker')
    .setDescription('🎴 Chơi game Poker Texas Hold\'em 1v1 với Bot')
    .addIntegerOption(opt =>
      opt
        .setName('bet')
        .setDescription('Số tiền đặt cược ban đầu (Small Blind/Ante)')
        .setRequired(true)
        .setMinValue(1)
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const startingBet = interaction.options.getInteger('bet', true);

    await interaction.deferReply();

    const activeLock = kernel.cache.get(`active_game:${userId}`);
    if (activeLock) {
      return void interaction.editReply({ content: '❌ Bạn đang ở trong một phiên chơi khác chưa hoàn thành! Hãy hoàn thành ván đó trước.' });
    }

    // Lấy cấu hình tiền cược cá nhân của user
    const { config } = await getModuleConfig<Record<string, 'COIN' | 'VND'>>(guildId, 'casino_user_prefs');
    const currency = config[userId] ?? 'COIN';

    // Đọc cấu hình game global từ dashboard
    const gameConfig = await getGameConfig();

    // Kiểm tra min/max bet
    if (startingBet < gameConfig.poker.minBet || startingBet > gameConfig.poker.maxBet) {
      const formattedMin = currency === 'VND' ? `${gameConfig.poker.minBet.toLocaleString('vi-VN')} ₫` : `${gameConfig.poker.minBet.toLocaleString()} Coins`;
      const formattedMax = currency === 'VND' ? `${gameConfig.poker.maxBet.toLocaleString('vi-VN')} ₫` : `${gameConfig.poker.maxBet.toLocaleString()} Coins`;
      return void interaction.editReply({
        content: `❌ Tiền cược không hợp lệ! Mức cược cho phép từ **${formattedMin}** đến **${formattedMax}**.`
      });
    }

    // 1. Kiểm tra số dư người chơi
    await ensureMember(guildId, userId);
    const member = await kernel.db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } }
    });

    if (!member) {
      return void interaction.editReply({ content: '❌ Không tìm thấy thông tin tài khoản.' });
    }

    const balance = currency === 'VND' ? member.vnd : member.balance;
    if (balance < startingBet) {
      const formattedBalance = currency === 'VND' 
        ? `${balance.toLocaleString('vi-VN')} ₫` 
        : `${balance.toLocaleString()} Coins`;
      return void interaction.editReply({
        content: `❌ Bạn không đủ số dư để chơi Poker!\nSố dư hiện tại: **${formattedBalance}**`
      });
    }

    // Kích hoạt khóa phòng chơi sau khi kiểm tra số dư thành công
    kernel.cache.set(`active_game:${userId}`, true, 1800);

    // Tiền cược hiện tại của người chơi và của bot
    let playerTotalBet = startingBet;
    let botTotalBet = startingBet;
    let pot = playerTotalBet + botTotalBet;

    // Helper cập nhật tiền cược
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
          ? `Thắng Poker. Nhận +${amount.toLocaleString('vi-VN')} VNĐ. Số dư mới: ${nextMember.vnd.toLocaleString('vi-VN')} VNĐ.`
          : `Cược Poker. Bị trừ -${amount.toLocaleString('vi-VN')} VNĐ. Số dư mới: ${nextMember.vnd.toLocaleString('vi-VN')} VNĐ.`;
        await SpecialLogger.logVnd(kernel, guildId, userId, interaction.user.username, action, amount, txId, details);
      }
    };

    // Khấu trừ tiền cược ban đầu của người chơi
    await updateBalance(playerTotalBet, false);

    // 2. Các hàm bổ trợ bài Tây & Thuật toán so bài Poker (Texas Hold'em)
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

    const evaluate5CardHand = (cards: Card[]): EvaluatedHand => {
      const valuesMap: Record<string, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
      };

      const sorted = [...cards].sort((a, b) => valuesMap[b.value] - valuesMap[a.value]);
      const sortedVals = sorted.map(c => valuesMap[c.value]);
      const sortedSuits = sorted.map(c => c.suit);

      const isFlush = sortedSuits.every(s => s === sortedSuits[0]);

      let isStraight = false;
      let straightHigh = 0;

      const isNormalStraight = sortedVals.every((v, i) => i === 0 || v === sortedVals[i - 1] - 1);
      if (isNormalStraight) {
        isStraight = true;
        straightHigh = sortedVals[0];
      } else {
        if (sortedVals[0] === 14 && sortedVals[1] === 5 && sortedVals[2] === 4 && sortedVals[3] === 3 && sortedVals[4] === 2) {
          isStraight = true;
          straightHigh = 5;
        }
      }

      const counts: Record<number, number> = {};
      for (const val of sortedVals) {
        counts[val] = (counts[val] || 0) + 1;
      }

      const freq = Object.entries(counts).map(([val, count]) => ({
        val: parseInt(val),
        count
      })).sort((a, b) => b.count - a.count || b.val - a.val);

      const getTieBreaker = (vals: number[]) => {
        return vals.reduce((sum, v, i) => sum + v * Math.pow(15, 4 - i), 0);
      };

      if (isFlush && isStraight) {
        if (straightHigh === 14) {
          return { rank: 9, rankName: 'Thùng Phá Sảnh Lớn (Royal Flush)', score: 9000000 };
        }
        return { rank: 8, rankName: 'Thùng Phá Sảnh (Straight Flush)', score: 8000000 + straightHigh };
      }

      if (freq[0].count === 4) {
        return { rank: 7, rankName: 'Tứ Quý (Four of a Kind)', score: 7000000 + freq[0].val * 15 + freq[1].val };
      }

      if (freq[0].count === 3 && freq[1].count === 2) {
        return { rank: 6, rankName: 'Cù Lũ (Full House)', score: 6000000 + freq[0].val * 15 + freq[1].val };
      }

      if (isFlush) {
        return { rank: 5, rankName: 'Thùng (Flush)', score: 5000000 + getTieBreaker(sortedVals) };
      }

      if (isStraight) {
        return { rank: 4, rankName: 'Sảnh (Straight)', score: 4000000 + straightHigh };
      }

      if (freq[0].count === 3) {
        return { rank: 3, rankName: 'Sám Cô (Three of a Kind)', score: 3000000 + freq[0].val * 225 + freq[1].val * 15 + freq[2].val };
      }

      if (freq[0].count === 2 && freq[1].count === 2) {
        const pair1 = Math.max(freq[0].val, freq[1].val);
        const pair2 = Math.min(freq[0].val, freq[1].val);
        return { rank: 2, rankName: 'Hai Đôi (Two Pair)', score: 2000000 + pair1 * 225 + pair2 * 15 + freq[2].val };
      }

      if (freq[0].count === 2) {
        return { rank: 1, rankName: 'Một Đôi (One Pair)', score: 1000000 + freq[0].val * 3375 + freq[1].val * 225 + freq[2].val * 15 + freq[3].val };
      }

      return { rank: 0, rankName: 'Mậu Thầu (High Card)', score: getTieBreaker(sortedVals) };
    };

    const evaluate7CardHand = (cards: Card[]): EvaluatedHand => {
      let bestHand: EvaluatedHand | null = null;
      const combinations: Card[][] = [];
      const makeCombos = (temp: Card[], start: number) => {
        if (temp.length === 5) {
          combinations.push([...temp]);
          return;
        }
        for (let i = start; i < cards.length; i++) {
          temp.push(cards[i]);
          makeCombos(temp, i + 1);
          temp.pop();
        }
      };
      makeCombos([], 0);

      for (const combo of combinations) {
        const evalResult = evaluate5CardHand(combo);
        if (!bestHand || evalResult.score > bestHand.score) {
          bestHand = evalResult;
        }
      }
      return bestHand!;
    };

    // 3. Khởi tạo ván bài
    let deck = shuffle(createDeck());
    let playerHand: Card[] = [deck.pop()!, deck.pop()!];
    let botHand: Card[] = [deck.pop()!, deck.pop()!];
    let communityCards: Card[] = [];

    // Danh sách các lá bài chung sẽ xuất hiện
    const flopCards = [deck.pop()!, deck.pop()!, deck.pop()!];
    const turnCard = deck.pop()!;
    const riverCard = deck.pop()!;

    // Trạng thái vòng chơi: 'preflop' -> 'flop1' -> 'flop2' -> 'flop3' -> 'turn' -> 'river' -> 'showdown'
    let phase: 'preflop' | 'flop1' | 'flop2' | 'flop3' | 'turn' | 'river' | 'showdown' = 'preflop';
    let statusText = 'Lượt của bạn. Hãy đưa ra quyết định.';

    // Hàm tạo giao diện bàn chơi hiện tại
    const getTableBuffer = async (hideBot = true) => {
      return CardDrawer.drawPokerTable(
        playerHand,
        botHand,
        communityCards,
        pot,
        playerTotalBet,
        botTotalBet,
        currency,
        phase === 'preflop' ? 'Pre-flop' : phase === 'flop1' ? 'Flop 1' : phase === 'flop2' ? 'Flop 2' : phase === 'flop3' ? 'Flop 3' : phase === 'turn' ? 'Turn' : phase === 'river' ? 'River' : 'Showdown',
        statusText,
        hideBot
      );
    };

    // Hàm kiểm tra xem người chơi còn đủ tiền để Tăng cược (Raise) không
    const checkCanRaise = async (): Promise<boolean> => {
      const currentMember = await kernel.db.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });
      if (!currentMember) return false;
      const currentBalance = currency === 'VND' ? currentMember.vnd : currentMember.balance;
      return currentBalance >= startingBet;
    };

    // Các nút hành động
    const getPokerButtons = (canRaise: boolean) => {
      const isCheckAllowed = phase === 'flop2';
      const label = isCheckAllowed ? 'Xem Bài / Theo Cược (Check/Call)' : 'Theo Cược (Call)';
      return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('pk:check').setLabel(label).setStyle(ButtonStyle.Success).setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId('pk:raise')
            .setLabel(`Tăng cược (+${startingBet.toLocaleString()})`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔺')
            .setDisabled(!canRaise || !isCheckAllowed),
          new ButtonBuilder().setCustomId('pk:fold').setLabel('Fold (Bỏ bài)').setStyle(ButtonStyle.Danger).setEmoji('🏳️')
        )
      ];
    };

    let buffer = await getTableBuffer(true);
    let attachment = new AttachmentBuilder(buffer, { name: 'poker.png' });

    let canRaise = await checkCanRaise();
    const embed = new EmbedBuilder()
      .setTitle('🎴 Poker Table (Texas Hold\'em)')
      .setColor(0x0F4C81)
      .setDescription(`Nhận bài tẩy! Hãy đưa ra lựa chọn.\nKhởi điểm: **${currency === 'VND' ? `${startingBet.toLocaleString('vi-VN')} ₫` : `${startingBet.toLocaleString()} Coins`}**`)
      .setImage('attachment://poker.png')
      .setTimestamp();

    const msg = await interaction.editReply({
      embeds: [embed],
      files: [attachment],
      components: getPokerButtons(canRaise)
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: i => i.user.id === userId,
      idle: 300000
    });

    let gameEnded = false;

    // AI Logic quyết định của Bot khi bị Raise
    const botDecisionOnRaise = (botCards: Card[], board: Card[], round: string): 'call' | 'fold' => {
      const allCards = [...botCards, ...board];
      if (round === 'preflop') {
        // Pre-flop AI logic
        const cardValues = botCards.map(c => {
          const valuesMap: Record<string, number> = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
          };
          return valuesMap[c.value];
        });
        const hasHighCard = cardValues.some(v => v >= 11); // J or higher
        const isPair = cardValues[0] === cardValues[1];
        const isSuited = botCards[0].suit === botCards[1].suit;

        if (hasHighCard || isPair || isSuited) return 'call';
        return Math.random() < 0.65 ? 'call' : 'fold';
      } else {
        // Flop, Turn, River AI logic
        const evalHand = evaluate7CardHand(allCards);
        // Có đôi trở lên thì luôn Theo (Call)
        if (evalHand.rank >= 1) return 'call';
        // Mậu thầu thì có tỉ lệ Bỏ bài (Fold) cao
        return Math.random() < 0.35 ? 'call' : 'fold';
      }
    };

    collector.on('collect', async i => {
      if (gameEnded) return;
      await i.deferUpdate();

      if (i.customId === 'pk:fold') {
        gameEnded = true;
        collector.stop('player_fold');
        return;
      }

      let botAction: 'check' | 'call' | 'fold' = 'check';

      if (i.customId === 'pk:raise') {
        // Người chơi tăng cược
        await updateBalance(startingBet, false);
        playerTotalBet += startingBet;
        pot += startingBet;

        // Bot suy nghĩ phản hồi
        const botChoice = botDecisionOnRaise(botHand, communityCards, phase);
        if (botChoice === 'fold') {
          gameEnded = true;
          collector.stop('bot_fold');
          return;
        } else {
          // Bot theo cược
          botTotalBet += startingBet;
          pot += startingBet;
          botAction = 'call';
          statusText = `Bot đã CALL cược tăng của bạn!`;
        }
      } else {
        // Check / Call bình thường
        botAction = 'check';
        statusText = `Cả hai bên đều CHECK.`;
      }

      // 4. Chuyển sang vòng tiếp theo
      if (phase === 'preflop') {
        phase = 'flop1';
        communityCards.push(flopCards[0]);
        statusText += ` Vòng 2: Lá bài chung thứ 1 mở ra.`;
      } else if (phase === 'flop1') {
        phase = 'flop2';
        communityCards.push(flopCards[1]);
        statusText += ` Vòng 3: Lá bài chung thứ 2 mở ra (Được phép Check/Raise).`;
      } else if (phase === 'flop2') {
        phase = 'flop3';
        communityCards.push(flopCards[2]);
        statusText += ` Vòng 4: Lá bài chung thứ 3 mở ra.`;
      } else if (phase === 'flop3') {
        phase = 'turn';
        communityCards.push(turnCard);
        statusText += ` Vòng 5: Lá bài chung thứ 4 mở ra.`;
      } else if (phase === 'turn') {
        phase = 'river';
        communityCards.push(riverCard);
        statusText += ` Vòng 6: Lá bài chung thứ 5 mở ra!`;
      } else {
        // Đã là River, bấm tiếp tục -> Showdown
        phase = 'showdown';
        gameEnded = true;
        collector.stop('showdown');
        return;
      }

      // Cập nhật giao diện bàn chơi cho vòng mới
      buffer = await getTableBuffer(true);
      attachment = new AttachmentBuilder(buffer, { name: 'poker.png' });
      canRaise = await checkCanRaise();

      await interaction.editReply({
        embeds: [
          EmbedBuilder.from(embed)
            .setDescription(`Vòng chơi hiện tại: **${phase.toUpperCase()}**\nTổng Pot: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
        ],
        files: [attachment],
        components: getPokerButtons(canRaise)
      });
    });

    collector.on('end', async (_, reason) => {
      let outcome = '';
      let winColor = 0x0F4C81;

      if (reason === 'player_fold') {
        outcome = 'BẠN ĐÃ FOLD (BỎ BÀI). BOT THẮNG POT!';
        winColor = 0xED4245;
        // Tiền cược đã bị trừ trước đó, không được hoàn lại
      } else if (reason === 'bot_fold') {
        outcome = 'BOT ĐÃ FOLD! BẠN THẮNG POT!';
        winColor = 0x57F287;
        await updateBalance(pot, true); // Nhận lại toàn bộ Pot
      } else if (reason === 'showdown') {
        // Áp dụng win rate control cho bot poker
        const isBiased = Math.random() < gameConfig.poker.botWinRate;
        if (isBiased) {
          const playerEval = evaluate7CardHand([...playerHand, ...communityCards]);
          const botEval = evaluate7CardHand([...botHand, ...communityCards]);

          if (botEval.score < playerEval.score) {
            let bestHandCards = [...botHand];
            let bestScore = botEval.score;

            for (let i = 0; i < deck.length; i++) {
              for (let j = i + 1; j < deck.length; j++) {
                const testHand = [deck[i], deck[j]];
                const testEval = evaluate7CardHand([...testHand, ...communityCards]);
                if (testEval.score > playerEval.score) {
                  bestHandCards = testHand;
                  bestScore = testEval.score;
                  break;
                } else if (testEval.score > bestScore) {
                  bestHandCards = testHand;
                  bestScore = testEval.score;
                }
              }
              if (bestScore > playerEval.score) break;
            }

            if (bestHandCards !== botHand) {
              const idx1 = deck.indexOf(bestHandCards[0]);
              if (idx1 !== -1) deck.splice(idx1, 1);
              const idx2 = deck.indexOf(bestHandCards[1]);
              if (idx2 !== -1) deck.splice(idx2, 1);
              deck.push(...botHand);
              botHand = bestHandCards;
            }
          }
        }

        // So bài 7 lá cuối cùng
        const playerEval = evaluate7CardHand([...playerHand, ...communityCards]);
        const botEval = evaluate7CardHand([...botHand, ...communityCards]);

        const scoreDiff = playerEval.score - botEval.score;

        if (scoreDiff > 0) {
          outcome = `BẠN THẮNG! (${playerEval.rankName} thắng ${botEval.rankName})`;
          winColor = 0x57F287;
          await updateBalance(pot, true); // Nhận lại toàn bộ Pot
        } else if (scoreDiff < 0) {
          outcome = `BOT THẮNG! (${botEval.rankName} thắng ${playerEval.rankName})`;
          winColor = 0xED4245;
        } else {
          outcome = `HÒA NHAU! Cả hai đều có ${playerEval.rankName}`;
          winColor = 0x5865F2;
          await updateBalance(playerTotalBet, true); // Trả lại tiền cược của mình
        }
      } else {
        // Hết giờ hoặc lỗi khác
        outcome = 'HẾT GIỜ TỰ ĐỘNG BỎ BÀI!';
        winColor = 0xED4245;
      }

      statusText = outcome;
      // Vẽ lại bàn chơi, mở bài của Bot
      buffer = await getTableBuffer(false);
      attachment = new AttachmentBuilder(buffer, { name: 'poker.png' });

      const finalEmbed = new EmbedBuilder()
        .setTitle('🎴 Kết Quả Poker Texas Hold\'em')
        .setColor(winColor)
        .setDescription(`**${outcome}**\n\n💰 Tiền thắng cược: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
        .setImage('attachment://poker.png')
        .setTimestamp();

      kernel.cache.del(`active_game:${userId}`);

      await interaction.editReply({
        embeds: [finalEmbed],
        files: [attachment],
        components: [] // Xóa các nút tương tác
      });
    });
  }
}
