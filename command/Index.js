const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { registerEvents } = require('./events');
const { registerAntiNuke } = require('./handlers/antiNuke');
const { registerAntiRaid } = require('./handlers/antiRaid');
const { registerAutomod } = require('./handlers/automod');
const { handleTicketSelect } = require('./commands/ticketpanel');
const { getGiveaways, saveGiveaway } = require('./store');

// ==================== BOT NAME ====================
const BOT_NAME = 'Ryomen Sukuna';
const PORT = process.env.PORT || 3000;

// ==================== CLIENT SETUP ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

client.commands = new Collection();
client.afkUsers = new Map();

// ==================== LOAD COMMANDS ====================
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commandsToRegister = [];

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commandsToRegister.push(command.data.toJSON());
    console.log(`[${BOT_NAME}] Loaded command: ${command.data.name}`);
  } else {
    console.warn(`[${BOT_NAME}] Skipped ${file} — missing "data" or "execute"`);
  }
}

// ==================== REGISTER EVENT SYSTEMS ====================
registerEvents(client);
registerAntiNuke(client);
registerAntiRaid(client);
registerAutomod(client);

// ==================== AFK: clear on message + notify on mention ====================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const guildAfk = client.afkUsers.get(message.guild.id);
  if (!guildAfk) return;

  if (guildAfk.has(message.author.id)) {
    guildAfk.delete(message.author.id);
    try {
      if (message.member.displayName.startsWith('[AFK] ')) {
        await message.member.setNickname(message.member.displayName.slice(6));
      }
    } catch {
      // ignore
    }
    const notice = await message.channel.send(`👋 Welcome back ${message.author}, I removed your AFK status.`);
    setTimeout(() => notice.delete().catch(() => {}), 5000);
  }

  for (const [, mentioned] of message.mentions.users) {
    if (guildAfk.has(mentioned.id)) {
      const info = guildAfk.get(mentioned.id);
      await message.channel.send(`💤 ${mentioned.username} is AFK: **${info.message}**`);
    }
  }
});

// ==================== INTERACTIONS (commands, buttons, selects) ====================
client.on('interactionCreate', async (interaction) => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // Ticket division select menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_division_select') {
      await handleTicketSelect(interaction);
      return;
    }

    // Giveaway join button
    if (interaction.isButton() && interaction.customId === 'giveaway_join') {
      const all = getGiveaways();
      const giveaway = all[interaction.message.id];
      if (!giveaway || giveaway.ended) {
        return interaction.reply({ content: '❌ This giveaway has ended.', ephemeral: true });
      }
      if (giveaway.entries.includes(interaction.user.id)) {
        return interaction.reply({ content: '✅ You are already entered!', ephemeral: true });
      }
      giveaway.entries.push(interaction.user.id);
      saveGiveaway(interaction.message.id, giveaway);
      return interaction.reply({ content: '🎉 You entered the giveaway!', ephemeral: true });
    }
  } catch (err) {
    console.error(`[${BOT_NAME}] Interaction error:`, err);
    const errorReply = { content: '⚠️ There was an error processing this action.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorReply).catch(() => {});
    } else {
      await interaction.reply(errorReply).catch(() => {});
    }
  }
});

// ==================== READY ====================
client.once('ready', async () => {
  console.log(`✅ ${BOT_NAME} is online as ${client.user.tag}`);
  client.user.setActivity('over the Culling Game', { type: 3 }); // "Watching"

  const rest = new REST().setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandsToRegister });
    console.log(`[${BOT_NAME}] Slash commands registered globally.`);
  } catch (err) {
    console.error(`[${BOT_NAME}] Failed to register commands:`, err);
  }
});

// ==================== KEEP-ALIVE SERVER ====================
const app = express();
app.get('/', (req, res) => res.send(`${BOT_NAME} is alive.`));
app.listen(PORT, () => console.log(`[${BOT_NAME}] Keep-alive server running on port ${PORT}`));

// ==================== LOGIN ====================
client.login(process.env.TOKEN);
