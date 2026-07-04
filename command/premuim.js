const { SlashCommandBuilder } = require('discord.js');
const { setGuildConfig, getGuildConfig } = require('../store');

// Replace with your own Discord user ID
const BOT_OWNER_ID = 'YOUR_DISCORD_USER_ID';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Manage premium status (bot owner only)')
    .addSubcommand(sub =>
      sub.setName('grant')
        .setDescription('Grant premium to this server')
    )
    .addSubcommand(sub =>
      sub.setName('revoke')
        .setDescription('Revoke premium from this server')
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Check this server\'s premium status')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'status') {
      const { premium = false } = getGuildConfig(guildId);
      return interaction.reply({ content: `⭐ Premium status: **${premium ? 'Active' : 'Inactive'}**`, ephemeral: true });
    }

    if (interaction.user.id !== BOT_OWNER_ID) {
      return interaction.reply({ content: '❌ Only the bot owner can manage premium status.', ephemeral: true });
    }

    if (sub === 'grant') {
      setGuildConfig(guildId, 'premium', true);
      return interaction.reply({ content: '✅ Premium granted to this server.' });
    }

    if (sub === 'revoke') {
      setGuildConfig(guildId, 'premium', false);
      return interaction.reply({ content: '✅ Premium revoked from this server.' });
    }
  },
};
