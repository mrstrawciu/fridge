# Lodówka - Aplikacja do zarządzania produktami

Prosta aplikacja webowa do śledzenia produktów w lodówce wraz z datami ważności.

## Funkcje

- Dodawanie, edytowanie i usuwanie produktów
- Kategorie produktów (nabiał, mięso, warzywa, itp.)
- Śledzenie ilości i dat ważności
- Kolorowe oznaczenie statusu (zielony = OK, żółty = wkrótce, czerwony = przeterminowany)
- Historia usuniętych produktów
- Wyszukiwanie i filtrowanie po kategoriach
- **Bot Telegram** z powiadomieniami i komendami
- Obsługa dwóch użytkowników
- Interfejs zoptymalizowany pod telefon
- **PostgreSQL** - dane bezpieczne przy każdym deploy

---

## Deployment na Railway - krok po kroku

### Krok 1: Dodaj bazę danych PostgreSQL

1. Zaloguj się na [railway.app](https://railway.app)
2. Otwórz swój projekt z aplikacją Lodówka
3. Kliknij **"+ New"** w prawym górnym rogu
4. Wybierz **"Database" → "Add PostgreSQL"**
5. Railway automatycznie utworzy bazę danych

### Krok 2: Połącz bazę z aplikacją

1. Kliknij na serwis z bazą PostgreSQL
2. Przejdź do zakładki **"Variables"**
3. Skopiuj wartość `DATABASE_URL`
4. Kliknij na serwis z aplikacją (web)
5. Przejdź do **"Variables"**
6. Dodaj zmienną: `DATABASE_URL` = (wklej skopiowaną wartość)

**Albo prościej:** Railway potrafi automatycznie połączyć zmienne:
1. Kliknij serwis aplikacji → **"Variables"**
2. Kliknij **"Add a variable reference"**
3. Wybierz PostgreSQL i `DATABASE_URL`

### Krok 3: Deploy

Wypchnij zmiany na GitHub - Railway automatycznie zrobi deploy.

---

## Bot Telegram - konfiguracja krok po kroku

### Krok 1: Utwórz bota

1. Otwórz Telegram na telefonie
2. Wyszukaj **@BotFather** i napisz do niego
3. Wyślij komendę: `/newbot`
4. Podaj nazwę bota, np: `Lodówka`
5. Podaj username bota, np: `moja_lodowka_bot` (musi kończyć się na `bot`)
6. BotFather da Ci **token** - skopiuj go (wygląda tak: `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`)

### Krok 2: Znajdź swój Chat ID

1. Napisz do swojego nowo utworzonego bota cokolwiek (np. "cześć")
2. Następnie napisz do bota komendę: `/chatid`
3. Bot odpowie Twoim Chat ID (np. `123456789`)
4. Powtórz to samo z telefonu żony

### Krok 3: Ustaw zmienne w Railway

W serwisie aplikacji na Railway, dodaj zmienne środowiskowe (**Variables**):

| Zmienna | Wartość | Opis |
|---------|---------|------|
| `TELEGRAM_BOT_TOKEN` | `123456789:ABCdef...` | Token od BotFather |
| `TELEGRAM_CHAT_IDS` | `111111,222222` | Chat ID Twój i żony, po przecinku |
| `NOTIFY_HOUR` | `08:00` | Godzina powiadomień (domyślnie 08:00) |
| `NOTIFY_DAYS_BEFORE` | `2` | Ile dni przed przeterminowaniem ostrzec |

### Krok 4: Przetestuj

Napisz do bota na Telegramie:
- `/start` - zobaczysz powitanie i listę komend
- `/lodowka` - pokaże zawartość lodówki
- `/przeterminowane` - pokaże kończące się produkty
- `/kategorie` - pokaże produkty wg kategorii

Bot automatycznie wyśle wam powiadomienia codziennie o ustawionej godzinie, jeśli coś się kończy.

---

## Wszystkie zmienne środowiskowe

| Zmienna | Wymagana | Domyślna | Opis |
|---------|----------|----------|------|
| `DATABASE_URL` | Tak | - | Adres bazy PostgreSQL |
| `PORT` | Nie | `3000` | Port serwera HTTP |
| `TELEGRAM_BOT_TOKEN` | Nie | - | Token bota Telegram |
| `TELEGRAM_CHAT_IDS` | Nie | - | Chat ID (po przecinku) |
| `NOTIFY_HOUR` | Nie | `08:00` | Godzina powiadomień |
| `NOTIFY_DAYS_BEFORE` | Nie | `2` | Dni przed przeterminowaniem |

---

## Uruchamianie lokalne (do testów)

```bash
# Uruchom lokalny PostgreSQL (np. przez Docker)
docker run -d --name fridge-db -p 5432:5432 -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=fridge postgres:16

# Ustaw zmienną
export DATABASE_URL="postgresql://postgres:pass@localhost:5432/fridge"

# Opcjonalnie - bot Telegram
export TELEGRAM_BOT_TOKEN="twoj-token"
export TELEGRAM_CHAT_IDS="twoj-chat-id"

# Zainstaluj i uruchom
npm install
npm start
```

Otwórz w przeglądarce: http://localhost:3000

---

## Struktura plików

```
fridge/
├── server.js          # Serwer Express (backend + start)
├── db.js              # Moduł bazy danych PostgreSQL
├── bot.js             # Bot Telegram + powiadomienia
├── package.json       # Zależności
└── public/
    ├── index.html     # Strona główna
    ├── style.css      # Style (mobile-first)
    └── app.js         # Logika frontend
```
