const { EmbedBuilder } = require('discord.js');

const WELCOME_CHANNEL_ID = '1522660501304377495';
const LEAVE_CHANNEL_ID = '1522848666082218108';
const LOGS_CHANNEL_ID = '1522660504701763635';

// Hosted GIF URL — replace this with your actual hosted GIF link after uploading to imgur/cdn
const WELCOME_GIF = 'https://tenor.com/view/jujutsu-kaisen-shibuya-arc-sukuna-domain-expansion-sukuna-fukuma-mizushi-gif-9700025892794569971';

function registerEvents(client) {
  // ==================== WELCOME ====================
  client.on('guildMemberAdd', async (member) => {
    try {
      const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('⚔️ Infernal Sovereign┃龍黑影')
        .setDescription(
          ` Welcome to INFERNAL SOVEREIGN, ${member}.\n\n` +
          `You have entered a realm forged in shadow and absolute power.\n` +
          `Here, the weak are forgotten and the strong ascend.\n` +
          `Aizen sees all. Doubt is a luxury you cannot afford.\n` +
          `Bow to no one — except the one who stands above all.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━`
        )
        .addFields(
          {
            name: '📜 Quick Start',
            value:
              '› › Read the server rules.\n' +
              '› › Complete verification\n' +
              '› › Claim your roles.\n' +
              '› › Introduce yourself.\n' +
              '› › Contact staff if you need assistance.'
          }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setImage(WELCOME_GIF)
        .setColor(0x6A0DAD) // deep purple
        .setFooter({ text: `Member #${member.guild.memberCount} has entered INFERNAL SOVEREIGN.` })
        .setTimestamp();

      await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
    } catch (err) {
      console.error('Failed to send welcome message:', err.message);
    }
  });

  // ==================== LEAVE ====================
  client.on('guildMemberRemove', async (member) => {
    try {
      const channel = await member.guild.channels.fetch(LEAVE_CHANNEL_ID);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('🌑 A soul has fled HOGYOKU VANGUARD ')
        .setDescription(`**${member.user.tag}** has abandoned the dominion.\n*The weak were never meant to stay.*`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setColor(0x6A0DAD)
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
