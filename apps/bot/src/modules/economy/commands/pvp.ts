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
          { name: 'Poker Texas Hold\'em (1v1)', value: 'POKER' },
          { name: 'Poker Texas Hold\'em (4 Người)', value: 'POKER_4P' },
          { name: 'Blackjack (Xì Dách PvP 1v1)', value: 'BLACKJACK' },
          { name: 'Blackjack (Xì Dách PvP 4 Người)', value: 'BLACKJACK_4P' },
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
        .setDescription('Đối thủ 1')
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt
        .setName('opponent2')
        .setDescription('Đối thủ 2 (Chỉ dùng cho game 4 người)')
        .setRequired(false)
    )
    .addUserOption(opt =>
      opt
        .setName('opponent3')
        .setDescription('Đối thủ 3 (Chỉ dùng cho game 4 người)')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt
        .setName('amount')
        .setDescription('Số lượng bài rút (1-5 lá, chỉ áp dụng cho game Bài Ngẫu Nhiên PvP)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5)
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const guildId = interaction.guildId!;
    const challengerId = interaction.user.id;
    const opponentUser = interaction.options.getUser('opponent', true);
    const opponentId = opponentUser.id;
    const bet = interaction.options.getInteger('bet', true);
    const gameType = interaction.options.getString('game', true) as 'POKER' | 'POKER_4P' | 'BLACKJACK' | 'BLACKJACK_4P' | 'RANDOM_NUMBER' | 'RANDOM_CARD';

    await interaction.deferReply();

    const is4PlayerGame = gameType === 'POKER_4P' || gameType === 'BLACKJACK_4P';
    const opponentUser2 = interaction.options.getUser('opponent2');
    const opponentUser3 = interaction.options.getUser('opponent3');

    if (is4PlayerGame) {
      if (!opponentUser2 || !opponentUser3) {
        return void interaction.editReply({ content: '❌ Để chơi chế độ PvP 4 người, bạn phải chọn đủ 3 đối thủ bằng cách điền các tuỳ chọn opponent, opponent2 và opponent3!' });
      }
    }

    const opponents = [opponentUser];
    if (is4PlayerGame && opponentUser2 && opponentUser3) {
      opponents.push(opponentUser2, opponentUser3);
    }

    const allUsers = [interaction.user, ...opponents];
    const allUserIds = allUsers.map(u => u.id);
    const uniqueUserIds = new Set(allUserIds);
    if (uniqueUserIds.size !== allUsers.length) {
      return void interaction.editReply({ content: '❌ Các người chơi thách đấu phải là những người khác nhau và không trùng với bạn!' });
    }

    for (const u of opponents) {
      if (u.bot) {
        return void interaction.editReply({ content: '❌ Bạn không thể thách đấu với Bot.' });
      }
    }

    // Kiểm tra Khóa phiên chơi (Active Game Lock) của tất cả
    for (const u of allUsers) {
      const lock = kernel.cache.get(`active_game:${u.id}`);
      if (lock) {
        const lockTime = typeof lock === 'number' ? lock : 0;
        if (Date.now() - lockTime > 180000) {
          kernel.cache.del(`active_game:${u.id}`);
        } else {
          const remaining = Math.ceil((180000 - (Date.now() - lockTime)) / 1000);
          const name = u.id === challengerId ? 'Bạn' : `Người chơi <@${u.id}>`;
          return void interaction.editReply({ content: `❌ ${name} đang ở trong một phiên chơi khác chưa hoàn thành! Vui lòng chờ **${remaining}** giây để phiên cũ tự hủy.` });
        }
      }
    }

    // Đảm bảo thông tin người dùng được khởi tạo trong DB
    for (const u of allUsers) {
      await ensureMember(guildId, u.id);
    }

    const memberDbs: Record<string, any> = {};
    for (const u of allUsers) {
      const dbUser = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId: u.id } } });
      if (!dbUser) {
        return void interaction.editReply({ content: `❌ Lỗi hệ thống: Không tìm thấy tài khoản của người chơi <@${u.id}>.` });
      }
      memberDbs[u.id] = dbUser;
    }

    // Lấy loại tiền cược cá nhân của Người thách đấu để áp dụng
    const { config: challengerPrefs } = await getModuleConfig<Record<string, 'COIN' | 'VND'>>(guildId, 'casino_user_prefs');
    const currency = challengerPrefs[challengerId] ?? 'COIN';

    // Kiểm tra số dư của tất cả người chơi
    for (const u of allUsers) {
      const balance = currency === 'VND' ? memberDbs[u.id].vnd : memberDbs[u.id].balance;
      if (balance < bet) {
        const formatted = currency === 'VND' ? `${balance.toLocaleString('vi-VN')} ₫` : `${balance.toLocaleString()} Coins`;
        const name = u.id === challengerId ? 'Bạn không đủ số dư!' : `Người chơi <@${u.id}> không đủ số dư tương ứng!`;
        return void interaction.editReply({ content: `❌ ${name}\nSố dư hiện tại: **${formatted}**` });
      }
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

    if (!is4PlayerGame) {
      // 2. Gửi lời mời thách đấu 1v1
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
          kernel.cache.set(`active_game:${challengerId}`, Date.now(), 1800);
          kernel.cache.set(`active_game:${opponentId}`, Date.now(), 1800);

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
    } else {
      // 2. Gửi lời mời thách đấu 4 Người
      const gameLabel = gameType === 'POKER_4P' ? "Poker Texas Hold'em (4 Players)" : "Blackjack (Xì Dách) 4 Players";
      const acceptedList = new Set<string>([challengerId]);
      
      const getInviteDescription = () => {
        const opponentsStatus = opponents.map((opp, idx) => {
          const accepted = acceptedList.has(opp.id);
          return `Đối thủ ${idx + 1} - 👤 <@${opp.id}>: ${accepted ? '✅ **Đã đồng ý**' : '⏳ **Chờ đồng ý...**'}`;
        }).join('\n');

        return `👤 <@${challengerId}> thách đấu PvP 4 người game **${gameLabel}**!\n💵 Mức cược: **${currency === 'VND' ? `${bet.toLocaleString('vi-VN')} ₫` : `${bet.toLocaleString()} Coins`}**\n\n📌 **Trạng thái phòng:**\n👤 Trưởng phòng: <@${challengerId}> ✅\n${opponentsStatus}\n\n📢 **Thông báo:** Chỉ những người chơi đã chọn mới có thể sử dụng các nút chức năng trong trò chơi này!\n*Các đối thủ có 60 giây để đồng ý tham gia phòng chơi.*`;
      };

      const challengeEmbed = new EmbedBuilder()
        .setTitle(`⚔️ Thách Đấu PvP 4 Người`)
        .setColor(0xF6C453)
        .setDescription(getInviteDescription())
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

      let inviteFinished = false;

      challengeCollector.on('collect', async i => {
        const userId = i.user.id;
        
        if (i.customId === 'pvp:accept') {
          const isOpponent = opponents.some(opp => opp.id === userId);
          if (!isOpponent) {
            return void i.reply({ content: '❌ Bạn không nằm trong danh sách được mời thách đấu!', ephemeral: true });
          }
          if (acceptedList.has(userId)) {
            return void i.reply({ content: '❌ Bạn đã chấp nhận lời mời rồi!', ephemeral: true });
          }

          const checkOpponentDb = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId } } });
          const currentOpponentBal = currency === 'VND' ? checkOpponentDb?.vnd ?? 0 : checkOpponentDb?.balance ?? 0;

          if (currentOpponentBal < bet) {
            return void i.reply({ content: '❌ Bạn không đủ số dư để tham gia!', ephemeral: true });
          }

          await i.deferUpdate();
          const oppUser = opponents.find(opp => opp.id === userId)!;
          await updatePlayerBalance(userId, oppUser.username, bet, false);

          acceptedList.add(userId);

          await interaction.editReply({
            embeds: [
              EmbedBuilder.from(challengeEmbed)
                .setDescription(getInviteDescription())
            ]
          });

          if (acceptedList.size === 4) {
            inviteFinished = true;
            challengeCollector.stop('accepted');
          }
        } 
        
        else if (i.customId === 'pvp:decline') {
          const isParticipant = allUserIds.includes(userId);
          if (!isParticipant) {
            return void i.reply({ content: '❌ Bạn không có thẩm quyền trong lời mời này!', ephemeral: true });
          }

          await i.deferUpdate();
          inviteFinished = false;
          challengeCollector.stop('declined');
        }
      });

      challengeCollector.on('end', async (_, reason) => {
        if (reason === 'accepted' && inviteFinished) {
          for (const u of allUsers) {
            kernel.cache.set(`active_game:${u.id}`, Date.now(), 1800);
          }

          if (gameType === 'POKER_4P') {
            await startPoker4PGame();
          } else if (gameType === 'BLACKJACK_4P') {
            await startBlackjack4PGame();
          }
        } else {
          for (const userId of acceptedList) {
            const u = allUsers.find(user => user.id === userId)!;
            await updatePlayerBalance(userId, u.username, bet, true);
          }

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
    }

    // =================================================================
    // 🃏 GAME ENGINE 3: BLACKJACK PVP 4 PLAYERS
    // =================================================================
    async function startBlackjack4PGame() {
      const deck = getDeck();
      
      // Hands for 4 players
      const hands: Card[][] = [
        [deck.pop()!, deck.pop()!],
        [deck.pop()!, deck.pop()!],
        [deck.pop()!, deck.pop()!],
        [deck.pop()!, deck.pop()!]
      ];

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

      const getInitialCombo = (hand: Card[]): number => {
        if (hand.length !== 2) return 0; // NORMAL
        const aceCount = hand.filter(c => c.value === 'A').length;
        if (aceCount === 2) return 2; // XI_BAN
        const hasAce = hand.some(c => c.value === 'A');
        const has10Card = hand.some(c => ['10', 'J', 'Q', 'K'].includes(c.value));
        if (hasAce && has10Card) return 1; // XI_DACH
        return 0; // NORMAL
      };

      const scores = hands.map(hand => calculateScore(hand));
      const combos = hands.map(hand => getInitialCombo(hand));
      const pot = bet * 4;
      const playerNames = allUsers.map(u => u.username);

      // Check if any player has initial combos
      const hasInitialCombos = combos.some(c => c > 0);
      if (hasInitialCombos) {
        const maxCombo = Math.max(...combos);
        const winnersIndices: number[] = [];
        for (let i = 0; i < 4; i++) {
          if (combos[i] === maxCombo) {
            winnersIndices.push(i);
          }
        }

        let outcome = '';
        const comboName = maxCombo === 2 ? 'Xì Bàn (Đôi AA)' : 'Xì Dách';
        
        if (winnersIndices.length === 1) {
          const winnerIndex = winnersIndices[0];
          const winnerName = playerNames[winnerIndex];
          outcome = `🏆 **${winnerName}** thắng luôn nhờ có **${comboName}**!`;
          await updatePlayerBalance(allUsers[winnerIndex].id, allUsers[winnerIndex].username, pot, true);
        } else {
          const winnerNames = winnersIndices.map(idx => playerNames[idx]).join(', ');
          outcome = `🤝 HÒA NHAU! Các người chơi **${winnerNames}** đều có **${comboName}**!`;
          const splitAmount = Math.floor(pot / winnersIndices.length);
          for (const idx of winnersIndices) {
            await updatePlayerBalance(allUsers[idx].id, allUsers[idx].username, splitAmount, true);
          }
        }

        for (const u of allUsers) {
          kernel.cache.del(`active_game:${u.id}`);
        }

        const buffer = await CardDrawer.drawBlackjack4PTable(
          hands,
          scores,
          playerNames,
          bet,
          currency,
          -1,
          false,
          outcome
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'bj-pvp-4p.png' });

        const finalEmbed = new EmbedBuilder()
          .setTitle('🃏 Kết Quả Blackjack PvP 4P')
          .setColor(0x57F287)
          .setDescription(`**${outcome}**\n\n💰 Tổng Pot giải quyết: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
          .setImage('attachment://bj-pvp-4p.png')
          .setTimestamp();

        return void interaction.editReply({
          embeds: [finalEmbed],
          files: [attachment],
          components: []
        });
      }

      let activeIndex = 0;
      let stood = [false, false, false, false];
      const privateInteractions: Record<string, any> = {};

      const updatePrivateHand = async (targetUserId: string) => {
        const pInt = privateInteractions[targetUserId];
        if (!pInt) return;

        const playerIdx = allUserIds.indexOf(targetUserId);
        if (playerIdx === -1) return;

        const myHand = hands[playerIdx];
        const myScore = scores[playerIdx];

        try {
          const privateBuffer = await CardDrawer.drawRandomCards(myHand);
          const privateAttach = new AttachmentBuilder(privateBuffer, { name: 'bj-private-4p.png' });

          const suitsVi: Record<Card['suit'], string> = { H: 'Cơ ♥', D: 'Rô ♦', C: 'Chuồn ♣', S: 'Bích ♠' };
          const cardText = myHand.map(c => `**${c.value}** ${suitsVi[c.suit]}`).join(', ');

          await pInt.editReply({
            content: `🃏 Bài Blackjack của bạn: ${cardText} (Tổng điểm: **${myScore}** / 21)`,
            files: [privateAttach]
          });
        } catch (err) {
          delete privateInteractions[targetUserId];
        }
      };

      const getPvp4PBjButtons = () => {
        const activeUser = allUsers[activeIndex];
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('bj_4p:hit').setLabel('Rút Bài (Hit)').setStyle(ButtonStyle.Success).setEmoji('🃏').setDisabled(hands[activeIndex].length >= 5 || stood[activeIndex]),
          new ButtonBuilder().setCustomId('bj_4p:stand').setLabel('Dừng Bài (Stand)').setStyle(ButtonStyle.Danger).setEmoji('🛑').setDisabled(stood[activeIndex]),
          new ButtonBuilder().setCustomId('bj_4p:view_cards').setLabel('👁️ Xem bài của mình').setStyle(ButtonStyle.Secondary)
        );
        return [row];
      };

      const getTableBuffer = async (outcome?: string) => {
        return CardDrawer.drawBlackjack4PTable(
          hands,
          scores,
          playerNames,
          bet,
          currency,
          activeIndex,
          !outcome,
          outcome
        );
      };

      let buffer = await getTableBuffer();
      let attachment = new AttachmentBuilder(buffer, { name: 'bj-pvp-4p.png' });

      let statusText = `Lượt của **${allUsers[activeIndex].username}** (Rút hoặc Dừng).`;
      const potDisplay = currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`;

      const bjEmbed = new EmbedBuilder()
        .setTitle('🃏 Blackjack PvP 4 Người')
        .setColor(0x105B34)
        .setDescription(`🃏 **Quy định:** Chỉ người đến lượt mới có thể bấm Hit/Stand!\n👤 Lượt đi: <@${allUsers[activeIndex].id}>\n\n*${statusText}*\n\n💰 Tổng Pot: **${potDisplay}**`)
        .setImage('attachment://bj-pvp-4p.png')
        .setTimestamp();

      const gameMsg = await interaction.editReply({
        embeds: [bjEmbed],
        files: [attachment],
        components: getPvp4PBjButtons()
      });

      const gameCollector = gameMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: 90000
      });

      gameCollector.on('collect', async i => {
        const userId = i.user.id;

        if (i.customId === 'bj_4p:view_cards') {
          const playerIdx = allUserIds.indexOf(userId);
          if (playerIdx === -1) {
            return void i.reply({ content: '❌ Bạn không tham gia ván chơi này!', ephemeral: true });
          }

          await i.deferReply({ ephemeral: true });
          privateInteractions[userId] = i;
          await updatePrivateHand(userId);
          return;
        }

        const expectedUserId = allUsers[activeIndex].id;
        if (userId !== expectedUserId) {
          const isParticipant = allUserIds.includes(userId);
          if (!isParticipant) {
            return void i.reply({ content: '❌ Bạn không tham gia ván đấu này!', ephemeral: true });
          } else {
            return void i.reply({ content: `❌ Chưa đến lượt của bạn! Hiện tại đang là lượt của <@${expectedUserId}>.`, ephemeral: true });
          }
        }

        await i.deferUpdate();

        const advancePlayer = () => {
          activeIndex++;
          if (activeIndex >= 4) {
            gameCollector.stop('showdown');
          } else {
            statusText = `Lượt tiếp theo của **${allUsers[activeIndex].username}**.`;
          }
        };

        if (i.customId === 'bj_4p:hit') {
          hands[activeIndex].push(deck.pop()!);
          scores[activeIndex] = calculateScore(hands[activeIndex]);
          await updatePrivateHand(expectedUserId);

          if (scores[activeIndex] > 21) {
            stood[activeIndex] = true;
            statusText = `**${allUsers[activeIndex].username}** đã rút 1 lá bài và bị BUST (>21 điểm)!`;
            advancePlayer();
          } else if (hands[activeIndex].length >= 5) {
            stood[activeIndex] = true;
            statusText = `**${allUsers[activeIndex].username}** đã rút đủ 5 lá bài (Ngũ Linh)!`;
            advancePlayer();
          } else {
            statusText = `**${allUsers[activeIndex].username}** đã rút 1 lá bài và tiếp tục lượt.`;
          }
        } else if (i.customId === 'bj_4p:stand') {
          stood[activeIndex] = true;
          statusText = `**${allUsers[activeIndex].username}** đã Dừng bài (Stand).`;
          advancePlayer();
        }

        if (activeIndex < 4) {
          buffer = await getTableBuffer();
          attachment = new AttachmentBuilder(buffer, { name: 'bj-pvp-4p.png' });

          await interaction.editReply({
            embeds: [
              EmbedBuilder.from(bjEmbed)
                .setDescription(`🃏 **Quy định:** Chỉ người đến lượt mới có thể bấm Hit/Stand!\n👤 Lượt đi: <@${allUsers[activeIndex].id}>\n\n*${statusText}*\n\n💰 Tổng Pot: **${potDisplay}**`)
            ],
            files: [attachment],
            components: getPvp4PBjButtons()
          });
        }
      });

      gameCollector.on('end', async (_, reason) => {
        let outcome = '';
        let winColor = 0xF6C453;

        if (reason === 'showdown') {
          const finalScores = scores;
          const finalHands = hands;
          
          const nguLinhs: number[] = [];
          const valids: number[] = [];
          
          for (let i = 0; i < 4; i++) {
            const hasNguLinh = finalHands[i].length === 5 && finalScores[i] <= 21;
            const isBust = finalScores[i] > 21;
            
            if (hasNguLinh) {
              nguLinhs.push(i);
            } else if (!isBust) {
              valids.push(i);
            }
          }

          if (nguLinhs.length > 0) {
            nguLinhs.sort((a, b) => finalScores[a] - finalScores[b]);
            const minScore = finalScores[nguLinhs[0]];
            const winners = nguLinhs.filter(idx => finalScores[idx] === minScore);

            if (winners.length === 1) {
              const winIdx = winners[0];
              outcome = `🏆 **${playerNames[winIdx]}** thắng tuyệt đối nhờ đạt **Ngũ Linh** (${finalScores[winIdx]} điểm)!`;
              winColor = 0x57F287;
              await updatePlayerBalance(allUsers[winIdx].id, allUsers[winIdx].username, pot, true);
            } else {
              const winNames = winners.map(idx => playerNames[idx]).join(', ');
              outcome = `🤝 HÒA NHAU! Các người chơi **${winNames}** cùng đạt **Ngũ Linh** với ${minScore} điểm!`;
              winColor = 0x5865F2;
              const splitAmount = Math.floor(pot / winners.length);
              for (const idx of winners) {
                await updatePlayerBalance(allUsers[idx].id, allUsers[idx].username, splitAmount, true);
              }
            }
          } else if (valids.length > 0) {
            valids.sort((a, b) => finalScores[b] - finalScores[a]);
            const maxScore = finalScores[valids[0]];
            const winners = valids.filter(idx => finalScores[idx] === maxScore);

            if (winners.length === 1) {
              const winIdx = winners[0];
              outcome = `🏆 **${playerNames[winIdx]}** chiến thắng với số điểm cao nhất: **${maxScore}**!`;
              winColor = 0x57F287;
              await updatePlayerBalance(allUsers[winIdx].id, allUsers[winIdx].username, pot, true);
            } else {
              const winNames = winners.map(idx => playerNames[idx]).join(', ');
              outcome = `🤝 HÒA NHAU! Các người chơi **${winNames}** cùng có điểm số cao nhất là **${maxScore}**!`;
              winColor = 0x5865F2;
              const splitAmount = Math.floor(pot / winners.length);
              for (const idx of winners) {
                await updatePlayerBalance(allUsers[idx].id, allUsers[idx].username, splitAmount, true);
              }
            }
          } else {
            outcome = '🤝 HÒA! Tất cả các người chơi đều bị BUST (>21 điểm). Hoàn tiền cược!';
            winColor = 0x5865F2;
            for (let i = 0; i < 4; i++) {
              await updatePlayerBalance(allUsers[i].id, allUsers[i].username, bet, true);
            }
          }
        } else {
          outcome = '❌ Trận đấu kết thúc do quá thời gian chờ (idle)! Hoàn tiền cược.';
          winColor = 0xED4245;
          for (let i = 0; i < 4; i++) {
            await updatePlayerBalance(allUsers[i].id, allUsers[i].username, bet, true);
          }
        }

        for (const u of allUsers) {
          kernel.cache.del(`active_game:${u.id}`);
        }

        buffer = await getTableBuffer(outcome);
        attachment = new AttachmentBuilder(buffer, { name: 'bj-pvp-4p.png' });

        const finalEmbed = new EmbedBuilder()
          .setTitle('🃏 Kết Quả Blackjack PvP 4 Người')
          .setColor(winColor)
          .setDescription(`**${outcome}**\n\n💰 Tổng Pot giải quyết: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
          .setImage('attachment://bj-pvp-4p.png')
          .setTimestamp();

        await interaction.editReply({
          embeds: [finalEmbed],
          files: [attachment],
          components: []
        });
      });
    }

    // =================================================================
    // 🎴 GAME ENGINE 4: POKER PVP 4 PLAYERS
    // =================================================================
    async function startPoker4PGame() {
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
      const hands: Card[][] = [
        [deck.pop()!, deck.pop()!],
        [deck.pop()!, deck.pop()!],
        [deck.pop()!, deck.pop()!],
        [deck.pop()!, deck.pop()!]
      ];
      const communityCards: Card[] = [];

      const flopCards = [deck.pop()!, deck.pop()!, deck.pop()!];
      const turnCard = deck.pop()!;
      const riverCard = deck.pop()!;

      let bets = [bet, bet, bet, bet];
      let pot = bet * 4;
      let playerFolded = [false, false, false, false];
      let hasActed = [false, false, false, false];
      let highestBet = bet;

      let phase: 'preflop' | 'flop1' | 'flop2' | 'flop3' | 'turn' | 'river' | 'showdown' = 'preflop';
      let activePlayerIndex = 0;
      let statusText = `Lượt của <@${allUsers[activePlayerIndex].id}>. Hãy đưa ra quyết định.`;
      const playerNames = allUsers.map(u => u.username);
      const privateInteractions: Record<string, any> = {};

      const updatePrivateHand = async (targetUserId: string) => {
        const pInt = privateInteractions[targetUserId];
        if (!pInt) return;

        const playerIdx = allUserIds.indexOf(targetUserId);
        if (playerIdx === -1) return;

        const hand = hands[playerIdx];

        try {
          const allCards = [...hand, ...communityCards];
          const privateBuffer = await CardDrawer.drawRandomCards(allCards);
          const privateAttach = new AttachmentBuilder(privateBuffer, { name: 'pocket.png' });

          const suitsVi: Record<Card['suit'], string> = { H: 'Cơ ♥', D: 'Rô ♦', C: 'Chuồn ♣', S: 'Bích ♠' };
          const pocketText = hand.map(c => `**${c.value}** ${suitsVi[c.suit]}`).join(', ');
          
          let comboText = '';
          if (communityCards.length >= 3) {
            const evalResult = evaluate7CardHand([...hand, ...communityCards]);
            comboText = `\n✨ Liên kết tốt nhất hiện tại: **${evalResult.rankName}**`;
          }

          let msgContent = `🎴 Bài tẩy của bạn: ${pocketText}${comboText}`;
          if (communityCards.length > 0) {
            const communityText = communityCards.map(c => `**${c.value}** ${suitsVi[c.suit]}`).join(', ');
            msgContent += `\n🃏 Bài chung đã lật: ${communityText}`;
          }

          await pInt.editReply({
            content: msgContent,
            files: [privateAttach]
          });
        } catch (err) {
          delete privateInteractions[targetUserId];
        }
      };

      const getPvpTable = async (hideAll = true) => {
        let displayStatusText = statusText;
        for (const u of allUsers) {
          displayStatusText = displayStatusText.replace(new RegExp(`<@${u.id}>`, 'g'), u.username);
        }

        return CardDrawer.drawPoker4PTable(
          hands,
          communityCards,
          pot,
          bets,
          currency,
          phase === 'preflop' ? 'Preflop' : phase === 'flop1' ? 'Flop 1' : phase === 'flop2' ? 'Flop 2' : phase === 'flop3' ? 'Flop 3' : phase === 'turn' ? 'Turn' : phase === 'river' ? 'River' : 'Showdown',
          playerNames,
          activePlayerIndex,
          hideAll,
          displayStatusText
        );
      };

      const getActionButtons = () => {
        const isCheckAllowed = phase === 'flop2';
        const hasRaise = highestBet > bets[activePlayerIndex];
        const checkLabel = hasRaise ? 'Theo Cược (Call)' : (isCheckAllowed ? 'Xem Bài (Check)' : 'Theo Cược (Call)');
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('poker_4p:check_call')
            .setLabel(checkLabel)
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId('poker_4p:raise')
            .setLabel(`Tăng cược (+${bet.toLocaleString()})`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔺')
            .setDisabled(!isCheckAllowed),
          new ButtonBuilder()
            .setCustomId('poker_4p:fold')
            .setLabel('Bỏ bài (Fold)')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🏳️'),
          new ButtonBuilder()
            .setCustomId('poker_4p:view_cards')
            .setLabel('👁️ Xem bài tẩy')
            .setStyle(ButtonStyle.Secondary)
        );
        return [row];
      };

      const checkRoundComplete = (): boolean => {
        const activeIndices: number[] = [];
        for (let i = 0; i < 4; i++) {
          if (!playerFolded[i]) {
            activeIndices.push(i);
          }
        }
        return activeIndices.every(idx => hasActed[idx]);
      };

      const advancePhase = () => {
        if (phase === 'preflop') {
          phase = 'flop1';
          communityCards.push(flopCards[0]);
          statusText = `Vòng 2: lật lá chung thứ 1.`;
        } else if (phase === 'flop1') {
          phase = 'flop2';
          communityCards.push(flopCards[1]);
          statusText = `Vòng 3: lật lá chung thứ 2 (Được phép Check/Raise).`;
        } else if (phase === 'flop2') {
          phase = 'flop3';
          communityCards.push(flopCards[2]);
          statusText = `Vòng 4: lật lá chung thứ 3.`;
        } else if (phase === 'flop3') {
          phase = 'turn';
          communityCards.push(turnCard);
          statusText = `Vòng 5: lật lá chung thứ 4.`;
        } else if (phase === 'turn') {
          phase = 'river';
          communityCards.push(riverCard);
          statusText = `Vòng 6: lật lá chung thứ 5!`;
        } else {
          phase = 'showdown';
          gameEnded = true;
          gameCollector.stop('showdown');
          return;
        }

        for (let i = 0; i < 4; i++) {
          hasActed[i] = false;
        }
        activePlayerIndex = playerFolded.indexOf(false);
        statusText += ` Lượt của <@${allUsers[activePlayerIndex].id}>.`;
        Promise.all(allUsers.map(u => updatePrivateHand(u.id))).catch(() => null);
      };

      const checkAndSkipAllIn = async () => {
        while (!gameEnded) {
          const userId = allUsers[activePlayerIndex].id;
          const m = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId } } });
          const balance = m ? (currency === 'VND' ? m.vnd : m.balance) : 0;
          if (balance === 0 && !playerFolded[activePlayerIndex]) {
            hasActed[activePlayerIndex] = true;
            statusText = `Người chơi <@${userId}> đã All-In, tự động qua lượt.`;
            const isRoundComplete = checkRoundComplete();
            if (isRoundComplete) {
              advancePhase();
            } else {
              do { activePlayerIndex = (activePlayerIndex + 1) % 4 } while (playerFolded[activePlayerIndex]);
            }
          } else {
            break;
          }
        }
      };

      let buffer = await getPvpTable(true);
      let attachment = new AttachmentBuilder(buffer, { name: 'poker-4p.png' });

      const pvpEmbed = new EmbedBuilder()
        .setTitle('🎴 Poker PvP 4 Người')
        .setColor(0x0F4C81)
        .setDescription(`Ván đấu bắt đầu!\n👤 Người đi lượt: <@${allUsers[activePlayerIndex].id}>\n💵 Tổng Pot: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
        .setImage('attachment://poker-4p.png')
        .setTimestamp();

      const gameMsg = await interaction.editReply({
        embeds: [pvpEmbed],
        files: [attachment],
        components: getActionButtons()
      });

      const gameCollector = gameMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: 90000
      });

      let gameEnded = false;

      const updateDisplay = async () => {
        buffer = await getPvpTable(true);
        attachment = new AttachmentBuilder(buffer, { name: 'poker-4p.png' });
        await interaction.editReply({
          embeds: [
            EmbedBuilder.from(pvpEmbed)
              .setDescription(`Vòng chơi hiện tại: **${phase.toUpperCase()}**\n👤 Người đi lượt: <@${allUsers[activePlayerIndex].id}>\n💵 Tổng Pot: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**\n\n*${statusText}*`)
          ],
          files: [attachment],
          components: getActionButtons()
        });
      };

      gameCollector.on('collect', async i => {
        if (gameEnded) return;
        const userId = i.user.id;

        if (i.customId === 'poker_4p:view_cards') {
          const playerIdx = allUserIds.indexOf(userId);
          if (playerIdx === -1) {
            return void i.reply({ content: '❌ Bạn không tham gia trận đấu này!', ephemeral: true });
          }

          await i.deferReply({ ephemeral: true });
          privateInteractions[userId] = i;
          await updatePrivateHand(userId);
          return;
        }

        const expectedUserId = allUsers[activePlayerIndex].id;
        if (userId !== expectedUserId) {
          const isParticipant = allUserIds.includes(userId);
          if (!isParticipant) {
            return void i.reply({ content: '❌ Bạn không tham gia ván đấu này!', ephemeral: true });
          } else {
            return void i.reply({ content: `❌ Chưa đến lượt của bạn! Hiện tại đang là lượt của <@${expectedUserId}>.`, ephemeral: true });
          }
        }

        if (i.customId === 'poker_4p:fold') {
          await i.deferUpdate();
          playerFolded[activePlayerIndex] = true;
          statusText = `<@${userId}> đã FOLD bài!`;

          const activeCount = playerFolded.filter(f => !f).length;
          if (activeCount === 1) {
            gameEnded = true;
            gameCollector.stop('win_by_fold');
            return;
          }

          const isRoundComplete = checkRoundComplete();
          if (isRoundComplete) {
            advancePhase();
          } else {
            do { activePlayerIndex = (activePlayerIndex + 1) % 4 } while (playerFolded[activePlayerIndex]);
          }

          await checkAndSkipAllIn();
          if (!gameEnded) await updateDisplay();
          return;
        }

        if (i.customId === 'poker_4p:raise') {
          const modal = new ModalBuilder()
            .setCustomId('poker_4p_raise_modal')
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
            filter: modalInteraction => modalInteraction.customId === 'poker_4p_raise_modal' && modalInteraction.user.id === i.user.id,
            time: 60000
          }).catch(() => null);

          if (!submit) return;
          await submit.deferUpdate();

          const valStr = submit.fields.getTextInputValue('raise_amount_input');
          const raiseAmount = parseInt(valStr.replace(/[^0-9]/g, ''));
          if (isNaN(raiseAmount) || raiseAmount <= 0) {
            return void submit.followUp({ content: '❌ Số tiền tăng cược không hợp lệ!', ephemeral: true });
          }

          const m = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId } } });
          const currentBal = m ? (currency === 'VND' ? m.vnd : m.balance) : 0;
          if (currentBal < raiseAmount) {
            return void submit.followUp({ content: '❌ Số dư của bạn không đủ để tăng cược!', ephemeral: true });
          }

          await updatePlayerBalance(userId, i.user.username, raiseAmount, false);
          
          bets[activePlayerIndex] += raiseAmount;
          pot += raiseAmount;
          highestBet = bets[activePlayerIndex];

          for (let pIdx = 0; pIdx < 4; pIdx++) {
            if (pIdx !== activePlayerIndex) {
              hasActed[pIdx] = false;
            }
          }
          hasActed[activePlayerIndex] = true;

          statusText = `<@${userId}> đã TĂNG CƯỢC (+${raiseAmount.toLocaleString()})!`;
          
          do { activePlayerIndex = (activePlayerIndex + 1) % 4 } while (playerFolded[activePlayerIndex]);
          
          await checkAndSkipAllIn();
          if (!gameEnded) await updateDisplay();
          return;
        }

        if (i.customId === 'poker_4p:check_call') {
          await i.deferUpdate();
          const hasRaise = highestBet > bets[activePlayerIndex];
          if (hasRaise) {
            const betDiff = highestBet - bets[activePlayerIndex];
            const m = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId } } });
            const currentBal = m ? (currency === 'VND' ? m.vnd : m.balance) : 0;

            const actualCallAmount = Math.min(betDiff, currentBal);
            await updatePlayerBalance(userId, i.user.username, actualCallAmount, false);
            
            bets[activePlayerIndex] += actualCallAmount;
            pot += actualCallAmount;
            statusText = `<@${userId}> đã THEO CƯỢC (Call) ${actualCallAmount.toLocaleString()}.`;
          } else {
            statusText = `<@${userId}> đã CHECK.`;
          }

          hasActed[activePlayerIndex] = true;

          const isRoundComplete = checkRoundComplete();
          if (isRoundComplete) {
            advancePhase();
          } else {
            do { activePlayerIndex = (activePlayerIndex + 1) % 4 } while (playerFolded[activePlayerIndex]);
          }

          await checkAndSkipAllIn();
          if (!gameEnded) await updateDisplay();
          return;
        }
      });

      gameCollector.on('end', async (_, reason) => {
        let outcome = '';
        let winColor = 0x0F4C81;

        if (reason === 'win_by_fold') {
          const winnerIndex = playerFolded.indexOf(false);
          const winner = allUsers[winnerIndex];
          outcome = `🏆 <@${winner.id}> chiến thắng do tất cả đối thủ đều Fold! Nhận trọn Pot!`;
          winColor = 0x57F287;
          await updatePlayerBalance(winner.id, winner.username, pot, true);
        } else if (reason === 'showdown') {
          const playerEvals: { index: number; evalResult: EvaluatedHand }[] = [];
          for (let i = 0; i < 4; i++) {
            if (!playerFolded[i]) {
              const res = evaluate7CardHand([...hands[i], ...communityCards]);
              playerEvals.push({ index: i, evalResult: res });
            }
          }

          playerEvals.sort((a, b) => b.evalResult.score - a.evalResult.score);
          const maxScore = playerEvals[0].evalResult.score;
          const winners = playerEvals.filter(e => e.evalResult.score === maxScore);

          if (winners.length === 1) {
            const winnerIdx = winners[0].index;
            outcome = `🏆 <@${allUsers[winnerIdx].id}> chiến thắng với bài **${winners[0].evalResult.rankName}**!`;
            winColor = 0x57F287;
            await updatePlayerBalance(allUsers[winnerIdx].id, allUsers[winnerIdx].username, pot, true);
          } else {
            const winNames = winners.map(w => `<@${allUsers[w.index].id}>`).join(', ');
            outcome = `🤝 HÒA NHAU! Các người chơi **${winNames}** cùng có bài **${winners[0].evalResult.rankName}**!`;
            winColor = 0x5865F2;
            const splitAmount = Math.floor(pot / winners.length);
            for (const w of winners) {
              await updatePlayerBalance(allUsers[w.index].id, allUsers[w.index].username, splitAmount, true);
            }
          }
        } else {
          outcome = `❌ Ván đấu kết thúc do hết thời gian chờ! Hoàn trả tiền cược.`;
          winColor = 0xED4245;
          for (let i = 0; i < 4; i++) {
            await updatePlayerBalance(allUsers[i].id, allUsers[i].username, bets[i], true);
          }
        }

        for (const u of allUsers) {
          kernel.cache.del(`active_game:${u.id}`);
        }

        statusText = outcome;
        buffer = await getPvpTable(false);
        attachment = new AttachmentBuilder(buffer, { name: 'poker-4p.png' });

        const finalEmbed = new EmbedBuilder()
          .setTitle('🎴 Kết Quả Poker PvP 4 Người')
          .setColor(winColor)
          .setDescription(`**${outcome}**\n\n💰 Tổng Pot giải quyết: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
          .setImage('attachment://poker-4p.png')
          .setTimestamp();

        await interaction.editReply({
          embeds: [finalEmbed],
          files: [attachment],
          components: []
        });
      });
    }

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
      const privateInteractions: Record<string, any> = {};

      const updatePrivateHand = async (targetUserId: string) => {
        const pInt = privateInteractions[targetUserId];
        if (!pInt) return;

        const isChallenger = targetUserId === challengerId;
        const myHand = isChallenger ? p1Hand : p2Hand;
        const myScore = isChallenger ? p1Score : p2Score;

        try {
          const privateBuffer = await CardDrawer.drawRandomCards(myHand);
          const privateAttach = new AttachmentBuilder(privateBuffer, { name: 'bj-private.png' });

          const suitsVi: Record<Card['suit'], string> = { H: 'Cơ ♥', D: 'Rô ♦', C: 'Chuồn ♣', S: 'Bích ♠' };
          const cardText = myHand.map(c => `**${c.value}** ${suitsVi[c.suit]}`).join(', ');

          await pInt.editReply({
            content: `🃏 Bài Blackjack của bạn: ${cardText} (Tổng điểm: **${myScore}** / 21)`,
            files: [privateAttach]
          });
        } catch (err) {
          delete privateInteractions[targetUserId];
        }
      };

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
        idle: 90000
      });


      gameCollector.on('collect', async i => {
        // Private view cards action
        if (i.customId === 'bj_pvp:view_cards') {
          if (i.user.id !== challengerId && i.user.id !== opponentId) {
            return void i.reply({ content: '❌ Bạn không tham gia ván chơi này!', ephemeral: true });
          }

          await i.deferReply({ ephemeral: true });
          privateInteractions[i.user.id] = i;
          await updatePrivateHand(i.user.id);
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
            await updatePrivateHand(challengerId);
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
            await updatePrivateHand(opponentId);
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
      const privateInteractions: Record<string, any> = {};

      const updatePrivateHand = async (targetUserId: string) => {
        const pInt = privateInteractions[targetUserId];
        if (!pInt) return;

        const isChallenger = targetUserId === challengerId;
        const hand = isChallenger ? p1Hand : p2Hand;

        try {
          const allCards = [...hand, ...communityCards];
          const privateBuffer = await CardDrawer.drawRandomCards(allCards);
          const privateAttach = new AttachmentBuilder(privateBuffer, { name: 'pocket.png' });

          const suitsVi: Record<Card['suit'], string> = { H: 'Cơ ♥', D: 'Rô ♦', C: 'Chuồn ♣', S: 'Bích ♠' };
          const pocketText = hand.map(c => `**${c.value}** ${suitsVi[c.suit]}`).join(', ');
          
          let comboText = '';
          if (communityCards.length >= 3) {
            const evalResult = evaluate7CardHand([...hand, ...communityCards]);
            comboText = `\n✨ Liên kết tốt nhất hiện tại: **${evalResult.rankName}**`;
          }

          let msgContent = `🎴 Bài tẩy của bạn: ${pocketText}${comboText}`;
          if (communityCards.length > 0) {
            const communityText = communityCards.map(c => `**${c.value}** ${suitsVi[c.suit]}`).join(', ');
            msgContent += `\n🃏 Bài chung đã lật: ${communityText}`;
          }

          await pInt.editReply({
            content: msgContent,
            files: [privateAttach]
          });
        } catch (err) {
          delete privateInteractions[targetUserId];
        }
      };

      const getPvpTable = async (hideAll = true) => {
        const displayStatusText = statusText
          .replace(new RegExp(`<@${challengerId}>`, 'g'), interaction.user.username)
          .replace(new RegExp(`<@${opponentId}>`, 'g'), opponentUser.username);

        return CardDrawer.drawPokerTable(
          p1Hand,
          p2Hand,
          communityCards,
          pot,
          p1TotalBet,
          p2TotalBet,
          currency,
          phase === 'preflop' ? 'Preflop' : phase === 'flop1' ? 'Flop 1' : phase === 'flop2' ? 'Flop 2' : phase === 'flop3' ? 'Flop 3' : phase === 'turn' ? 'Turn' : phase === 'river' ? 'River' : 'Showdown',
          displayStatusText,
          hideAll, // hideBotHand
          hideAll, // hidePlayerHand
          interaction.user.username.toUpperCase(),
          opponentUser.username.toUpperCase()
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
        idle: 90000
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
        Promise.all([
          updatePrivateHand(challengerId),
          updatePrivateHand(opponentId)
        ]).catch(() => null);
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
        await Promise.all([
          updatePrivateHand(challengerId),
          updatePrivateHand(opponentId)
        ]).catch(() => null);
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
          privateInteractions[i.user.id] = i;
          await updatePrivateHand(i.user.id);
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
      const amount = interaction.options.getInteger('amount') ?? 1;

      const suitsVi: Record<Card['suit'], string> = {
        H: 'Cơ ♥',
        D: 'Rô ♦',
        C: 'Chuồn ♣',
        S: 'Bích ♠',
      };

      const deck = getDeck();
      const p1Hand: Card[] = [];
      const p2Hand: Card[] = [];
      for (let i = 0; i < amount; i++) {
        p1Hand.push(deck.pop()!);
        p2Hand.push(deck.pop()!);
      }

      const p1Flipped = new Array(amount).fill(false);
      const p2Flipped = new Array(amount).fill(false);
      const pot = bet * 2;

      const p1Name = interaction.user.username;
      const p2Name = opponentUser.username;

      // Helper tạo chuỗi mô tả bài
      const getHandText = (hand: Card[], flipped: boolean[]): string => {
        return hand
          .map((c, idx) => {
            if (flipped[idx]) {
              return `**${c.value}** ${suitsVi[c.suit]}`;
            }
            return `\`[Úp 🔒]\``;
          })
          .join(', ');
      };

      const getTableBuffer = async (outcome?: string) => {
        return CardDrawer.drawPvpCardsTable(
          p1Hand,
          p2Hand,
          p1Flipped,
          p2Flipped,
          p1Name,
          p2Name,
          bet,
          currency,
          outcome
        );
      };

      let buffer = await getTableBuffer();
      let attachment = new AttachmentBuilder(buffer, { name: `rc-pvp_${Date.now()}.png` });

      const getButtons = () => {
        const p1All = p1Flipped.every(v => v === true);
        const p2All = p2Flipped.every(v => v === true);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('rnd_pvp:draw')
            .setLabel('Rút 1 lá (Draw)')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕')
            .setDisabled(p1All && p2All),
          new ButtonBuilder()
            .setCustomId('rnd_pvp:reveal')
            .setLabel('Mở tất cả (Reveal)')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👁️')
            .setDisabled(p1All && p2All)
        );
        return [row];
      };

      const getEmbed = (fileName: string) => {
        const p1Count = p1Flipped.filter(v => v).length;
        const p2Count = p2Flipped.filter(v => v).length;

        return new EmbedBuilder()
          .setTitle('🃏 Bài Ngẫu Nhiên PvP (Interactive)')
          .setColor(0x103f6b)
          .setDescription(`⚔️ **${p1Name}** vs **${p2Name}**\n\n🃏 **${p1Name}** (Đã lật ${p1Count}/${amount}):\n👉 ${getHandText(p1Hand, p1Flipped)}\n\n🃏 **${p2Name}** (Đã lật ${p2Count}/${amount}):\n👉 ${getHandText(p2Hand, p2Flipped)}\n\n*Bấm nút bên dưới để tự rút/lật lá bài tiếp theo của bạn!*`)
          .setImage(`attachment://${fileName}`)
          .setTimestamp();
      };

      const gameMsg = await interaction.editReply({
        embeds: [getEmbed(attachment.name!)],
        files: [attachment],
        components: getButtons()
      });

      const gameCollector = gameMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: 90000
      });

      gameCollector.on('collect', async i => {
        if (i.user.id !== challengerId && i.user.id !== opponentId) {
          return void i.reply({ content: '❌ Bạn không tham gia ván đấu này!', ephemeral: true });
        }

        await i.deferUpdate();

        if (i.customId === 'rnd_pvp:draw') {
          if (i.user.id === challengerId) {
            const nextIdx = p1Flipped.indexOf(false);
            if (nextIdx !== -1) {
              p1Flipped[nextIdx] = true;
            } else {
              return void i.followUp({ content: '❌ Bạn đã lật hết bài của mình!', ephemeral: true });
            }
          } else {
            const nextIdx = p2Flipped.indexOf(false);
            if (nextIdx !== -1) {
              p2Flipped[nextIdx] = true;
            } else {
              return void i.followUp({ content: '❌ Bạn đã lật hết bài của mình!', ephemeral: true });
            }
          }
        } else if (i.customId === 'rnd_pvp:reveal') {
          if (i.user.id === challengerId) {
            p1Flipped.fill(true);
          } else {
            p2Flipped.fill(true);
          }
        }

        // Kiểm tra xem cả hai bên đã lật hết chưa
        const p1All = p1Flipped.every(v => v === true);
        const p2All = p2Flipped.every(v => v === true);
        if (p1All && p2All) {
          gameCollector.stop('showdown');
          return;
        }

        // Cập nhật giao diện
        attachment = await getAttachmentFilename();
        await interaction.editReply({
          embeds: [getEmbed(attachment.name!)],
          files: [attachment],
          components: getButtons()
        });
      });

      async function getAttachmentFilename() {
        const buf = await getTableBuffer();
        return new AttachmentBuilder(buf, { name: `rc-pvp_${Date.now()}.png` });
      }

      gameCollector.on('end', async (_, reason) => {
        let outcome = '';
        let winColor = 0xF6C453;

        if (reason === 'showdown' || reason === 'user' || reason === 'all_flipped') {
          // Bảo đảm lật tất cả
          p1Flipped.fill(true);
          p2Flipped.fill(true);

          const getHandScore = (hand: Card[]): { val: number; suitVal: number; card: Card } => {
            const valuesMap: Record<string, number> = {
              '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
            };
            const suitsMap: Record<Card['suit'], number> = {
              'S': 1, 'C': 2, 'D': 3, 'H': 4
            };

            let bestCard = hand[0];
            let maxScore = valuesMap[hand[0].value] * 10 + suitsMap[hand[0].suit];

            for (const card of hand) {
              const score = valuesMap[card.value] * 10 + suitsMap[card.suit];
              if (score > maxScore) {
                maxScore = score;
                bestCard = card;
              }
            }

            return { val: valuesMap[bestCard.value], suitVal: suitsMap[bestCard.suit], card: bestCard };
          };

          const p1Best = getHandScore(p1Hand);
          const p2Best = getHandScore(p2Hand);

          const p1CardText = `**${p1Best.card.value}** ${suitsVi[p1Best.card.suit]}`;
          const p2CardText = `**${p2Best.card.value}** ${suitsVi[p2Best.card.suit]}`;

          const p1Score = p1Best.val * 10 + p1Best.suitVal;
          const p2Score = p2Best.val * 10 + p2Best.suitVal;

          if (p1Score > p2Score) {
            outcome = `🏆 **${p1Name}** chiến thắng! (${p1CardText} lớn hơn ${p2CardText})`;
            winColor = 0x57F287;
            await updatePlayerBalance(challengerId, p1Name, pot, true);
          } else {
            outcome = `🏆 **${p2Name}** chiến thắng! (${p2CardText} lớn hơn ${p1CardText})`;
            winColor = 0x57F287;
            await updatePlayerBalance(opponentId, p2Name, pot, true);
          }
        } else {
          // Hết giờ, hoàn cược
          outcome = '❌ Trận đấu bị hủy do hết thời gian rút bài!';
          winColor = 0xED4245;
          await updatePlayerBalance(challengerId, p1Name, bet, true);
          await updatePlayerBalance(opponentId, p2Name, bet, true);
        }

        // Xóa khóa phiên chơi
        kernel.cache.del(`active_game:${challengerId}`);
        kernel.cache.del(`active_game:${opponentId}`);

        const finalBuffer = await getTableBuffer(outcome);
        const finalAttachment = new AttachmentBuilder(finalBuffer, { name: `rc-pvp_${Date.now()}.png` });

        const finalEmbed = new EmbedBuilder()
          .setTitle('🃏 Kết Quả Bài Ngẫu Nhiên PvP')
          .setColor(winColor)
          .setDescription(`⚔️ **${p1Name}** vs **${p2Name}**\n\n🃏 Bài **${p1Name}**:\n👉 ${getHandText(p1Hand, p1Flipped)}\n\n🃏 Bài **${p2Name}**:\n👉 ${getHandText(p2Hand, p2Flipped)}\n\n👉 Kết quả: **${outcome}**\n💰 Tổng Pot giải quyết: **${currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`}**`)
          .setImage(`attachment://${finalAttachment.name}`)
          .setTimestamp();

        await interaction.editReply({
          embeds: [finalEmbed],
          files: [finalAttachment],
          components: []
        });
      });
    }
  }
}
