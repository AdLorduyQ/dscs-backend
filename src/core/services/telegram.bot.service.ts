import { ServerService } from './server.service';
import { AlertService } from './alert.service';
import { ConfigService } from './config.service';
import { TelegramUtil } from '../../utils/telegram.util';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; username?: string };
    chat: { id: number };
    text?: string;
  };
}

export class TelegramBotService {
  private offset = 0;
  private polling = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  private get token(): string {
    return process.env.TELEGRAM_BOT_TOKEN ?? '';
  }

  constructor(
    private readonly serverService: ServerService,
    private readonly alertService: AlertService,
    private readonly configService: ConfigService
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  startPolling(intervalMs = 3000) {
    if (!this.token) {
      console.log('[Telegram Bot] Token no configurado, polling desactivado.');
      return;
    }
    this.polling = true;
    console.log('[Telegram Bot] Polling iniciado...');
    this.scheduleNext(intervalMs);
  }

  stopPolling() {
    this.polling = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    console.log('[Telegram Bot] Polling detenido.');
  }

  // ─── Polling internals ─────────────────────────────────────────────────────

  private scheduleNext(intervalMs: number) {
    this.pollTimer = setTimeout(async () => {
      if (!this.polling) return;
      await this.fetchUpdates();
      this.scheduleNext(intervalMs);
    }, intervalMs);
  }

  private async fetchUpdates() {
    try {
      const url =
        `https://api.telegram.org/bot${this.token}/getUpdates` +
        `?offset=${this.offset}&timeout=2`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;

      const data: { ok: boolean; result: TelegramUpdate[] } = await res.json();
      if (!data.ok || !data.result.length) return;

      for (const update of data.result) {
        this.offset = update.update_id + 1;
        if (update.message?.text) {
          await this.handleMessage(update.message);
        }
      }
    } catch {
      // silently ignore network errors during polling
    }
  }

  // ─── Command dispatcher ────────────────────────────────────────────────────

  private async handleMessage(message: NonNullable<TelegramUpdate['message']>) {
    const chatId = String(message.chat.id);
    const text = message.text?.trim() ?? '';
    const [command, ...args] = text.split(' ');

    console.log(`[Telegram Bot] Comando recibido: "${text}"`);

    try {
      switch (command.toLowerCase()) {
        case '/start':
        case '/ayuda':
        case '/help':
          await this.cmdHelp(chatId);
          break;

        case '/servidores':
        case '/servers':
          await this.cmdServers(chatId);
          break;

        case '/uso':
        case '/usage':
          await this.cmdUsage(chatId, args[0]);
          break;

        case '/alertas':
        case '/alerts':
          await this.cmdAlerts(chatId, args[0]);
          break;

        case '/alertas_activas':
        case '/active_alerts':
          await this.cmdActiveAlerts(chatId, args[0]);
          break;

        case '/resolver':
        case '/resolve':
          await this.cmdResolve(chatId, args[0]);
          break;

        case '/config':
          await this.cmdConfig(chatId);
          break;

        case '/set_cpu':
          await this.cmdSetCpu(chatId, args[0]);
          break;

        case '/set_ram':
          await this.cmdSetRam(chatId, args[0]);
          break;

        case '/set_interval':
          await this.cmdSetInterval(chatId, args[0]);
          break;

        case '/changelog':
          await this.cmdChangelog(chatId);
          break;

        default:
          await this.reply(
            chatId,
            `❓ Comando no reconocido: <code>${command}</code>\n\nEscribe /ayuda para ver los comandos disponibles.`
          );
      }
    } catch (error: any) {
      await this.reply(chatId, `⚠️ Error ejecutando el comando:\n<code>${error.message}</code>`);
    }
  }

  // ─── Commands ──────────────────────────────────────────────────────────────

  private async cmdHelp(chatId: string) {
    const msg = `
🖥️ <b>DSCS - Distributed Server Control System</b>
<i>Bot de monitoreo y control</i>

<b>📊 Monitoreo</b>
/servidores — Lista todos los servidores
/uso &lt;id&gt; — Métricas de CPU, RAM, disco y red de un servidor
/alertas &lt;id&gt; — Historial de alertas de un servidor
/alertas_activas &lt;id&gt; — Alertas activas de un servidor

<b>✅ Gestión de alertas</b>
/resolver &lt;alertaId&gt; — Resuelve una alerta activa

<b>⚙️ Configuración</b>
/config — Ver configuración actual de umbrales
/set_cpu &lt;valor%&gt; — Cambiar umbral de CPU
/set_ram &lt;valor%&gt; — Cambiar umbral de RAM
/set_interval &lt;segundos&gt; — Cambiar intervalo de monitoreo

<b>📋 Historial</b>
/changelog — Ver últimos cambios de configuración

<b>ℹ️ Ayuda</b>
/ayuda — Mostrar este mensaje
`.trim();
    await this.reply(chatId, msg);
  }

  private async cmdServers(chatId: string) {
    const servers = await this.serverService.getAllServers();

    if (!servers.length) {
      await this.reply(chatId, '📭 No hay servidores registrados.');
      return;
    }

    const lines = servers.map((s) => {
      const emoji = s.estado === 'ONLINE' ? '🟢' : s.estado === 'WARNING' ? '🟡' : '🔴';
      return `${emoji} <b>#${s.id} ${s.nombre}</b>  |  <code>${s.ip}</code>  |  ${s.estado}`;
    });

    await this.reply(chatId, `🖥️ <b>Servidores registrados (${servers.length})</b>\n\n${lines.join('\n')}`);
  }

  private async cmdUsage(chatId: string, idArg?: string) {
    if (!idArg || isNaN(Number(idArg))) {
      await this.reply(chatId, '⚠️ Uso: /uso &lt;id_servidor&gt;\nEjemplo: /uso 1');
      return;
    }

    const server = await this.serverService.getServerById(Number(idArg));
    const estado = server.estado === 'ONLINE' ? '🟢' : server.estado === 'WARNING' ? '🟡' : '🔴';

    const bar = (pct: number) => {
      const filled = Math.round(pct / 10);
      return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
    };

    const msg = `
${estado} <b>${server.nombre}</b>  (<code>${server.ip}</code>)

🔵 CPU    ${bar(server.cpu)}
🟣 RAM    ${bar(server.ram)}
🟠 Disco  ${bar(server.disco)}
🟡 Red    ${bar(server.red)}
    `.trim();

    await this.reply(chatId, msg);
  }

  private async cmdAlerts(chatId: string, idArg?: string) {
    if (!idArg || isNaN(Number(idArg))) {
      await this.reply(chatId, '⚠️ Uso: /alertas &lt;id_servidor&gt;\nEjemplo: /alertas 1');
      return;
    }

    const alerts = await this.alertService.getAlerts(Number(idArg));

    if (!alerts.length) {
      await this.reply(chatId, `✅ No hay alertas registradas para el servidor #${idArg}.`);
      return;
    }

    const lines = alerts.slice(0, 10).map((a) => {
      const estado = a.resuelto ? '✅' : '🚨';
      const fecha = a.timestamp ? new Date(a.timestamp).toLocaleString('es-CO') : '—';
      return `${estado} [${a.tipo}] <b>${a.recurso}</b> — ${a.valor}% (umbral ${a.umbral}%)\n   <i>${fecha}</i>`;
    });

    const total = alerts.length;
    const footer = total > 10 ? `\n<i>Mostrando 10 de ${total} alertas</i>` : '';

    await this.reply(chatId, `🚨 <b>Alertas del servidor #${idArg}</b>\n\n${lines.join('\n\n')}${footer}`);
  }

  private async cmdActiveAlerts(chatId: string, idArg?: string) {
    if (!idArg || isNaN(Number(idArg))) {
      await this.reply(chatId, '⚠️ Uso: /alertas_activas &lt;id_servidor&gt;\nEjemplo: /alertas_activas 1');
      return;
    }

    const alerts = await this.alertService.getActiveAlerts(Number(idArg));

    if (!alerts.length) {
      await this.reply(chatId, `✅ No hay alertas activas en el servidor #${idArg}.`);
      return;
    }

    const lines = alerts.map((a) => {
      const fecha = a.timestamp ? new Date(a.timestamp).toLocaleString('es-CO') : '—';
      return `🚨 [<code>${a.id}</code>]\n   <b>${a.recurso}</b>: ${a.valor}% (umbral ${a.umbral}%)\n   <i>${fecha}</i>`;
    });

    await this.reply(
      chatId,
      `🔴 <b>Alertas ACTIVAS en servidor #${idArg}</b>\n\n${lines.join('\n\n')}\n\nUsa /resolver &lt;alertaId&gt; para resolverla.`
    );
  }

  private async cmdResolve(chatId: string, alertId?: string) {
    if (!alertId) {
      await this.reply(chatId, '⚠️ Uso: /resolver &lt;alertaId&gt;\nEjemplo: /resolver abc-123-uuid');
      return;
    }

    const resolved = await this.alertService.resolveAlert(alertId);
    const fecha = resolved.resueltoEn
      ? new Date(resolved.resueltoEn).toLocaleString('es-CO')
      : new Date().toLocaleString('es-CO');

    await this.reply(
      chatId,
      `✅ <b>Alerta resuelta correctamente</b>\n\nRecurso: <b>${resolved.recurso}</b>\nMensaje: ${resolved.mensaje}\nResuelta el: <i>${fecha}</i>`
    );
  }

  private async cmdConfig(chatId: string) {
    const config = await this.configService.getConfig();
    const msg = `
⚙️ <b>Configuración actual del sistema</b>

🔵 Umbral CPU:        <b>${config.cpuThreshold}%</b>
🟣 Umbral RAM:        <b>${config.ramThreshold}%</b>
⏱️ Intervalo monitoreo: <b>${config.monitoringInterval}s</b>

Para cambiar:
/set_cpu &lt;valor&gt;
/set_ram &lt;valor&gt;
/set_interval &lt;segundos&gt;
    `.trim();
    await this.reply(chatId, msg);
  }

  private async cmdSetCpu(chatId: string, valueArg?: string) {
    const value = parseFloat(valueArg ?? '');
    if (isNaN(value) || value < 1 || value > 100) {
      await this.reply(chatId, '⚠️ Uso: /set_cpu &lt;1-100&gt;\nEjemplo: /set_cpu 80');
      return;
    }
    // userId 1 — bot actúa como admin (mismo criterio que el TODO del configController)
    await this.configService.updateConfig({ cpuThreshold: value }, 1);
    await this.reply(chatId, `✅ Umbral de CPU actualizado a <b>${value}%</b>`);
  }

  private async cmdSetRam(chatId: string, valueArg?: string) {
    const value = parseFloat(valueArg ?? '');
    if (isNaN(value) || value < 1 || value > 100) {
      await this.reply(chatId, '⚠️ Uso: /set_ram &lt;1-100&gt;\nEjemplo: /set_ram 85');
      return;
    }
    await this.configService.updateConfig({ ramThreshold: value }, 1);
    await this.reply(chatId, `✅ Umbral de RAM actualizado a <b>${value}%</b>`);
  }

  private async cmdSetInterval(chatId: string, valueArg?: string) {
    const value = parseInt(valueArg ?? '');
    if (isNaN(value) || value < 5) {
      await this.reply(chatId, '⚠️ Uso: /set_interval &lt;segundos&gt; (mínimo 5)\nEjemplo: /set_interval 30');
      return;
    }
    await this.configService.updateConfig({ monitoringInterval: value }, 1);
    await this.reply(
      chatId,
      `✅ Intervalo de monitoreo actualizado a <b>${value}s</b>\n\n⚠️ El nuevo intervalo aplica al próximo reinicio del servidor.`
    );
  }

  private async cmdChangelog(chatId: string) {
    const logs = await this.configService.getChangelogs();

    if (!logs.length) {
      await this.reply(chatId, '📭 No hay cambios registrados.');
      return;
    }

    const lines = logs.slice(0, 10).map((l) => {
      const fecha = l.fecha ? new Date(l.fecha).toLocaleString('es-CO') : '—';
      return `📝 <b>${l.descripcion}</b>\n   <i>${fecha}</i>`;
    });

    await this.reply(chatId, `📋 <b>Últimos cambios de configuración</b>\n\n${lines.join('\n\n')}`);
  }

  // ─── Helper ────────────────────────────────────────────────────────────────

  private async reply(chatId: string, text: string) {
    if (!this.token) return;
    try {
      await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error: any) {
      console.error('[Telegram Bot] Error enviando respuesta:', error.message);
    }
  }
}
