const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const MusicQueue = require('../structures/MusicQueue');
const { resolveQuery, resolvePlaylist, isPlaylistURL, playNextSong, spotifyTrackToSong } = require('../utils/player');
const { isSpotifyURL, getSpotifyType, getTrackMeta, resolveSpotifyPlaylist, resolveSpotifyAlbum } = require('../utils/spotify');

function ensureQueue(interaction, queues, voiceChannel) {
  let queue = queues.get(interaction.guildId);
  if (queue) return queue;

  queue = new MusicQueue(interaction.guildId, interaction.channel);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: interaction.guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      queue.destroy();
      queues.delete(interaction.guildId);
    }
  });

  queue.voiceConnection = connection;
  queues.set(interaction.guildId, queue);
  return queue;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('YouTube\'dan şarkı veya playlist çalar')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('YouTube URL, playlist URL veya arama terimi')
        .setRequired(true)
    ),

  async execute(interaction, queues) {
    await interaction.deferReply();

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply('Bir ses kanalına girmeden müzik çalamazsın!');
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return interaction.editReply('Bu ses kanalına bağlanma veya konuşma iznim yok!');
    }

    const query = interaction.options.getString('query');
    await interaction.editReply('Yükleniyor...');

    // --- Spotify ---
    if (isSpotifyURL(query)) {
      const type = getSpotifyType(query);

      if (type === 'track') {
        let meta;
        try {
          meta = await getTrackMeta(query);
        } catch (err) {
          console.error('[play/spotify/track]', err.message);
          return interaction.editReply('Spotify şarkısı yüklenemedi.');
        }

        let song;
        try {
          song = await spotifyTrackToSong(meta, interaction.user.tag);
        } catch (err) {
          console.error('[play/spotify/track/yt]', err.message);
          return interaction.editReply(`YouTube'da bulunamadı: \`${meta.title}\``);
        }

        const queue = ensureQueue(interaction, queues, voiceChannel);
        if (!queue.currentSong) {
          queue.currentSong = song;
          await interaction.editReply(`**${song.title}** çalınıyor.`);
          playNextSong(queue, queues);
        } else {
          queue.addSong(song);
          const pos = queue.songs.length;
          const embed = new EmbedBuilder()
            .setColor(0x1db954)
            .setTitle('Kuyruğa Eklendi')
            .setDescription(`**${song.title}**`)
            .addFields({ name: 'Sıra Pozisyonu', value: `#${pos}`, inline: true })
            .setFooter({ text: `İsteyen: ${song.requestedBy}` });
          if (song.thumbnail) embed.setThumbnail(song.thumbnail);
          await interaction.editReply({ content: '', embeds: [embed] });
        }
        return;
      }

      if (type === 'playlist' || type === 'album') {
        let result;
        try {
          result = type === 'playlist'
            ? await resolveSpotifyPlaylist(query)
            : await resolveSpotifyAlbum(query);
        } catch (err) {
          console.error(`[play/spotify/${type}]`, err.message);
          return interaction.editReply(`Spotify ${type === 'playlist' ? 'playlist' : 'albüm'}ü yüklenemedi.`);
        }

        if (!result.tracks.length) {
          return interaction.editReply('Spotify listesi boş veya yüklenemedi.');
        }

        let firstSong;
        try {
          firstSong = await spotifyTrackToSong(result.tracks[0], interaction.user.tag);
        } catch (err) {
          console.error('[play/spotify/first]', err.message);
          return interaction.editReply('İlk şarkı YouTube\'da bulunamadı.');
        }

        const queue = ensureQueue(interaction, queues, voiceChannel);
        const wasEmpty = !queue.currentSong && queue.songs.length === 0;
        if (wasEmpty) {
          queue.currentSong = firstSong;
        } else {
          queue.addSong(firstSong);
        }

        await interaction.editReply(
          `**${result.playlistName}** — **${result.tracks.length}** şarkı kuyruğa ekleniyor, ilk şarkı hazırlandı.`
        );

        if (wasEmpty) playNextSong(queue, queues);

        // Geri kalan şarkıları arka planda çöz
        queue.isLoading = true;
        (async () => {
          for (let i = 1; i < result.tracks.length; i++) {
            try {
              const song = await spotifyTrackToSong(result.tracks[i], interaction.user.tag);
              queue.addSong(song);
            } catch (_) {}
          }
          queue.isLoading = false;
        })();
        return;
      }
    }

    // --- YouTube Playlist ---
    if (isPlaylistURL(query)) {
      let result;
      try {
        result = await resolvePlaylist(query, interaction.user.tag);
      } catch (err) {
        console.error('[play/playlist]', err.message);
        return interaction.editReply("Playlist yüklenemedi. URL'yi kontrol et.");
      }

      if (!result.songs.length) {
        return interaction.editReply('Playlist boş veya yüklenemedi.');
      }

      const queue = ensureQueue(interaction, queues, voiceChannel);
      const isFirstSong = !queue.currentSong;

      if (isFirstSong) {
        queue.currentSong = result.songs[0];
        queue.addSongs(result.songs.slice(1));
        await interaction.editReply(
          `**${result.title}** playlistinden **${result.songs.length}** şarkı kuyruğa eklendi.`
        );
        playNextSong(queue, queues);
      } else {
        queue.addSongs(result.songs);
        await interaction.editReply(
          `**${result.title}** playlistinden **${result.songs.length}** şarkı kuyruğa eklendi.`
        );
      }
      return;
    }

    // --- Tek şarkı ---
    const songInfo = await resolveQuery(query);
    if (!songInfo) {
      return interaction.editReply('Şarkı bulunamadı. Farklı bir arama terimi dene.');
    }
    songInfo.requestedBy = interaction.user.tag;

    const queue = ensureQueue(interaction, queues, voiceChannel);

    if (!queue.currentSong) {
      queue.currentSong = songInfo;
      await interaction.editReply(`**${songInfo.title}** çalınıyor.`);
      playNextSong(queue, queues);
    } else {
      queue.addSong(songInfo);
      const pos = queue.songs.length;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Kuyruğa Eklendi')
        .setDescription(`**[${songInfo.title}](${songInfo.url})**`)
        .addFields({ name: 'Sıra Pozisyonu', value: `#${pos}`, inline: true })
        .setFooter({ text: `İsteyen: ${songInfo.requestedBy}` });
      if (songInfo.thumbnail) embed.setThumbnail(songInfo.thumbnail);
      await interaction.editReply({ content: '', embeds: [embed] });
    }
  },
};
