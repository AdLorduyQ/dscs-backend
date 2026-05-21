import { ServerService } from '../services/server.service';
import { AlertService } from '../services/alert.service';
import { ConfigService } from '../services/config.service';
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
    const senderName = message.from?.first_name ?? 'Usuario';

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
          await this.cmdResolve(chatId, args[0], senderName);
          break;

        case '/config':
          await this.cmdConfig(chatId);
          break;

        case '/set_cpu':
          await this.cmdSetCpu(chatId, args[0], senderName);
          break;

        case '/set_ram':
          await this.cmdSetRam(chatId, args[0], senderName);
          break;

        case '/set_interval':
          await this.cmdSetInterval(chatId, args[0], senderName);
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
      await this.reply(
        chatId,
        `⚠️ <b>Error ejecutando el comando</b>\n\n<code>${error.message}</code>\n\n<i>Si el problema persiste, verifica que el ID sea correcto.</i>`
      );
    }
  }

  // ─── Commands ──────────────────────────────────────────────────────────────

  private async cmdHelp(chatId: string) {
    const msg = `
🖥️ <b>DSCS - Distributed Server Control System</b>
<i>Bot de monitoreo y control de clúster K8s</i>

<b>📊 Monitoreo</b>
/servidores — Lista todos los servidores registrados
/uso &lt;id&gt; — Métricas de CPU, RAM, disco y red de un servidor
/alertas &lt;id&gt; — Historial completo de alertas de un servidor
/alertas_activas &lt;id&gt; — Solo alertas sin resolver

<b>✅ Gestión de alertas</b>
/resolver &lt;alertaId&gt; — Marca una alerta como resuelta

<b>⚙️ Configuración</b>
/config — Ver umbrales y configuración actual
/set_cpu &lt;valor%&gt; — Cambiar umbral de CPU (1–100)
/set_ram &lt;valor%&gt; — Cambiar umbral de RAM (1–100)
/set_interval &lt;segundos&gt; — Cambiar intervalo de monitoreo (mín. 5s)

<b>📋 Historial</b>
/changelog — Ver últimos cambios de configuración

<b>ℹ️ Ayuda</b>
/ayuda — Mostrar este mensaje
`.trim();
    await this.reply(chatId, msg);
  }

  private async cmdServers(chatId: string) {
    await this.reply(chatId, '⏳ Consultando servidores...');

    const servers = await this.serverService.getAllServers();

    if (!servers.length) {
      await this.reply(chatId, '📭 No hay servidores registrados en el sistema.');
      return;
    }

    const lines = servers.map((s) => {
      const emoji = s.estado === 'ONLINE' ? '🟢' : s.estado === 'WARNING' ? '🟡' : '🔴';
      return `${emoji} <b>#${s.id} ${s.nombre}</b>\n   IP: <code>${s.ip}</code> | Estado: ${s.estado}\n   CPU: ${s.cpu}% | RAM: ${s.ram}%`;
    });

    await this.reply(
      chatId,
      `🖥️ <b>Servidores registrados (${servers.length})</b>\n\n${lines.join('\n\n')}\n\n<i>Usa /uso &lt;id&gt; para ver métricas detalladas.</i>`
    );
  }

  private async cmdUsage(chatId: string, idArg?: string) {
    if (!idArg || isNaN(Number(idArg))) {
      await this.reply(chatId, '⚠️ Uso: /uso &lt;id_servidor&gt;\nEjemplo: /uso 1');
      return;
    }

    await this.reply(chatId, `⏳ Obteniendo métricas del servidor #${idArg}...`);

    const server = await this.serverService.getServerById(Number(idArg));
    const estado = server.estado === 'ONLINE' ? '🟢' : server.estado === 'WARNING' ? '🟡' : '🔴';

    const bar = (pct: number) => {
      const filled = Math.round(pct / 10);
      const color = pct >= 80 ? '🔴' : pct >= 60 ? '🟡' : '🟢';
      return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${pct}% ${color}`;
    };

    const msg = `
${estado} <b>${server.nombre}</b>  (<code>${server.ip}</code>)
Estado: <b>${server.estado}</b>

🔵 CPU    ${bar(server.cpu)}
🟣 RAM    ${bar(server.ram)}
🟠 Disco  ${bar(server.disco)}
🟡 Red    ${bar(server.red)}

<i>Actualizado: ${new Date().toLocaleString('es-CO')}</i>
`.trim();

    await this.reply(chatId, msg);
  }

  private async cmdAlerts(chatId: string, idArg?: string) {
    if (!idArg || isNaN(Number(idArg))) {
      await this.reply(chatId, '⚠️ Uso: /alertas &lt;id_servidor&gt;\nEjemplo: /alertas 1');
      return;
    }

    await this.reply(chatId, `⏳ Consultando historial de alertas del servidor #${idArg}...`);

    const alerts = await this.alertService.getAlerts(Number(idArg));

    if (!alerts.length) {
      await this.reply(chatId, `✅ No hay alertas registradas para el servidor #${idArg}.\n\n<i>Este servidor no ha disparado ninguna alerta.</i>`);
      return;
    }

    const resueltas = alerts.filter((a) => a.resuelto).length;
    const activas = alerts.length - resueltas;

    const lines = alerts.slice(0, 10).map((a) => {
      const estado = a.resuelto ? '✅' : '🚨';
      const fecha = a.timestamp ? new Date(a.timestamp).toLocaleString('es-CO') : '—';
      return `${estado} [${a.tipo}] <b>${a.recurso}</b> — ${a.valor}% (umbral ${a.umbral}%)\n   ID: <code>${a.id}</code>\n   <i>${fecha}</i>`;
    });

    const total = alerts.length;
    const footer = total > 10 ? `\n\n<i>Mostrando 10 de ${total} alertas</i>` : '';

    await this.reply(
      chatId,
      `📋 <b>Historial de alertas — Servidor #${idArg}</b>\n` +
      `🚨 Activas: <b>${activas}</b> | ✅ Resueltas: <b>${resueltas}</b>\n\n` +
      `${lines.join('\n\n')}${footer}\n\n` +
      `<i>Usa /resolver &lt;alertaId&gt; para resolver una alerta activa.</i>`
    );
  }

  private async cmdActiveAlerts(chatId: string, idArg?: string) {
    if (!idArg || isNaN(Number(idArg))) {
      await this.reply(chatId, '⚠️ Uso: /alertas_activas &lt;id_servidor&gt;\nEjemplo: /alertas_activas 1');
      return;
    }

    await this.reply(chatId, `⏳ Buscando alertas activas del servidor #${idArg}...`);

    const alerts = await this.alertService.getActiveAlerts(Number(idArg));

    if (!alerts.length) {
      await this.reply(
        chatId,
        `✅ <b>Sin alertas activas</b>\n\nEl servidor #${idArg} no tiene alertas pendientes de resolver. ¡Todo en orden!`
      );
      return;
    }

    const lines = alerts.map((a) => {
      const fecha = a.timestamp ? new Date(a.timestamp).toLocaleString('es-CO') : '—';
      return `🚨 [<code>${a.id}</code>]\n   <b>${a.recurso}</b>: ${a.valor}% (umbral ${a.umbral}%)\n   <i>Desde: ${fecha}</i>`;
    });

    await this.reply(
      chatId,
      `🔴 <b>Alertas ACTIVAS — Servidor #${idArg} (${alerts.length})</b>\n\n` +
      `${lines.join('\n\n')}\n\n` +
      `<i>Usa /resolver &lt;alertaId&gt; para marcar una como resuelta.</i>`
    );
  }

  private async cmdResolve(chatId: string, alertId?: string, senderName = 'Usuario') {
    if (!alertId) {
      await this.reply(chatId, '⚠️ Uso: /resolver &lt;alertaId&gt;\nEjemplo: /resolver abc-123-uuid');
      return;
    }

    await this.reply(chatId, `⏳ Resolviendo alerta <code>${alertId}</code>...`);

    const resolved = await this.alertService.resolveAlert(alertId);

    const fechaCreacion = resolved.timestamp
      ? new Date(resolved.timestamp).toLocaleString('es-CO')
      : '—';
    const fechaResolucion = resolved.resueltoEn
      ? new Date(resolved.resueltoEn).toLocaleString('es-CO')
      : new Date().toLocaleString('es-CO');

    let duracion = '';
    if (resolved.timestamp && resolved.resueltoEn) {
      const ms = new Date(resolved.resueltoEn).getTime() - new Date(resolved.timestamp).getTime();
      const mins = Math.floor(ms / 60000);
      const horas = Math.floor(mins / 60);
      duracion = horas > 0 ? `${horas}h ${mins % 60}m` : `${mins}m`;
    }

    const confirmacion =
      `✅ <b>Alerta resuelta</b>\n\n` +
      `🆔 ID: <code>${resolved.id}</code>\n` +
      `📌 Recurso: <b>${resolved.recurso}</b>\n` +
      `📊 Tipo: ${resolved.tipo}\n` +
      `📈 Valor detectado: <b>${resolved.valor}%</b> (umbral ${resolved.umbral}%)\n` +
      `💬 Mensaje: <i>${resolved.mensaje}</i>\n\n` +
      `🕐 Generada: <i>${fechaCreacion}</i>\n` +
      `🕑 Resuelta: <i>${fechaResolucion}</i>` +
      (duracion ? `\n⏱️ Duración: <b>${duracion}</b>` : '') +
      `\n\n<i>Resuelta por: ${senderName}</i>`;

    await this.reply(chatId, confirmacion);

    // Notificación global al canal si hay TELEGRAM_CHAT_ID configurado
    await TelegramUtil.send(
      `✅ <b>Alerta resuelta por ${senderName}</b>\n\n` +
      `Recurso: <b>${resolved.recurso}</b> | Tipo: ${resolved.tipo}\n` +
      `Estuvo activa ${duracion || 'un momento'}.\n` +
      `ID: <code>${resolved.id}</code>`
    );
  }

  private async cmdConfig(chatId: string) {
    await this.reply(chatId, '⏳ Cargando configuración actual...');

    const config = await this.configService.getConfig();

    const cpuBar = config.cpuThreshold >= 80 ? '🔴' : config.cpuThreshold >= 60 ? '🟡' : '🟢';
    const ramBar = config.ramThreshold >= 80 ? '🔴' : config.ramThreshold >= 60 ? '🟡' : '🟢';

    const msg = `
⚙️ <b>Configuración actual del sistema</b>

${cpuBar} Umbral CPU:           <b>${config.cpuThreshold}%</b>
${ramBar} Umbral RAM:           <b>${config.ramThreshold}%</b>
⏱️ Intervalo monitoreo:  <b>${config.monitoringInterval}s</b>

<i>Para modificar la configuración:</i>
/set_cpu &lt;valor&gt; — Cambiar umbral de CPU
/set_ram &lt;valor&gt; — Cambiar umbral de RAM
/set_interval &lt;segundos&gt; — Cambiar intervalo
`.trim();

    await this.reply(chatId, msg);
  }

  private async cmdSetCpu(chatId: string, valueArg?: string, senderName = 'Usuario') {
    const value = parseFloat(valueArg ?? '');
    if (isNaN(value) || value < 1 || value > 100) {
      await this.reply(chatId, '⚠️ Uso: /set_cpu &lt;1-100&gt;\nEjemplo: /set_cpu 80');
      return;
    }

    await this.reply(chatId, `⏳ Actualizando umbral de CPU a ${value}%...`);

    const oldConfig = await this.configService.getConfig();
    await this.configService.updateConfig({ cpuThreshold: value }, 1);

    await this.reply(
      chatId,
      `✅ <b>Umbral de CPU actualizado</b>\n\n` +
      `Valor anterior: <b>${oldConfig.cpuThreshold}%</b>\n` +
      `Valor nuevo:    <b>${value}%</b>\n\n` +
      `<i>Las alertas de CPU se dispararán a partir del ${value}%.\n` +
      `Modificado por: ${senderName}</i>`
    );
  }

  private async cmdSetRam(chatId: string, valueArg?: string, senderName = 'Usuario') {
    const value = parseFloat(valueArg ?? '');
    if (isNaN(value) || value < 1 || value > 100) {
      await this.reply(chatId, '⚠️ Uso: /set_ram &lt;1-100&gt;\nEjemplo: /set_ram 85');
      return;
    }

    await this.reply(chatId, `⏳ Actualizando umbral de RAM a ${value}%...`);

    const oldConfig = await this.configService.getConfig();
    await this.configService.updateConfig({ ramThreshold: value }, 1);

    await this.reply(
      chatId,
      `✅ <b>Umbral de RAM actualizado</b>\n\n` +
      `Valor anterior: <b>${oldConfig.ramThreshold}%</b>\n` +
      `Valor nuevo:    <b>${value}%</b>\n\n` +
      `<i>Las alertas de RAM se dispararán a partir del ${value}%.\n` +
      `Modificado por: ${senderName}</i>`
    );
  }

  private async cmdSetInterval(chatId: string, valueArg?: string, senderName = 'Usuario') {
    const value = parseInt(valueArg ?? '');
    if (isNaN(value) || value < 5) {
      await this.reply(chatId, '⚠️ Uso: /set_interval &lt;segundos&gt; (mínimo 5)\nEjemplo: /set_interval 30');
      return;
    }

    await this.reply(chatId, `⏳ Actualizando intervalo de monitoreo a ${value}s...`);

    const oldConfig = await this.configService.getConfig();
    await this.configService.updateConfig({ monitoringInterval: value }, 1);

    await this.reply(
      chatId,
      `✅ <b>Intervalo de monitoreo actualizado</b>\n\n` +
      `Valor anterior: <b>${oldConfig.monitoringInterval}s</b>\n` +
      `Valor nuevo:    <b>${value}s</b>\n\n` +
      `⚠️ <i>El nuevo intervalo aplica al próximo reinicio del servidor.\n` +
      `Modificado por: ${senderName}</i>`
    );
  }

  private async cmdChangelog(chatId: string) {
    await this.reply(chatId, '⏳ Cargando historial de cambios...');

    const logs = await this.configService.getChangelogs();

    if (!logs.length) {
      await this.reply(chatId, '📭 No hay cambios de configuración registrados aún.');
      return;
    }

    const lines = logs.slice(0, 10).map((l) => {
      const fecha = l.fecha ? new Date(l.fecha).toLocaleString('es-CO') : '—';
      return `📝 <b>${l.descripcion}</b>\n   <i>${fecha}</i>`;
    });

    const total = logs.length;
    const footer = total > 10 ? `\n\n<i>Mostrando 10 de ${total} entradas</i>` : '';

    await this.reply(
      chatId,
      `📋 <b>Historial de cambios de configuración</b>\n\n${lines.join('\n\n')}${footer}`
    );
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