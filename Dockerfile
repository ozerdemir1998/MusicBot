FROM node:20-alpine

# ffmpeg + python3 (yt-dlp için)
RUN apk add --no-cache ffmpeg python3 py3-pip

# yt-dlp pip ile kur — standalone binary Alpine'da arch/libc uyumsuzluğu nedeniyle çalışmaz
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app

# Bağımlılık dosyalarını önce kopyala — layer cache için
COPY package*.json ./
RUN npm ci --only=production

# Kaynak kodları kopyala
COPY src/ ./src/
COPY deploy-commands.js ./

# Güvenlik: root yerine node kullanıcısı
USER node

CMD ["node", "src/index.js"]
