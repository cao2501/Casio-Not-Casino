import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { logger } from '../../../core/logger/Logger';
import { Kernel } from '../../../core/Kernel';
import { ensureMember } from '../../../database/helpers';
import { CardRenderer } from '../../../core/ui/CardRenderer';
import { UIBuilders } from '../../../core/ui/UIBuilders';
import { SpecialLogger } from '../../../core/logger/SpecialLogger';

export default class VndCommand implements ICommand {
	data = new SlashCommandBuilder()
		.setName('vnd')
		.setDescription('💳 Hệ thống tiền tệ VND liên kết ngân hàng')
		.addSubcommand((sub) =>
			sub
				.setName('balance')
				.setDescription('📊 Kiểm tra số dư VND của bạn hoặc thành viên khác')
				.addUserOption((opt) => opt.setName('member').setDescription('Chọn thành viên cần xem').setRequired(false)),
		)
		.addSubcommand((sub) =>
			sub
				.setName('pay')
				.setDescription('💸 Chuyển khoản tiền VND cho thành viên khác')
				.addUserOption((opt) => opt.setName('member').setDescription('Thành viên nhận chuyển khoản').setRequired(true))
				.addIntegerOption((opt) =>
					opt
						.setName('amount')
						.setDescription('Số tiền VND muốn chuyển (tối thiểu 1 ₫)')
						.setRequired(true)
						.setMinValue(1),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('deposit')
				.setDescription('📥 Nạp tiền VND tự động bằng chuyển khoản ngân hàng (VietQR)')
				.addIntegerOption((opt) =>
					opt
						.setName('amount')
						.setDescription('Số tiền VND muốn nạp (tối thiểu 1.000 ₫)')
						.setRequired(true)
						.setMinValue(1000),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('admin')
				.setDescription('🛡️ Lệnh quản trị số dư VND (Chỉ dành cho Admin)')
				.addSubcommand((sub) =>
					sub
						.setName('add')
						.setDescription('🟢 Nạp (cộng) tiền VND cho thành viên')
						.addUserOption((opt) => opt.setName('member').setDescription('Thành viên được nạp').setRequired(true))
						.addIntegerOption((opt) =>
							opt.setName('amount').setDescription('Số tiền VND muốn nạp').setRequired(true).setMinValue(1),
						),
				)
				.addSubcommand((sub) =>
					sub
						.setName('remove')
						.setDescription('🔴 Rút (trừ) tiền VND của thành viên')
						.addUserOption((opt) => opt.setName('member').setDescription('Thành viên bị trừ').setRequired(true))
						.addIntegerOption((opt) =>
							opt.setName('amount').setDescription('Số tiền VND muốn rút').setRequired(true).setMinValue(1),
						),
				)
				.addSubcommand((sub) =>
					sub
						.setName('set')
						.setDescription('⚙️ Đặt (set) lại số dư VND cho thành viên')
						.addUserOption((opt) => opt.setName('member').setDescription('Thành viên cần thiết lập').setRequired(true))
						.addIntegerOption((opt) =>
							opt.setName('amount').setDescription('Số tiền VND muốn đặt').setRequired(true).setMinValue(0),
						),
				),
		);

	async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
		const guildId = interaction.guildId!;
		const subcommand = interaction.options.getSubcommand();
		const group = interaction.options.getSubcommandGroup(false);

		await interaction.deferReply();

		// 1. Check permissions for Admin commands
		if (group === 'admin') {
			const isOwner = kernel.ownerIds.includes(interaction.user.id);
			const isManageGuild = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

			if (!isOwner && !isManageGuild) {
				const errorEmbed = UIBuilders.createErrorEmbed(
					'Từ Chối Quyền Hạn',
					'❌ Bạn cần có quyền `Quản Lý Máy Chủ` (Manage Server) để sử dụng lệnh Admin này.',
				);
				const buffer = await UIBuilders.convertToCanvasCard(
					errorEmbed,
					interaction.user.displayAvatarURL({ extension: 'png' }),
					interaction.user.username,
					interaction.guild?.name,
				);
				const attachment = new AttachmentBuilder(buffer, { name: 'error.png' });
				await interaction.editReply({ files: [attachment] });
				return;
			}

			const targetUser = interaction.options.getUser('member', true);
			const amount = interaction.options.getInteger('amount', true);

			await ensureMember(guildId, targetUser.id);

			if (subcommand === 'add') {
				const memberData = await kernel.db.guildMember.update({
					where: { guildId_userId: { guildId, userId: targetUser.id } },
					data: { vnd: { increment: amount } },
				});

				const txId = SpecialLogger.generateTxId('ADM');
				await SpecialLogger.logVnd(kernel, guildId, targetUser.id, targetUser.username, 'ADMIN_ADD', amount, txId, `Admin ${interaction.user.tag} (${interaction.user.id}) nạp thêm tiền cho thành viên. Số dư mới: ${memberData.vnd.toLocaleString()} VNĐ.`);

				const successEmbed = UIBuilders.createSuccessEmbed(
					'Nạp Tiền Thành Công',
					`✅ Đã cộng **${amount.toLocaleString('vi-VN')} ₫** cho <@${targetUser.id}>.\nSố dư mới: **${memberData.vnd.toLocaleString('vi-VN')} ₫**`,
				);
				const buffer = await UIBuilders.convertToCanvasCard(
					successEmbed,
					targetUser.displayAvatarURL({ extension: 'png' }),
					targetUser.username,
					interaction.guild?.name,
				);
				const attachment = new AttachmentBuilder(buffer, { name: 'success.png' });
				await interaction.editReply({
					content: `💳 Nạp tiền VND thành công cho <@${targetUser.id}>`,
					files: [attachment],
				});
				return;
			}

			if (subcommand === 'remove') {
				const currentMember = await kernel.db.guildMember.findUnique({
					where: { guildId_userId: { guildId, userId: targetUser.id } },
				});

				const currentVnd = currentMember?.vnd ?? 0;
				const finalAmount = Math.min(amount, currentVnd);

				const memberData = await kernel.db.guildMember.update({
					where: { guildId_userId: { guildId, userId: targetUser.id } },
					data: { vnd: { decrement: finalAmount } },
				});

				const txId = SpecialLogger.generateTxId('ADM');
				await SpecialLogger.logVnd(kernel, guildId, targetUser.id, targetUser.username, 'ADMIN_REMOVE', finalAmount, txId, `Admin ${interaction.user.tag} (${interaction.user.id}) rút bớt tiền của thành viên. Số dư mới: ${memberData.vnd.toLocaleString()} VNĐ.`);

				const successEmbed = UIBuilders.createSuccessEmbed(
					'Rút Tiền Thành Công',
					`✅ Đã trừ **${finalAmount.toLocaleString('vi-VN')} ₫** từ tài khoản <@${targetUser.id}>.\nSố dư mới: **${memberData.vnd.toLocaleString('vi-VN')} ₫**`,
				);
				const buffer = await UIBuilders.convertToCanvasCard(
					successEmbed,
					targetUser.displayAvatarURL({ extension: 'png' }),
					targetUser.username,
					interaction.guild?.name,
				);
				const attachment = new AttachmentBuilder(buffer, { name: 'success.png' });
				await interaction.editReply({
					content: `💳 Rút tiền VND thành công của <@${targetUser.id}>`,
					files: [attachment],
				});
				return;
			}

			if (subcommand === 'set') {
				const memberData = await kernel.db.guildMember.update({
					where: { guildId_userId: { guildId, userId: targetUser.id } },
					data: { vnd: amount },
				});

				const txId = SpecialLogger.generateTxId('ADM');
				await SpecialLogger.logVnd(kernel, guildId, targetUser.id, targetUser.username, 'ADMIN_SET', amount, txId, `Admin ${interaction.user.tag} (${interaction.user.id}) đặt lại số dư thành viên thành ${amount.toLocaleString()} VNĐ.`);

				const successEmbed = UIBuilders.createSuccessEmbed(
					'Đặt Lại Số Dư',
					`✅ Đã thiết lập số dư VND của <@${targetUser.id}> thành **${amount.toLocaleString('vi-VN')} ₫**.`,
				);
				const buffer = await UIBuilders.convertToCanvasCard(
					successEmbed,
					targetUser.displayAvatarURL({ extension: 'png' }),
					targetUser.username,
					interaction.guild?.name,
				);
				const attachment = new AttachmentBuilder(buffer, { name: 'success.png' });
				await interaction.editReply({
					content: `💳 Thiết lập số dư VND thành công cho <@${targetUser.id}>`,
					files: [attachment],
				});
				return;
			}
		}

		// 2. /vnd balance
		if (subcommand === 'balance') {
			const targetUser = interaction.options.getUser('member') ?? interaction.user;
			await ensureMember(guildId, targetUser.id);

			const memberData = await kernel.db.guildMember.findUnique({
				where: { guildId_userId: { guildId, userId: targetUser.id } },
			});

			const vndBalance = memberData?.vnd ?? 0;

			const buffer = await CardRenderer.drawVndCard(
				targetUser.displayAvatarURL({ extension: 'png' }),
				targetUser.username,
				vndBalance,
				interaction.guild!.name,
			);
			const attachment = new AttachmentBuilder(buffer, { name: 'vnd-balance.png' });

			await interaction.editReply({
				content: `💳 **Thẻ VND của** <@${targetUser.id}>`,
				files: [attachment],
			});
			return;
		}

		// 3. /vnd pay
		if (subcommand === 'pay') {
			const receiver = interaction.options.getUser('member', true);
			const amount = interaction.options.getInteger('amount', true);

			if (receiver.id === interaction.user.id) {
				const errorEmbed = UIBuilders.createErrorEmbed(
					'Lỗi Chuyển Khoản',
					'❌ Bạn không thể tự chuyển khoản cho chính mình.',
				);
				const buffer = await UIBuilders.convertToCanvasCard(
					errorEmbed,
					interaction.user.displayAvatarURL({ extension: 'png' }),
					interaction.user.username,
					interaction.guild?.name,
				);
				const attachment = new AttachmentBuilder(buffer, { name: 'error.png' });
				await interaction.editReply({ files: [attachment] });
				return;
			}

			if (receiver.bot) {
				const errorEmbed = UIBuilders.createErrorEmbed('Lỗi Chuyển Khoản', '❌ Bạn không thể chuyển khoản cho bot.');
				const buffer = await UIBuilders.convertToCanvasCard(
					errorEmbed,
					interaction.user.displayAvatarURL({ extension: 'png' }),
					interaction.user.username,
					interaction.guild?.name,
				);
				const attachment = new AttachmentBuilder(buffer, { name: 'error.png' });
				await interaction.editReply({ files: [attachment] });
				return;
			}

			await ensureMember(guildId, interaction.user.id);
			await ensureMember(guildId, receiver.id);

			const senderData = await kernel.db.guildMember.findUnique({
				where: { guildId_userId: { guildId, userId: interaction.user.id } },
			});

			const senderVnd = senderData?.vnd ?? 0;
			if (senderVnd < amount) {
				const errorEmbed = UIBuilders.createErrorEmbed(
					'Giao Dịch Bị Từ Chối',
					`❌ Số dư VND của bạn không đủ để thực hiện giao dịch.\n\nYêu cầu: **${amount.toLocaleString('vi-VN')} ₫**\nSố dư hiện tại: **${senderVnd.toLocaleString('vi-VN')} ₫**`,
				);
				const buffer = await UIBuilders.convertToCanvasCard(
					errorEmbed,
					interaction.user.displayAvatarURL({ extension: 'png' }),
					interaction.user.username,
					interaction.guild?.name,
				);
				const attachment = new AttachmentBuilder(buffer, { name: 'error.png' });
				await interaction.editReply({ files: [attachment] });
				return;
			}

			// Perform transaction atomic updates
			await kernel.db.$transaction([
				kernel.db.guildMember.update({
					where: { guildId_userId: { guildId, userId: interaction.user.id } },
					data: { vnd: { decrement: amount } },
				}),
				kernel.db.guildMember.update({
					where: { guildId_userId: { guildId, userId: receiver.id } },
					data: { vnd: { increment: amount } },
				}),
			]);

			const txId = SpecialLogger.generateTxId('PAY');
			await SpecialLogger.logVnd(kernel, guildId, interaction.user.id, interaction.user.username, 'PAY', amount, txId, `Chuyển khoản thành công sang thành viên <@${receiver.id}> (${receiver.tag}).`);

			const successEmbed = UIBuilders.createSuccessEmbed(
				'Giao Dịch Thành Công',
				`💸 Bạn đã chuyển **${amount.toLocaleString('vi-VN')} ₫** cho <@${receiver.id}> thành công!`,
			);
			const buffer = await UIBuilders.convertToCanvasCard(
				successEmbed,
				interaction.user.displayAvatarURL({ extension: 'png' }),
				interaction.user.username,
				interaction.guild?.name,
			);
			const attachment = new AttachmentBuilder(buffer, { name: 'success.png' });

			await interaction.editReply({
				content: `💸 **Chuyển khoản thành công!** <@${interaction.user.id}> ➔ <@${receiver.id}>`,
				files: [attachment],
			});
			return;
		}

		// 4. /vnd deposit
		if (subcommand === 'deposit') {
			const amount = interaction.options.getInteger('amount', true);
			await ensureMember(guildId, interaction.user.id);

			// Generate a unique 4-digit code suffix e.g., KN3819
			let depositCode = '';
			let attempts = 0;
			while (attempts < 10) {
				const rand = Math.floor(1000 + Math.random() * 9000); // 1000 - 9999
				const codeCandidate = `KN${rand}`;
				const existing = await kernel.db.vndDepositRequest.findUnique({
					where: { code: codeCandidate },
				});
				if (!existing) {
					depositCode = codeCandidate;
					break;
				}
				attempts++;
			}

			if (!depositCode) {
				depositCode = `KN${Date.now().toString().slice(-4)}`;
			}

			// Save the deposit request in database
			await kernel.db.vndDepositRequest.create({
				data: {
					code: depositCode,
					guildId,
					userId: interaction.user.id,
					channelId: interaction.channelId,
					amount,
				},
			});

			const txId = SpecialLogger.generateTxId('DEP');
			await SpecialLogger.logVnd(kernel, guildId, interaction.user.id, interaction.user.username, 'DEPOSIT', amount, txId, `Khởi tạo hóa đơn nạp tiền VietQR, mã nạp: ${depositCode}.`);

			// Fetch dynamic VietQR code image
			const bankId = process.env.BANK_ID ?? 'MBBank';
			const bankAccount = process.env.BANK_ACCOUNT ?? '1234567890';
			const accountName = encodeURIComponent(process.env.BANK_ACCOUNT_NAME ?? 'ADMIN');
			const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankAccount}-compact2.png?amount=${amount}&addInfo=${depositCode}&accountName=${accountName}`;

			try {
				const res = await fetch(qrUrl);
				if (!res.ok) throw new Error('Failed to fetch VietQR image');
				const arrayBuffer = await res.arrayBuffer();
				const qrBuffer = Buffer.from(arrayBuffer);

				// Render Canvas Card
				const buffer = await CardRenderer.drawDepositCard(
					interaction.user.displayAvatarURL({ extension: 'png' }),
					interaction.user.username,
					depositCode,
					amount,
					qrBuffer,
				);

				const attachment = new AttachmentBuilder(buffer, { name: 'deposit-invoice.png' });

				await interaction.editReply({
					content: `📥 **Yêu cầu nạp tiền của** <@${interaction.user.id}> đã được khởi tạo!`,
					files: [attachment],
				});
			} catch (err) {
				logger.error('Failed to generate deposit card:', err);
				const errorEmbed = UIBuilders.createErrorEmbed(
					'Lỗi Hệ Thống',
					'❌ Không thể kết nối tới VietQR API để tạo mã QR nạp tiền. Vui lòng thử lại sau.',
				);
				const buffer = await UIBuilders.convertToCanvasCard(
					errorEmbed,
					interaction.user.displayAvatarURL({ extension: 'png' }),
					interaction.user.username,
					interaction.guild?.name,
				);
				const attachment = new AttachmentBuilder(buffer, { name: 'error.png' });
				await interaction.editReply({ files: [attachment] });
			}
		}
	}
}
