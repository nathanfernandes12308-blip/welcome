const { SlashCommandBuilder } = require('discord.js');
const { getBalance, addBalance, setBalance } = require('../store');

// Track last daily claim in memory: { "guildId_userId": timestamp }
const lastDaily = new Map();
const DAILY_AMOUNT = 500;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const SLOT_SYMBOLS = ['🍒', '🍋', '🍇', '💀', '👑'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Gambling & currency commands')
    .addSubcommand(sub => sub.setName('balance').setDescription('Check your balance'))
    .addSubcommand(sub => sub.setName('daily').setDescription('Claim your daily coins'))
    .addSubcommand(sub =>
      sub.setName('coinflip')
        .setDescription('Bet coins on a coinflip')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true))
        .addStringOption(opt =>
          opt.setName('choice').setDescription('Heads or tails').setRequired(true)
            .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })
        )
    )
    .addSubcommand(sub =>
      sub.setName('slots')
        .setDescription('Spin the slot machine')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (sub === 'balance') {
      const balance = getBalance(guildId, userId);
      return interaction.reply({ content: `💰 You have **${balance}** coins.`, ephemeral: true });
    }

    if (sub === 'daily') {
      const key = `${guildId}_${userId}`;
      const last = lastDaily.get(key) || 0;
      const remaining = DAILY_COOLDOWN_MS - (Date.now() - last);
      if (remaining > 0) {
        const hours = Math.ceil(remaining / (60 * 60 * 1000));
        return interaction.reply({ content: `⏳ You already claimed today. Try again in ~${hours}h.`, ephemeral: true });
      }
      lastDaily.set(key, Date.now());
      const newBalance = addBalance(guildId, userId, DAILY_AMOUNT);
      return interaction.reply({ content: `✅ Claimed **${DAILY_AMOUNT}** coins! Balance: **${newBalance}**.` });
    }

    if (sub === 'coinflip') {
      const amount = interaction.options.getInteger('amount');
      const choice = interaction.options.getString('choice');
      const balance = getBalance(guildId, userId);

      if (amount <= 0) return interaction.reply({ content: '❌ Bet must be positive.', ephemeral: true });
      if (amount > balance) return interaction.reply({ content: `❌ You only have ${balance} coins.`, ephemeral: true });

      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = result === choice;
      const newBalance = addBalance(guildId, userId, won ? amount : -amount);

      return interaction.reply({
        content: `🪙 It landed on **${result}**! You ${won ? 'won' : 'lost'} **${amount}** coins. Balance: **${newBalance}**.`,
      });
    }

    if (sub === 'slots') {
      const amount = interaction.options.getInteger('amount');
      const balance = getBalance(guildId, userId);

      if (amount <= 0) return interaction.reply({ content: '❌ Bet must be positive.', ephemeral: true });
      if (amount > balance) return interaction.reply({ content: `❌ You only have ${balance} coins.`, ephemeral: true });

      const spin = [0, 0, 0].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
      const allMatch = spin[0] === spin[1] && spin[1] === spin[2];
      const twoMatch = spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2];

      let winnings = -amount;
      if (allMatch) winnings = amount * 5;
      else if (twoMatch) winnings = amount * 1.5;

      const newBalance = addBalance(guildId, userId, Math.round(winnings));

      return interaction.reply({
        content: `🎰 [ ${spin.join(' | ')} ]\n${winnings > 0 ? `You won **${Math.round(winnings)}** coins!` : `You lost **${amount}** coins.`} Balance: **${newBalance}**.`,
      });
    }
  },
};
