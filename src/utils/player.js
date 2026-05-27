const { createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const YouTube = require('youtube-sr').default;

function getYtDlpBin() {
  const candidates = [
    path.join(__dirname, '../../yt-dlp.exe'),
    path.join(__dirname, '../../yt-dlp'),
    'yt-dlp',
  ];
  for (const c of candidates) {
    if (c === 'yt-dlp') return c;
    if (fs.existsSync(c)) return c;
  }
  return 'yt-dlp';
}

const YT_DLP_BIN = getYtDlpBin();

function formatDuration(seconds) {
  if (!seconds) return 'Bilinmiyor';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isYouTubeURL(str) {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(str);
}

function isPlaylistURL(str) {
  // playlist?list= ve watch?v=...&list=... (Mix/Radio dahil) yakalar
  return /youtube\.com\/.*[?&]list=/.test(str) || /youtu\.be\/.*[?&]list=/.test(str);
}

async function ytDlpInfo(target) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP_BIN, [
      target, '--dump-single-json', '--no-playlist', '--no-warnings', '-q',
    ]);
    let data = '';
    proc.stdout.on('data', chunk => { data += chunk; });
    proc.stderr.on('data', () => {});
    proc.on('close', () => {
      if (!data.trim()) return reject(new Error('yt-dlp veri döndürmedi'));
      try {
        const json = JSON.parse(data.replace(/^﻿/, ''));
        resolve(json.entries ? json.entries[0] : json);
      } catch { reject(new Error('yt-dlp JSON parse hatası')); }
    });
    proc.on('error', err => reject(new Error(`yt-dlp bulunamadı: ${err.message}`)));
  });
}

async function resolvePlaylist(url, requestedBy) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP_BIN, [
      url, '--flat-playlist', '--dump-single-json',
      '--no-warnings', '-q', '--playlist-end', '100',
    ]);
    let data = '';
    proc.stdout.on('data', chunk => { data += chunk; });
    proc.stderr.on('data', () => {});
    proc.on('close', () => {
      if (!data.trim()) return reject(new Error('Playlist bilgisi alınamadı'));
      try {
        const json = JSON.parse(data.replace(/^﻿/, ''));
        const entries = json.entries || [json];
        const songs = entries
          .filter(e => e && (e.id || e.url))
          .map(e => ({
            title: e.title || e.id || 'Bilinmiyor',
            url: e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : null),
            duration: e.duration ?? 0,
            thumbnail: e.thumbnails?.[0]?.url || e.thumbnail || null,
            requestedBy,
          }))
          .filter(s => s.url);
        resolve({ title: json.title || 'Playlist', songs });
      } catch { reject(new Error('Playlist JSON parse hatası')); }
    });
    proc.on('error', err => reject(new Error(`yt-dlp bulunamadı: ${err.message}`)));
  });
}

async function resolveQuery(query) {
  try {
    if (isYouTubeURL(query)) {
      const v = await ytDlpInfo(query);
      return {
        title: v.title || 'Bilinmiyor',
        url: v.webpage_url || query,
        duration: v.duration ?? 0,
        thumbnail: v.thumbnail || null,
        requestedBy: null,
      };
    }
    const video = await YouTube.searchOne(query);
    if (!video) return null;
    return {
      title: video.title || query,
      url: video.url,
      duration: Math.floor((video.duration ?? 0) / 1000),
      thumbnail: video.thumbnail?.url || null,
      requestedBy: null,
    };
  } catch (err) {
    console.error('[resolveQuery] HATA:', err.message);
    return null;
  }
}

function createYtDlpStream(url) {
  return spawn(YT_DLP_BIN, [
    url, '-f', 'bestaudio/best', '-o', '-',
    '--no-playlist', '--no-warnings', '-q',
  ], { stdio: ['ignore', 'pipe', 'ignore'] }); // stderr ignore — broken pipe gürültüsünü bastır
}

async function playNextSong(queue, queues) {
  const song = queue.currentSong || queue.shiftSong();
  if (!song) {
    queue.textChannel.send('Kuyruk bitti. Görüşürüz!').catch(() => {});
    queue.destroy();
    queues.delete(queue.guildId);
    return;
  }

  queue.currentSong = song;

  // Eski process'i öldür — EPIPE hatasının AudioPlayer'a yansımasını önler
  queue.killCurrentProcess();

  try {
    const proc = createYtDlpStream(song.url);
    if (!proc.stdout) throw new Error('yt-dlp stream başlatılamadı');

    queue.currentProcess = proc;

    const resource = createAudioResource(proc.stdout, { inputType: StreamType.Arbitrary });

    // Listener'ları play() ÖNCE kur
    queue.audioPlayer.removeAllListeners(AudioPlayerStatus.Idle);
    queue.audioPlayer.once(AudioPlayerStatus.Idle, async () => {
      queue.currentSong = null;
      // Kuyruk boş ama Spotify yüklemesi sürüyorsa bekle
      while (queue.songs.length === 0 && queue.isLoading) {
        await new Promise(r => setTimeout(r, 400));
      }
      const next = queue.shiftSong();
      if (next) {
        queue.currentSong = next;
        playNextSong(queue, queues);
      } else {
        queue.textChannel.send('Kuyruk bitti. Görüşürüz!').catch(() => {});
        queue.destroy();
        queues.delete(queue.guildId);
      }
    });

    queue.audioPlayer.removeAllListeners('error');
    queue.audioPlayer.on('error', err => {
      console.error('[audioPlayer error]', err.message);
      queue.textChannel.send(`Oynatma hatası: \`${err.message}\``).catch(() => {});
      queue.currentSong = null;
      playNextSong(queue, queues);
    });

    queue.audioPlayer.play(resource);
    queue.voiceConnection.subscribe(queue.audioPlayer);

    const embed = new EmbedBuilder()
      .setColor(0x1db954)
      .setTitle('Şimdi Çalıyor')
      .setDescription(`**[${song.title}](${song.url})**`)
      .addFields({ name: 'Süre', value: formatDuration(song.duration), inline: true })
      .setFooter({ text: song.requestedBy ? `İsteyen: ${song.requestedBy}` : '' });

    if (song.thumbnail) embed.setThumbnail(song.thumbnail);
    queue.textChannel.send({ embeds: [embed] }).catch(() => {});

  } catch (err) {
    console.error('[playNextSong] HATA:', err.message);
    queue.textChannel.send(`Şarkı yüklenemedi: \`${err.message}\``).catch(() => {});
    queue.currentSong = null;
    const next = queue.shiftSong();
    if (next) {
      queue.currentSong = next;
      playNextSong(queue, queues);
    } else {
      queue.destroy();
      queues.delete(queue.guildId);
    }
  }
}

async function spotifyTrackToSong(meta, requestedBy) {
  const query = `${meta.title} ${meta.artist}`;
  const result = await YouTube.searchOne(query);
  if (!result?.url) throw new Error(`YouTube'da bulunamadı: ${query}`);
  return {
    title: meta.title,
    url: result.url,
    duration: meta.duration,
    thumbnail: meta.thumbnail || result.thumbnail?.url || null,
    requestedBy,
  };
}

module.exports = { resolveQuery, resolvePlaylist, isPlaylistURL, playNextSong, formatDuration, spotifyTrackToSong };
