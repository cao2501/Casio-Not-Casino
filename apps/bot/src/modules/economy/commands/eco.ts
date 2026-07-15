import {
  ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureMember } from '../../../database/helpers';
import { CardRenderer } from '../../../core/ui/CardRenderer';

const DAILY_AMOUNT = 200;
const WEEKLY_AMOUNT = 1000;
const WORK_JOBS = [
  { name: 'lập trình viên', min: 100, max: 300 },
  { name: 'bác sĩ', min: 150, max: 400 },
  { name: 'giáo viên', min: 80, max: 200 },
  { name: 'thợ xây', min: 50, max: 150 },
  { name: 'đầu bếp', min: 70, max: 180 },
];

export default class EconomyCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('eco')
    .setDescription('💰 Hệ thống kinh tế')
    .addSubcommand(s => s.setName('balance').setDescription('💰 Xem số dư').addUserOption(o => o.setName('user').setDescription('Người dùng khác')))
    .addSubcommand(s => s.setName('daily').setDescription('📅 Nhận tiền hàng ngày'))
    .addSubcommand(s => s.setName('weekly').setDescription('📅 Nhận tiền hàng tuần'))
    .addSubcommand(s => s.setName('work').setDescription('💼 Đi làm kiếm tiền'))
    .addSubcommand(s => s.setName('crime').setDescription('🦹 Phạm tội (rủi ro cao)'))
    .addSubcommand(s => s.setName('rob').setDescription('🔫 Cướp tiền người khác').addUserOption(o => o.setName('user').setDescription('Nạn nhân').setRequired(true)))
    .addSubcommand(s => s.setName('transfer').setDescription('💸 Chuyển tiền').addUserOption(o => o.setName('user').setDescription('Người nhận').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Số tiền').setRequired(true).setMinValue(1)))
    .addSubcommandGroup(group =>
      group
        .setName('admin')
        .setDescription('🛡️ Lệnh quản trị số dư Coins (Chỉ dành cho Admin)')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('🟢 Cộng coins cho thành viên')
            .addUserOption(opt => opt.setName('member').setDescription('Thành viên được cộng').setRequired(true))
            .addIntegerOption(opt => opt.setName('amount').setDescription('Số lượng coins').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('🔴 Trừ coins của thành viên')
            .addUserOption(opt => opt.setName('member').setDescription('Thành viên bị trừ').setRequired(true))
            .addIntegerOption(opt => opt.setName('amount').setDescription('Số lượng coins').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sub =>
          sub
            .setName('set')
            .setDescription('⚙️ Đặt lại số dư coins cho thành viên')
            .addUserOption(opt => opt.setName('member').setDescription('Thành viên cần thiết lập').setRequired(true))
            .addIntegerOption(opt => opt.setName('amount').setDescription('Số lượng coins').setRequired(true).setMinValue(0))
        )
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    // ─── 0. ADMIN SUBCOMMANDS ───────────────────────────────────────────
    if (group === 'admin') {
      const isOwner = kernel.ownerIds.includes(interaction.user.id);
      const isManageGuild = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

      if (!isOwner && !isManageGuild) {
        const buffer = await CardRenderer.drawEconomyActionCard(
          'Từ Chối Quyền Hạn',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'ERROR',
          'Yêu cầu quyền Quản Lý Máy Chủ',
          'Bạn không thể thực hiện lệnh Admin này.'
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'error.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      const target = interaction.options.getUser('member', true);
      const amount = interaction.options.getInteger('amount', true);

      await ensureMember(guildId, target.id);

      if (sub === 'add') {
        const memberData = await kernel.db.guildMember.update({
          where: { guildId_userId: { guildId, userId: target.id } },
          data: { balance: { increment: amount } }
        });

        const buffer = await CardRenderer.drawEconomyActionCard(
          'Cộng Tiền Thành Công',
          target.username,
          target.displayAvatarURL({ extension: 'png' }),
          'SUCCESS',
          `Đã cộng +${amount.toLocaleString()} coins cho @${target.username}!`,
          `Số dư mới: ${memberData.balance.toLocaleString()} coins`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'success.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      if (sub === 'remove') {
        const currentMember = await kernel.db.guildMember.findUnique({
          where: { guildId_userId: { guildId, userId: target.id } }
        });
        const currentBal = currentMember?.balance ?? 0;
        const finalAmount = Math.min(amount, currentBal);

        const memberData = await kernel.db.guildMember.update({
          where: { guildId_userId: { guildId, userId: target.id } },
          data: { balance: { decrement: finalAmount } }
        });

        const buffer = await CardRenderer.drawEconomyActionCard(
          'Trừ Tiền Thành Công',
          target.username,
          target.displayAvatarURL({ extension: 'png' }),
          'SUCCESS',
          `Đã trừ -${finalAmount.toLocaleString()} coins của @${target.username}!`,
          `Số dư mới: ${memberData.balance.toLocaleString()} coins`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'success.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      if (sub === 'set') {
        const memberData = await kernel.db.guildMember.update({
          where: { guildId_userId: { guildId, userId: target.id } },
          data: { balance: amount }
        });

        const buffer = await CardRenderer.drawEconomyActionCard(
          'Đặt Lại Số Dư',
          target.username,
          target.displayAvatarURL({ extension: 'png' }),
          'SUCCESS',
          `Đã đặt số dư của @${target.username} thành ${amount.toLocaleString()} coins!`,
          `Số dư mới: ${memberData.balance.toLocaleString()} coins`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'success.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      return;
    }

    await ensureMember(guildId, userId);

    // ─── 1. BALANCE SUBCOMMAND ──────────────────────────────────────────
    if (sub === 'balance') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      await ensureMember(guildId, target.id);
      const member = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId: target.id } } });

      const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 128 });
      const gems = (member as any)?.gems ?? 0;
      const dailyStreak = (member as any)?.dailyStreak ?? 0;

      const buffer = await CardRenderer.drawEconomyCard(
        target.username,
        avatarUrl,
        member?.balance ?? 0,
        member?.bank ?? 0,
        gems,
        dailyStreak
      );
      const attachment = new AttachmentBuilder(buffer, { name: 'balance.png' });
      return void interaction.editReply({ files: [attachment] });
    }

    // ─── 2. DAILY & WEEKLY SUBCOMMANDS ─────────────────────────────────
    if (sub === 'daily' || sub === 'weekly') {
      const cooldown = sub === 'daily' ? 86400000 : 604800000;
      const amount = sub === 'daily' ? DAILY_AMOUNT : WEEKLY_AMOUNT;
      const key = `${sub}:${guildId}:${userId}`;
      const last = kernel.cache.get<number>(key);

      if (last && Date.now() - last < cooldown) {
        const remaining = Math.ceil((last + cooldown - Date.now()) / 3600000);
        const buffer = await CardRenderer.drawEconomyActionCard(
          'Chưa Sẵn Sàng',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'ERROR',
          `Bạn đã nhận tiền ${sub === 'daily' ? 'hàng ngày' : 'hàng tuần'} rồi!`,
          `Vui lòng quay lại sau ${remaining} giờ nữa.`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'cooldown.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      kernel.cache.set(key, Date.now(), cooldown / 1000);
      await kernel.db.guildMember.update({
        where: { guildId_userId: { guildId, userId } },
        data: { balance: { increment: amount } }
      });
      kernel.eventBus.emit('economy:transaction', { guildId, userId, amount, type: sub.toUpperCase() });

      const nextMember = await kernel.db.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });

      const buffer = await CardRenderer.drawEconomyActionCard(
        'Nhận Thưởng Thành Công',
        interaction.user.username,
        interaction.user.displayAvatarURL({ extension: 'png' }),
        'SUCCESS',
        `Bạn nhận được +${amount.toLocaleString()} coins!`,
        `Số dư ví: ${(nextMember?.balance ?? 0).toLocaleString()} coins`
      );
      const attachment = new AttachmentBuilder(buffer, { name: 'success.png' });
      return void interaction.editReply({ files: [attachment] });
    }

    // ─── 3. WORK SUBCOMMAND ─────────────────────────────────────────────
    if (sub === 'work') {
      const key = `work:${guildId}:${userId}`;
      const last = kernel.cache.get<number>(key);

      if (last && Date.now() - last < 3600000) {
        const remainingMin = Math.ceil((last + 3600000 - Date.now()) / 60000);
        const buffer = await CardRenderer.drawEconomyActionCard(
          'Thời Gian Chờ',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'ERROR',
          'Bạn vừa mới đi làm việc!',
          `Vui lòng nghỉ ngơi thêm ${remainingMin} phút.`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'cooldown.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      const job = WORK_JOBS[Math.floor(Math.random() * WORK_JOBS.length)]!;
      const earned = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
      
      kernel.cache.set(key, Date.now(), 3600);
      await kernel.db.guildMember.update({
        where: { guildId_userId: { guildId, userId } },
        data: { balance: { increment: earned } }
      });

      const nextMember = await kernel.db.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });

      const buffer = await CardRenderer.drawEconomyActionCard(
        'Đi Làm Kiếm Tiền',
        interaction.user.username,
        interaction.user.displayAvatarURL({ extension: 'png' }),
        'SUCCESS',
        `Bạn làm việc với tư cách là ${job.name} và kiếm được +${earned.toLocaleString()} coins!`,
        `Số dư ví: ${(nextMember?.balance ?? 0).toLocaleString()} coins`
      );
      const attachment = new AttachmentBuilder(buffer, { name: 'work.png' });
      return void interaction.editReply({ files: [attachment] });
    }

    // ─── 4. CRIME SUBCOMMAND ────────────────────────────────────────────
    if (sub === 'crime') {
      const key = `crime:${guildId}:${userId}`;
      const last = kernel.cache.get<number>(key);

      if (last && Date.now() - last < 7200000) {
        const remainingMin = Math.ceil((last + 7200000 - Date.now()) / 60000);
        const buffer = await CardRenderer.drawEconomyActionCard(
          'Truy Quét Hình Sự',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'ERROR',
          'Cảnh sát đang truy quét khu vực!',
          `Nên lẩn trốn thêm ${remainingMin} phút nữa.`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'cooldown.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      kernel.cache.set(key, Date.now(), 7200);
      const success = Math.random() > 0.4;

      if (success) {
        const amount = Math.floor(Math.random() * 500) + 100;
        await kernel.db.guildMember.update({
          where: { guildId_userId: { guildId, userId } },
          data: { balance: { increment: amount } }
        });

        const nextMember = await kernel.db.guildMember.findUnique({
          where: { guildId_userId: { guildId, userId } }
        });

        const buffer = await CardRenderer.drawEconomyActionCard(
          'Phi Vụ Thành Công',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'SUCCESS',
          `Thực hiện hành vi phạm tội trót lọt! Kiếm được +${amount.toLocaleString()} coins!`,
          `Số dư ví: ${(nextMember?.balance ?? 0).toLocaleString()} coins`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'crime_success.png' });
        return void interaction.editReply({ files: [attachment] });

      } else {
        const fine = Math.floor(Math.random() * 200) + 50;
        await kernel.db.guildMember.update({
          where: { guildId_userId: { guildId, userId } },
          data: { balance: { decrement: fine } }
        });

        const nextMember = await kernel.db.guildMember.findUnique({
          where: { guildId_userId: { guildId, userId } }
        });

        const buffer = await CardRenderer.drawEconomyActionCard(
          'Bị Cảnh Sát Bắt',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'ERROR',
          `Bạn đã bị bắt quả tang! Bị phạt -${fine.toLocaleString()} coins.`,
          `Số dư ví: ${(nextMember?.balance ?? 0).toLocaleString()} coins`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'crime_fail.png' });
        return void interaction.editReply({ files: [attachment] });
      }
    }

    // ─── 5. TRANSFER SUBCOMMAND ─────────────────────────────────────────
    if (sub === 'transfer') {
      const target = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);

      if (target.id === userId) {
        const buffer = await CardRenderer.drawEconomyActionCard(
          'Giao Dịch Thất Bại',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'ERROR',
          'Không thể tự chuyển tiền cho chính mình!'
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'transfer_fail.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      const sender = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId } } });
      if (!sender || sender.balance < amount) {
        const buffer = await CardRenderer.drawEconomyActionCard(
          'Số Dư Không Đủ',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'ERROR',
          `Số dư trong ví không đủ để chuyển ${amount.toLocaleString()} coins!`,
          `Bạn hiện chỉ có ${(sender?.balance ?? 0).toLocaleString()} coins.`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'transfer_fail.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      await ensureMember(guildId, target.id);
      await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId } }, data: { balance: { decrement: amount } } });
      await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId: target.id } }, data: { balance: { increment: amount } } });

      const nextSender = await kernel.db.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });

      const buffer = await CardRenderer.drawEconomyActionCard(
        'Chuyển Tiền Thành Công',
        interaction.user.username,
        interaction.user.displayAvatarURL({ extension: 'png' }),
        'SUCCESS',
        `Đã chuyển thành công +${amount.toLocaleString()} coins cho @${target.username}!`,
        `Ví của bạn: ${(nextSender?.balance ?? 0).toLocaleString()} coins`
      );
      const attachment = new AttachmentBuilder(buffer, { name: 'transfer_success.png' });
      return void interaction.editReply({ files: [attachment] });
    }

    // ─── 6. ROB SUBCOMMAND ───────────────────────────────────────────────
    if (sub === 'rob') {
      const target = interaction.options.getUser('user', true);

      if (target.id === userId) {
        const buffer = await CardRenderer.drawEconomyActionCard(
          'Hành Động Kỳ Lạ',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'ERROR',
          'Bạn không thể tự cướp tiền của chính mình!'
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'rob_fail.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      const key = `rob:${guildId}:${userId}`;
      const last = kernel.cache.get<number>(key);

      if (last && Date.now() - last < 14400000) {
        const remainingMin = Math.ceil((last + 14400000 - Date.now()) / 60000);
        const buffer = await CardRenderer.drawEconomyActionCard(
          'Chờ Đợi Hành Động',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'ERROR',
          'Bạn cần lẩn trốn thêm một thời gian nữa!',
          `Có thể tiếp tục đi cướp sau ${remainingMin} phút.`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'cooldown.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      kernel.cache.set(key, Date.now(), 14400);
      await ensureMember(guildId, target.id);
      const victim = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId: target.id } } });

      if (!victim || victim.balance < 100) {
        const buffer = await CardRenderer.drawEconomyActionCard(
          'Mục Tiêu Quá Nghèo',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'ERROR',
          `@${target.username} không có đủ 100 coins trong ví để cướp!`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'rob_fail.png' });
        return void interaction.editReply({ files: [attachment] });
      }

      const success = Math.random() > 0.5;

      if (success) {
        const stolen = Math.floor(victim.balance * (Math.random() * 0.3 + 0.1));
        await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId: target.id } }, data: { balance: { decrement: stolen } } });
        await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId } }, data: { balance: { increment: stolen } } });

        const nextSender = await kernel.db.guildMember.findUnique({
          where: { guildId_userId: { guildId, userId } }
        });

        const buffer = await CardRenderer.drawEconomyActionCard(
          'Cướp Thành Công',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'SUCCESS',
          `Cướp thành công +${stolen.toLocaleString()} coins từ ví của @${target.username}!`,
          `Ví của bạn: ${(nextSender?.balance ?? 0).toLocaleString()} coins`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'rob_success.png' });
        return void interaction.editReply({ files: [attachment] });

      } else {
        const fine = Math.floor(victim.balance * 0.1);
        await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId } }, data: { balance: { decrement: fine } } });

        const nextSender = await kernel.db.guildMember.findUnique({
          where: { guildId_userId: { guildId, userId } }
        });

        const buffer = await CardRenderer.drawEconomyActionCard(
          'Cướp Thất Bại',
          interaction.user.username,
          interaction.user.displayAvatarURL({ extension: 'png' }),
          'ERROR',
          `Phi vụ cướp của @${target.username} thất bại! Bạn bị phạt -${fine.toLocaleString()} coins.`,
          `Ví của bạn: ${(nextSender?.balance ?? 0).toLocaleString()} coins`
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'rob_fail.png' });
        return void interaction.editReply({ files: [attachment] });
      }
    }
  }
}
