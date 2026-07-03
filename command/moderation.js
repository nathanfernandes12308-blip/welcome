const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addWarning, getWarnings, clearWarnings } = require('../store');
const { logEvent } = require('../handlers/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderation actions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('ban')
        .setDescription('Ban a member')
        .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('kick')
        .setDescription('Kick a member')
        .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('timeout')
        .setDescription('Timeout a member')
        .addUserOption(opt => opt.setName('user').setDescription('User to timeout').setRequired(true))
        .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('warn')
        .setDescription('Warn a member')
        .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('warnings')
        .setDescription('View a member\'s warnings')
        .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('clearwarnings')
        .setDescription('Clear a member\'s warnings')
        .addUserOption(opt => opt.setName('user').setDescription('User to clear').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (sub === 'ban') {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member?.bannable) return interaction.reply({ content: '❌ I cannot ban this user.', ephemeral: true });
      await member.ban({ reason });
      await logEvent(guild, { title: '🔨 Member Banned', description: `${user.tag} banned by ${interaction.user.tag}`, fields: [{ name: 'Reason', value: reason }] });
      return interaction.reply({ content: `✅ Banned ${user.tag}.` });
    }

    if (sub === 'kick') {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member?.kickable) return interaction.reply({ content: '❌ I cannot kick this user.', ephemeral: true });
      await member.kick(reason);
      await logEvent(guild, { title: '👢 Member Kicked', description: `${user.tag} kicked by ${interaction.user.tag}`, fields: [{ name: 'Reason', value: reason }] });
      return interaction.reply({ content: `✅ Kicked ${user.tag}.` });
    }

    if (sub === 'timeout') {
      const minutes = interaction.options.getInteger('minutes');
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member?.moderatable) return interaction.reply({ content: '❌ I cannot timeout this user.', ephemeral: true });
      await member.timeout(minutes * 60 * 1000, reason);
      await logEvent(guild, { title: '⏱️ Member Timed Out', description: `${user.tag} timed out by ${interaction.user.tag} for ${minutes}m`, fields: [{ name: 'Reason', value: reason }] });
      return interaction.reply({ content: `✅ Timed out ${user.tag} for ${minutes} minute(s).` });
    }

    if (sub === 'warn') {
      const warnings = addWarning(guild.id, user.id, { reason, moderator: interaction.user.tag, timestamp: Date.now() });
      await logEvent(guild, { title: '⚠️ Member Warned', description: `${user.tag} warned by ${interaction.user.tag}`, fields: [{ name: 'Reason', value: reason }, { name: 'Total Warnings', value: `${warnings.length}` }] });
      return interaction.reply({ content: `✅ Warned ${user.tag}. They now have ${warnings.length} warning(s).` });
    }

    if (sub === 'warnings') {
      const warnings = getWarnings(guild.id, user.id);
      if (!warnings.length) return interaction.reply({ content: `${user.tag} has no warnings.`, ephemeral: true });
      const embed = new EmbedBuilder()
        .setTitle(`Warnings for ${user.tag}`)
        .setColor(0xFFA500)
        .setDescription(warnings.map((w, i) => `**${i + 1}.** ${w.reason} — *by ${w.moderator}* (<t:${Math.floor(w.timestamp / 1000)}:R>)`).join('\n'));
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'clearwarnings') {
      clearWarnings(guild.id, user.id);
      return interaction.reply({ content: `✅ Cleared warnings for ${user.tag}.` });
    }
  },
};
