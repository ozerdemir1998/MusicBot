const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { AudioPlayerStatus } = require('@discordjs/voice');
const { formatDuration } = require('../utils/player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Şu an çalan şarkının bilgilerini gösterir'),

  async execute(interaction, queues) {
    const queue = queues.get(interaction.guildId);

    if (!queue || !queue.currentSong) {
      return interaction.reply({ content: 'Şu an çalan bir şarkı yok.', ephemeral: true });
    }

    const song = queue.currentSong;
    // queue.paused flag yerine gerçek player state kullan
    const playerStatus = queue.audioPlayer.state.status;
    const isPaused = [AudioPlayerStatus.Paused, AudioPlayerStatus.AutoPaused].includes(playerStatus);

    const embed = new EmbedBuilder()
      .setColor(isPaused ? 0xfaa61a : 0x1db954)
      .setTitle(isPaused ? 'Duraklatıldı' : 'Şimdi Çalıyor')
      .setDescription(`**[${song.title}](${song.url})**`)
      .addFields(
        { name: 'Süre', value: formatDuration(song.duration), inline: true },
        { name: 'Kuyrukta', value: `${queue.songs.length} şarkı`, inline: true }
      );

    if (song.requestedBy) embed.setFooter({ text: `İsteyen: ${song.requestedBy}` });
    if (song.thumbnail) embed.setThumbnail(song.thumbnail);

    await interaction.reply({ embeds: [embed] });
  },
};
