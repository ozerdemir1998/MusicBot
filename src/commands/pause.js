const { SlashCommandBuilder } = require('discord.js');
const { AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Çalan şarkıyı duraklatır'),

  async execute(interaction, queues) {
    const queue = queues.get(interaction.guildId);

    if (!queue || !queue.currentSong) {
      return interaction.reply({ content: 'Şu an çalan bir şarkı yok.', ephemeral: true });
    }

    const status = queue.audioPlayer.state.status;
    const pausable = [AudioPlayerStatus.Playing, AudioPlayerStatus.Buffering];

    if (!pausable.includes(status)) {
      return interaction.reply({ content: 'Şarkı zaten duraklatılmış.', ephemeral: true });
    }

    queue.audioPlayer.pause();
    queue.paused = true;
    await interaction.reply('Duraklatıldı.');
  },
};
