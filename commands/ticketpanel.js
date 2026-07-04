const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
} = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../store');

// Ticket categories — customize labels/emojis here
const TICKET_TYPES = {
  bug_report: { label: 'Bug Report', emoji: '🐛', description: 'Report a bug in the server or bot', color: 0xE74C3C },
  member_report: { label: 'Member Report', emoji: '🚨', description: 'Report a member for rule violations', color: 0xF39C12 },
  glitch_fix: { label: 'Glitch Fix', emoji: '🔧', description: 'Request a fix for a glitch/exploit', color: 0x3498DB },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Post the premium ticket panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Ryomen Sukuna ┃ Support Desk', iconURL: interaction.guild.iconURL() || undefined })
      .setTitle('🎫 Open a Ticket')
      .setDescription(
        'Select a category below to open a private ticket channel with staff.\n\n' +
        '🐛 **Bug Report** — something broken in the server or bot\n' +
        '🚨 **Member Report** — report a rule violation\n' +
        '🔧 **Glitch Fix** — request a fix for a glitch or exploit\n\n' +
        '*Only you and staff can see your ticket.*'
      )
      .setColor(0x8B0000)
      .setFooter({ text: 'Premium Support System' })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_division_select')
      .setPlaceholder('Choose a ticket category...')
      .addOptions(
        Object.entries(TICKET_TYPES).map(([value, t]) => ({
          label: t.label,
          value,
          description: t.description,
          emoji: t.emoji,
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Ticket panel posted.', ephemeral: true });
  },
};

// Finds or creates a "Tickets" category channel to keep things organized
async function getOrCreateTicketCategory(guild) {
  const config = getGuildConfig(guild.id);
  if (config.ticketCategoryId) {
    const existing = await guild.channels.fetch(config.ticketCategoryId).catch(() => null);
    if (existing) return existing;
  }

  const category = await guild.channels.create({
    name: '🎫 Tickets',
    type: ChannelType.GuildCategory,
  });

  setGuildConfig(guild.id, 'ticketCategoryId', category.id);
  return category;
}

async function handleTicketSelect(interaction) {
  const type = interaction.values[0];
  const ticketInfo = TICKET_TYPES[type];
  const guild = interaction.guild;
  const config = getGuildConfig(guild.id);

  const existingId = config[`ticket_${interaction.user.id}_${type}`];
  if (existingId) {
    const existing = await guild.channels.fetch(existingId).catch(() => null);
    if (existing) {
      return interaction.reply({ content: `You already have an open ticket: ${existing}`, ephemeral: true });
    }
  }

  const category = await getOrCreateTicketCategory(guild);

  const channel = await guild.channels.create({
    name: `${ticketInfo.emoji}-${type.replace('_', '-')}-${interaction.user.username}`.toLowerCase().slice(0, 90),
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ],
  });

  setGuildConfig(guild.id, `ticket_${interaction.user.id}_${type}`, channel.id);

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${ticketInfo.emoji} ${ticketInfo.label}` })
    .setDescription(
      `Welcome ${interaction.user}, thank you for reaching out.\n\n` +
      `**Category:** ${ticketInfo.label}\n` +
      `Please describe your issue in as much detail as possible. Staff will respond shortly.`
    )
    .setColor(ticketInfo.color)
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close_${type}_${interaction.user.id}`).setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  );

  await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeRow] });
  await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
}

async function handleTicketClose(interaction) {
  // customId format: ticket_close_<type>_<userId>
  const parts = interaction.customId.split('_');
  const type = parts[2];
  const ownerId = parts[3];
  const guild = interaction.guild;

  setGuildConfig(guild.id, `ticket_${ownerId}_${type}`, null);

  await interaction.reply({ content: '🔒 Closing this ticket in 5 seconds...' });
  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

module.exports.handleTicketSelect = handleTicketSelect;
module.exports.handleTicketClose = handleTicketClose;
module.exports.TICKET_TYPES = TICKET_TYPES;
