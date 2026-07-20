import { createCanvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import { Theme } from './Theme';

export interface Card {
  suit: 'H' | 'D' | 'C' | 'S'; // Hearts, Diamonds, Clubs, Spades
  value: string; // '2'-'10', 'J', 'Q', 'K', 'A'
}

export class CardDrawer {
  private static suitSymbols: Record<Card['suit'], string> = {
    H: '♥',
    D: '♦',
    C: '♣',
    S: '♠',
  };

  private static suitColors: Record<Card['suit'], string> = {
    H: '#EF4444', // Bright red
    D: '#EF4444', // Bright red
    C: '#1E293B', // Dark slate
    S: '#1E293B', // Dark slate
  };

  private static drawSuitPath(
    ctx: CanvasRenderingContext2D,
    suit: Card['suit'],
    centerX: number,
    centerY: number,
    size: number
  ): void {
    ctx.save();
    switch (suit) {
      case 'D': { // Diamond
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size / 2);
        ctx.lineTo(centerX + size / 2, centerY);
        ctx.lineTo(centerX, centerY + size / 2);
        ctx.lineTo(centerX - size / 2, centerY);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'H': { // Heart
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size * 0.2);
        ctx.bezierCurveTo(
          centerX - size * 0.2, centerY - size * 0.5,
          centerX - size * 0.55, centerY - size * 0.45,
          centerX - size * 0.5, centerY - size * 0.1
        );
        ctx.bezierCurveTo(
          centerX - size * 0.45, centerY + size * 0.2,
          centerX - size * 0.15, centerY + size * 0.35,
          centerX, centerY + size * 0.5
        );
        ctx.bezierCurveTo(
          centerX + size * 0.15, centerY + size * 0.35,
          centerX + size * 0.45, centerY + size * 0.2,
          centerX + size * 0.5, centerY - size * 0.1
        );
        ctx.bezierCurveTo(
          centerX + size * 0.55, centerY - size * 0.45,
          centerX + size * 0.2, centerY - size * 0.5,
          centerX, centerY - size * 0.2
        );
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'S': { // Spade
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size * 0.5);
        ctx.bezierCurveTo(
          centerX - size * 0.15, centerY - size * 0.35,
          centerX - size * 0.45, centerY - size * 0.2,
          centerX - size * 0.5, centerY + size * 0.1
        );
        ctx.bezierCurveTo(
          centerX - size * 0.55, centerY + size * 0.45,
          centerX - size * 0.2, centerY + size * 0.5,
          centerX, centerY + size * 0.2
        );
        ctx.bezierCurveTo(
          centerX + size * 0.2, centerY + size * 0.5,
          centerX + size * 0.55, centerY + size * 0.45,
          centerX + size * 0.5, centerY + size * 0.1
        );
        ctx.bezierCurveTo(
          centerX + size * 0.45, centerY - size * 0.2,
          centerX + size * 0.15, centerY - size * 0.35,
          centerX, centerY - size * 0.5
        );
        ctx.closePath();
        ctx.fill();

        // Stem
        ctx.beginPath();
        ctx.moveTo(centerX, centerY + size * 0.1);
        ctx.quadraticCurveTo(centerX - size * 0.15, centerY + size * 0.5, centerX - size * 0.25, centerY + size * 0.5);
        ctx.lineTo(centerX + size * 0.25, centerY + size * 0.5);
        ctx.quadraticCurveTo(centerX + size * 0.15, centerY + size * 0.5, centerX, centerY + size * 0.1);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'C': { // Club
        const r = size * 0.22;
        ctx.beginPath();
        ctx.arc(centerX, centerY - size * 0.15, r, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(centerX - size * 0.17, centerY + size * 0.08, r, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(centerX + size * 0.17, centerY + size * 0.08, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX, centerY + size * 0.03, r * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Stem
        ctx.beginPath();
        ctx.moveTo(centerX, centerY + size * 0.05);
        ctx.quadraticCurveTo(centerX - size * 0.15, centerY + size * 0.5, centerX - size * 0.25, centerY + size * 0.5);
        ctx.lineTo(centerX + size * 0.25, centerY + size * 0.5);
        ctx.quadraticCurveTo(centerX + size * 0.15, centerY + size * 0.5, centerX, centerY + size * 0.05);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  /**
   * Draw a single playing card on the canvas context
   */
  public static drawPlayingCard(
    ctx: CanvasRenderingContext2D,
    card: Card,
    x: number,
    y: number,
    w: number,
    h: number,
    isHidden = false
  ): void {
    ctx.save();

    // Draw shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;

    // Card background
    ctx.beginPath();
    const radius = 8;
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (isHidden) {
      // Draw card back
      ctx.fillStyle = '#1E3A8A'; // Navy blue base
      ctx.fill();

      ctx.shadowColor = 'transparent'; // No inner shadow
      
      // Draw a nice geometric pattern on the back
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);

      ctx.fillStyle = '#2563EB';
      ctx.fillRect(x + 10, y + 10, w - 20, h - 20);

      // Draw mini bot logo (crossed diamonds or circle)
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 6, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('KINI', x + w / 2, y + h / 2);
    } else {
      // Draw card front
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Card border
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.shadowColor = 'transparent';

      const color = this.suitColors[card.suit];

      // Draw rank & suit on top-left
      ctx.fillStyle = color;
      ctx.font = 'bold 20px "Segoe UI", Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(card.value, x + 8, y + 8);
      
      this.drawSuitPath(ctx, card.suit, x + 16, y + 38, 14);

      // Draw rank & suit on bottom-right (rotated)
      ctx.save();
      ctx.translate(x + w - 8, y + h - 8);
      ctx.rotate(Math.PI);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(card.value, 0, 0);
      this.drawSuitPath(ctx, card.suit, 8, 29, 14);
      ctx.restore();

      // Draw large central symbol
      ctx.save();
      ctx.fillStyle = color;
      this.drawSuitPath(ctx, card.suit, x + w / 2, y + h / 2, 44);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Draw a player's hand of cards
   */
  public static drawHand(
    ctx: CanvasRenderingContext2D,
    cards: Card[],
    startX: number,
    startY: number,
    title: string,
    scoreText?: string,
    isDealerHidden = false,
    hideAllCards = false
  ): void {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Label / Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Segoe UI", Arial';
    ctx.fillText(title, startX, startY - 20);

    // Score badge if provided
    if (scoreText) {
      ctx.fillStyle = Theme.colors.accentGold;
      ctx.font = 'bold 16px "Segoe UI", Arial';
      ctx.fillText(`(${scoreText})`, startX + ctx.measureText(title).width + 10, startY - 20);
    }

    // Draw cards side-by-side
    const cardWidth = 80;
    const cardHeight = 120;
    const gap = 20;

    cards.forEach((card, index) => {
      const x = startX + index * (cardWidth - gap);
      const y = startY;
      const isCardHidden = (hideAllCards && index >= 1) || (isDealerHidden && index === 0);
      this.drawPlayingCard(ctx, card, x, y, cardWidth, cardHeight, isCardHidden);
    });
    ctx.restore();
  }

  /**
   * Draw a full Blackjack felt table
   */
  public static async drawBlackjackTable(
    playerHand: Card[],
    dealerHand: Card[],
    playerScore: number,
    dealerScore: number,
    bet: number,
    currency: 'COIN' | 'VND',
    outcomeText?: string,
    isOngoing = true,
    playerLabel = 'BẠN (PLAYER)',
    dealerLabel = 'NHÀ CÁI (DEALER)',
    hidePlayer = false,
    hideDealer = false
  ): Promise<Buffer> {
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Draw Table background (green gradient felt)
    const tableGrad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 500);
    tableGrad.addColorStop(0, '#105B34'); // Lighter felt green
    tableGrad.addColorStop(1, '#08331E'); // Dark edge green
    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw felt lines (golden border arch)
    ctx.strokeStyle = 'rgba(246, 196, 83, 0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(width / 2, -100, 380, 0, Math.PI);
    ctx.stroke();

    // Blackjack text on table
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.font = 'bold 28px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BLACKJACK PAYS 3 TO 2', width / 2, height / 2 - 30);
    ctx.font = '16px "Segoe UI", Arial';
    ctx.fillText('Dealer must stand on 17 and draw to 16', width / 2, height / 2 + 5);

    // 2. Draw Dealer Hand
    const dealerScoreStr = hideDealer ? '?' : (isOngoing ? undefined : `${dealerScore}`);
    this.drawHand(ctx, dealerHand, 50, 60, dealerLabel, dealerScoreStr, isOngoing && !hideDealer, hideDealer);

    // 3. Draw Player Hand
    const playerScoreStr = hidePlayer ? undefined : (isOngoing ? undefined : `${playerScore}`);
    this.drawHand(ctx, playerHand, 50, 240, playerLabel, playerScoreStr, false, hidePlayer);

    // 4. Draw Bet info
    ctx.save();
    ctx.fillStyle = '#1E293B';
    // Draw box for bet
    ctx.beginPath();
    const boxX = 550;
    const boxY = 60;
    const boxW = 200;
    const boxH = 90;
    const radius = 10;
    ctx.moveTo(boxX + radius, boxY);
    ctx.lineTo(boxX + boxW - radius, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
    ctx.lineTo(boxX + boxW, boxY + boxH - radius);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
    ctx.lineTo(boxX + radius, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
    ctx.lineTo(boxX, boxY + radius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = Theme.colors.accentGold;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 14px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TIỀN CƯỢC', boxX + boxW / 2, boxY + 30);

    const formattedBet = currency === 'VND' ? `${bet.toLocaleString('vi-VN')} ₫` : `${bet.toLocaleString()} Coins`;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Segoe UI", Arial';
    ctx.fillText(formattedBet, boxX + boxW / 2, boxY + 62);
    ctx.restore();

    // 5. Draw Game outcome banner if ended
    if (outcomeText) {
      ctx.save();

      const bannerX = 520;
      const bannerY = 230;
      const bannerW = 260;
      const bannerH = 120;

      // Banner container
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      const br = 10;
      ctx.moveTo(bannerX + br, bannerY);
      ctx.lineTo(bannerX + bannerW - br, bannerY);
      ctx.quadraticCurveTo(bannerX + bannerW, bannerY, bannerX + bannerW, bannerY + br);
      ctx.lineTo(bannerX + bannerW, bannerY + bannerH - br);
      ctx.quadraticCurveTo(bannerX + bannerW, bannerY + bannerH, bannerX + bannerW - br, bannerY + bannerH);
      ctx.lineTo(bannerX + br, bannerY + bannerH);
      ctx.quadraticCurveTo(bannerX, bannerY + bannerH, bannerX, bannerY + bannerH - br);
      ctx.lineTo(bannerX, bannerY + br);
      ctx.quadraticCurveTo(bannerX, bannerY, bannerX + br, bannerY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = Theme.colors.accentGold;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Determine outcome color
      let color = Theme.colors.accentGold;
      if (outcomeText.includes('\u1eafng') || outcomeText.includes('chi\u1ebfn th\u1eafng')) color = Theme.colors.success;
      if (outcomeText.includes('BUST') || outcomeText.includes('THUA')) color = Theme.colors.danger;
      if (outcomeText.includes('H\u00d2A')) color = Theme.colors.info;

      // Word-wrap helper
      const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
        ctx.font = `bold ${fontSize}px "Segoe UI", Arial`;
        const words = text.split(' ');
        const lines: string[] = [];
        let current = '';
        for (const word of words) {
          const test = current ? `${current} ${word}` : word;
          if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
          } else {
            current = test;
          }
        }
        if (current) lines.push(current);
        return lines;
      };

      // Try fitting with decreasing font sizes
      const padding = 16;
      const maxW = bannerW - padding * 2;
      let fontSize = 15;
      let lines: string[] = [];
      for (let fs = 15; fs >= 9; fs--) {
        const tryLines = wrapText(outcomeText, maxW, fs);
        const totalH = tryLines.length * (fs + 6);
        if (totalH <= bannerH - 24) {
          fontSize = fs;
          lines = tryLines;
          break;
        }
      }
      if (!lines.length) lines = wrapText(outcomeText, maxW, 9);

      ctx.fillStyle = color;
      ctx.font = `bold ${fontSize}px "Segoe UI", Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const lineH = fontSize + 6;
      const totalTextH = lines.length * lineH;
      const startTextY = bannerY + (bannerH - totalTextH) / 2 + lineH / 2;
      const centerX = bannerX + bannerW / 2;

      lines.forEach((line, i) => {
        ctx.fillText(line, centerX, startTextY + i * lineH);
      });

      ctx.restore();
    }

    return canvas.toBuffer('image/png');
  }

  /**
   * Draw a Poker Texas Hold'em felt table
   */
  public static async drawPokerTable(
    playerHand: Card[],
    botHand: Card[],
    communityCards: Card[],
    pot: number,
    betPlayer: number,
    betBot: number,
    currency: 'COIN' | 'VND',
    gamePhase: string,
    statusText?: string,
    hideBotHand = true
  ): Promise<Buffer> {
    const width = 900;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // radial felt background
    const tableGrad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 550);
    tableGrad.addColorStop(0, '#0F4C81'); // Elegant dark blue felt
    tableGrad.addColorStop(1, '#0B233A'); // Near black edge
    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, 0, width, height);

    // Felt inner line border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 8;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Draw Poker Felt Text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.font = 'bold 36px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TEXAS HOLD\'EM', width / 2, height / 2 - 120);

    // 1. Draw Bot (Dealer) Hand at Top
    this.drawHand(ctx, botHand, 350, 60, `BOT (ĐỐI THỦ)`, isNaN(betBot) ? undefined : `Cược: ${betBot.toLocaleString()}`, hideBotHand);

    // 2. Draw Community Cards in the center
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillText('BÀI CHUNG (COMMUNITY CARDS)', 230, height / 2 - 35);

    const cardWidth = 70;
    const cardHeight = 100;
    const gap = 15;
    const boardStartX = 230;
    const boardY = height / 2 - 15;

    // Draw 5 community card boxes (faint placeholder or drawn card)
    for (let i = 0; i < 5; i++) {
      const x = boardStartX + i * (cardWidth + gap);
      if (communityCards[i]) {
        this.drawPlayingCard(ctx, communityCards[i], x, boardY, cardWidth, cardHeight, false);
      } else {
        // Draw dashed card placeholders
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, boardY, cardWidth, cardHeight);
        ctx.restore();
      }
    }

    // 3. Draw Player Hand at Bottom
    this.drawHand(ctx, playerHand, 350, 340, `BẠN (PLAYER)`, isNaN(betPlayer) ? undefined : `Cược: ${betPlayer.toLocaleString()}`, false);

    // 4. Draw Pot and Info Section (left box)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(40, height / 2 - 80, 160, 160);
    ctx.strokeStyle = Theme.colors.accentGold;
    ctx.lineWidth = 2;
    ctx.strokeRect(40, height / 2 - 80, 160, 160);

    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 12px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TỔNG POT', 120, height / 2 - 50);

    const formattedPot = currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Segoe UI", Arial';
    ctx.fillText(formattedPot, 120, height / 2 - 25);

    ctx.fillStyle = Theme.colors.textMuted;
    ctx.font = '12px "Segoe UI", Arial';
    ctx.fillText('VÒNG CHƠI', 120, height / 2 + 10);

    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 14px "Segoe UI", Arial';
    ctx.fillText(gamePhase.toUpperCase(), 120, height / 2 + 30);

    ctx.restore();

    // 5. Draw Game Status/Actions (Right Box)
    if (statusText) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(width - 200, height / 2 - 80, 160, 160);
      ctx.strokeStyle = Theme.colors.accentGold;
      ctx.lineWidth = 2;
      ctx.strokeRect(width - 200, height / 2 - 80, 160, 160);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      
      // Splitting status text if it is too long
      const words = statusText.split(' ');
      let line = '';
      let yOffset = height / 2 - 40;
      for (const word of words) {
        if (ctx.measureText(line + word).width > 140) {
          ctx.fillText(line, width - 120, yOffset);
          line = word + ' ';
          yOffset += 18;
        } else {
          line += word + ' ';
        }
      }
      ctx.fillText(line, width - 120, yOffset);
      ctx.restore();
    }

    return canvas.toBuffer('image/png');
  }

  /**
   * Draw a set of random cards
   */
  public static async drawRandomCards(cards: Card[], flippedStates?: boolean[]): Promise<Buffer> {
    const cardWidth = 85;
    const cardHeight = 130;
    const gap = 15;
    const padding = 20;

    const width = cards.length * (cardWidth + gap) - gap + padding * 2;
    const height = cardHeight + padding * 2;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Felt green background
    ctx.fillStyle = '#155e37';
    ctx.fillRect(0, 0, width, height);

    // Draw border
    ctx.strokeStyle = Theme.colors.accentGold;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    cards.forEach((card, index) => {
      const x = padding + index * (cardWidth + gap);
      const y = padding;
      const isHidden = flippedStates ? !flippedStates[index] : false;
      this.drawPlayingCard(ctx, card, x, y, cardWidth, cardHeight, isHidden);
    });

    return canvas.toBuffer('image/png');
  }

  /**
   * Draw a felt table for Random Card PvP with 2 rows of cards (one for each player)
   */
  public static async drawPvpCardsTable(
    p1Hand: Card[],
    p2Hand: Card[],
    p1Flipped: boolean[],
    p2Flipped: boolean[],
    p1Name: string,
    p2Name: string,
    bet: number,
    currency: 'COIN' | 'VND',
    outcomeText?: string
  ): Promise<Buffer> {
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Draw felt background (royal blue gradient)
    const tableGrad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 500);
    tableGrad.addColorStop(0, '#103f6b'); // Dark Blue felt
    tableGrad.addColorStop(1, '#081e33');
    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, 0, width, height);

    // Border lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Title on felt
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.font = 'bold 36px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('RANDOM CARD PVP', width / 2, height / 2 - 10);

    const cardWidth = 70;
    const cardHeight = 100;
    const gap = 15;

    // Draw Player 1 Hand (Top)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillText(p1Name.toUpperCase(), 50, 45);

    p1Hand.forEach((card, index) => {
      const x = 50 + index * (cardWidth + gap);
      const y = 65;
      const isHidden = !p1Flipped[index];
      this.drawPlayingCard(ctx, card, x, y, cardWidth, cardHeight, isHidden);
    });

    // Draw Player 2 Hand (Bottom)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillText(p2Name.toUpperCase(), 50, 215);

    p2Hand.forEach((card, index) => {
      const x = 50 + index * (cardWidth + gap);
      const y = 235;
      const isHidden = !p2Flipped[index];
      this.drawPlayingCard(ctx, card, x, y, cardWidth, cardHeight, isHidden);
    });

    // Draw Bet Box (Right side)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.beginPath();
    const boxX = 530;
    const boxY = 65;
    const boxW = 220;
    const boxH = 100;
    const r = 10;
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxW - r, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
    ctx.lineTo(boxX + boxW, boxY + boxH - r);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
    ctx.lineTo(boxX, boxY + r);
    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = Theme.colors.accentGold;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 12px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MỨC CƯỢC MỖI BÊN', boxX + boxW / 2, boxY + 35);

    const formattedBet = currency === 'VND' ? `${bet.toLocaleString('vi-VN')} ₫` : `${bet.toLocaleString()} Coins`;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Segoe UI", Arial';
    ctx.fillText(formattedBet, boxX + boxW / 2, boxY + 68);
    ctx.restore();

    // Draw Outcome Box if finished
    if (outcomeText) {
      ctx.save();
      const bannerX = 515;
      const bannerY = 215;
      const bannerW = 250;
      const bannerH = 120;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.beginPath();
      ctx.moveTo(bannerX + 10, bannerY);
      ctx.lineTo(bannerX + bannerW - 10, bannerY);
      ctx.quadraticCurveTo(bannerX + bannerW, bannerY, bannerX + bannerW, bannerY + 10);
      ctx.lineTo(bannerX + bannerW, bannerY + bannerH - 10);
      ctx.quadraticCurveTo(bannerX + bannerW, bannerY + bannerH, bannerX + bannerW - 10, bannerY + bannerH);
      ctx.lineTo(bannerX + 10, bannerY + bannerH);
      ctx.quadraticCurveTo(bannerX, bannerY + bannerH, bannerX, bannerY + bannerH - 10);
      ctx.lineTo(bannerX, bannerY + 10);
      ctx.quadraticCurveTo(bannerX, bannerY, bannerX + 10, bannerY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = Theme.colors.accentGold;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Determine outcome color
      let color = Theme.colors.accentGold;
      if (outcomeText.includes('chiến thắng') || outcomeText.includes('thắng')) color = Theme.colors.success;
      if (outcomeText.includes('HÒA')) color = Theme.colors.info;
      if (outcomeText.includes('huỷ')) color = Theme.colors.danger;

      ctx.fillStyle = color;
      ctx.font = 'bold 13px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const words = outcomeText.split(' ');
      let line = '';
      let yOffset = bannerY + 40;
      for (const word of words) {
        if (ctx.measureText(line + word).width > 220) {
          ctx.fillText(line, bannerX + bannerW / 2, yOffset);
          line = word + ' ';
          yOffset += 20;
        } else {
          line += word + ' ';
        }
      }
      ctx.fillText(line, bannerX + bannerW / 2, yOffset);
      ctx.restore();
    }

    return canvas.toBuffer('image/png');
  }

  /**
   * Draw a felt table for 4-Player Blackjack PvP
   */
  public static async drawBlackjack4PTable(
    hands: Card[][],
    scores: number[],
    playerNames: string[],
    bet: number,
    currency: 'COIN' | 'VND',
    activePlayerIndex: number,
    isOngoing: boolean,
    outcomeText?: string
  ): Promise<Buffer> {
    const width = 900;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Draw Table background (green gradient felt)
    const tableGrad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 550);
    tableGrad.addColorStop(0, '#105B34'); // Lighter felt green
    tableGrad.addColorStop(1, '#08331E'); // Dark edge green
    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw felt lines (golden border arch)
    ctx.strokeStyle = 'rgba(246, 196, 83, 0.2)';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = 'bold 24px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BLACKJACK PVP 4 PLAYERS', width / 2, 40);

    // Positions for 2x2 grid
    const positions = [
      { x: 50, y: 100 },
      { x: 500, y: 100 },
      { x: 50, y: 350 },
      { x: 500, y: 350 }
    ];

    for (let i = 0; i < 4; i++) {
      let title = playerNames[i];
      if (isOngoing && i === activePlayerIndex) {
        title = `👉 ${title} (Lượt)`;
      }

      // If finished or player is bust or has ngũ linh, show score. Otherwise hide score while game is ongoing.
      const showScore = !isOngoing || scores[i] > 21 || hands[i].length >= 5;
      const scoreStr = showScore ? `${scores[i]}` : undefined;

      this.drawHand(
        ctx,
        hands[i],
        positions[i].x,
        positions[i].y,
        title.toUpperCase(),
        scoreStr,
        false, // isDealerHidden
        isOngoing // hideAllCards (if ongoing, hides cards from index 1)
      );
    }

    // 4. Draw Pot info in the center
    ctx.save();
    ctx.fillStyle = '#1E293B';
    const boxX = 380;
    const boxY = 240;
    const boxW = 140;
    const boxH = 70;
    const radius = 8;
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY);
    ctx.lineTo(boxX + boxW - radius, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
    ctx.lineTo(boxX + boxW, boxY + boxH - radius);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
    ctx.lineTo(boxX + radius, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
    ctx.lineTo(boxX, boxY + radius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = Theme.colors.accentGold;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 12px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TỔNG POT', boxX + boxW / 2, boxY + 22);

    const pot = bet * 4;
    const formattedPot = currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px "Segoe UI", Arial';
    ctx.fillText(formattedPot, boxX + boxW / 2, boxY + 48);
    ctx.restore();

    // 5. Draw Game outcome banner if ended
    if (outcomeText) {
      ctx.save();
      const bannerX = 250;
      const bannerY = 490;
      const bannerW = 400;
      const bannerH = 80;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.beginPath();
      const br = 10;
      ctx.moveTo(bannerX + br, bannerY);
      ctx.lineTo(bannerX + bannerW - br, bannerY);
      ctx.quadraticCurveTo(bannerX + bannerW, bannerY, bannerX + bannerW, bannerY + br);
      ctx.lineTo(bannerX + bannerW, bannerY + bannerH - br);
      ctx.quadraticCurveTo(bannerX + bannerW, bannerY + bannerH, bannerX + bannerW - br, bannerY + bannerH);
      ctx.lineTo(bannerX + br, bannerY + bannerH);
      ctx.quadraticCurveTo(bannerX, bannerY + bannerH, bannerX, bannerY + bannerH - br);
      ctx.lineTo(bannerX, bannerY + br);
      ctx.quadraticCurveTo(bannerX, bannerY, bannerX + br, bannerY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = Theme.colors.accentGold;
      ctx.lineWidth = 2;
      ctx.stroke();

      let color = Theme.colors.accentGold;
      if (outcomeText.includes('thắng') || outcomeText.includes('chiến thắng')) color = Theme.colors.success;
      if (outcomeText.includes('HÒA')) color = Theme.colors.info;
      if (outcomeText.includes('hết thời gian') || outcomeText.includes('huỷ')) color = Theme.colors.danger;

      ctx.fillStyle = color;
      ctx.font = 'bold 14px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const words = outcomeText.split(' ');
      let line = '';
      let yOffset = bannerY + 25;
      for (const word of words) {
        if (ctx.measureText(line + word).width > bannerW - 40) {
          ctx.fillText(line, bannerX + bannerW / 2, yOffset);
          line = word + ' ';
          yOffset += 18;
        } else {
          line += word + ' ';
        }
      }
      ctx.fillText(line, bannerX + bannerW / 2, yOffset);
      ctx.restore();
    }

    return canvas.toBuffer('image/png');
  }

  /**
   * Draw a felt table for 4-Player Poker Texas Hold'em PvP
   */
  public static async drawPoker4PTable(
    hands: Card[][],
    communityCards: Card[],
    pot: number,
    bets: number[],
    currency: 'COIN' | 'VND',
    gamePhase: string,
    playerNames: string[],
    activePlayerIndex: number,
    isOngoing: boolean,
    statusText?: string
  ): Promise<Buffer> {
    const width = 1000;
    const height = 700;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Radial felt background
    const tableGrad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 600);
    tableGrad.addColorStop(0, '#0F4C81'); // Elegant dark blue felt
    tableGrad.addColorStop(1, '#0B233A'); // Near black edge
    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, 0, width, height);

    // Felt inner line border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 8;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.font = 'bold 36px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TEXAS HOLD\'EM 4P', width / 2, height / 2 - 120);

    // 1. Draw Community Cards in the center
    const cardWidth = 70;
    const cardHeight = 100;
    const gap = 15;
    const boardStartX = width / 2 - (cardWidth * 5 + gap * 4) / 2; // 295
    const boardY = height / 2 - cardHeight / 2; // 300

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BÀI CHUNG (COMMUNITY CARDS)', width / 2, boardY - 15);

    for (let i = 0; i < 5; i++) {
      const x = boardStartX + i * (cardWidth + gap);
      if (communityCards[i]) {
        this.drawPlayingCard(ctx, communityCards[i], x, boardY, cardWidth, cardHeight, false);
      } else {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, boardY, cardWidth, cardHeight);
        ctx.restore();
      }
    }

    // 2. Draw 4 Players around the table
    // Positions: 0: Bottom, 1: Left, 2: Top, 3: Right
    const handWidth = cardWidth * 2 + gap; // 155
    const playerPositions = [
      { x: width / 2 - handWidth / 2, y: 530, title: playerNames[0] }, // Bottom
      { x: 60, y: 280, title: playerNames[1] },                       // Left
      { x: width / 2 - handWidth / 2, y: 80, title: playerNames[2] },  // Top
      { x: 785, y: 280, title: playerNames[3] }                       // Right
    ];

    for (let i = 0; i < 4; i++) {
      let title = playerPositions[i].title;
      if (isOngoing && i === activePlayerIndex) {
        title = `👉 ${title} (Lượt)`;
      }

      const betText = bets[i] > 0 ? `Cược: ${bets[i].toLocaleString()}` : undefined;

      this.drawHand(
        ctx,
        hands[i],
        playerPositions[i].x,
        playerPositions[i].y,
        title.toUpperCase(),
        betText,
        isOngoing, // isDealerHidden (if ongoing, hide all cards)
        isOngoing  // hideAllCards
      );
    }

    // 3. Draw Pot and Info
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(width / 2 - 250, height / 2 - 210, 150, 80);
    ctx.strokeStyle = Theme.colors.accentGold;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(width / 2 - 250, height / 2 - 210, 150, 80);

    ctx.fillStyle = Theme.colors.textSecondary;
    ctx.font = 'bold 11px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TỔNG POT', width / 2 - 175, height / 2 - 185);

    const formattedPot = currency === 'VND' ? `${pot.toLocaleString('vi-VN')} ₫` : `${pot.toLocaleString()} Coins`;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px "Segoe UI", Arial';
    ctx.fillText(formattedPot, width / 2 - 175, height / 2 - 160);

    ctx.fillStyle = Theme.colors.accentGold;
    ctx.font = 'bold 11px "Segoe UI", Arial';
    ctx.fillText(gamePhase.toUpperCase(), width / 2 - 175, height / 2 - 140);
    ctx.restore();

    // 4. Draw Status/Actions
    if (statusText) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(width / 2 + 100, height / 2 - 210, 150, 80);
      ctx.strokeStyle = Theme.colors.accentGold;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(width / 2 + 100, height / 2 - 210, 150, 80);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px "Segoe UI", Arial';
      ctx.textAlign = 'center';

      const words = statusText.split(' ');
      let line = '';
      let yOffset = height / 2 - 190;
      for (const word of words) {
        if (ctx.measureText(line + word).width > 130) {
          ctx.fillText(line, width / 2 + 175, yOffset);
          line = word + ' ';
          yOffset += 14;
        } else {
          line += word + ' ';
        }
      }
      ctx.fillText(line, width / 2 + 175, yOffset);
      ctx.restore();
    }

    return canvas.toBuffer('image/png');
  }
}
