const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ChannelType,
} = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../store');

// Default divisions — customize via /ticketpanel divisions if you want different ones
const DEFAULT_DIVISIONS = [
  { label: 'Espada', value: 'espada', description: 'Join the Espada ranks' },
  { label: 'Vanguard Ops', value: 'vanguard', description: 'Raids, wars, operations' },
  { label: 'Support', value: 'support', description: 'General help & questions' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Post the division ticket panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Open a Ticket')
      .setDescription('Select a division below to open a private ticket channel.')
      .setColor(0x6A0DAD);

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_division_select')
      .setPlaceholder('Choose a division...')
      .addOptions(DEFAULT_DIVISIONS.map(d => ({ label: d.label, value: d.value, description: d.description })));

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Ticket panel posted.', ephemeral: true });
  },
};

// Exported so index.js can handle the select menu + close button interactions
async function handleTicketSelect(interaction) {
  const division = interaction.values[0];
  const guild = interaction.guild;
  const config = getGuildConfig(guild.id);

  const existingId = config[`ticket_${interaction.user.id}_${division}`];
  if (existingId) {
    const existing = await guild.channels.fetch(existingId).catch(() => null);
    if (existing) {
      return interaction.reply({ content: `You already have an open ticket: ${existing}`, ephemeral: true });
    }
  }

  const channel = await guild.channels.create({
    name: `ticket-${division}-${interaction.user.username}`.toLowerCase().slice(0, 90),
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ],
  });

  setGuildConfig(guild.id, `ticket_${interaction.user.id}_${division}`, channel.id);

  const embed = new EmbedBuilder()
    .setTitle(`🎫 ${division.toUpperCase()} Ticket`)
    .setDescription(`Welcome ${interaction.user}, staff will be with you shortly.\nType your request below.`)
    .setColor(0x6A0DAD);

  await channel.send({ content: `${interaction.user}`, embeds: [embed] });
  await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
}

module.exports.handleTicketSelect = handleTicketSelect;
