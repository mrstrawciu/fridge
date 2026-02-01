const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const db = require('./db');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);
const NOTIFY_HOUR = process.env.NOTIFY_HOUR || '08:00';
const NOTIFY_DAYS_BEFORE = parseInt(process.env.NOTIFY_DAYS_BEFORE) || 2;

let bot = null;

function startBot() {
  if (!TOKEN) {
    console.log('TELEGRAM_BOT_TOKEN nie ustawiony - bot Telegram wyłączony.');
    console.log('Aby włączyć, ustaw zmienne: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS');
    return;
  }

  bot = new TelegramBot(TOKEN, { polling: true });
  console.log('Bot Telegram uruchomiony.');

  // --- Commands ---

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, [
      '🧊 *Lodówka Bot*',
      '',
      'Cześć! Pomagam pilnować dat ważności produktów w lodówce.',
      '',
      '*Komendy:*',
      '/lodowka - pokaż zawartość lodówki',
      '/przeterminowane - produkty do wyrzucenia',
      '/kategorie - pokaż produkty wg kategorii',
      '/chatid - pokaż ID tego czatu (do konfiguracji)',
      '',
      `Powiadomienia codziennie o ${NOTIFY_HOUR}.`
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  bot.onText(/\/chatid/, (msg) => {
    bot.sendMessage(msg.chat.id, `ID tego czatu: \`${msg.chat.id}\``, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/lodowka/, async (msg) => {
    try {
      const products = await db.getAllProducts();
      if (products.length === 0) {
        return bot.sendMessage(msg.chat.id, '🧊 Lodówka jest pusta!');
      }

      const lines = products.map(p => {
        const icon = getExpiryIcon(p.expiryDate);
        return `${icon} *${escapeMarkdown(p.name)}* — ${p.quantity} ${escapeMarkdown(p.unit)} _(${formatDate(p.expiryDate)})_`;
      });

      bot.sendMessage(msg.chat.id, [
        `🧊 *W lodówce (${products.length}):*`,
        '',
        ...lines
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Błąd /lodowka:', err);
      bot.sendMessage(msg.chat.id, '❌ Wystąpił błąd.');
    }
  });

  bot.onText(/\/przeterminowane/, async (msg) => {
    try {
      const expiring = await db.getExpiring(NOTIFY_DAYS_BEFORE);
      if (expiring.length === 0) {
        return bot.sendMessage(msg.chat.id, '✅ Brak przeterminowanych lub kończących się produktów!');
      }

      const message = buildExpiringMessage(expiring);
      bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Błąd /przeterminowane:', err);
      bot.sendMessage(msg.chat.id, '❌ Wystąpił błąd.');
    }
  });

  bot.onText(/\/kategorie/, async (msg) => {
    try {
      const products = await db.getAllProducts();
      if (products.length === 0) {
        return bot.sendMessage(msg.chat.id, '🧊 Lodówka jest pusta!');
      }

      const byCategory = {};
      products.forEach(p => {
        if (!byCategory[p.category]) byCategory[p.category] = [];
        byCategory[p.category].push(p);
      });

      const lines = [];
      for (const [cat, items] of Object.entries(byCategory)) {
        lines.push(`\n📦 *${escapeMarkdown(cat)}:*`);
        items.forEach(p => {
          const icon = getExpiryIcon(p.expiryDate);
          lines.push(`  ${icon} ${escapeMarkdown(p.name)} — ${p.quantity} ${escapeMarkdown(p.unit)}`);
        });
      }

      bot.sendMessage(msg.chat.id, ['🧊 *Lodówka wg kategorii:*', ...lines].join('\n'), { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Błąd /kategorie:', err);
      bot.sendMessage(msg.chat.id, '❌ Wystąpił błąd.');
    }
  });

  // --- Scheduled notifications ---

  const [hour, minute] = NOTIFY_HOUR.split(':');
  const cronExpr = `${parseInt(minute)} ${parseInt(hour)} * * *`;

  cron.schedule(cronExpr, async () => {
    console.log(`[${new Date().toISOString()}] Sprawdzam przeterminowane produkty...`);
    try {
      const expiring = await db.getExpiring(NOTIFY_DAYS_BEFORE);
      if (expiring.length === 0) {
        console.log('Brak przeterminowanych produktów.');
        return;
      }

      const message = buildExpiringMessage(expiring);

      for (const chatId of CHAT_IDS) {
        try {
          await bot.sendMessage(chatId.trim(), message, { parse_mode: 'Markdown' });
          console.log(`Powiadomienie wysłane do ${chatId}`);
        } catch (err) {
          console.error(`Błąd wysyłki do ${chatId}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Błąd sprawdzania przeterminowanych:', err);
    }
  });

  console.log(`Powiadomienia zaplanowane na ${NOTIFY_HOUR} codziennie.`);
}

// --- Helpers ---

function buildExpiringMessage(products) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expired = products.filter(p => new Date(p.expiryDate) <= now);
  const soon = products.filter(p => new Date(p.expiryDate) > now);

  const lines = ['🧊 *Lodówka — Powiadomienie*', ''];

  if (expired.length > 0) {
    lines.push('⚠️ *PRZETERMINOWANE:*');
    expired.forEach(p => {
      const daysAgo = Math.ceil((now - new Date(p.expiryDate)) / (1000 * 60 * 60 * 24));
      lines.push(`  ❌ *${escapeMarkdown(p.name)}* (${p.quantity} ${escapeMarkdown(p.unit)}) — ${daysAgo} dni temu`);
    });
    lines.push('');
  }

  if (soon.length > 0) {
    lines.push('⏳ *Tracą ważność wkrótce:*');
    soon.forEach(p => {
      const daysLeft = Math.ceil((new Date(p.expiryDate) - now) / (1000 * 60 * 60 * 24));
      const dayWord = daysLeft === 1 ? 'dzień' : 'dni';
      lines.push(`  ⚡ *${escapeMarkdown(p.name)}* (${p.quantity} ${escapeMarkdown(p.unit)}) — za ${daysLeft} ${dayWord}`);
    });
  }

  return lines.join('\n');
}

function getExpiryIcon(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr);
  const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return '🔴';
  if (diff <= 2) return '🟡';
  return '🟢';
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

module.exports = { startBot };
