const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const dbPath = './data/bot.db';
if (!fs.existsSync('./data')) fs.mkdirSync('./data');

const db = new sqlite3.Database(dbPath);

// ====================== ACCESS CONTROL ======================
const authorizedDevs = ['1187672135049674846']; 
const MOD_LOG_CHANNEL_ID = '1522660504701763635';
// Create warnings table
db.run(`CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  username TEXT,
  reason TEXT,
  warned_by TEXT,
  warned_by_id TEXT,
  guild_id TEXT,
  timestamp INTEGER
)`);

const snipeCache = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderation commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

    // Kick & Ban
    .addSubcommand(sub => 
      sub.setName('ban')
        .setDescription('Ban a user')
        .addUserOption(opt => opt.setName('target').setDescription('User to ban').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason')))
    
    .addSubcommand(sub => 
      sub.setName('kick')
        .setDescription('Kick a user')
        .addUserOption(opt => opt.setName('target').setDescription('User to kick').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason')))

    // Other mod commands
    .addSubcommand(sub => 
      sub.setName('timeout')
        .setDescription('Timeout a user')
        .addUserOption(opt => opt.setName('target').setDescription('User to timeout').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('e.g. 10m, 2h, 1d').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason')))
    
    .addSubcommand(sub => 
      sub.setName('untimeout')
        .setDescription('Remove timeout')
        .addUserOption(opt => opt.setName('target').setDescription('User to remove timeout from').setRequired(true)))

    .addSubcommand(sub => 
      sub.setName('unban')
        .setDescription('Unban by user ID')
        .addStringOption(opt => opt.setName('userid').setDescription('User ID to unban').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason')))

    .addSubcommand(sub => 
      sub.setName('purge')
        .setDescription('Delete messages')
        .addIntegerOption(opt => opt.setName('amount').setDescription('1-100').setRequired(true)))

    .addSubcommand(sub => 
      sub.setName('warn')
        .setDescription('Warn a user')
        .addUserOption(opt => opt.setName('target').setDescription('User to warn').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason')))

    .addSubcommand(sub => 
      sub.setName('warnings')
        .setDescription('View warnings')
        .addUserOption(opt => opt.setName('target').setDescription('User to view warnings for').setRequired(true)))

    .addSubcommand(sub => 
      sub.setName('clearwarnings')
        .setDescription('Clear warnings (Dev only)')
        .addUserOption(opt => opt.setName('target').setDescription('User to clear warnings for').setRequired(true)))

    // New Features
    .addSubcommand(sub => 
      sub.setName('giverole')
        .setDescription('Give a role to a member')
        .addUserOption(opt => opt.setName('target').setDescription('User to give the role to').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to give').setRequired(true)))

    .addSubcommand(sub => 
      sub.setName('backup')
        .setDescription('Backup server structure (Dev only)'))

    .addSubcommand(sub =>
      sub.setName('loadbackup')
        .setDescription('Restore server structure from a backup file (Dev only)')
        .addAttachmentOption(opt => opt.setName('file').setDescription('The backup .json file').setRequired(true)))

    .addSubcommand(sub => 
      sub.setName('snipe')
        .setDescription('Snipe last deleted message')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const authorizedDevs = ['1187672135049674846']; // ← Change to your Discord ID

    if (['backup', 'loadbackup', 'clearwarnings'].includes(sub) && !authorizedDevs.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Developer access only.", ephemeral: true });
    }

    try {
      switch (sub) {
        case 'ban': await handleBan(interaction); break;
        case 'kick': await handleKick(interaction); break;
        case 'timeout': await handleTimeout(interaction); break;
        case 'untimeout': await handleUntimeout(interaction); break;
        case 'unban': await handleUnban(interaction); break;
        case 'purge': await handlePurge(interaction); break;
        case 'warn': await handleWarn(interaction); break;
        case 'warnings': await handleWarnings(interaction); break;
        case 'clearwarnings': await handleClearWarnings(interaction); break;
        case 'giverole': await handleGiveRole(interaction); break;
        case 'backup': await handleBackup(interaction); break;
        case 'loadbackup': await handleLoadBackup(interaction); break;
        case 'snipe': await handleSnipe(interaction); break;
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '❌ Error executing command.', ephemeral: true });
    }
  }
};

// ====================== COMMAND HANDLERS ======================

async function notifyUser(user, title, desc, color) {
  try {
    const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color);
    await user.send({ embeds: [embed] });
  } catch (e) {}
}

async function logModAction(interaction, action, target, reason, color) {
  try {
    const logChannel = await interaction.guild.channels.fetch(MOD_LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setTitle(`${action}`)
      .addFields(
        { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason || 'No reason provided' }
      )
      .setColor(color)
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to send mod log:', err.message);
  }
}

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return num * multipliers[unit];
}

async function handleBan(interaction) {
  const target = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  // DM the user BEFORE banning — Discord usually revokes DM access right after a ban
  await notifyBanWithVideo(target, interaction.guild, reason);

  await interaction.guild.bans.create(target, { reason });
  await logModAction(interaction, '🚫 Member Banned', target, reason, 0xFF0000);
  await interaction.reply(`🚫 Banned **${target.tag}**`);
}

async function notifyBanWithVideo(user, guild, reason) {
  try {
    const embed = new EmbedBuilder()
      .setTitle('Aizen is tired of you')
      .setDescription(`**Server:** ${guild.name}\n**Reason:** ${reason}`)
      .setColor(0xFF0000);

    const videoPath = './assets/banned.mp4';
    const files = fs.existsSync(videoPath)
      ? [new AttachmentBuilder(videoPath, { name: 'banned.mp4' })]
      : [];

    if (!files.length) {
      console.error('Ban video not found at', videoPath, '- sending text-only DM instead.');
    }

    await user.send({ embeds: [embed], files });
  } catch (e) {
    // User likely has DMs disabled or blocked the bot — non-fatal, ban still proceeds
    console.error('Failed to DM ban video:', e.message);
  }
}

async function handleKick(interaction) {
  const target = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  const member = await interaction.guild.members.fetch(target.id);
  await member.kick(reason);
  await notifyUser(target, "You have been kicked", `**Server:** ${interaction.guild.name}\n**Reason:** ${reason}`, 0xFFA500);
  await logModAction(interaction, '👢 Member Kicked', target, reason, 0xFFA500);
  await interaction.reply(`👢 Kicked **${target.tag}**`);
}

async function handleTimeout(interaction) {
  const target = interaction.options.getUser('target');
  const duration = interaction.options.getString('duration');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  const seconds = parseDuration(duration);
  if (!seconds) return interaction.reply({ content: "❌ Invalid duration! Use: 30s, 10m, 2h, 1d", ephemeral: true });

  const member = await interaction.guild.members.fetch(target.id);
  await member.timeout(seconds * 1000, reason);
  await notifyUser(target, "You have been timed out", `Duration: ${duration}\nReason: ${reason}`, 0xFFFF00);
  await interaction.reply(`🔇 Timed out **${target.tag}** for ${duration}`);
}

async function handleUntimeout(interaction) {
  const target = interaction.options.getUser('target');
  const member = await interaction.guild.members.fetch(target.id);
  await member.timeout(null);
  await interaction.reply(`✅ Untimed out **${target.tag}**`);
}

async function handleUnban(interaction) {
  const userid = interaction.options.getString('userid');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const user = await interaction.client.users.fetch(userid);
  await interaction.guild.bans.remove(user, reason);
  await interaction.reply(`✅ Unbanned **${user.tag}**`);
}

async function handlePurge(interaction) {
  const amount = interaction.options.getInteger('amount');
  if (amount < 1 || amount > 100) return interaction.reply({ content: "Amount must be 1-100", ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  try {
    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.editReply({ content: `🧹 Purged ${deleted.size} message(s). (Messages older than 14 days can't be bulk deleted by Discord and are skipped.)` });
  } catch (err) {
    console.error('Purge failed:', err);
    await interaction.editReply({ content: '❌ Failed to purge messages.' });
  }
}

async function handleWarn(interaction) {
  const target = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  const timestamp = Math.floor(Date.now() / 1000);
  db.run(`INSERT INTO warnings (user_id, username, reason, warned_by, warned_by_id, guild_id, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)`, 
    [target.id, target.tag, reason, interaction.user.tag, interaction.user.id, interaction.guild.id, timestamp]);

  await notifyUser(target, `Warning in ${interaction.guild.name}`, `**Reason:** ${reason}`, 0xFFFF00);
  await interaction.reply(`⚠️ Warned **${target.tag}**`);
}

async function handleWarnings(interaction) {
  const target = interaction.options.getUser('target');
  db.all("SELECT * FROM warnings WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10", [target.id], (err, rows) => {
    if (err || !rows.length) return interaction.reply({ content: `No warnings for ${target.tag}`, ephemeral: true });

    const embed = new EmbedBuilder().setTitle(`Warnings for ${target.tag}`).setColor(0xFFA500);
    rows.forEach((row, i) => {
      embed.addFields({ name: `#${i+1}`, value: `**Reason:** ${row.reason}\n**By:** ${row.warned_by}\n<t:${row.timestamp}:R>` });
    });
    interaction.reply({ embeds: [embed] });
  });
}

async function handleClearWarnings(interaction) {
  const target = interaction.options.getUser('target');
  db.run("DELETE FROM warnings WHERE user_id = ?", [target.id]);
  await interaction.reply(`✅ Cleared warnings for **${target.tag}**`);
}

async function handleGiveRole(interaction) {
  const target = interaction.options.getMember('target');
  const role = interaction.options.getRole('role');

  if (!target) return interaction.reply({ content: "User not found.", ephemeral: true });
  if (role.position >= interaction.guild.members.me.roles.highest.position) {
    return interaction.reply({ content: "Cannot assign a role higher than my top role.", ephemeral: true });
  }

  await target.roles.add(role);
  await interaction.reply(`✅ Gave **${role.name}** to ${target.user.tag}`);
}

async function handleBackup(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const backupData = { guild_id: guild.id, guild_name: guild.name, roles: [], categories: [], channels: [] };

  guild.roles.cache.forEach(r => backupData.roles.push({ id: r.id, name: r.name, color: r.color, position: r.position }));
  guild.channels.cache.forEach(ch => {
    if (ch.type === 4) backupData.categories.push({ id: ch.id, name: ch.name, position: ch.position });
    else backupData.channels.push({ id: ch.id, name: ch.name, type: ch.type, parent_id: ch.parentId, position: ch.position });
  });

  const jsonString = JSON.stringify(backupData, null, 2);

  // Also save locally for quick same-session access (note: lost on redeploy/restart)
  try {
    const folder = `./backup/server-${guild.id}`;
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(`${folder}/backup_${Date.now()}.json`, jsonString);
  } catch (err) {
    console.error('Local backup save failed (non-fatal):', err.message);
  }

  const attachment = new AttachmentBuilder(Buffer.from(jsonString, 'utf-8'), { name: `backup_${guild.id}_${Date.now()}.json` });

  await interaction.editReply({
    content: `✅ Backup created.\n**Roles:** ${backupData.roles.length} | **Categories:** ${backupData.categories.length} | **Channels:** ${backupData.channels.length}\n\n⚠️ Save this file somewhere safe (your computer) — you'll need to upload it back with \`/mod loadbackup\` to restore.`,
    files: [attachment]
  });
}

async function handleLoadBackup(interaction) {
  await interaction.deferReply();

  const file = interaction.options.getAttachment('file');
  if (!file.name.endsWith('.json')) {
    return interaction.editReply('❌ Please upload a valid `.json` backup file.');
  }

  try {
    const res = await fetch(file.url);
    const backupData = await res.json();

    if (!backupData.roles || !backupData.categories || !backupData.channels) {
      return interaction.editReply('❌ This file doesn\'t look like a valid backup.');
    }

    const guild = interaction.guild;
    const categoryMap = {};
    let rolesCreated = 0, categoriesCreated = 0, channelsCreated = 0;

    // 1. Recreate roles (skip @everyone and roles that already exist by name)
    const sortedRoles = backupData.roles
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => a.position - b.position);

    for (const r of sortedRoles) {
      if (guild.roles.cache.find(role => role.name === r.name)) continue;
      try {
        await guild.roles.create({ name: r.name, color: r.color || undefined });
        rolesCreated++;
      } catch (err) {
        console.error(`Failed to create role ${r.name}:`, err.message);
      }
    }

    // 2. Recreate categories (skip ones that already exist by name)
    const sortedCategories = backupData.categories.sort((a, b) => a.position - b.position);
    for (const cat of sortedCategories) {
      const existing = guild.channels.cache.find(c => c.type === 4 && c.name === cat.name);
      if (existing) {
        categoryMap[cat.id] = existing.id;
        continue;
      }
      try {
        const newCat = await guild.channels.create({ name: cat.name, type: 4 });
        categoryMap[cat.id] = newCat.id;
        categoriesCreated++;
      } catch (err) {
        console.error(`Failed to create category ${cat.name}:`, err.message);
      }
    }

    // 3. Recreate channels (skip ones that already exist by name within the same parent)
    const sortedChannels = backupData.channels.sort((a, b) => a.position - b.position);
    for (const ch of sortedChannels) {
      const parentId = ch.parent_id ? categoryMap[ch.parent_id] : null;
      const existing = guild.channels.cache.find(c => c.name === ch.name && c.parentId === (parentId || null));
      if (existing) continue;
      try {
        await guild.channels.create({ name: ch.name, type: ch.type, parent: parentId || null });
        channelsCreated++;
      } catch (err) {
        console.error(`Failed to create channel ${ch.name}:`, err.message);
      }
    }

    await interaction.editReply(
      `✅ Restore complete.\n**Roles created:** ${rolesCreated}\n**Categories created:** ${categoriesCreated}\n**Channels created:** ${channelsCreated}\n\n` +
      `Note: only names/colors/structure were restored — permissions and overwrites are not part of backups and were not touched.`
    );
  } catch (err) {
    console.error(err);
    await interaction.editReply('❌ Failed to restore backup. Make sure the file is a valid backup JSON and the bot has permission to manage roles/channels.');
  }
}

async function handleSnipe(interaction) {
  const data = snipeCache.get(interaction.channel.id);
  if (!data) return interaction.reply({ content: "Nothing to snipe!", ephemeral: true });

  const embed = new EmbedBuilder()
    .setDescription(data.content)
    .setAuthor({ name: data.author, iconURL: data.avatar })
    .setColor(0x5865F2);

  if (data.attachment) embed.setImage(data.attachment);

  await interaction.reply({ embeds: [embed] });
}
