const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const MusicQueue = require('../structures/MusicQueue');
const { resolveQuery, resolvePlaylist, isPlaylistURL, playNextSong } = require('../utils/player');

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

    // --- Playlist ---
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
