const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const GIVEAWAY_PING_ROLE = '1522515316704546856';

// Active giveaways: messageId -> giveaway data
const giveaways = new Map();

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return num * multipliers[unit];
}

function formatTimeLeft(endsAt) {
  const ms = endsAt - Date.now();
  if (ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function buildEmbed(data, ended = false) {
  const { prize, endsAt, winners, entries, hostedBy } = data;

  const embed = new EmbedBuilder()
    .setTitle('🎉 GIVEAWAY 🎉')
    .setDescription(
      `**Prize:** ${prize}\n\n` +
      `Click the 🎉 button below to enter!\n\n` +
      `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n` +
      `👥 **Entries:** ${entries.length}\n` +
      `🏆 **Winners:** ${winners}\n` +
      `⏰ **${ended ? 'Ended' : 'Ends'}:** <t:${Math.floor(endsAt / 1000)}:R>\n` +
      `🎗️ **Hosted by:** <@${hostedBy}>`
    )
    .setColor(ended ? 0x808080 : 0x9B59B6)
    .setFooter({ text: ended ? 'Giveaway ended' : `${formatTimeLeft(endsAt)} remaining` })
    .setTimestamp();

  return embed;
}

function buildButton(ended = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway_enter')
      .setLabel(ended ? 'Giveaway Ended' : 'Enter Giveaway')
      .setEmoji('🎉')
      .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(ended),
    new ButtonBuilder()
      .setCustomId('giveaway_participants')
      .setLabel('Participants')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Secondary)
  );
}

async function endGiveaway(client, messageId, channelId, guildId) {
  const data = giveaways.get(messageId);
  if (!data || data.ended) return;

  data.ended = true;
  clearTimeout(data.timeout);

  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);

    const embed = buildEmbed(data, true);
    await message.edit({ embeds: [embed], components: [buildButton(true)] });

    if (data.entries.length === 0) {
      await channel.send({ content: `🎉 The giveaway for **${data.prize}** has ended but nobody entered.` });
      return;
    }

    const winnerIds = pickWinners(data.entries, data.winners);
    const winnerMentions = winnerIds.map(id => `<@${id}>`).join(', ');

    const winEmbed = new EmbedBuilder()
      .setTitle('🏆 Giveaway Ended!')
      .setDescription(
        `**Prize:** ${data.prize}\n\n` +
        `🎉 Congratulations ${winnerMentions}!\n` +
        `You won the giveaway!\n\n` +
        `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n` +
        `👥 Total entries: ${data.entries.length}`
      )
      .setColor(0x9B59B6)
      .setTimestamp();

    await channel.send({ content: winnerMentions, embeds: [winEmbed] });
    data.winnerIds = winnerIds;

  } catch (err) {
    console.error('Failed to end giveaway:', err.message);
  }
}

function pickWinners(entries, count) {
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaway system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a giveaway')
        .addStringOption(opt => opt.setName('prize').setDescription('What are you giving away?').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('How long? e.g. 30m, 2h, 1d').setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(10))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post in (default: current)')))

    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End a giveaway early')
        .addStringOption(opt => opt.setName('messageid').setDescription('Message ID of the giveaway').setRequired(true)))

    .addSubcommand(sub =>
      sub.setName('reroll')
        .setDescription('Reroll winners for a giveaway')
        .addStringOption(opt => opt.setName('messageid').setDescription('Message ID of the giveaway').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try {
      switch (sub) {
        case 'start':  return handleStart(interaction);
        case 'end':    return handleEnd(interaction);
        case 'reroll': return handleReroll(interaction);
        case 'participants': return handleParticipants(interaction);
      }
    } catch (err) {
      console.error('Giveaway error:', err);
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true });
    }
  },

  async handleButton(interaction) {
    const messageId = interaction.message.id;
    const data = giveaways.get(messageId);

    // ── View Participants button ──
    if (interaction.customId === 'giveaway_participants') {
      if (!data || data.entries.length === 0) {
        return interaction.reply({ content: '📭 Nobody has entered this giveaway yet.', ephemeral: true });
      }
      const mentions = data.entries.map((id, i) => `${i + 1}. <@${id}>`);
      const chunks = [];
      for (let i = 0; i < mentions.length; i += 20) chunks.push(mentions.slice(i, i + 20).join('\n'));

      const embed = new EmbedBuilder()
        .setTitle(`👥 Participants — ${data.prize}`)
        .setDescription(chunks[0])
        .setColor(0x9B59B6)
        .setFooter({ text: `Total entries: ${data.entries.length}${data.ended ? ' · Ended' : ' · Active'}` })
        .setTimestamp();

      for (let i = 1; i < chunks.length; i++) embed.addFields({ name: '\u200b', value: chunks[i] });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── Enter Giveaway button ──
    if (interaction.customId !== 'giveaway_enter') return;

    if (!data || data.ended) {
      return interaction.reply({ content: '❌ This giveaway has ended.', ephemeral: true });
    }

    if (data.entries.includes(interaction.user.id)) {
      data.entries = data.entries.filter(id => id !== interaction.user.id);
      const embed = buildEmbed(data);
      await interaction.message.edit({ embeds: [embed] });
      return interaction.reply({ content: '✅ You have left the giveaway.', ephemeral: true });
    }

    data.entries.push(interaction.user.id);
    const embed = buildEmbed(data);
    await interaction.message.edit({ embeds: [embed] });
    return interaction.reply({ content: '🎉 You have entered the giveaway! Good luck!', ephemeral: true });
  },

  giveaways
};

