const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { saveGiveaway, getGiveaways, deleteGiveaway } = require('../store');

function parseDuration(input) {
  const match = input.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a giveaway')
        .addStringOption(opt => opt.setName('prize').setDescription('What are you giving away').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('e.g. 10m, 1h, 2d').setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End a giveaway early')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const prize = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration');
      const winners = interaction.options.getInteger('winners') || 1;
      const durationMs = parseDuration(durationStr);

      if (!durationMs) {
        return interaction.reply({ content: '❌ Invalid duration. Use formats like `10m`, `1h`, `2d`.', ephemeral: true });
      }

      const endsAt = Date.now() + durationMs;

      const embed = new EmbedBuilder()
        .setTitle('🎉 Giveaway!')
        .setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\nEnds: <t:${Math.floor(endsAt / 1000)}:R>\n\nClick the button below to enter!`)
        .setColor(0x6A0DAD)
        .setTimestamp(endsAt);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giveaway_join').setLabel('🎉 Enter').setStyle(ButtonStyle.Success)
      );

      const message = await interaction.channel.send({ embeds: [embed], components: [row] });

      saveGiveaway(message.id, {
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        prize,
        winners,
        endsAt,
        entries: [],
        ended: false,
      });

      await interaction.reply({ content: '✅ Giveaway started!', ephemeral: true });

      setTimeout(() => endGiveaway(interaction.client, message.id), durationMs);
      return;
    }

    if (sub === 'end') {
      const messageId = interaction.options.getString('message_id');
      const all = getGiveaways();
      if (!all[messageId]) return interaction.reply({ content: '❌ Giveaway not found.', ephemeral: true });
      await endGiveaway(interaction.client, messageId);
      return interaction.reply({ content: '✅ Giveaway ended.', ephemeral: true });
    }
  },
};

async function endGiveaway(client, messageId) {
  const all = getGiveaways();
  const giveaway = all[messageId];
  if (!giveaway || giveaway.ended) return;

  giveaway.ended = true;
  saveGiveaway(messageId, giveaway);

  try {
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;

    const entries = giveaway.entries;
    if (!entries.length) {
      await channel.send(`😔 No one entered the giveaway for **${giveaway.prize}**.`);
      deleteGiveaway(messageId);
      return;
    }

    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    const winnersList = shuffled.slice(0, giveaway.winners);

    await channel.send(
      `🎉 Congratulations ${winnersList.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`
    );
  } catch (err) {
    console.error('[giveaway] Error ending giveaway:', err.message);
  } finally {
    deleteGiveaway(messageId);
  }
}

module.exports.endGiveaway = endGiveaway;
