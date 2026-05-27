FROM node:20-alpine

# ffmpeg (ses işleme) + curl (yt-dlp indirme)
RUN apk add --no-cache ffmpeg curl

# yt-dlp standalone Linux binary — Python gerektirmez
RUN curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux" \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Bağımlılık dosyalarını önce kopyala — layer cache'i kullanmak için
COPY package*.json ./
RUN npm ci --only=production

# Uygulama kaynak kodlarını kopyala
COPY src/ ./src/
COPY deploy-commands.js ./

# Güvenlik: root kullanıcısı yerine node kullanıcısıyla çalış
USER node

CMD ["node", "src/index.js"]
