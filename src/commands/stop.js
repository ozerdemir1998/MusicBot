const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Müziği durdurur, kuyruğu temizler ve kanaldan ayrılır'),

  async execute(interaction, queues) {
    const queue = queues.get(interaction.guildId);

    if (!queue) {
      return interaction.reply({ content: 'Zaten bir şey çalmıyor.', ephemeral: true });
    }

    if (!interaction.member?.voice?.channel) {
      return interaction.reply({ content: 'Bir ses kanalında olmalısın.', ephemeral: true });
    }

    queue.destroy();
    queues.delete(interaction.guildId);

    await interaction.reply('Müzik durduruldu, kuyruk temizlendi ve kanaldan ayrıldım.');
  },
};
