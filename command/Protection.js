const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('protection')
    .setDescription('Manage server protection systems')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('antinuke')
        .setDescription('Toggle anti-nuke protection')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('antiraid')
        .setDescription('Toggle anti-raid protection')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('automod')
        .setDescription('Toggle automod')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('whitelist-add')
        .setDescription('Whitelist a user from anti-nuke actions')
        .addUserOption(opt => opt.setName('user').setDescription('User to whitelist').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('banword')
        .setDescription('Add a word to the automod banned word list')
        .addStringOption(opt => opt.setName('word').setDescription('Word to ban').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'antinuke') {
      const enabled = interaction.options.getBoolean('enabled');
      setGuildConfig(guildId, 'antiNukeEnabled', enabled);
      return interaction.reply({ content: `🛡️ Anti-nuke is now **${enabled ? 'ON' : 'OFF'}**.`, ephemeral: true });
    }

    if (sub === 'antiraid') {
      const enabled = interaction.options.getBoolean('enabled');
      setGuildConfig(guildId, 'antiRaidEnabled', enabled);
      return interaction.reply({ content: `🚨 Anti-raid is now **${enabled ? 'ON' : 'OFF'}**.`, ephemeral: true });
    }

    if (sub === 'automod') {
      const enabled = interaction.options.getBoolean('enabled');
      setGuildConfig(guildId, 'automodEnabled', enabled);
      return interaction.reply({ content: `🔨 Automod is now **${enabled ? 'ON' : 'OFF'}**.`, ephemeral: true });
    }

    if (sub === 'whitelist-add') {
      const user = interaction.options.getUser('user');
      const config = getGuildConfig(guildId);
      const list = config.antiNukeWhitelist || [];
      if (!list.includes(user.id)) list.push(user.id);
      setGuildConfig(guildId, 'antiNukeWhitelist', list);
      return interaction.reply({ content: `✅ ${user.tag} added to anti-nuke whitelist.`, ephemeral: true });
    }

    if (sub === 'banword') {
      const word = interaction.options.getString('word');
      const config = getGuildConfig(guildId);
      const list = config.bannedWords || [];
      if (!list.includes(word)) list.push(word);
      setGuildConfig(guildId, 'bannedWords', list);
      return interaction.reply({ content: `✅ Added \`${word}\` to banned words.`, ephemeral: true });
    }
  },
};
