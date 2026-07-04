const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Send the support ticket panel to this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Member Services')
      .setDescription(
        'Need assistance? Open the appropriate ticket below and a member of the **Eminence Vanguard** staff team will assist you.\n\n' +
        '💬 **General Support**\nGet help with server-related questions, issues, or concerns.\n\n' +
        '🐛 **Report a Bug**\nReport rule violations, scams, harassment, or other issues.\n\n' +
        '🤝 **Partnership**\nDiscuss a partnership or collaboration with us.'
      )
      .setColor(0x2B2D31);
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket_type_select')
      .setPlaceholder('Select a category')
      .addOptions([
        {
          label: 'General Support',
          value: 'general',
          emoji: '💬',
          description: 'Get help with general questions'
        },
        {
          label: 'Report a Bug',
          value: 'bug',
          emoji: '🐛',
          description: 'Report a bug or issue'
        },
        {
          label: 'Partnership',
          value: 'partnership',
          emoji: '🤝',
          description: 'Discuss a partnership or collab'
        }
      ]);
    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
