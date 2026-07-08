// events.js
// Registers the bot's non-command event handlers: welcome/leave messages and
// message edit/delete logging. `ready` is handled directly in index.js, so
// it's not duplicated here.
//
// >>> REPLACE THESE PLACEHOLDER IDS WITH YOUR ACTUAL CHANNEL IDs <<<
const WELCOME_CHANNEL_ID = 'PUT_WELCOME_CHANNEL_ID_HERE';
const LEAVE_CHANNEL_ID = 'PUT_LEAVE_CHANNEL_ID_HERE';
const LOGS_CHANNEL_ID = 'PUT_LOGS_CHANNEL_ID_HERE';

const { EmbedBuilder } = require('discord.js');

const SUKUNA_RED = 0x8b0000;

function registerEvents(client) {
  // ==================== WELCOME ====================
  client.on('guildMemberAdd', async (member) => {
    try {
      const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('A new vessel has entered the Culling Game')
        .setDescription(
          `${member}, you have stepped into a domain ruled by the King of Curses.\n\n` +
          `Show strength, or be consumed.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━`
        )
        .addFields({
          name: '📜 Quick Start',
          value:
            '› Read the rules.\n' +
            '› Complete verification.\n' +
            '› Introduce yourself.\n' +
            '› Check the announcements.',
        })
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setColor(SUKUNA_RED)
        .setFooter({ text: `Member #${member.guild.memberCount}` })
        .setTimestamp();

      await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
    } catch (err) {
      console.error('Failed to send welcome message:', err.message);
    }
  });

  // ==================== LEAVE ====================
  client.on('guildMemberRemove', async (member) => {
    try {
      const channel = await member.guild.channels.fetch(LEAVE_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('A vessel has fallen')
        .setDescription(`**${member.user.tag}** has left the domain.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setColor(SUKUNA_RED)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send leave message:', err.message);
    }
  });

  // ==================== MESSAGE EDIT ====================
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    try {
      if (newMessage.author?.bot || !newMessage.guild) return;
      if (oldMessage.content === newMessage.content) return;

      const channel = await newMessage.guild.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('✏️ Message Edited')
        .addFields(
          { name: 'Author', value: `${newMessage.author.tag} (${newMessage.author.id})`, inline: true },
          { name: 'Channel', value: `${newMessage.channel}`, inline: true },
          { name: 'Before', value: oldMessage.content?.slice(0, 1024) || '*(empty)*' },
          { name: 'After', value: newMessage.content?.slice(0, 1024) || '*(empty)*' }
        )
        .setColor(SUKUNA_RED)
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

      const channel = await message.guild.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Message Deleted')
        .addFields(
          { name: 'Author', value: `${message.author?.tag || 'Unknown'} (${message.author?.id || 'N/A'})`, inline: true },
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Content', value: message.content?.slice(0, 1024) || '*(no text)*' }
        )
        .setColor(SUKUNA_RED)
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
