/**
 * Skrypt do wysyłania powiadomień WhatsApp o przeterminowanych produktach.
 * Uruchamiaj codziennie przez cron, np.:
 *   0 8 * * * cd /path/to/fridge && node notify.js
 *
 * Wymaga skonfigurowania Twilio w pliku data/config.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function run() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.log('Brak pliku konfiguracyjnego data/config.json');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));

  const { twilio: twilioConfig, notifyDaysBefore } = config;

  if (!twilioConfig.accountSid || !twilioConfig.authToken) {
    console.log('Twilio nie jest skonfigurowane. Uzupełnij dane w data/config.json');
    console.log('Potrzebne pola: twilio.accountSid, twilio.authToken, twilio.toNumbers');
    process.exit(1);
  }

  if (!twilioConfig.toNumbers || twilioConfig.toNumbers.length === 0) {
    console.log('Brak numerów do powiadomień. Dodaj numery w twilio.toNumbers w data/config.json');
    console.log('Format: ["whatsapp:+48XXXXXXXXX"]');
    process.exit(1);
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = notifyDaysBefore || 2;
  const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const expiring = products.filter(p => {
    const exp = new Date(p.expiryDate);
    return exp <= threshold;
  }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  if (expiring.length === 0) {
    console.log('Brak produktów do przeterminowania. Nie wysyłam powiadomień.');
    return;
  }

  // Build message
  let message = `🧊 *Lodówka - Powiadomienie*\n\n`;

  const expired = expiring.filter(p => new Date(p.expiryDate) <= now);
  const soonExpiring = expiring.filter(p => new Date(p.expiryDate) > now);

  if (expired.length > 0) {
    message += `⚠️ *PRZETERMINOWANE:*\n`;
    expired.forEach(p => {
      message += `  ❌ ${p.name} (${p.quantity} ${p.unit}) - ${formatDate(p.expiryDate)}\n`;
    });
    message += '\n';
  }

  if (soonExpiring.length > 0) {
    message += `⏳ *Tracą ważność wkrótce:*\n`;
    soonExpiring.forEach(p => {
      const daysLeft = Math.ceil((new Date(p.expiryDate) - now) / (1000 * 60 * 60 * 24));
      message += `  ⚡ ${p.name} (${p.quantity} ${p.unit}) - za ${daysLeft} ${daysLeft === 1 ? 'dzień' : 'dni'}\n`;
    });
  }

  console.log('Wysyłam wiadomość:\n' + message);

  // Send via Twilio
  const client = require('twilio')(twilioConfig.accountSid, twilioConfig.authToken);

  const promises = twilioConfig.toNumbers.map(toNumber => {
    return client.messages.create({
      body: message,
      from: twilioConfig.fromNumber,
      to: toNumber
    }).then(msg => {
      console.log(`Wysłano do ${toNumber}: ${msg.sid}`);
    }).catch(err => {
      console.error(`Błąd wysyłki do ${toNumber}:`, err.message);
    });
  });

  Promise.all(promises).then(() => {
    console.log('Gotowe!');
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

run();
