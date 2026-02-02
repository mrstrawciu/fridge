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

  if (CHAT_IDS.length === 0) {
    console.warn('UWAGA: TELEGRAM_CHAT_IDS nie ustawione — powiadomienia nie będą wysyłane!');
    console.warn('Użyj /chatid w Telegramie, a potem dodaj ID do zmiennej TELEGRAM_CHAT_IDS.');
  } else {
    console.log(`Powiadomienia będą wysyłane do: ${CHAT_IDS.join(', ')}`);
  }

  // --- Commands ---

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, [
      '🧊 *Lodówka Bot*',
      '',
      'Cześć! Pomagam pilnować dat ważności produktów w lodówce.',
      '',
      '*Komendy:*',
      '/dodaj — dodaj produkt (np. `/dodaj Mleko 2l 15.02`)',
      '/usun — usuń produkt z lodówki',
      '/lodowka — pokaż zawartość lodówki',
      '/przeterminowane — produkty do wyrzucenia',
      '/kategorie — pokaż produkty wg kategorii',
      '/test — wyślij testowe powiadomienie',
      '/chatid — pokaż ID tego czatu',
      '',
      `Powiadomienia codziennie o ${NOTIFY_HOUR}.`
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  bot.onText(/\/chatid/, (msg) => {
    bot.sendMessage(msg.chat.id, `ID tego czatu: \`${msg.chat.id}\``, { parse_mode: 'Markdown' });
  });

  // --- /test (manual notification trigger) ---
  bot.onText(/\/test/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const expiring = await db.getExpiring(NOTIFY_DAYS_BEFORE);
      if (expiring.length === 0) {
        return bot.sendMessage(chatId, '✅ Brak przeterminowanych produktów — powiadomienie nie zostałoby wysłane.');
      }
      const message = buildExpiringMessage(expiring);
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Błąd /test:', err);
      bot.sendMessage(chatId, '❌ Wystąpił błąd.');
    }
  });

  // --- /dodaj ---
  bot.onText(/\/dodaj(?:@\w+)?\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].trim();
    const parsed = parseProductInput(input);

    if (!parsed.name) {
      return bot.sendMessage(chatId,
        '❌ Nie rozpoznałem nazwy produktu\\. Spróbuj np\\.\n`/dodaj Mleko 2l 15.02`',
        { parse_mode: 'MarkdownV2' });
    }

    try {
      const product = await db.addProduct({
        name: parsed.name,
        category: 'Inne',
        quantity: parsed.quantity || 1,
        unit: parsed.unit || 'szt.',
        expiryDate: parsed.expiryDate,
        addedBy: msg.from.first_name || 'Telegram'
      });

      bot.sendMessage(chatId, [
        '✅ *Dodano do lodówki:*',
        '',
        `📦 *${escapeMarkdown(product.name)}*`,
        `📏 ${product.quantity} ${escapeMarkdown(product.unit)}`,
        `📅 Ważność: ${formatDate(product.expiryDate)}`,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Błąd /dodaj:', err);
      bot.sendMessage(chatId, '❌ Wystąpił błąd przy dodawaniu produktu.');
    }
  });

  // /dodaj without arguments — show help
  bot.onText(/\/dodaj(?:@\w+)?$/, (msg) => {
    bot.sendMessage(msg.chat.id, [
      '📝 *Jak dodać produkt:*',
      '',
      '`/dodaj Nazwa [ilość+jednostka] [data]`',
      '',
      '*Przykłady:*',
      '`/dodaj Mleko` — 1 szt., ważność +7 dni',
      '`/dodaj Mleko 2l` — 2 litry, ważność +7 dni',
      '`/dodaj Mleko 2l 15.02` — 2 litry, do 15 lut',
      '`/dodaj Ser żółty 200g 20.02.2026`',
      '',
      '*Jednostki:* l, ml, kg, g, szt, op',
      '*Data:* DD.MM lub DD.MM.RRRR',
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  // --- /usun ---
  bot.onText(/\/usun/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const products = await db.getAllProducts();
      if (products.length === 0) {
        return bot.sendMessage(chatId, '🧊 Lodówka jest pusta!');
      }

      const keyboard = products.slice(0, 30).map(p => [{
        text: `${getExpiryIcon(p.expiryDate)} ${p.name} (${p.quantity} ${p.unit})`,
        callback_data: `del_${p.id}`
      }]);

      bot.sendMessage(chatId, '🗑️ *Który produkt usunąć?*', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (err) {
      console.error('Błąd /usun:', err);
      bot.sendMessage(chatId, '❌ Wystąpił błąd.');
    }
  });

  // --- Callback queries (for /usun inline buttons) ---
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const data = query.data;

    if (data.startsWith('del_')) {
      const productId = parseInt(data.split('_')[1]);
      const products = await db.getAllProducts();
      const product = products.find(p => p.id === productId);
      const productName = product ? product.name : 'produkt';

      bot.editMessageText(`Co zrobić z *${escapeMarkdown(productName)}*?`, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Zużyty', callback_data: `rm_${productId}_used` }],
            [{ text: '❌ Przeterminowany', callback_data: `rm_${productId}_expired` }],
            [{ text: '↩️ Anuluj', callback_data: 'cancel' }]
          ]
        }
      });
      bot.answerCallbackQuery(query.id);

    } else if (data.startsWith('rm_')) {
      const parts = data.split('_');
      const productId = parseInt(parts[1]);
      const reason = parts[2];

      try {
        const result = await db.deleteProduct(productId, reason);
        const text = result ? '✅ Produkt usunięty!' : '❌ Nie znaleziono produktu.';
        bot.editMessageText(text, { chat_id: chatId, message_id: msgId });
      } catch (err) {
        console.error('Błąd usuwania:', err);
        bot.editMessageText('❌ Wystąpił błąd.', { chat_id: chatId, message_id: msgId });
      }
      bot.answerCallbackQuery(query.id);

    } else if (data === 'cancel') {
      bot.editMessageText('↩️ Anulowano.', { chat_id: chatId, message_id: msgId });
      bot.answerCallbackQuery(query.id);
    }
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

  cron.schedule(cronExpr, () => sendScheduledNotification(), {
    timezone: 'Europe/Warsaw'
  });

  console.log(`Powiadomienia zaplanowane na ${NOTIFY_HOUR} (Europe/Warsaw) codziennie.`);
}

