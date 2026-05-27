const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration } = require('../utils/player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Kuyruktaki şarkıları listeler'),

  async execute(interaction, queues) {
    const queue = queues.get(interaction.guildId);

    if (!queue || (!queue.currentSong && queue.songs.length === 0)) {
      return interaction.reply({ content: 'Kuyruk boş.', ephemeral: true });
    }

    const lines = [];
    if (queue.currentSong) {
      lines.push(`**Şimdi Çalıyor:** [${queue.currentSong.title}](${queue.currentSong.url}) \`${formatDuration(queue.currentSong.duration)}\``);
    }

    if (queue.songs.length > 0) {
      lines.push('\n**Sıradaki Şarkılar:**');
      const visible = queue.songs.slice(0, 10);
      visible.forEach((s, i) => {
        lines.push(`\`${i + 1}.\` [${s.title}](${s.url}) \`${formatDuration(s.duration)}\``);
      });
      if (queue.songs.length > 10) {
        lines.push(`\n...ve ${queue.songs.length - 10} şarkı daha`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Müzik Kuyruğu')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Toplam ${queue.songs.length} şarkı kuyrukta` });

    await interaction.reply({ embeds: [embed] });
  },
};
