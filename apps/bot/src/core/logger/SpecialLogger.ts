import fs from 'fs';
import path from 'path';
import { EmbedBuilder, TextChannel, AttachmentBuilder, Guild } from 'discord.js';
import { Kernel } from '../Kernel';

export interface IVndLog {
  txId: string;
  timestamp: string;
  guildId: string;
  userId: string;
  username: string;
  actionType: 'PAY' | 'DEPOSIT' | 'ADMIN_ADD' | 'ADMIN_REMOVE' | 'ADMIN_SET' | 'SHOP_BUY' | 'CASINO_WIN' | 'CASINO_LOSE';
  amount: number;
  details: string;
}

export interface ITicketLog {
  ticketId: string;
  timestamp: string;
  guildId: string;
  userId: string;
  channelName: string;
  closerTag: string;
  closerId: string;
  reason: string;
  messageCount: number;
}

export class SpecialLogger {
  private static queue: Array<{ filePath: string; line: string }> = [];
  private static isProcessing = false;

  /**
   * Enqueue a write operation to prevent blocking or file locking
   */
  private static async enqueue(filePath: string, line: string) {
    this.queue.push({ filePath, line });
    this.processQueue();
  }

  private static async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        try {
          const dir = path.dirname(item.filePath);
          await fs.promises.mkdir(dir, { recursive: true });
          await fs.promises.appendFile(item.filePath, item.line + '\n', 'utf8');
        } catch (err) {
          console.error('[SpecialLogger] Queue write failed:', err);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Helper to generate unique transaction ID
   */
  public static generateTxId(prefix: 'PAY' | 'DEP' | 'ADM' | 'BUY'): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(1000 + Math.random() * 9000).toString(36).toUpperCase();
    return `TX-${prefix}-${timestamp}-${rand}`;
  }

