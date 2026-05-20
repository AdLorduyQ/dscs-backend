export class TelegramUtil {
  private static get token(): string | undefined {
    return process.env.TELEGRAM_BOT_TOKEN;
  }

  private static get chatId(): string | undefined {
    return process.env.TELEGRAM_CHAT_ID;
  }

  static async send(text: string): Promise<void> {
    if (!this.token || !this.chatId) {
      console.log('[Telegram] Token o Chat ID no configurados');
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`[Telegram] Error HTTP ${res.status}: ${body}`);
      }
    } catch (error: any) {
      console.error('[Telegram] Error al enviar mensaje:', error.message);
    }
  }
}
