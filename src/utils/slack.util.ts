export class SlackUtil {
  static async send(text: string): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl === 'PEGA_TU_URL_AQUI') {
      console.log('[Slack] Webhook URL no configurada');
      return;
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) {
        console.error(`[Slack] Error HTTP ${res.status} al enviar notificación`);
      }
    } catch (error: any) {
      console.error('[Slack] Error al enviar notificación:', error.message);
    }
  }
}