async function sendScheduledNotification() {
  console.log(`[${new Date().toISOString()}] Sprawdzam przeterminowane produkty...`);
  try {
    if (CHAT_IDS.length === 0) {
      console.warn('Pominięto powiadomienie — TELEGRAM_CHAT_IDS jest puste.');
      return;
    }

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
}

// --- Input parsing ---

function parseProductInput(input) {
  const tokens = input.split(/\s+/);
  let expiryDate = null;
  let quantity = null;
  let unit = null;

  const datePattern = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/;
  const qtyPattern = /^(\d+(?:[.,]\d+)?)(l|ml|kg|g|szt|op|opak)?\.?$/i;

  // Check last token for date
  if (tokens.length > 1) {
    const match = tokens[tokens.length - 1].match(datePattern);
    if (match) {
      expiryDate = parsePolishDate(match[1], match[2], match[3]);
      tokens.pop();
    }
  }

  // Check (new) last token for quantity+unit
  if (tokens.length > 1) {
    const match = tokens[tokens.length - 1].match(qtyPattern);
    if (match) {
      quantity = parseFloat(match[1].replace(',', '.'));
      unit = mapUnit(match[2]);
      tokens.pop();
    }
  }

  // Default expiry: +7 days
  if (!expiryDate) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    expiryDate = d.toISOString().split('T')[0];
  }

  const name = tokens.join(' ');
  return { name: name || null, quantity, unit, expiryDate };
}

function parsePolishDate(day, month, year) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let y = now.getFullYear();

  if (year) {
    y = year.length <= 2 ? 2000 + parseInt(year) : parseInt(year);
  } else {
    const testDate = new Date(y, parseInt(month) - 1, parseInt(day));
    if (testDate < now) {
      y += 1;
    }
  }

  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mapUnit(raw) {
  if (!raw) return 'szt.';
  const u = raw.toLowerCase();
  const map = { l: 'l', ml: 'ml', kg: 'kg', g: 'g', szt: 'szt.', op: 'opak.', opak: 'opak.' };
  return map[u] || 'szt.';
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
