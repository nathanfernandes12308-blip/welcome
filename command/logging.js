const { EmbedBuilder } = require('discord.js');

const WELCOME_CHANNEL_ID = '1522660501304377495';
const LOGS_CHANNEL_ID = '1522660503825154149';

// Hosted GIF URL — replace this with your actual hosted GIF link after uploading to imgur/cdn
const WELCOME_GIF = 'https://tenor.com/lIInTBxrbk7.gif';

function registerEvents(client) {
  // ==================== WELCOME ====================
  client.on('guildMemberAdd', async (member) => {
    try {
      const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('⚔️ HEIAN VANGUARD')
        .setDescription(
          `Welcome to HEIAN VANGUARD.\n\n` +
          `Welcome, ${member}.\n\n` +
          `You have entered a realm where only the strongest rise. Earn your place through loyalty, skill, and determination. Stay active, fight alongside your division, and leave your mark on the Vanguard.\n` +
          `────────────────────\n` +
          `**Quick Start**\n` +
          `› Read the server rules.\n` +
          `› Complete verification.\n` +
          `› Claim your roles.\n` +
          `› Introduce yourself.\n` +
          `› Join events and giveaways.\n` +
          `› Contact staff if you need help.\n` +
          `────────────────────\n` +
          `Your journey begins here.`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setImage(WELCOME_GIF)
        .setColor(0x6A0DAD) // deep purple
        .setFooter({ text: `Member #${member.guild.memberCount} has entered HEIAN VANGUARD.` })
        .setTimestamp();

      await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
    } catch (err) {
      console.error('Failed to send welcome message:', err.message);
    }
  });

  // ==================== MESSAGE EDIT ====================
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    try {
      if (newMessage.author?.bot || !newMessage.guild) return;
      if (oldMessage.content === newMessage.content) return;

      const channel = await newMessage.guild.channels.fetch(LOGS_CHANNEL_ID);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('✏️ Message Edited')
        .addFields(
          { name: 'Author', value: `${newMessage.author.tag} (${newMessage.author.id})`, inline: true },
          { name: 'Channel', value: `${newMessage.channel}`, inline: true },
          { name: 'Before', value: oldMessage.content?.slice(0, 1024) || '*(empty)*' },
          { name: 'After', value: newMessage.content?.slice(0, 1024) || '*(empty)*' }
        )
        .setColor(0x6A0DAD)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to log message edit:', err.message);
    }
  });

  // ==================== MESSAGE DELETE ====================
  client.on('messageDelete', async (message) => {
    try {
      if (message.author?.bot || !message.guild) return;

      const channel = await message.guild.channels.fetch(LOGS_CHANNEL_ID);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Message Deleted')
        .addFields(
          { name: 'Author', value: `${message.author?.tag || 'Unknown'} (${message.author?.id || 'N/A'})`, inline: true },
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Content', value: message.content?.slice(0, 1024) || '*(no text)*' }
        )
        .setColor(0x6A0DAD)
        .setTimestamp();

      if (message.attachments.first()) {
        embed.addFields({ name: 'Attachment', value: message.attachments.first().url });
      }

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to log message delete:', err.message);
    }
  });
}

module.exports = { registerEvents };
