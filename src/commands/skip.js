const { SlashCommandBuilder } = require('discord.js');
const { AudioPlayerStatus } = require('@discordjs/voice');
const { playNextSong } = require('../utils/player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Şu anki şarkıyı atlar ve sıradakini çalar'),

  async execute(interaction, queues) {
    const queue = queues.get(interaction.guildId);

    if (!queue || !queue.currentSong) {
      return interaction.reply({ content: 'Şu an çalan bir şarkı yok.', ephemeral: true });
    }

    if (!interaction.member?.voice?.channel) {
      return interaction.reply({ content: 'Bir ses kanalında olmalısın.', ephemeral: true });
    }

    const skipped = queue.currentSong.title;
    const next = queue.shiftSong();

    // Listener'ları temizle
    queue.audioPlayer.removeAllListeners(AudioPlayerStatus.Idle);
    queue.audioPlayer.removeAllListeners('error');

    if (next) {
      // Eski process'i öldür, doğrudan yeni şarkıya geç — stop() kullanma
      // stop() → Idle event → race condition yerine audioPlayer.play() doğrudan üzerine yazar
      queue.currentSong = next;
      await interaction.reply(`**${skipped}** atlandı.`);
      playNextSong(queue, queues);
    } else {
      queue.killCurrentProcess();
      queue.currentSong = null;
      queue.audioPlayer.stop(true);
      await interaction.reply(`**${skipped}** atlandı. Kuyruk bitti, ayrılıyorum.`);
      queue.destroy();
      queues.delete(interaction.guildId);
    }
  },
};