  /**
   * Helper to fetch YYYY-MM-DD local date folder
   */
  public static getTodayFolder(): string {
    const now = new Date();
    // UTC to GMT+7 timezone adjustment
    const gmt7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const yyyy = gmt7.getUTCFullYear();
    const mm = String(gmt7.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(gmt7.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * 1. Log VND transaction (file + Discord)
   */
  public static async logVnd(
    kernel: Kernel,
    guildId: string,
    userId: string,
    username: string,
    actionType: IVndLog['actionType'],
    amount: number,
    txId: string,
    details: string
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry: IVndLog = {
      txId,
      timestamp,
      guildId,
      userId,
      username,
      actionType,
      amount,
      details,
    };

    // Write to daily directory path logs/YYYY-MM-DD/vnd.jsonl
    const dateDir = this.getTodayFolder();
    const filePath = path.join(process.cwd(), 'logs', dateDir, 'vnd.jsonl');
    await this.enqueue(filePath, JSON.stringify(logEntry));

    // Write to a separate file for this individual VND session/transaction
    const sessionFilePath = path.join(process.cwd(), 'logs', dateDir, 'sessions', `vnd-${txId}.json`);
    await this.enqueue(sessionFilePath, JSON.stringify(logEntry, null, 2));

    // Send embed to Discord channel if configured
    try {
      const logConfig = await kernel.db.logChannel.findUnique({
        where: { guildId_eventType: { guildId, eventType: 'VND_TRANSACTION' } },
      });

      if (logConfig?.enabled) {
        const channel = kernel.client.channels.cache.get(logConfig.channelId);
        if (channel && channel.isTextBased()) {
          const actionLabels: Record<IVndLog['actionType'], string> = {
            PAY: '💸 Chuyển khoản',
            DEPOSIT: '📥 Nạp tiền (VietQR/SePay)',
            ADMIN_ADD: '🟢 Admin Cộng tiền',
            ADMIN_REMOVE: '🔴 Admin Trừ tiền',
            ADMIN_SET: '⚙️ Admin Đặt số dư',
            SHOP_BUY: '🛍️ Mua hàng',
            CASINO_WIN: '🎮 Thắng Casino',
            CASINO_LOSE: '🎮 Thua Casino',
          };

          const embed = new EmbedBuilder()
            .setTitle('💳 Giao Dịch VND')
            .setColor(
              actionType === 'CASINO_WIN' || actionType === 'DEPOSIT' || actionType === 'ADMIN_ADD'
                ? 0x2ecc71 // Green
                : actionType === 'CASINO_LOSE' || actionType === 'ADMIN_REMOVE'
                ? 0xe74c3c // Red
                : 0x3498db // Blue for others
            )
            .addFields(
              { name: '🆔 Mã Giao Dịch (TxID)', value: `\`${txId}\``, inline: false },
              { name: '👤 Người Thực Hiện', value: `<@${userId}> (\`@${username}\`)`, inline: true },
              { name: '🏷️ Loại Giao Dịch', value: actionLabels[actionType], inline: true },
              { name: '💰 Số Tiền', value: `**${amount.toLocaleString()} VNĐ**`, inline: true },
              { name: '📋 Chi Tiết', value: details, inline: false }
            )
            .setFooter({ text: 'Kini Bank Logs' })
            .setTimestamp();

          await (channel as TextChannel).send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[SpecialLogger] Failed to send VND log to Discord:', err);
    }
  }

  /**
   * 2. Log Ticket chat history, files, HTML/text transcripts to disk and Discord
   */
  public static async logTicket(
    kernel: Kernel,
    guild: Guild,
    channelName: string,
    ticketId: string,
    userId: string,
    closerTag: string,
    closerId: string,
    reason: string,
    sortedMessages: any[]
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const dateDir = this.getTodayFolder();
    
    // Save metadata summary in Daily JSONL
    const logSummary: ITicketLog = {
      ticketId,
      timestamp,
      guildId: guild.id,
      userId,
      channelName,
      closerTag,
      closerId,
      reason,
      messageCount: sortedMessages.length,
    };
    const summaryFilePath = path.join(process.cwd(), 'logs', dateDir, 'tickets.jsonl');
    await this.enqueue(summaryFilePath, JSON.stringify(logSummary));

    // Create directories for ticket data
    const dailyPath = path.join(process.cwd(), 'logs', dateDir);
    const attachmentsDir = path.join(dailyPath, 'attachments', ticketId);
    await fs.promises.mkdir(attachmentsDir, { recursive: true });

    // Download attachments locally
    const filesToUpload: AttachmentBuilder[] = [];
    const localAttachments: Array<{ name: string; localPath: string }> = [];

    for (const m of sortedMessages) {
      if (m.attachments) {
        for (const att of m.attachments.values()) {
          try {
            const fileRes = await fetch(att.url);
            if (fileRes.ok) {
              const buffer = Buffer.from(await fileRes.arrayBuffer());
              const localFilePath = path.join(attachmentsDir, att.name);
              await fs.promises.writeFile(localFilePath, buffer);
              localAttachments.push({ name: att.name, localPath: localFilePath });
              
              // Attachment for Discord log message
              filesToUpload.push(new AttachmentBuilder(buffer, { name: att.name }));
            }
          } catch (err) {
            console.error(`[SpecialLogger] Failed to save attachment ${att.name} locally:`, err);
          }
        }
      }
    }

    // Build plain text transcript
    let txtTranscript = `==================================================\n`;
    txtTranscript += `TICKET LOG TRANSCRIPT: ${channelName}\n`;
    txtTranscript += `Guild: ${guild.name} (${guild.id})\n`;
    txtTranscript += `Chủ ticket: ID ${userId}\n`;
    txtTranscript += `Đóng bởi: ${closerTag} (ID ${closerId})\n`;
    txtTranscript += `Lý do: ${reason}\n`;
    txtTranscript += `Thời gian đóng: ${timestamp}\n`;
    txtTranscript += `==================================================\n\n`;

    for (const m of sortedMessages) {
      const time = new Date(m.createdTimestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      txtTranscript += `[${time}] ${m.author.username} (${m.author.id}):\n`;
      if (m.content) {
        txtTranscript += `${m.content}\n`;
      }
      if (m.attachments && m.attachments.size > 0) {
        txtTranscript += `[Đính kèm: ${Array.from(m.attachments.values()).map((a: any) => a.name).join(', ')}]\n`;
      }
      txtTranscript += `\n`;
    }

    const txtPath = path.join(dailyPath, `transcript-${channelName}-${ticketId}.txt`);
    await fs.promises.writeFile(txtPath, txtTranscript, 'utf8');

    // Build HTML transcript
    const htmlContent = this.generateHtmlTranscript(
      channelName,
      ticketId,
      userId,
      closerTag,
      closerId,
      reason,
      sortedMessages
    );
    const htmlPath = path.join(dailyPath, `transcript-${channelName}-${ticketId}.html`);
    await fs.promises.writeFile(htmlPath, htmlContent, 'utf8');

    // Prepare files for uploading to Discord Channel
    const txtBuffer = Buffer.from(txtTranscript, 'utf-8');
    const htmlBuffer = Buffer.from(htmlContent, 'utf-8');
    filesToUpload.unshift(new AttachmentBuilder(htmlBuffer, { name: `transcript-${channelName}.html` }));
    filesToUpload.unshift(new AttachmentBuilder(txtBuffer, { name: `transcript-${channelName}.txt` }));

    // Send transcript to log channel (Custom configured TICKET_LOG or fallback)
    try {
      let targetChannel: TextChannel | null = null;
      const logConfig = await kernel.db.logChannel.findUnique({
        where: { guildId_eventType: { guildId: guild.id, eventType: 'TICKET_LOG' } },
      });

      if (logConfig?.enabled) {
        targetChannel = guild.channels.cache.get(logConfig.channelId) as TextChannel;
      }

      if (!targetChannel) {
        // Fallback to auto-created kini-ticket-logs
        targetChannel = guild.channels.cache.find(
          c => c.name === 'kini-ticket-logs' && c.type === 0
        ) as TextChannel | undefined ?? null;

        if (!targetChannel) {
          targetChannel = await guild.channels.create({
            name: 'kini-ticket-logs',
            type: 0,
            permissionOverwrites: [
              {
                id: guild.id,
                deny: [0x400n] // ViewChannel
              },
              {
                id: kernel.client.user!.id,
                allow: [0x400n, 0x800n] // ViewChannel, SendMessages
              }
            ]
          }) as TextChannel;
        }
      }

      const logEmbed = new EmbedBuilder()
        .setTitle(`🔒 Ticket Closed: ${channelName}`)
        .setColor(0xe74c3c)
        .addFields(
          { name: '👤 Chủ Ticket', value: `<@${userId}> (ID: ${userId})`, inline: true },
          { name: '🔒 Đóng bởi', value: `<@${closerId}> (${closerTag})`, inline: true },
          { name: '📋 Lý do', value: reason || 'Không có', inline: false }
        )
        .setFooter({ text: `Kini Ticket Logs` })
        .setTimestamp();

      // Send to channel
      const chunkSize = 5;
      for (let i = 0; i < filesToUpload.length; i += chunkSize) {
        const chunk = filesToUpload.slice(i, i + chunkSize);
        if (i === 0) {
          await targetChannel.send({ embeds: [logEmbed], files: chunk });
        } else {
          await targetChannel.send({
            content: `📎 Tệp tin bổ sung từ ticket **${channelName}**:`,
            files: chunk
          });
        }
      }
    } catch (err) {
      console.error('[SpecialLogger] Failed to post ticket transcript logs to Discord:', err);
    }
  }

  private static generateHtmlTranscript(
    channelName: string,
    ticketId: string,
    userId: string,
    closerTag: string,
    closerId: string,
    reason: string,
    sortedMessages: any[]
  ): string {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Transcript - ${channelName}</title>
  <style>
    body {
      background-color: #36393f;
      color: #dcddde;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
    }
    .header {
      border-bottom: 1px solid #4f545c;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .header h1 {
      color: #ffffff;
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      font-size: 14px;
    }
    .meta-item {
      background-color: #2f3136;
      padding: 10px;
      border-radius: 4px;
      border-left: 4px solid #7289da;
    }
    .meta-label {
      color: #8e9297;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .meta-value {
      color: #ffffff;
    }
    .chat-log {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    .message-group {
      display: flex;
      gap: 15px;
      background-color: #2f3136;
      padding: 12px;
      border-radius: 8px;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: #4f545c;
    }
    .message-content-wrapper {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }
    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .author-name {
      color: #ffffff;
      font-weight: bold;
      font-size: 15px;
    }
    .timestamp {
      color: #72767d;
      font-size: 12px;
    }
    .message-text {
      font-size: 15px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .attachments {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .attachment-item {
      display: flex;
      align-items: center;
      gap: 10px;
      background-color: #202225;
      padding: 10px;
      border-radius: 4px;
      border: 1px solid #4f545c;
      max-width: fit-content;
    }
    .attachment-icon {
      font-size: 24px;
    }
    .attachment-link {
      color: #00b0f4;
      text-decoration: none;
      font-size: 14px;
    }
    .attachment-link:hover {
      text-decoration: underline;
    }
    .attachment-preview {
      max-width: 400px;
      max-height: 300px;
      border-radius: 4px;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎫 Ticket Transcript: #${channelName}</h1>
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">MÃ TICKET</div>
        <div class="meta-value">${ticketId}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">CHỦ TICKET</div>
        <div class="meta-value">${userId}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">ĐÓNG BỞI</div>
        <div class="meta-value">${closerTag} (ID ${closerId})</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">LÝ DO ĐÓNG</div>
        <div class="meta-value">${reason || 'Không có lý do'}</div>
      </div>
    </div>
  </div>
  <div class="chat-log">`;

    for (const m of sortedMessages) {
      const time = new Date(m.createdTimestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const avatarUrl = m.author.avatarUrl || 'https://discord.com/assets/3c6ccb83716d5e4dd91d373517e6a44d.png';
      html += `
    <div class="message-group">
      <img class="avatar" src="${avatarUrl}" alt="${m.author.username}" />
      <div class="message-content-wrapper">
        <div class="message-header">
          <span class="author-name">${m.author.username}</span>
          <span class="timestamp">${time}</span>
        </div>
        <div class="message-text">${m.content || ''}</div>`;
      
      if (m.attachments && m.attachments.size > 0) {
        html += `
        <div class="attachments">`;
        for (const att of m.attachments.values()) {
          const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(att.name);
          if (isImage) {
            html += `
          <div class="attachment-item">
            <span class="attachment-icon">🖼️</span>
            <div>
              <a class="attachment-link" href="attachments/${ticketId}/${att.name}" target="_blank">${att.name}</a>
              <br/>
              <img class="attachment-preview" src="attachments/${ticketId}/${att.name}" alt="${att.name}" />
            </div>
          </div>`;
          } else {
            html += `
          <div class="attachment-item">
            <span class="attachment-icon">📎</span>
            <a class="attachment-link" href="attachments/${ticketId}/${att.name}" target="_blank">${att.name}</a>
          </div>`;
          }
        }
        html += `
        </div>`;
      }
      
      html += `
      </div>
    </div>`;
    }

    html += `
  </div>
</body>
</html>`;
    return html;
  }
}
