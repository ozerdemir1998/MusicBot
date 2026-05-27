require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

// Her guild için ayrı kuyruk saklar
const queues = new Map();

// Komutları commands/ klasöründen yükle
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`Komut yüklendi: /${command.data.name}`);
  }
}

client.once('ready', () => {
  console.log(`Bot hazır: ${client.user.tag}`);
  client.user.setActivity('/play ile müzik aç', { type: 2 });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, queues);
  } catch (err) {
    console.error(`[${interaction.commandName}] Hata:`, err);
    const msg = { content: 'Komut çalıştırılırken bir hata oluştu.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      interaction.editReply(msg).catch(() => {});
    } else {
      interaction.reply(msg).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
