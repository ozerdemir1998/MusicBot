# Discord Müzik Botu

YouTube'dan müzik çalan Discord botu. Slash komutları kullanır.

---

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `/play [URL veya arama]` | Şarkı veya playlist çalar / kuyruğa ekler |
| `/skip` | Şu anki şarkıyı atlar |
| `/stop` | Müziği durdurur, kuyruğu temizler, kanaldan ayrılır |
| `/queue` | Kuyruktaki şarkıları listeler |
| `/pause` | Şarkıyı duraklatır |
| `/resume` | Duraklatılmış şarkıyı devam ettirir |
| `/nowplaying` | Şu an çalan şarkının bilgisini gösterir |

---

## Yerel Geliştirme (Node.js)

### Gereksinimler

- **Node.js** v18 veya üzeri
- **yt-dlp** — [yt-dlp.exe](https://github.com/yt-dlp/yt-dlp/releases/latest) proje köküne koy

### Kurulum

```bash
# Bağımlılıkları yükle
npm install

# .env dosyasını oluştur
cp .env.example .env
# .env içine kendi token ve client ID'ni gir

# Slash komutlarını Discord'a kaydet (ilk kurulumda bir kez)
npm run deploy

# Botu başlat
npm start
```

---

## Docker ile Çalıştırma

### Gereksinimler

- [Docker](https://docs.docker.com/get-docker/) (v20+)
- [Docker Compose](https://docs.docker.com/compose/) (v2+)

> yt-dlp ve ffmpeg container içine otomatik kurulur, ayrıca yükleme gerekmez.

### Çalıştırma

```bash
# .env dosyasını oluştur
cp .env.example .env
# .env içine kendi token ve client ID'ni gir

# Build edip başlat
docker compose up -d

# Logları takip et
docker compose logs -f

# Durdur
docker compose down
```

---

## Portainer ile Deploy (GitHub Repo Üzerinden)

### Gereksinimler

- Portainer CE veya BE kurulu bir sunucu
- Bu repo GitHub'a pushlanmış olmalı

### Adımlar

**1. Kodu GitHub'a pushla**

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/kullaniciadi/MusicBot.git
git push -u origin main
```

**2. Portainer'da Stack oluştur**

1. Portainer arayüzüne gir → **Stacks** → **Add stack**
2. **Name:** `discord-music-bot`
3. **Build method:** `Repository` seç
4. **Repository URL:** `https://github.com/kullaniciadi/MusicBot`
5. **Repository reference:** `refs/heads/main`
6. **Compose path:** `docker-compose.yml`
7. (İsteğe bağlı) **Authentication** → Private repo ise GitHub token gir

**3. Environment Variables tanımla**

Portainer'da `.env` dosyası olmadığından değişkenleri arayüzden gir:

| Name | Value |
|------|-------|
| `DISCORD_TOKEN` | Bot token'ın |
| `CLIENT_ID` | Uygulama client ID'n |

> **Not:** `docker-compose.yml` içinde `env_file: .env` yerine Portainer'ın
> environment variables alanını kullanıyorsan `docker-compose.yml`'yi şu şekilde düzenle:
>
> ```yaml
> environment:
>   - DISCORD_TOKEN=${DISCORD_TOKEN}
>   - CLIENT_ID=${CLIENT_ID}
> ```

**4. Deploy et**

**Deploy the stack** butonuna bas. Portainer GitHub'dan kodu çekip build edecek.

---

## Güncelleme ve Yeniden Deploy

### Yerel Docker

```bash
git pull
docker compose up -d --build
```

### Portainer

1. **Stacks** → `discord-music-bot` → **Editor** sekmesi
2. **Update the stack** butonuna bas
3. **Re-pull image** seçeneğini işaretle → **Update** bas

Portainer GitHub'dan son commit'i çekip yeniden build eder.

---

## Bot Davet Linki Oluşturma

1. [Discord Developer Portal](https://discord.com/developers/applications) → uygulamanı seç
2. **OAuth2 → URL Generator** bölümüne git
3. **Scopes:** `bot` + `applications.commands`
4. **Bot Permissions:** `Connect`, `Speak`, `Send Messages`, `Embed Links`
5. Oluşturulan URL ile botu sunucuna davet et

---

## .env Değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `DISCORD_TOKEN` | Discord Developer Portal'dan alınan bot token'ı |
| `CLIENT_ID` | Discord uygulamasının Application ID'si |

---

## Notlar

- Slash komutları global olarak kaydedilir, yayılması ~1 saat sürebilir.
- Hızlı test için `deploy-commands.js` içinde guild-bazlı kayda geç:
  `Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)`
