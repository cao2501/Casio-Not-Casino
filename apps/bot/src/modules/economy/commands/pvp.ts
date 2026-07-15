import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureMember, getModuleConfig } from '../../../database/helpers';
import { CardDrawer, Card } from '../../../core/ui/CardDrawer';
import { SpecialLogger } from '../../../core/logger/SpecialLogger';

interface EvaluatedHand {
  rank: number;
  rankName: string;
  score: number;
}

export default class PvpCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('pvp')
    .setDescription('⚔️ Thách đấu PvP người chơi khác (Poker hoặc Blackjack)')
    .addStringOption(opt =>
      opt
        .setName('game')
        .setDescription('Chọn trò chơi bạn muốn đấu trí')
        .setRequired(true)
        .addChoices(
          { name: 'Poker Texas Hold\'em', value: 'POKER' },
          { name: 'Blackjack (Xì Dách PvP)', value: 'BLACKJACK' },
          { name: 'Random Number (Số Ngẫu Nhiên PvP)', value: 'RANDOM_NUMBER' },
          { name: 'Random Card (Bài Ngẫu Nhiên PvP)', value: 'RANDOM_CARD' }
        )
    )
    .addIntegerOption(opt =>
      opt
        .setName('bet')
        .setDescription('Mức tiền đặt cược')
        .setRequired(true)
        .setMinValue(1)
    )
    .addUserOption(opt =>
      opt
        .setName('opponent')
        .setDescription('Thành viên bạn muốn thách đấu')
        .setRequired(true)
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const guildId = interaction.guildId!;
    const challengerId = interaction.user.id;
    const opponentUser = interaction.options.getUser('opponent', true);
    const opponentId = opponentUser.id;
    const bet = interaction.options.getInteger('bet', true);
    const gameType = interaction.options.getString('game', true) as 'POKER' | 'BLACKJACK' | 'RANDOM_NUMBER' | 'RANDOM_CARD';

    await interaction.deferReply();

    // 1. Kiểm tra các điều kiện hợp lệ
    if (challengerId === opponentId) {
      return void interaction.editReply({ content: '❌ Bạn không thể tự thách đấu chính mình!' });
    }
    if (opponentUser.bot) {
      return void interaction.editReply({ content: '❌ Bạn không thể thách đấu với Bot.' });
    }

    // Kiểm tra Khóa phiên chơi (Active Game Lock) của cả 2
    const challengerLock = kernel.cache.get(`active_game:${challengerId}`);
    const opponentLock = kernel.cache.get(`active_game:${opponentId}`);
    if (challengerLock) {
      return void interaction.editReply({ content: '❌ Bạn đang ở trong một phiên chơi khác chưa hoàn thành! Hãy hoàn thành ván đó trước.' });
    }
    if (opponentLock) {
      return void interaction.editReply({ content: '❌ Đối thủ đang ở trong một phiên chơi khác chưa hoàn thành! Không thể thách đấu lúc này.' });
    }

    // Lấy loại tiền cược cá nhân của Người thách đấu để áp dụng
    const { config: challengerPrefs } = await getModuleConfig<Record<string, 'COIN' | 'VND'>>(guildId, 'casino_user_prefs');
    const currency = challengerPrefs[challengerId] ?? 'COIN';

    // Đảm bảo thông tin người dùng được khởi tạo trong DB
    await ensureMember(guildId, challengerId);
    await ensureMember(guildId, opponentId);

    const challengerDb = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId: challengerId } } });
    const opponentDb = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId: opponentId } } });

    if (!challengerDb || !opponentDb) {
      return void interaction.editReply({ content: '❌ Lỗi hệ thống: Không tìm thấy tài khoản người chơi.' });
    }

    // Kiểm tra số dư của Người thách đấu
    const challengerBalance = currency === 'VND' ? challengerDb.vnd : challengerDb.balance;
    if (challengerBalance < bet) {
      const formatted = currency === 'VND' ? `${challengerBalance.toLocaleString('vi-VN')} ₫` : `${challengerBalance.toLocaleString()} Coins`;
      return void interaction.editReply({ content: `❌ Bạn không đủ số dư!\nSố dư hiện tại: **${formatted}**` });
    }

    // Kiểm tra số dư của Đối thủ
    const opponentBalance = currency === 'VND' ? opponentDb.vnd : opponentDb.balance;
    if (opponentBalance < bet) {
      return void interaction.editReply({ content: `❌ Đối thủ <@${opponentId}> không đủ số dư tương ứng để tham gia ván đấu này!` });
    }

    // Helper giao dịch số dư
    const updatePlayerBalance = async (userId: string, username: string, amount: number, isWin: boolean) => {
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
          ? `Thắng ${gameType} PvP. Nhận +${amount.toLocaleString('vi-VN')} VNĐ. Số dư mới: ${nextMember.vnd.toLocaleString('vi-VN')} VNĐ.`
          : `Cược ${gameType} PvP. Bị trừ -${amount.toLocaleString('vi-VN')} VNĐ. Số dư mới: ${nextMember.vnd.toLocaleString('vi-VN')} VNĐ.`;
        await SpecialLogger.logVnd(kernel, guildId, userId, username, action, amount, txId, details);
      }
    };

    // Khấu trừ tiền cược trước của Người thách đấu
    await updatePlayerBalance(challengerId, interaction.user.username, bet, false);

    // 2. Gửi lời mời thách đấu
    const gameLabel = gameType === 'POKER' 
      ? "Poker Texas Hold'em" 
      : gameType === 'BLACKJACK' 
      ? 'Blackjack (Xì Dách)' 
      : gameType === 'RANDOM_NUMBER' 
      ? 'Random Number (Số Ngẫu Nhiên)' 
      : 'Random Card (Bài Ngẫu Nhiên)';
    const challengeEmbed = new EmbedBuilder()
      .setTitle(`⚔️ Thách Đấu PvP ${gameLabel}`)
      .setColor(0xF6C453)
      .setDescription(`👤 <@${challengerId}> thách đấu với 👤 <@${opponentId}>\n💵 Mức cược: **${currency === 'VND' ? `${bet.toLocaleString('vi-VN')} ₫` : `${bet.toLocaleString()} Coins`}**\n\n*Đối thủ có 60 giây để đồng ý tham gia phòng chơi.*`)
      .setTimestamp();

    const challengeRows = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('pvp:accept').setLabel('Đồng ý (Accept)').setStyle(ButtonStyle.Success).setEmoji('🤝'),
      new ButtonBuilder().setCustomId('pvp:decline').setLabel('Từ chối / Huỷ').setStyle(ButtonStyle.Danger).setEmoji('❌')
    );

    const challengeMsg = await interaction.editReply({
      embeds: [challengeEmbed],
      components: [challengeRows]
    });

    const challengeCollector = challengeMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    let isAccepted = false;

    challengeCollector.on('collect', async i => {
      if (i.customId === 'pvp:accept') {
        if (i.user.id !== opponentId) {
          return void i.reply({ content: '❌ Chỉ đối thủ được thách đấu mới có thể đồng ý!', ephemeral: true });
        }

        const checkOpponentDb = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId: opponentId } } });
        const currentOpponentBal = currency === 'VND' ? checkOpponentDb?.vnd ?? 0 : checkOpponentDb?.balance ?? 0;

        if (currentOpponentBal < bet) {
          return void i.reply({ content: '❌ Bạn không đủ số dư để tham gia!', ephemeral: true });
        }

        await i.deferUpdate();
        await updatePlayerBalance(opponentId, opponentUser.username, bet, false);

        isAccepted = true;
        challengeCollector.stop('accepted');
      } else if (i.customId === 'pvp:decline') {
        if (i.user.id !== challengerId && i.user.id !== opponentId) {
          return void i.reply({ content: '❌ Bạn không có thẩm quyền trong lời mời này!', ephemeral: true });
        }

        await i.deferUpdate();
        challengeCollector.stop('declined');
      }
    });

    challengeCollector.on('end', async (_, reason) => {
      if (reason === 'accepted' && isAccepted) {
        // Đặt khóa Active Game Lock cho cả 2 người chơi
        kernel.cache.set(`active_game:${challengerId}`, true, 1800);
        kernel.cache.set(`active_game:${opponentId}`, true, 1800);

        // Khởi chạy game cụ thể
        if (gameType === 'POKER') {
          await startPokerGame();
        } else if (gameType === 'BLACKJACK') {
          await startBlackjackGame();
        } else if (gameType === 'RANDOM_NUMBER') {
          await startRandomNumberGame();
        } else if (gameType === 'RANDOM_CARD') {
          await startRandomCardGame();
        }
      } else {
        // Hoàn trả cược cho challenger
        await updatePlayerBalance(challengerId, interaction.user.username, bet, true);

        const cancelEmbed = new EmbedBuilder()
          .setTitle('❌ Thách Đấu Bị Huỷ')
          .setColor(0xED4245)
          .setDescription(reason === 'declined' ? 'Lời mời đã bị huỷ bởi người chơi.' : 'Hết thời gian chờ đồng ý.')
          .setTimestamp();

        await interaction.editReply({
          embeds: [cancelEmbed],
          components: []
        });
      }
    });

    // Deck generator helpers
    const getDeck = (): Card[] => {
      const suits: Card['suit'][] = ['H', 'D', 'C', 'S'];
      const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      const deck: Card[] = [];
      for (const s of suits) {
        for (const v of values) {
          deck.push({ suit: s, value: v });
        }
      }
      // Shuffle
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      return deck;
    };

    // ────────────────────────────────────────────────────────────────
    // 🃏 GAME ENGINE 1: BLACKJACK PVP
    // ────────────────────────────────────────────────────────────────
    async function startBlackjackGame() {
      const deck = getDeck();
      const p1Hand: Card[] = [deck.pop()!, deck.pop()!]; // Challenger
      const p2Hand: Card[] = [deck.pop()!, deck.pop()!]; // Opponent

      const calculateScore = (hand: Card[]): number => {
        let score = 0;
        let aces = 0;
        const valuesMap: Record<string, number> = {
          '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11
        };
        for (const c of hand) {
          score += valuesMap[c.value];
          if (c.value === 'A') aces++;
        }
        while (score > 21 && aces > 0) {
          score -= 10;
          aces--;
        }
        return score;
      };

      let p1Score = calculateScore(p1Hand);
      let p2Score = calculateScore(p2Hand);

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

      const p1Combo = getInitialCombo(p1Hand);
      const p2Combo = getInitialCombo(p2Hand);
      const pot = bet * 2;
      const p1Name = interaction.user.username;
      const p2Name = opponentUser.username;

      if (p1Combo !== InitialCombo.NORMAL || p2Combo !== InitialCombo.NORMAL) {
        let outcome = '';
        let winColor = 0xF6C453;
        
        if (p1Combo > p2Combo) {
          const comboName = p1Combo === InitialCombo.XI_BAN ? 'Xì Bàn (Đôi AA)' : 'Xì Dách';
          outcome = `🏆 **${p1Name}** thắng luôn nhờ có **${comboName}**!`;
          winColor = 0x57F287;
          await updatePlayerBalance(challengerId, p1Name, pot, true);
        } else if (p2Combo > p1Combo) {
          const comboName = p2Combo === InitialCombo.XI_BAN ? 'Xì Bàn (Đôi AA)' : 'Xì Dách';
          outcome = `🏆 **${p2Name}** thắng luôn nhờ có **${comboName}**!`;
          winColor = 0x57F287;
          await updatePlayerBalance(opponentId, p2Name, pot, true);
        } else {
          const comboName = p1Combo === InitialCombo.XI_BAN ? 'Xì Bàn (Đôi AA)' : 'Xì Dách';
          outcome = `🤝 HÒA NHAU! Cả hai đều có **${comboName}**!`;
          winColor = 0x5865F2;
          await updatePlayerBalance(challengerId, p1Name, bet, true);
          await updatePlayerBalance(opponentId, p2Name, bet, true);
        }

        kernel.cache.del(`active_game:${challengerId}`);
        kernel.cache.del(`active_game:${opponentId}`);

        const buffer = await CardDrawer.drawBlackjackTable(
          p1Hand,
          p2Hand,
          p1Score,
          p2Score,
          bet,
          currency,
          outcome,
          false,
          `${p1Name.toUpperCase()}`,
          `${p2Name.toUpperCase()}`,
          false,
          false
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'bj-pvp.png' });

        const finalEmbed = new EmbedBuilder()
          .setTitle('🃏 Kết Quả Blackjack PvP')
          .setColor(winColor)
          .setDescription(`**${outcome}**\n\n💰 Tổng Pot giải quyết: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
          .setImage('attachment://bj-pvp.png')
          .setTimestamp();

        return void interaction.editReply({
          embeds: [finalEmbed],
          files: [attachment],
          components: []
        });
      }

      let activeId = challengerId;
      let turn: 'p1' | 'p2' | 'ended' = 'p1';

      let statusText = `Lượt của **${p1Name}** (Rút hoặc Dừng).`;

      const potDisplay = currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`;

      const getTableBuffer = async (outcome?: string) => {
        const isGameOngoing = !outcome;
        return CardDrawer.drawBlackjackTable(
          p1Hand,
          p2Hand,
          p1Score,
          p2Score,
          bet,
          currency,
          outcome,
          false,
          `${p1Name.toUpperCase()}`,
          `${p2Name.toUpperCase()}`,
          isGameOngoing,
          isGameOngoing
        );
      };

      let p1Stood = false;
      let p2Stood = false;
      let drawRequesterId: string | null = null;

      const getPvpBjButtons = () => {
        const activeHand = (activeId === challengerId) ? p1Hand : p2Hand;
        const activeName = (activeId === challengerId) ? p1Name : p2Name;
        const activeStood = (activeId === challengerId) ? p1Stood : p2Stood;
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('bj_pvp:hit').setLabel('Rút Bài (Hit)').setStyle(ButtonStyle.Success).setEmoji('🃏').setDisabled(activeHand.length >= 5 || activeStood),
          new ButtonBuilder().setCustomId('bj_pvp:stand').setLabel('Dừng Bài (Stand)').setStyle(ButtonStyle.Danger).setEmoji('🛑').setDisabled(activeStood),
          new ButtonBuilder().setCustomId('bj_pvp:view_cards').setLabel('👁️ Xem bài').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('bj_pvp:draw_request').setLabel('Xin Hòa (Draw)').setStyle(ButtonStyle.Secondary).setEmoji('🤝')
        );
        return [row];
      };

      let buffer = await getTableBuffer();
      let attachment = new AttachmentBuilder(buffer, { name: 'bj-pvp.png' });

      const bjEmbed = new EmbedBuilder()
        .setTitle('🃏 Blackjack PvP 1v1')
        .setColor(0x105B34)
        .setDescription(`🃏 **${p1Name}** vs **${p2Name}**\n👤 Lượt đi: **${p1Name}**\n💰 Tổng Pot: **${potDisplay}**`)
        .setImage('attachment://bj-pvp.png')
        .setTimestamp();

      const gameMsg = await interaction.editReply({
        embeds: [bjEmbed],
        files: [attachment],
        components: getPvpBjButtons()
      });

      const gameCollector = gameMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: 300000
      });


      gameCollector.on('collect', async i => {
        // Private view cards action
        if (i.customId === 'bj_pvp:view_cards') {
          if (i.user.id !== challengerId && i.user.id !== opponentId) {
            return void i.reply({ content: '❌ Bạn không tham gia ván chơi này!', ephemeral: true });
          }

          await i.deferReply({ ephemeral: true });
          const hand = (i.user.id === challengerId) ? p1Hand : p2Hand;
          const score = (i.user.id === challengerId) ? p1Score : p2Score;
          
          const privateBuffer = await CardDrawer.drawRandomCards(hand);
          const privateAttach = new AttachmentBuilder(privateBuffer, { name: 'bj-private.png' });

          const suitsVi: Record<Card['suit'], string> = { H: 'Cơ ♥', D: 'Rô ♦', C: 'Chuồn ♣', S: 'Bích ♠' };
          const cardText = hand.map(c => `**${c.value}** ${suitsVi[c.suit]}`).join(', ');

          await i.editReply({
            content: `🃏 Bài Blackjack của bạn: ${cardText} (Tổng điểm: **${score}** / 21)`,
            files: [privateAttach]
          });
          return;
        }

        // Handle Draw Request buttons
        if (i.customId === 'bj_pvp:draw_request') {
          if (i.user.id !== challengerId && i.user.id !== opponentId) {
            return void i.reply({ content: '❌ Bạn không tham gia ván chơi này!', ephemeral: true });
          }
          await i.deferUpdate();
          drawRequesterId = i.user.id;
          const targetId = (drawRequesterId === challengerId) ? opponentId : challengerId;

          const drawAcceptRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('bj_pvp:draw_accept').setLabel('Đồng ý hòa').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('bj_pvp:draw_decline').setLabel('Tiếp tục chơi').setStyle(ButtonStyle.Danger).setEmoji('❌')
          );

          await interaction.editReply({
            embeds: [
              EmbedBuilder.from(bjEmbed)
                .setDescription(`🤝 <@${drawRequesterId}> đề nghị hòa và hủy trận đấu.\nChờ <@${targetId}> đồng ý...`)
            ],
            components: [drawAcceptRow]
          });
          return;
        }

        if (i.customId === 'bj_pvp:draw_accept' || i.customId === 'bj_pvp:draw_decline') {
          const targetId = (drawRequesterId === challengerId) ? opponentId : challengerId;
          if (i.user.id !== targetId) {
            return void i.reply({ content: '❌ Chỉ người nhận được đề nghị mới có quyền quyết định!', ephemeral: true });
          }

          await i.deferUpdate();

          if (i.customId === 'bj_pvp:draw_accept') {
            gameCollector.stop('draw_accepted');
          } else {
            drawRequesterId = null;
            // Restore normal screen
            await interaction.editReply({
              embeds: [
                EmbedBuilder.from(bjEmbed)
                  .setDescription(`Lượt hiện tại: <@${activeId}>\n*${statusText}*\n💰 Tổng Pot: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
              ],
              components: getPvpBjButtons()
            });
          }
          return;
        }

        if (drawRequesterId) {
          return void i.reply({ content: '❌ Vui lòng giải quyết đề nghị hòa trước!', ephemeral: true });
        }

        if (i.user.id !== activeId) {
          return void i.reply({ content: '❌ Chưa đến lượt của bạn!', ephemeral: true });
        }

        await i.deferUpdate();

        if (i.customId === 'bj_pvp:hit') {
          if (activeId === challengerId) {
            p1Hand.push(deck.pop()!);
            p1Score = calculateScore(p1Hand);
            if (p1Score > 21) {
              // BUST -> Đối thủ thắng ngay lập tức
              turn = 'ended';
              gameCollector.stop('showdown');
              return;
            } else if (p1Hand.length >= 5) {
              p1Stood = true;
              if (p2Stood) {
                turn = 'ended';
                gameCollector.stop('showdown');
                return;
              }
              activeId = opponentId;
              statusText = `<@${challengerId}> đã rút đủ 5 lá và tự động dừng bài! Lượt chuyển sang <@${activeId}>.`;
            } else {
              if (!p2Stood) {
                activeId = opponentId;
                statusText = `<@${challengerId}> đã rút 1 lá. Lượt tiếp theo của <@${activeId}>.`;
              } else {
                statusText = `<@${challengerId}> đã rút 1 lá và tiếp tục lượt (do đối thủ đã dừng).`;
              }
            }
          } else {
            p2Hand.push(deck.pop()!);
            p2Score = calculateScore(p2Hand);
            if (p2Score > 21) {
              // BUST -> Challenger thắng ngay lập tức
              turn = 'ended';
              gameCollector.stop('showdown');
              return;
            } else if (p2Hand.length >= 5) {
              p2Stood = true;
              if (p1Stood) {
                turn = 'ended';
                gameCollector.stop('showdown');
                return;
              }
              activeId = challengerId;
              statusText = `**${p2Name}** đã rút đủ 5 lá và tự động dừng bài! Lượt chuyển sang **${p1Name}**.`;
            } else {
              if (!p1Stood) {
                activeId = challengerId;
                statusText = `**${p2Name}** đã rút 1 lá. Lượt tiếp theo của **${p1Name}**.`;
              } else {
                statusText = `**${p2Name}** đã rút 1 lá và tiếp tục lượt (do đối thủ đã dừng).`;
              }
            }
          }
        } else if (i.customId === 'bj_pvp:stand') {
          if (activeId === challengerId) {
            p1Stood = true;
            if (p2Stood) {
              turn = 'ended';
              gameCollector.stop('showdown');
              return;
            }
            activeId = opponentId;
            statusText = `**${p1Name}** đã dừng bài. Lượt chuyển sang **${p2Name}**.️`;
          } else {
            p2Stood = true;
            if (p1Stood) {
              turn = 'ended';
              gameCollector.stop('showdown');
              return;
            }
            activeId = challengerId;
            statusText = `**${p2Name}** đã dừng bài. Lượt chuyển sang **${p1Name}**.️`;
          }
        }

        if (turn === 'ended') return;

        const activeName = (activeId === challengerId) ? p1Name : p2Name;
        buffer = await getTableBuffer();
        attachment = new AttachmentBuilder(buffer, { name: 'bj-pvp.png' });

        await interaction.editReply({
          embeds: [
            EmbedBuilder.from(bjEmbed)
              .setDescription(`🃏 **${p1Name}** vs **${p2Name}**\n👤 Lượt đi: **${activeName}**\n\n*${statusText}*\n\n💰 Tổng Pot: **${potDisplay}**`)
          ],
          files: [attachment],
          components: getPvpBjButtons()
        });
      });

      gameCollector.on('end', async (_, reason) => {
        let outcome = '';
        let winColor = 0xF6C453;

        // Phân định kết quả
        if (reason === 'draw_accepted') {
          outcome = '🤝 Trận đấu đã hòa theo sự đồng thuận của hai bên!';
          winColor = 0x5865F2;
          await updatePlayerBalance(challengerId, p1Name, bet, true);
          await updatePlayerBalance(opponentId, p2Name, bet, true);
        } else if (reason === 'showdown') {
          const p1NguLinh = p1Hand.length === 5 && p1Score <= 21;
          const p2NguLinh = p2Hand.length === 5 && p2Score <= 21;

          if (p1NguLinh || p2NguLinh) {
            if (p1NguLinh && p2NguLinh) {
              if (p1Score < p2Score) {
                outcome = `🏆 **${p1Name}** chiến thắng! Cả hai đều đạt **Ngũ Linh** nhưng **${p1Name}** ít điểm hơn (${p1Score} vs ${p2Score})`;
                winColor = 0x57F287;
                await updatePlayerBalance(challengerId, p1Name, pot, true);
              } else if (p2Score < p1Score) {
                outcome = `🏆 **${p2Name}** chiến thắng! Cả hai đều đạt **Ngũ Linh** nhưng **${p2Name}** ít điểm hơn (${p2Score} vs ${p1Score})`;
                winColor = 0x57F287;
                await updatePlayerBalance(opponentId, p2Name, pot, true);
              } else {
                outcome = `🤝 HÒA NHAU! Cả hai đều đạt **Ngũ Linh** với cùng ${p1Score} điểm!`;
                winColor = 0x5865F2;
                await updatePlayerBalance(challengerId, p1Name, bet, true);
                await updatePlayerBalance(opponentId, p2Name, bet, true);
              }
            } else if (p1NguLinh) {
              outcome = `🏆 **${p1Name}** chiến thắng nhờ đạt **Ngũ Linh** (5 lá bài <= 21 điểm)!`;
              winColor = 0x57F287;
              await updatePlayerBalance(challengerId, p1Name, pot, true);
            } else {
              outcome = `🏆 **${p2Name}** chiến thắng nhờ đạt **Ngũ Linh** (5 lá bài <= 21 điểm)!`;
              winColor = 0x57F287;
              await updatePlayerBalance(opponentId, p2Name, pot, true);
            }
          } else if (p1Score > 21 && p2Score > 21) {
            outcome = `🤝 HÒA! Cả hai đều bị BUST (>21) — **${p1Name}**: ${p1Score} điểm vs **${p2Name}**: ${p2Score} điểm`;
            winColor = 0x5865F2;
            await updatePlayerBalance(challengerId, p1Name, bet, true);
            await updatePlayerBalance(opponentId, p2Name, bet, true);
          } else if (p1Score > 21) {
            outcome = `🏆 **${p2Name}** chiến thắng! (**${p1Name}** bị BUST với ${p1Score} điểm | **${p2Name}**: ${p2Score} điểm)`;
            winColor = 0x57F287;
            await updatePlayerBalance(opponentId, p2Name, pot, true);
          } else if (p2Score > 21) {
            outcome = `🏆 **${p1Name}** chiến thắng! (**${p2Name}** bị BUST với ${p2Score} điểm | **${p1Name}**: ${p1Score} điểm)`;
            winColor = 0x57F287;
            await updatePlayerBalance(challengerId, p1Name, pot, true);
          } else {
            if (p1Score > p2Score) {
              outcome = `🏆 **${p1Name}** chiến thắng! (${p1Score} điểm vs ${p2Score} điểm)`;
              winColor = 0x57F287;
              await updatePlayerBalance(challengerId, p1Name, pot, true);
            } else if (p2Score > p1Score) {
              outcome = `🏆 **${p2Name}** chiến thắng! (${p2Score} điểm vs ${p1Score} điểm)`;
              winColor = 0x57F287;
              await updatePlayerBalance(opponentId, p2Name, pot, true);
            } else {
              outcome = `🤝 HÒA NHAU! **${p1Name}** vs **${p2Name}** cùng ${p1Score} điểm`;
              winColor = 0x5865F2;
              await updatePlayerBalance(challengerId, p1Name, bet, true);
              await updatePlayerBalance(opponentId, p2Name, bet, true);
            }
          }
        } else {
          // Hết giờ, hoàn tiền cược
          outcome = '❌ Trận đấu kết thúc do quá thời gian chờ!';
          winColor = 0xED4245;
          await updatePlayerBalance(challengerId, p1Name, bet, true);
          await updatePlayerBalance(opponentId, p2Name, bet, true);
        }

        // Xóa khóa phiên chơi cho cả hai
        kernel.cache.del(`active_game:${challengerId}`);
        kernel.cache.del(`active_game:${opponentId}`);

        buffer = await getTableBuffer(outcome);
        attachment = new AttachmentBuilder(buffer, { name: 'bj-pvp.png' });

        const finalEmbed = new EmbedBuilder()
          .setTitle('🃏 Kết Quả Blackjack PvP')
          .setColor(winColor)
          .setDescription(`**${outcome}**\n\n💰 Tổng Pot giải quyết: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
          .setImage('attachment://bj-pvp.png')
          .setTimestamp();

        await interaction.editReply({
          embeds: [finalEmbed],
          files: [attachment],
          components: []
        });
      });
    }

    // ────────────────────────────────────────────────────────────────
    // 🎴 GAME ENGINE 2: POKER PVP
    // ────────────────────────────────────────────────────────────────
    async function startPokerGame() {
      // Tách riêng luồng và tái sử dụng Poker PvP ở đây
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

      let deck = getDeck();
      const p1Hand: Card[] = [deck.pop()!, deck.pop()!];
      const p2Hand: Card[] = [deck.pop()!, deck.pop()!];
      const communityCards: Card[] = [];

      const flopCards = [deck.pop()!, deck.pop()!, deck.pop()!];
      const turnCard = deck.pop()!;
      const riverCard = deck.pop()!;

      let p1TotalBet = bet;
      let p2TotalBet = bet;
      let pot = p1TotalBet + p2TotalBet;

      let phase: 'preflop' | 'flop1' | 'flop2' | 'flop3' | 'turn' | 'river' | 'showdown' = 'preflop';
      let activePlayerId = challengerId;
      let raiseState: { raiserId: string; raiseAmount: number } | null = null;
      let statusText = `Lượt của <@${activePlayerId}>. Hãy đưa ra quyết định.`;

      const getPvpTable = async (hideAll = true) => {
        return CardDrawer.drawPokerTable(
          p1Hand,
          p2Hand,
          communityCards,
          pot,
          p1TotalBet,
          p2TotalBet,
          currency,
          phase === 'preflop' ? 'Preflop' : phase === 'flop1' ? 'Flop 1' : phase === 'flop2' ? 'Flop 2' : phase === 'flop3' ? 'Flop 3' : phase === 'turn' ? 'Turn' : phase === 'river' ? 'River' : 'Showdown',
          statusText,
          hideAll
        );
      };

      const getActionButtons = (activeId: string, hasRaise: boolean) => {
        const isCheckAllowed = phase === 'flop2';
        const checkLabel = hasRaise ? 'Theo Cược (Call)' : (isCheckAllowed ? 'Xem Bài (Check)' : 'Theo Cược (Call)');
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('pick_game:check_call')
            .setLabel(checkLabel)
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId('pick_game:raise')
            .setLabel(`Tăng cược (+${bet.toLocaleString()})`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔺')
            .setDisabled(!isCheckAllowed),
          new ButtonBuilder()
            .setCustomId('pick_game:fold')
            .setLabel('Bỏ bài (Fold)')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🏳️'),
          new ButtonBuilder()
            .setCustomId('pick_game:view_cards')
            .setLabel('👁️ Xem bài tẩy')
            .setStyle(ButtonStyle.Secondary)
        );
        const drawRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('pick_game:all_in')
            .setLabel('Tất Tay (All In)')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔥'),
          new ButtonBuilder()
            .setCustomId('pick_game:draw_request')
            .setLabel('Xin Hòa (Draw)')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🤝')
        );
        return [row, drawRow];
      };

      let buffer = await getPvpTable(true);
      let attachment = new AttachmentBuilder(buffer, { name: 'poker.png' });

      const pvpEmbed = new EmbedBuilder()
        .setTitle('🎴 Poker PvP Texas Hold\'em')
        .setColor(0x0F4C81)
        .setDescription(`Ván đấu bắt đầu!\n👤 Người đi lượt: <@${activePlayerId}>\n💵 Tổng Pot: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
        .setImage('attachment://poker.png')
        .setTimestamp();

      const gameMsg = await interaction.editReply({
        embeds: [pvpEmbed],
        files: [attachment],
        components: getActionButtons(activePlayerId, false)
      });

      const gameCollector = gameMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: 300000
      });

      let gameEnded = false;

      const switchTurn = () => {
        activePlayerId = (activePlayerId === challengerId) ? opponentId : challengerId;
      };

      const advancePhase = () => {
        if (phase === 'preflop') {
          phase = 'flop1';
          communityCards.push(flopCards[0]);
          statusText = `Vòng 2: lật 1 lá chung thứ 1.`;
        } else if (phase === 'flop1') {
          phase = 'flop2';
          communityCards.push(flopCards[1]);
          statusText = `Vòng 3: lật 1 lá chung thứ 2 (Được phép Check/Raise).`;
        } else if (phase === 'flop2') {
          phase = 'flop3';
          communityCards.push(flopCards[2]);
          statusText = `Vòng 4: lật 1 lá chung thứ 3.`;
        } else if (phase === 'flop3') {
          phase = 'turn';
          communityCards.push(turnCard);
          statusText = `Vòng 5: lật 1 lá chung thứ 4.`;
        } else if (phase === 'turn') {
          phase = 'river';
          communityCards.push(riverCard);
          statusText = `Vòng 6: lật 1 lá chung thứ 5!`;
        } else {
          phase = 'showdown';
          gameEnded = true;
          gameCollector.stop('showdown');
          return;
        }
        raiseState = null;
        activePlayerId = challengerId;
        statusText += ` Lượt của <@${activePlayerId}>.`;
      };

      const checkUserBalance = async (userId: string, amount: number): Promise<boolean> => {
        const m = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId } } });
        if (!m) return false;
        const bal = currency === 'VND' ? m.vnd : m.balance;
        return bal >= amount;
      };

      const getUserBalance = async (userId: string): Promise<number> => {
        const m = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId } } });
        if (!m) return 0;
        return currency === 'VND' ? m.vnd : m.balance;
      };

      const runOutCards = async () => {
        while (phase !== 'river' && phase !== 'showdown') {
          if (phase === 'preflop') {
            phase = 'flop1';
            communityCards.push(flopCards[0]);
          } else if (phase === 'flop1') {
            phase = 'flop2';
            communityCards.push(flopCards[1]);
          } else if (phase === 'flop2') {
            phase = 'flop3';
            communityCards.push(flopCards[2]);
          } else if (phase === 'flop3') {
            phase = 'turn';
            communityCards.push(turnCard);
          } else if (phase === 'turn') {
            phase = 'river';
            communityCards.push(riverCard);
          }
        }
        phase = 'showdown';
        gameEnded = true;
        gameCollector.stop('showdown');
      };

      let drawRequesterId: string | null = null;

      gameCollector.on('collect', async i => {
        if (gameEnded) return;

        // Handle Draw Request buttons
        if (i.customId === 'pick_game:draw_request') {
          if (i.user.id !== challengerId && i.user.id !== opponentId) {
            return void i.reply({ content: '❌ Bạn không tham gia ván chơi này!', ephemeral: true });
          }
          await i.deferUpdate();
          drawRequesterId = i.user.id;
          const targetId = (drawRequesterId === challengerId) ? opponentId : challengerId;

          const drawAcceptRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('pick_game:draw_accept').setLabel('Đồng ý hòa').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('pick_game:draw_decline').setLabel('Tiếp tục chơi').setStyle(ButtonStyle.Danger).setEmoji('❌')
          );

          await interaction.editReply({
            embeds: [
              EmbedBuilder.from(pvpEmbed)
                .setDescription(`🤝 <@${drawRequesterId}> đề nghị hòa và hủy trận đấu.\nChờ <@${targetId}> đồng ý...`)
            ],
            components: [drawAcceptRow]
          });
          return;
        }

        if (i.customId === 'pick_game:draw_accept' || i.customId === 'pick_game:draw_decline') {
          const targetId = (drawRequesterId === challengerId) ? opponentId : challengerId;
          if (i.user.id !== targetId) {
            return void i.reply({ content: '❌ Chỉ người nhận được đề nghị mới có quyền quyết định!', ephemeral: true });
          }

          await i.deferUpdate();

          if (i.customId === 'pick_game:draw_accept') {
            gameCollector.stop('draw_accepted');
          } else {
            drawRequesterId = null;
            // Restore normal screen
            await interaction.editReply({
              embeds: [
                EmbedBuilder.from(pvpEmbed)
                  .setDescription(`Vòng chơi hiện tại: **${phase.toUpperCase()}**\n👤 Người đi lượt: <@${activePlayerId}>\n💵 Tổng Pot: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
              ],
              components: getActionButtons(activePlayerId, raiseState !== null)
            });
          }
          return;
        }

        if (drawRequesterId) {
          return void i.reply({ content: '❌ Vui lòng giải quyết đề nghị hòa trước!', ephemeral: true });
        }

        if (i.customId === 'pick_game:view_cards') {
          if (i.user.id !== challengerId && i.user.id !== opponentId) {
            return void i.reply({ content: '❌ Bạn không tham gia trận đấu này!', ephemeral: true });
          }

          await i.deferReply({ ephemeral: true });
          const hand = (i.user.id === challengerId) ? p1Hand : p2Hand;
          const privateBuffer = await CardDrawer.drawRandomCards(hand);
          const privateAttach = new AttachmentBuilder(privateBuffer, { name: 'pocket.png' });

          const suitsVi: Record<Card['suit'], string> = { H: 'Cơ ♥', D: 'Rô ♦', C: 'Chuồn ♣', S: 'Bích ♠' };
          const cardText = hand.map(c => `**${c.value}** ${suitsVi[c.suit]}`).join(', ');

          await i.editReply({
            content: `🎴 Bài tẩy của bạn: ${cardText}`,
            files: [privateAttach]
          });
          return;
        }

        if (i.user.id !== activePlayerId) {
          return void i.reply({ content: '❌ Chưa đến lượt của bạn!', ephemeral: true });
        }

        await i.deferUpdate();

        if (i.customId === 'pick_game:fold') {
          gameEnded = true;
          gameCollector.stop(activePlayerId === challengerId ? 'p1_fold' : 'p2_fold');
          return;
        }

        if (i.customId === 'pick_game:raise') {
          // Mở Modal nhập số tiền tăng cược
          const modal = new ModalBuilder()
            .setCustomId('poker_raise_modal')
            .setTitle('🔺 Tăng Cược (Raise)');

          const raiseInput = new TextInputBuilder()
            .setCustomId('raise_amount_input')
            .setLabel('Số tiền muốn tăng thêm')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Nhập số tiền tăng cược...')
            .setRequired(true);

          const modalRow = new ActionRowBuilder<TextInputBuilder>().addComponents(raiseInput);
          modal.addComponents(modalRow);

          await i.showModal(modal);

          const submit = await i.awaitModalSubmit({
            filter: modalInteraction => modalInteraction.customId === 'poker_raise_modal' && modalInteraction.user.id === i.user.id,
            time: 60000
          }).catch(() => null);

          if (!submit) return;
          await submit.deferUpdate();

          const valStr = submit.fields.getTextInputValue('raise_amount_input');
          const raiseAmount = parseInt(valStr.replace(/[^0-9]/g, ''));
          if (isNaN(raiseAmount) || raiseAmount <= 0) {
            return void submit.followUp({ content: '❌ Số tiền tăng cược không hợp lệ!', ephemeral: true });
          }

          const canRaise = await checkUserBalance(activePlayerId, raiseAmount);
          if (!canRaise) {
            return void submit.followUp({ content: '❌ Số dư của bạn không đủ để tăng cược!', ephemeral: true });
          }

          // Khấu trừ số tiền tăng cược
          await updatePlayerBalance(activePlayerId, i.user.username, raiseAmount, false);
          
          if (activePlayerId === challengerId) {
            p1TotalBet += raiseAmount;
          } else {
            p2TotalBet += raiseAmount;
          }
          pot += raiseAmount;

          raiseState = {
            raiserId: activePlayerId,
            raiseAmount: raiseAmount
          };

          statusText = `<@${activePlayerId}> đã TĂNG CƯỢC (+${raiseAmount.toLocaleString()})!`;
          switchTurn();
          statusText += ` Lượt của <@${activePlayerId}> (Phải CALL hoặc FOLD).`;
        } 
        
        else if (i.customId === 'pick_game:all_in') {
          const activeBal = await getUserBalance(activePlayerId);
          if (activeBal <= 0) {
            return void i.followUp({ content: '❌ Số dư của bạn đã bằng 0, không thể Tất Tay thêm!', ephemeral: true });
          }

          // Khấu trừ số tiền Tất Tay
          await updatePlayerBalance(activePlayerId, i.user.username, activeBal, false);
          
          if (activePlayerId === challengerId) {
            p1TotalBet += activeBal;
          } else {
            p2TotalBet += activeBal;
          }
          pot += activeBal;

          raiseState = {
            raiserId: activePlayerId,
            raiseAmount: activeBal
          };

          statusText = `🔥 <@${activePlayerId}> đã TẤT TAY (ALL IN) (+${activeBal.toLocaleString()})!`;
          switchTurn();
          statusText += ` Lượt của <@${activePlayerId}> (Phải CALL hoặc FOLD).`;
        }

        else if (i.customId === 'pick_game:check_call') {
          if (raiseState) {
            const betDiff = Math.abs(p1TotalBet - p2TotalBet);
            const targetBal = await getUserBalance(activePlayerId);

            if (targetBal <= 0 && betDiff > 0) {
              return void i.followUp({ content: '❌ Bạn đã hết tiền, không thể Theo Cược!', ephemeral: true });
            }

            const actualCallAmount = Math.min(betDiff, targetBal);
            await updatePlayerBalance(activePlayerId, i.user.username, actualCallAmount, false);
            
            if (activePlayerId === challengerId) {
              p1TotalBet += actualCallAmount;
            } else {
              p2TotalBet += actualCallAmount;
            }
            pot += actualCallAmount;

            statusText = `<@${activePlayerId}> đã THEO CƯỢC (Call) ${actualCallAmount.toLocaleString()}.`;

            // Kiểm tra xem có ai hết tiền (All In) không
            const p1BalAfter = await getUserBalance(challengerId);
            const p2BalAfter = await getUserBalance(opponentId);
            if (p1BalAfter === 0 || p2BalAfter === 0) {
              statusText += ` Có người chơi đã Tất Tay! Tự động lật toàn bộ bài chung...`;
              await runOutCards();
            } else {
              advancePhase();
            }
          } else {
            if (activePlayerId === challengerId) {
              statusText = `<@${activePlayerId}> đã CHECK.`;
              switchTurn();
              statusText += ` Lượt của <@${activePlayerId}>.`;
            } else {
              statusText = `Cả hai đều CHECK.`;
              advancePhase();
            }
          }
        }

        if (gameEnded) return;

        buffer = await getPvpTable(true);
        attachment = new AttachmentBuilder(buffer, { name: 'poker.png' });

        await interaction.editReply({
          embeds: [
            EmbedBuilder.from(pvpEmbed)
              .setDescription(`Vòng chơi hiện tại: **${phase.toUpperCase()}**\n👤 Người đi lượt: <@${activePlayerId}>\n💵 Tổng Pot: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
          ],
          files: [attachment],
          components: getActionButtons(activePlayerId, raiseState !== null)
        });
      });

      gameCollector.on('end', async (_, reason) => {
        let outcome = '';
        let winColor = 0x0F4C81;

        if (reason === 'draw_accepted') {
          outcome = '🤝 Trận đấu đã hòa theo sự đồng thuận của hai bên!';
          winColor = 0x5865F2;
          await updatePlayerBalance(challengerId, interaction.user.username, p1TotalBet, true);
          await updatePlayerBalance(opponentId, opponentUser.username, p2TotalBet, true);
        } else if (reason === 'p1_fold') {
          outcome = `👤 <@${challengerId}> đã FOLD bài! <@${opponentId}> thắng cuộc và giành trọn Pot!`;
          winColor = 0x57F287;
          await updatePlayerBalance(opponentId, opponentUser.username, pot, true);
        } else if (reason === 'p2_fold') {
          outcome = `👤 <@${opponentId}> đã FOLD bài! <@${challengerId}> thắng cuộc và giành trọn Pot!`;
          winColor = 0x57F287;
          await updatePlayerBalance(challengerId, interaction.user.username, pot, true);
        } else if (reason === 'showdown') {
          const p1Eval = evaluate7CardHand([...p1Hand, ...communityCards]);
          const p2Eval = evaluate7CardHand([...p2Hand, ...communityCards]);

          const scoreDiff = p1Eval.score - p2Eval.score;

          if (scoreDiff > 0) {
            outcome = `🏆 <@${challengerId}> chiến thắng! (${p1Eval.rankName} thắng ${p2Eval.rankName})`;
            winColor = 0x57F287;
            await updatePlayerBalance(challengerId, interaction.user.username, pot, true);
          } else if (scoreDiff < 0) {
            outcome = `🏆 <@${opponentId}> chiến thắng! (${p2Eval.rankName} thắng ${p1Eval.rankName})`;
            winColor = 0x57F287;
            await updatePlayerBalance(opponentId, opponentUser.username, pot, true);
          } else {
            outcome = `🤝 Kết quả HÒA! Cả hai bên đều có ${p1Eval.rankName}`;
            winColor = 0x5865F2;
            await updatePlayerBalance(challengerId, interaction.user.username, p1TotalBet, true);
            await updatePlayerBalance(opponentId, opponentUser.username, p2TotalBet, true);
          }
        } else {
          outcome = `❌ Ván đấu kết thúc do hết thời gian chờ!`;
          winColor = 0xED4245;
          await updatePlayerBalance(challengerId, interaction.user.username, p1TotalBet, true);
          await updatePlayerBalance(opponentId, opponentUser.username, p2TotalBet, true);
        }

        // Xóa khóa Active Game Lock của cả hai
        kernel.cache.del(`active_game:${challengerId}`);
        kernel.cache.del(`active_game:${opponentId}`);

        buffer = await getPvpTable(false);
        attachment = new AttachmentBuilder(buffer, { name: 'poker.png' });

        const finalEmbed = new EmbedBuilder()
          .setTitle('🎴 Kết Quả Poker PvP')
          .setColor(winColor)
          .setDescription(`**${outcome}**\n\n💰 Tổng Pot giải quyết: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
          .setImage('attachment://poker.png')
          .setTimestamp();

        await interaction.editReply({
          embeds: [finalEmbed],
          files: [attachment],
          components: []
        });
      });
    }

    async function startRandomNumberGame() {
      const p1Num = Math.floor(Math.random() * 100) + 1;
      const p2Num = Math.floor(Math.random() * 100) + 1;
      const pot = bet * 2;

      let outcome = '';
      let winColor = 0xF6C453;

      const p1Name = interaction.user.username;
      const p2Name = opponentUser.username;

      if (p1Num > p2Num) {
        outcome = `🏆 **${p1Name}** chiến thắng! (${p1Num} vs ${p2Num})`;
        winColor = 0x57F287; // Xanh
        await updatePlayerBalance(challengerId, p1Name, pot, true);
      } else if (p2Num > p1Num) {
        outcome = `🏆 **${p2Name}** chiến thắng! (${p2Num} vs ${p1Num})`;
        winColor = 0x57F287;
        await updatePlayerBalance(opponentId, p2Name, pot, true);
      } else {
        outcome = `🤝 HÒA NHAU! Cả hai đều quay được số **${p1Num}**`;
        winColor = 0x5865F2; // Xanh dương
        await updatePlayerBalance(challengerId, p1Name, bet, true);
        await updatePlayerBalance(opponentId, p2Name, bet, true);
      }

      // Xóa khóa phiên chơi
      kernel.cache.del(`active_game:${challengerId}`);
      kernel.cache.del(`active_game:${opponentId}`);

      const resultEmbed = new EmbedBuilder()
        .setTitle('🔢 Kết Quả Số Ngẫu Nhiên PvP')
        .setColor(winColor)
        .setDescription(`⚔️ **${p1Name}** vs **${p2Name}**\n\n🎯 **${p1Name}** quay được: **${p1Num}**\n🎯 **${p2Name}** quay được: **${p2Num}**\n\n👉 Kết quả: **${outcome}**\n💰 Tổng Pot giải quyết: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
        .setTimestamp();

      await interaction.editReply({
        embeds: [resultEmbed],
        components: []
      });
    }

    async function startRandomCardGame() {
      const valuesMap: Record<string, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
      };
      const suitsMap: Record<Card['suit'], number> = {
        'S': 1, 'C': 2, 'D': 3, 'H': 4
      };

      const suitsVi: Record<Card['suit'], string> = {
        H: 'Cơ ♥',
        D: 'Rô ♦',
        C: 'Chuồn ♣',
        S: 'Bích ♠',
      };

      const deck = getDeck();
      const p1Card = deck.pop()!;
      const p2Card = deck.pop()!;

      const p1Score = valuesMap[p1Card.value] * 10 + suitsMap[p1Card.suit];
      const p2Score = valuesMap[p2Card.value] * 10 + suitsMap[p2Card.suit];
      const pot = bet * 2;

      let outcome = '';
      let winColor = 0xF6C453;

      const p1Name = interaction.user.username;
      const p2Name = opponentUser.username;

      const p1CardText = `**${p1Card.value}** ${suitsVi[p1Card.suit]}`;
      const p2CardText = `**${p2Card.value}** ${suitsVi[p2Card.suit]}`;

      if (p1Score > p2Score) {
        outcome = `🏆 **${p1Name}** chiến thắng! (${p1CardText} lớn hơn ${p2CardText})`;
        winColor = 0x57F287;
        await updatePlayerBalance(challengerId, p1Name, pot, true);
      } else {
        outcome = `🏆 **${p2Name}** chiến thắng! (${p2CardText} lớn hơn ${p1CardText})`;
        winColor = 0x57F287;
        await updatePlayerBalance(opponentId, p2Name, pot, true);
      }

      // Xóa khóa phiên chơi
      kernel.cache.del(`active_game:${challengerId}`);
      kernel.cache.del(`active_game:${opponentId}`);

      // Draw cards image using CardDrawer
      const buffer = await CardDrawer.drawRandomCards([p1Card, p2Card]);
      const attachment = new AttachmentBuilder(buffer, { name: 'random-cards-pvp.png' });

      const resultEmbed = new EmbedBuilder()
        .setTitle('🃏 Kết Quả Bài Ngẫu Nhiên PvP')
        .setColor(winColor)
        .setDescription(`⚔️ **${p1Name}** vs **${p2Name}**\n\n🃏 **${p1Name}** rút được: ${p1CardText}\n🃏 **${p2Name}** rút được: ${p2CardText}\n\n👉 Kết quả: **${outcome}**\n💰 Tổng Pot giải quyết: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
        .setImage('attachment://random-cards-pvp.png')
        .setTimestamp();

      await interaction.editReply({
        embeds: [resultEmbed],
        files: [attachment],
        components: []
      });
    }
  }
}
