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
      queue.currentSong = next;
      await interaction.reply(`**${skipped}** atlandı.`);
      playNextSong(queue, queues);
    } else if (queue.isLoading) {
      // Spotify yüklemesi sürüyor, sonraki şarkıyı bekle
      await interaction.reply(`**${skipped}** atlandı. Sonraki şarkı yükleniyor...`);
      queue.currentSong = null;
      queue.killCurrentProcess();
      queue.audioPlayer.stop(true);
      // Şarkı gelene kadar bekle, sonra çal
      (async () => {
        while (queue.songs.length === 0 && queue.isLoading) {
          await new Promise(r => setTimeout(r, 400));
        }
        const waited = queue.shiftSong();
        if (waited) {
          queue.currentSong = waited;
          playNextSong(queue, queues);
        } else {
          queue.textChannel.send('Kuyruk bitti. Görüşürüz!').catch(() => {});
          queue.destroy();
          queues.delete(interaction.guildId);
        }
      })();
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
