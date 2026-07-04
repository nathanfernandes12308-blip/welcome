const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

// ─── Per-guild state ─────────────────────────────────────────────────────────
const guildSettings = new Map();

function getSettings(guildId) {
  if (!guildSettings.has(guildId)) {
    guildSettings.set(guildId, {
      antiLink:        { enabled: true,  mode: 'strict' },
      antiSwear:       { enabled: false },
      antiMassMention: { enabled: true,  threshold: 5 },
      antiSpam:        { enabled: true,  threshold: 5, seconds: 2 },
      antiPing:        { enabled: true },
      whitelist: {
        roles:      [],
        users:      [],
        channels:   [],
      }
    });
  }
  return guildSettings.get(guildId);
}

// ─── Build main panel embed ───────────────────────────────────────────────────
function buildEmbed(guild, settings) {
  const s = settings;

  function status(enabled) {
    return enabled ? '✅ **ENABLED**' : '❌ **DISABLED**';
  }

  function wlList(arr, type) {
    if (!arr.length) return 'None';
    if (type === 'role')    return arr.map(id => `<@&${id}>`).join(', ');
    if (type === 'user')    return arr.map(id => `<@${id}>`).join(', ');
    if (type === 'channel') return arr.map(id => `<#${id}>`).join(', ');
    return 'None';
  }

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({
      name: `${guild.name} — AutoMod Panel`,
      iconURL: guild.iconURL({ dynamic: true }) ?? undefined,
    })
    .setDescription(
      '**❯ How to use this panel**\n' +
      '• Use the dropdown below to toggle protections\n' +
      '• Use `/automod whitelist` to manage whitelists\n' +
      '• Whitelisted entities bypass all AutoMod checks\n' +
      '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯'
    )
    .addFields(
      { name: '**Protection Status**', value: '\u200b', inline: false },
      {
        name: '🔗 Anti-Link',
        value:
          `${status(s.antiLink.enabled)}\n` +
          `└ ${s.antiLink.mode === 'loose' ? '🔓 Non-Discord links allowed' : '🔒 All external links blocked'}\n` +
          `└ Blocks Discord invites and external links`,
        inline: false,
      },
      {
        name: '🚫 Anti-Swear',
        value: `${status(s.antiSwear.enabled)}\n└ Filters profanity and inappropriate language`,
        inline: false,
      },
      {
        name: '📢 Anti-Mass-Mention',
        value: `${status(s.antiMassMention.enabled)}\n└ Prevents spam mentions (${s.antiMassMention.threshold}+ in one message)`,
        inline: false,
      },
      {
        name: '🚨 Anti-Spam',
        value: `${status(s.antiSpam.enabled)}\n└ Prevents rapid message spam (${s.antiSpam.threshold}+ in ${s.antiSpam.seconds} seconds)`,
        inline: false,
      },
      {
        name: '⚠️ Anti-Ping',
        value: `${status(s.antiPing.enabled)}\n└ Blocks @everyone / @here and punishes abusers`,
        inline: false,
      },
      { name: '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯', value: '\u200b', inline: false },
      {
        name: '**Whitelist Summary**',
        value:
          `**Whitelisted Roles:** ${wlList(s.whitelist.roles, 'role')}\n` +
          `**Whitelisted Users:** ${wlList(s.whitelist.users, 'user')}\n` +
          `**Whitelisted Channels:** ${wlList(s.whitelist.channels, 'channel')}\n` +
          `*Whitelisted entities bypass all AutoMod checks*`,
        inline: false,
      }
    )
    .setFooter({ text: 'Eminence Vanguard • AutoMod System' })
    .setTimestamp();
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function buildMenu(settings) {
  const s = settings;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('automod_toggle')
      .setPlaceholder('⚙️  Select a protection to toggle...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Anti-Link').setDescription(s.antiLink.enabled ? 'ENABLED — click to disable' : 'DISABLED — click to enable').setValue('antiLink').setEmoji('🔗'),
        new StringSelectMenuOptionBuilder().setLabel('Anti-Swear').setDescription(s.antiSwear.enabled ? 'ENABLED — click to disable' : 'DISABLED — click to enable').setValue('antiSwear').setEmoji('🚫'),
        new StringSelectMenuOptionBuilder().setLabel('Anti-Mass-Mention').setDescription(s.antiMassMention.enabled ? 'ENABLED — click to disable' : 'DISABLED — click to enable').setValue('antiMassMention').setEmoji('📢'),
        new StringSelectMenuOptionBuilder().setLabel('Anti-Spam').setDescription(s.antiSpam.enabled ? 'ENABLED — click to disable' : 'DISABLED — click to enable').setValue('antiSpam').setEmoji('🚨'),
        new StringSelectMenuOptionBuilder().setLabel('Anti-Ping').setDescription(s.antiPing.enabled ? 'ENABLED — click to disable' : 'DISABLED — click to enable').setValue('antiPing').setEmoji('⚠️'),
      )
  );
}

function buildButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('automod_enable_all').setLabel('Enable All').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('automod_disable_all').setLabel('Disable All').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    new ButtonBuilder().setCustomId('automod_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
  );
}

// ─── Slash command ────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Manage AutoMod protections for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── /automod panel ──
    .addSubcommand(sub =>
      sub.setName('panel').setDescription('Open the AutoMod control panel')
    )

    // ── /automod whitelist add ──
    .addSubcommandGroup(group =>
      group.setName('whitelist').setDescription('Manage the AutoMod whitelist')
        .addSubcommand(sub =>
          sub.setName('add').setDescription('Add a role, user, or channel to the whitelist')
            .addStringOption(opt =>
              opt.setName('type').setDescription('What to whitelist').setRequired(true)
                .addChoices(
                  { name: '👤 User',    value: 'user' },
                  { name: '🎭 Role',    value: 'role' },
                  { name: '💬 Channel', value: 'channel' },
                )
            )
            .addMentionableOption(opt =>
              opt.setName('target').setDescription('The user or role to whitelist').setRequired(false)
            )
            .addChannelOption(opt =>
              opt.setName('channel').setDescription('The channel to whitelist').setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub.setName('remove').setDescription('Remove a role, user, or channel from the whitelist')
            .addStringOption(opt =>
              opt.setName('type').setDescription('What to remove').setRequired(true)
                .addChoices(
                  { name: '👤 User',    value: 'user' },
                  { name: '🎭 Role',    value: 'role' },
                  { name: '💬 Channel', value: 'channel' },
                )
            )
            .addMentionableOption(opt =>
              opt.setName('target').setDescription('The user or role to remove').setRequired(false)
            )
            .addChannelOption(opt =>
              opt.setName('channel').setDescription('The channel to remove').setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub.setName('list').setDescription('View the current whitelist')
        )
    ),

  async execute(interaction) {
    const settings = getSettings(interaction.guild.id);
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();

    // ── panel ──────────────────────────────────────────────────────────────
    if (sub === 'panel') {
      return interaction.reply({
        embeds: [buildEmbed(interaction.guild, settings)],
        components: [buildMenu(settings), buildButtonRow()],
        ephemeral: true,
      });
    }

    // ── whitelist list ─────────────────────────────────────────────────────
    if (group === 'whitelist' && sub === 'list') {
      const wl = settings.whitelist;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 AutoMod Whitelist')
        .addFields(
          { name: '🎭 Roles',    value: wl.roles.length    ? wl.roles.map(id => `<@&${id}>`).join('\n')   : 'None', inline: true },
          { name: '👤 Users',    value: wl.users.length    ? wl.users.map(id => `<@${id}>`).join('\n')    : 'None', inline: true },
          { name: '💬 Channels', value: wl.channels.length ? wl.channels.map(id => `<#${id}>`).join('\n') : 'None', inline: true },
        )
        .setFooter({ text: 'Eminence Vanguard • AutoMod Whitelist' })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── whitelist add ──────────────────────────────────────────────────────
    if (group === 'whitelist' && sub === 'add') {
      const type    = interaction.options.getString('type');
      const target  = interaction.options.getMentionable('target');
      const channel = interaction.options.getChannel('channel');
      const wl      = settings.whitelist;

      if (type === 'channel') {
        if (!channel) return interaction.reply({ content: '❌ Please select a channel.', ephemeral: true });
        if (wl.channels.includes(channel.id)) return interaction.reply({ content: `❌ <#${channel.id}> is already whitelisted.`, ephemeral: true });
        wl.channels.push(channel.id);
        return interaction.reply({ content: `✅ <#${channel.id}> added to the whitelist.`, ephemeral: true });
      }

      if (!target) return interaction.reply({ content: '❌ Please select a user or role.', ephemeral: true });

      if (type === 'role') {
        if (!target.permissions) return interaction.reply({ content: '❌ Please select a **role**, not a user.', ephemeral: true });
        if (wl.roles.includes(target.id)) return interaction.reply({ content: `❌ <@&${target.id}> is already whitelisted.`, ephemeral: true });
        wl.roles.push(target.id);
        return interaction.reply({ content: `✅ <@&${target.id}> added to the whitelist.`, ephemeral: true });
      }

      if (type === 'user') {
        if (target.permissions) return interaction.reply({ content: '❌ Please select a **user**, not a role.', ephemeral: true });
        if (wl.users.includes(target.id)) return interaction.reply({ content: `❌ <@${target.id}> is already whitelisted.`, ephemeral: true });
        wl.users.push(target.id);
        return interaction.reply({ content: `✅ <@${target.id}> added to the whitelist.`, ephemeral: true });
      }
    }

    // ── whitelist remove ───────────────────────────────────────────────────
    if (group === 'whitelist' && sub === 'remove') {
      const type    = interaction.options.getString('type');
      const target  = interaction.options.getMentionable('target');
      const channel = interaction.options.getChannel('channel');
      const wl      = settings.whitelist;

      if (type === 'channel') {
        if (!channel) return interaction.reply({ content: '❌ Please select a channel.', ephemeral: true });
        if (!wl.channels.includes(channel.id)) return interaction.reply({ content: `❌ <#${channel.id}> is not whitelisted.`, ephemeral: true });
        wl.channels = wl.channels.filter(id => id !== channel.id);
        return interaction.reply({ content: `✅ <#${channel.id}> removed from the whitelist.`, ephemeral: true });
      }

      if (!target) return interaction.reply({ content: '❌ Please select a user or role.', ephemeral: true });

      if (type === 'role') {
        if (!wl.roles.includes(target.id)) return interaction.reply({ content: `❌ <@&${target.id}> is not whitelisted.`, ephemeral: true });
        wl.roles = wl.roles.filter(id => id !== target.id);
        return interaction.reply({ content: `✅ <@&${target.id}> removed from the whitelist.`, ephemeral: true });
      }

      if (type === 'user') {
        if (!wl.users.includes(target.id)) return interaction.reply({ content: `❌ <@${target.id}> is not whitelisted.`, ephemeral: true });
        wl.users = wl.users.filter(id => id !== target.id);
        return interaction.reply({ content: `✅ <@${target.id}> removed from the whitelist.`, ephemeral: true });
      }
    }
  },

  // ─── Event handlers ───────────────────────────────────────────────────────
  registerEvents(client) {

    // Dropdown toggle
    client.on('interactionCreate', async interaction => {
      if (!interaction.isStringSelectMenu()) return;
      if (interaction.customId !== 'automod_toggle') return;
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need **Manage Server** to use this.', ephemeral: true });
      }
      const key = interaction.values[0];
      const settings = getSettings(interaction.guild.id);
      settings[key].enabled = !settings[key].enabled;
      const label = { antiLink: 'Anti-Link', antiSwear: 'Anti-Swear', antiMassMention: 'Anti-Mass-Mention', antiSpam: 'Anti-Spam', antiPing: 'Anti-Ping' }[key];
      await interaction.update({
        embeds: [buildEmbed(interaction.guild, settings)],
        components: [buildMenu(settings), buildButtonRow()],
      });
      await interaction.followUp({ content: `🔧 **${label}** has been **${settings[key].enabled ? 'ENABLED ✅' : 'DISABLED ❌'}** by ${interaction.user}`, ephemeral: false });
    });

    // Buttons
    client.on('interactionCreate', async interaction => {
      if (!interaction.isButton()) return;
      if (!['automod_enable_all', 'automod_disable_all', 'automod_refresh'].includes(interaction.customId)) return;
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need **Manage Server** to use this.', ephemeral: true });
      }
      const settings = getSettings(interaction.guild.id);
      const keys = ['antiLink', 'antiSwear', 'antiMassMention', 'antiSpam', 'antiPing'];
      if (interaction.customId === 'automod_enable_all')  keys.forEach(k => settings[k].enabled = true);
      if (interaction.customId === 'automod_disable_all') keys.forEach(k => settings[k].enabled = false);
      await interaction.update({
        embeds: [buildEmbed(interaction.guild, settings)],
        components: [buildMenu(settings), buildButtonRow()],
      });
      if (interaction.customId !== 'automod_refresh') {
        await interaction.followUp({
          content: interaction.customId === 'automod_enable_all'
            ? `✅ All AutoMod protections **enabled** by ${interaction.user}`
            : `❌ All AutoMod protections **disabled** by ${interaction.user}`,
          ephemeral: false,
        });
      }
    });

    // Message enforcement
    client.on('messageCreate', async message => {
      if (!message.guild || message.author.bot) return;
      const settings = getSettings(message.guild.id);
      const wl = settings.whitelist;
      const member = message.member;
      if (
        wl.roles.some(r => member?.roles.cache.has(r)) ||
        wl.users.includes(message.author.id) ||
        wl.channels.includes(message.channel.id)
      ) return;
      if (member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

      // Anti-Ping
      if (settings.antiPing.enabled) {
        if (message.content.includes('@everyone') || message.content.includes('@here')) {
          await message.delete().catch(() => {});
          await message.channel.send({ content: `⚠️ ${message.author} — mass pings are not allowed.` })
            .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
          return;
        }
      }

      // Anti-Link
      if (settings.antiLink.enabled) {
        const urlRegex = /https?:\/\/[^\s]+/gi;
        const discordInviteRegex = /discord\.(gg|com\/invite)\/[^\s]+/gi;
        const hasLink   = urlRegex.test(message.content);
        const hasInvite = discordInviteRegex.test(message.content);
        const block = settings.antiLink.mode === 'strict' ? hasLink : hasInvite;
        if (block) {
          await message.delete().catch(() => {});
          await message.channel.send({ content: `🔗 ${message.author} — links are not allowed here.` })
            .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
          return;
        }
      }

      // Anti-Mass-Mention
      if (settings.antiMassMention.enabled) {
        const mentionCount = (message.mentions.users.size || 0) + (message.mentions.roles.size || 0);
        if (mentionCount >= settings.antiMassMention.threshold) {
          await message.delete().catch(() => {});
          await message.channel.send({ content: `📢 ${message.author} — too many mentions in one message.` })
            .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
          return;
        }
      }

      // Anti-Spam
      if (settings.antiSpam.enabled) {
        if (!client._spamTracker) client._spamTracker = new Map();
        const key = `${message.guild.id}-${message.author.id}`;
        const now = Date.now();
        const tracker = client._spamTracker.get(key) || { msgs: [], warned: false };
        tracker.msgs = tracker.msgs.filter(t => now - t < settings.antiSpam.seconds * 1000);
        tracker.msgs.push(now);
        client._spamTracker.set(key, tracker);
        if (tracker.msgs.length >= settings.antiSpam.threshold) {
          await message.delete().catch(() => {});
          if (!tracker.warned) {
            tracker.warned = true;
            setTimeout(() => { tracker.warned = false; }, 10000);
            await message.channel.send({ content: `🚨 ${message.author} — slow down, you're sending messages too fast.` })
              .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
          }
          return;
        }
      }

      // Anti-Swear
      if (settings.antiSwear.enabled) {
        const badWords = ['fuck', 'shit', 'ass', 'bitch', 'bastard', 'damn', 'crap', 'piss', 'dick', 'cock', 'pussy', 'cunt', 'nigga', 'nigger', 'fag', 'retard'];
        const lower = message.content.toLowerCase();
        if (badWords.some(w => lower.includes(w))) {
          await message.delete().catch(() => {});
          await message.channel.send({ content: `🚫 ${message.author} — watch your language!` })
            .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
          return;
        }
      }
    });
  }
};
