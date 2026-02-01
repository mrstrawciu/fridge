# Lodówka - Aplikacja do zarządzania produktami

Prosta aplikacja webowa do śledzenia produktów w lodówce wraz z datami ważności.

## Funkcje

- Dodawanie, edytowanie i usuwanie produktów
- Kategorie produktów (nabiał, mięso, warzywa, itp.)
- Śledzenie ilości i dat ważności
- Kolorowe oznaczenie statusu (zielony = OK, żółty = wkrótce, czerwony = przeterminowany)
- Historia usuniętych produktów
- Wyszukiwanie i filtrowanie po kategoriach
- Powiadomienia WhatsApp o przeterminowanych produktach (opcjonalnie)
- Obsługa dwóch użytkowników
- Interfejs zoptymalizowany pod telefon

---

## Instalacja na serwerze - krok po kroku

### Krok 1: Wynajmij serwer

Najtańsza opcja to np. serwer VPS:
- **Oracle Cloud** - darmowy VPS (Always Free tier)
- **Hetzner** - od ~3 EUR/miesiąc
- **DigitalOcean** - od 4 USD/miesiąc

Wybierz system **Ubuntu 22.04** lub nowszy.

### Krok 2: Zaloguj się na serwer

Po otrzymaniu danych do serwera (adres IP, hasło/klucz SSH):

```bash
ssh root@TWOJ_ADRES_IP
```

### Krok 3: Zainstaluj Node.js

```bash
# Zaktualizuj system
apt update && apt upgrade -y

# Zainstaluj Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Sprawdź czy działa
node --version
npm --version
```

### Krok 4: Skopiuj pliki aplikacji na serwer

Na swoim komputerze, w terminalu:

```bash
# Skopiuj cały folder na serwer
scp -r ./fridge root@TWOJ_ADRES_IP:/root/fridge
```

Albo na serwerze:

```bash
# Sklonuj repozytorium (jeśli jest na GitHubie)
cd /root
git clone https://github.com/TWOJ_USER/fridge.git
cd fridge
```

### Krok 5: Zainstaluj zależności i uruchom

```bash
cd /root/fridge
npm install
```

### Krok 6: Ustaw automatyczne uruchamianie

Utwórz plik systemowy:

```bash
nano /etc/systemd/system/fridge.service
```

Wklej poniższą zawartość (naciśnij Ctrl+Shift+V):

```ini
[Unit]
Description=Lodowka App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/fridge
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Zapisz (Ctrl+X, Y, Enter) i uruchom:

```bash
# Włącz i uruchom
systemctl enable fridge
systemctl start fridge

# Sprawdź czy działa
systemctl status fridge
```

### Krok 7: Otwórz port w firewallu

```bash
ufw allow 80
ufw allow 443
ufw allow 3000
```

Teraz aplikacja powinna być dostępna pod adresem:
`http://TWOJ_ADRES_IP:3000`

### Krok 8 (opcjonalnie): Ustaw domenę i HTTPS

Jeśli masz domenę (np. lodowka.example.com):

```bash
# Zainstaluj Nginx (proxy)
apt install -y nginx

# Utwórz konfigurację
nano /etc/nginx/sites-available/fridge
```

Wklej:

```nginx
server {
    listen 80;
    server_name lodowka.twojadomena.pl;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Zapisz i włącz:

```bash
ln -s /etc/nginx/sites-available/fridge /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Zainstaluj certyfikat SSL (HTTPS) za darmo
apt install -y certbot python3-certbot-nginx
certbot --nginx -d lodowka.twojadomena.pl
```

---

## Powiadomienia WhatsApp (opcjonalnie)

### Konfiguracja Twilio

1. Załóż konto na [twilio.com](https://www.twilio.com/) (jest darmowy trial)
2. W panelu Twilio przejdź do **Messaging > Try it out > Send a WhatsApp message**
3. Zeskanuj kod QR telefonem, żeby połączyć swój numer z Twilio Sandbox
4. Zanotuj swoje **Account SID** i **Auth Token** z panelu Twilio

### Uzupełnij konfigurację

Edytuj plik `data/config.json` na serwerze:

```json
{
  "twilio": {
    "accountSid": "TWOJ_ACCOUNT_SID",
    "authToken": "TWOJ_AUTH_TOKEN",
    "fromNumber": "whatsapp:+14155238886",
    "toNumbers": [
      "whatsapp:+48XXXXXXXXX",
      "whatsapp:+48YYYYYYYYY"
    ]
  },
  "notifyDaysBefore": 2
}
```

- `fromNumber` - numer Twilio Sandbox (domyślnie jak wyżej)
- `toNumbers` - wpisz numery telefonów swoje i żony (format: whatsapp:+48...)
- `notifyDaysBefore` - ile dni przed przeterminowaniem wysłać powiadomienie

### Ustaw automatyczne powiadomienia (cron)

```bash
# Otwórz crontab
crontab -e

# Dodaj linię (powiadomienia codziennie o 8:00 rano)
0 8 * * * cd /root/fridge && /usr/bin/node notify.js >> /var/log/fridge-notify.log 2>&1
```

### Testuj

```bash
cd /root/fridge
node notify.js
```

---

## Uruchamianie lokalne (do testów)

```bash
npm install
npm start
```

Otwórz w przeglądarce: http://localhost:3000

---

## Struktura plików

```
fridge/
├── server.js          # Serwer Express (backend)
├── notify.js          # Skrypt powiadomień WhatsApp
├── package.json       # Zależności
├── public/
│   ├── index.html     # Strona główna
│   ├── style.css      # Style (mobile-first)
│   └── app.js         # Logika frontend
└── data/              # Dane (tworzone automatycznie)
    ├── products.json  # Produkty w lodówce
    ├── history.json   # Historia usuniętych
    └── config.json    # Konfiguracja
```
