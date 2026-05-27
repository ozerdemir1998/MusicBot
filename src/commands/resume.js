const { SlashCommandBuilder } = require('discord.js');
const { AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Duraklatılmış şarkıyı devam ettirir'),

  async execute(interaction, queues) {
    const queue = queues.get(interaction.guildId);

    if (!queue || !queue.currentSong) {
      return interaction.reply({ content: 'Şu an çalan bir şarkı yok.', ephemeral: true });
    }

    const status = queue.audioPlayer.state.status;
    const resumable = [AudioPlayerStatus.Paused, AudioPlayerStatus.AutoPaused];

    if (!resumable.includes(status)) {
      return interaction.reply({ content: 'Şarkı zaten çalıyor.', ephemeral: true });
    }

    queue.audioPlayer.unpause();
    queue.paused = false;
    await interaction.reply('Devam ettiriliyor.');
  },
};