async function handleStart(interaction) {
  const prize = interaction.options.getString('prize');
  const durationStr = interaction.options.getString('duration');
  const winnersCount = interaction.options.getInteger('winners') || 1;
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

  const seconds = parseDuration(durationStr);
  if (!seconds) {
    return interaction.reply({ content: '❌ Invalid duration! Use: 30s, 10m, 2h, 1d', ephemeral: true });
  }
  if (seconds > 7 * 86400) {
    return interaction.reply({ content: '❌ Giveaway cannot be longer than 7 days.', ephemeral: true });
  }

  const endsAt = Date.now() + seconds * 1000;

  const data = {
    prize,
    endsAt,
    winners: winnersCount,
    entries: [],
    hostedBy: interaction.user.id,
    ended: false,
    channelId: targetChannel.id,
    guildId: interaction.guild.id,
    winnerIds: []
  };

  const embed = buildEmbed(data);
  const row = buildButton();

  await interaction.reply({ content: '✅ Giveaway started!', ephemeral: true });

  const msg = await targetChannel.send({
    content: `<@&${GIVEAWAY_PING_ROLE}> 🎉 A new giveaway has started!`,
    embeds: [embed],
    components: [row]
  });

  data.timeout = setTimeout(() => {
    endGiveaway(interaction.client, msg.id, targetChannel.id, interaction.guild.id);
  }, seconds * 1000);

  giveaways.set(msg.id, data);
}

async function handleEnd(interaction) {
  const messageId = interaction.options.getString('messageid');
  const data = giveaways.get(messageId);

  if (!data) {
    return interaction.reply({ content: '❌ Giveaway not found. Make sure you copied the correct message ID.', ephemeral: true });
  }
  if (data.ended) {
    return interaction.reply({ content: '❌ That giveaway has already ended.', ephemeral: true });
  }

  await interaction.reply({ content: '⏹️ Ending giveaway...', ephemeral: true });
  await endGiveaway(interaction.client, messageId, data.channelId, data.guildId);
}

async function handleReroll(interaction) {
  const messageId = interaction.options.getString('messageid');
  const data = giveaways.get(messageId);

  if (!data) {
    return interaction.reply({ content: '❌ Giveaway not found.', ephemeral: true });
  }
  if (!data.ended) {
    return interaction.reply({ content: '❌ This giveaway has not ended yet.', ephemeral: true });
  }
  if (data.entries.length === 0) {
    return interaction.reply({ content: '❌ No entries to reroll from.', ephemeral: true });
  }

  const winnerIds = pickWinners(data.entries, data.winners);
  const winnerMentions = winnerIds.map(id => `<@${id}>`).join(', ');

  const embed = new EmbedBuilder()
    .setTitle('🔄 Giveaway Rerolled!')
    .setDescription(
      `**Prize:** ${data.prize}\n\n` +
      `🎉 New winner(s): ${winnerMentions}\n` +
      `Congratulations!`
    )
    .setColor(0x9B59B6)
    .setTimestamp();

  const channel = await interaction.guild.channels.fetch(data.channelId);
  await channel.send({ content: winnerMentions, embeds: [embed] });
  await interaction.reply({ content: '✅ Rerolled!', ephemeral: true });
}

async function handleParticipants(interaction) {
  const messageId = interaction.options.getString('messageid');
  const data = giveaways.get(messageId);

  if (!data) {
    return interaction.reply({ content: '❌ Giveaway not found. Make sure you copied the correct message ID.', ephemeral: true });
  }

  if (data.entries.length === 0) {
    return interaction.reply({ content: '📭 Nobody has entered this giveaway yet.', ephemeral: true });
  }

  // Split into pages of 20 if large
  const mentions = data.entries.map((id, i) => `${i + 1}. <@${id}>`);
  const chunks = [];
  for (let i = 0; i < mentions.length; i += 20) {
    chunks.push(mentions.slice(i, i + 20).join('\n'));
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎉 Participants — ${data.prize}`)
    .setDescription(chunks[0])
    .setColor(0x9B59B6)
    .setFooter({ text: `Total entries: ${data.entries.length}${data.ended ? ' · Giveaway ended' : ' · Giveaway active'}` })
    .setTimestamp();

  // If more than 20 entries, add extra pages as fields
  for (let i = 1; i < chunks.length; i++) {
    embed.addFields({ name: `\u200b`, value: chunks[i] });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
