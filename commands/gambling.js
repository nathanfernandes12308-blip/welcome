const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const dbPath = './data/economy.db';
if (!fs.existsSync('./data')) fs.mkdirSync('./data');
const db = new sqlite3.Database(dbPath);

db.run(`CREATE TABLE IF NOT EXISTS economy (
  user_id TEXT PRIMARY KEY,
  username TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  last_daily INTEGER DEFAULT 0
)`);

// ====================== DB HELPERS ======================

function getUser(userId, username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM economy WHERE user_id = ?', [userId], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row);
      db.run('INSERT INTO economy (user_id, username) VALUES (?, ?)', [userId, username], (err2) => {
        if (err2) return reject(err2);
        resolve({ user_id: userId, username, xp: 0, level: 0, coins: 0, last_daily: 0 });
      });
    });
  });
}

function updateCoins(userId, coins) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE economy SET coins = ? WHERE user_id = ?', [coins, userId], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function validateBet(user, bet) {
  if (isNaN(bet) || bet < 1) return '❌ Bet must be at least 1 coin.';
  if (bet > user.coins) return `❌ You only have 💰 **${user.coins}** coins.`;
  return null;
}

function isAdminOrOwner(interaction) {
  return interaction.guild.ownerId === interaction.user.id ||
    interaction.member.permissions.has('Administrator');
}

// ====================== SLOTS ======================

const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎'];
const SLOT_PAYOUTS = { '💎': 10, '⭐': 5, '🍇': 3, '🍊': 2, '🍋': 1.5, '🍒': 1.2 };

function spinSlots() {
  return [0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
}

async function handleSlots(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = await getUser(interaction.user.id, interaction.user.tag);
  const err = validateBet(user, bet);
  if (err) return interaction.reply({ content: err, ephemeral: true });

  const reels = spinSlots();
  const display = reels.join(' | ');

  let multiplier = 0;
  let result = '';

  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    multiplier = SLOT_PAYOUTS[reels[0]] || 1;
    result = `🎉 JACKPOT! All three match! **${multiplier}x**`;
  } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    multiplier = 0.5;
    result = '✨ Two of a kind! **0.5x**';
  } else {
    result = '💀 No match. You lose.';
  }

  const won = Math.floor(bet * multiplier);
  const newCoins = multiplier > 0 ? user.coins - bet + won : user.coins - bet;
  await updateCoins(interaction.user.id, Math.max(0, newCoins));

  const embed = new EmbedBuilder()
    .setTitle('🎰 Slots')
    .setDescription(`[ ${display} ]\n\n${result}`)
    .addFields(
      { name: 'Bet', value: `💰 ${bet}`, inline: true },
      { name: multiplier > 0 ? 'Won' : 'Lost', value: `💰 ${multiplier > 0 ? won : bet}`, inline: true },
      { name: 'Balance', value: `💰 ${Math.max(0, newCoins)}`, inline: true }
    )
    .setColor(multiplier > 0 ? 0x00FF00 : 0xFF0000);

  await interaction.reply({ embeds: [embed] });
}

// ====================== COINFLIP ======================

async function handleCoinflip(interaction) {
  const bet = interaction.options.getInteger('bet');
  const choice = interaction.options.getString('choice');
  const user = await getUser(interaction.user.id, interaction.user.tag);
  const err = validateBet(user, bet);
  if (err) return interaction.reply({ content: err, ephemeral: true });

  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = result === choice;
  const newCoins = won ? user.coins + bet : user.coins - bet;
  await updateCoins(interaction.user.id, Math.max(0, newCoins));

  const embed = new EmbedBuilder()
    .setTitle(`🪙 Coinflip — ${result === 'heads' ? '🟡 Heads' : '⚪ Tails'}`)
    .setDescription(won ? `✅ You picked **${choice}** and won!` : `❌ You picked **${choice}** but it landed **${result}**.`)
    .addFields(
      { name: 'Bet', value: `💰 ${bet}`, inline: true },
      { name: won ? 'Won' : 'Lost', value: `💰 ${bet}`, inline: true },
      { name: 'Balance', value: `💰 ${Math.max(0, newCoins)}`, inline: true }
    )
    .setColor(won ? 0x00FF00 : 0xFF0000);

  await interaction.reply({ embeds: [embed] });
}

// ====================== DICE ======================

async function handleDice(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = await getUser(interaction.user.id, interaction.user.tag);
  const err = validateBet(user, bet);
  if (err) return interaction.reply({ content: err, ephemeral: true });

  const playerRoll = Math.floor(Math.random() * 6) + 1;
  const botRoll = Math.floor(Math.random() * 6) + 1;
  const DICE_EMOJI = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

  let result, newCoins;
  if (playerRoll > botRoll) {
    result = `✅ You win! **${playerRoll}** vs **${botRoll}**`;
    newCoins = user.coins + bet;
  } else if (botRoll > playerRoll) {
    result = `❌ You lose! **${playerRoll}** vs **${botRoll}**`;
    newCoins = user.coins - bet;
  } else {
    result = `🤝 Tie! **${playerRoll}** vs **${botRoll}** — bet returned`;
    newCoins = user.coins;
  }

  await updateCoins(interaction.user.id, Math.max(0, newCoins));

  const embed = new EmbedBuilder()
    .setTitle('🎲 Dice Roll')
    .setDescription(`You: ${DICE_EMOJI[playerRoll]}  vs  Bot: ${DICE_EMOJI[botRoll]}\n\n${result}`)
    .addFields(
      { name: 'Bet', value: `💰 ${bet}`, inline: true },
      { name: 'Balance', value: `💰 ${Math.max(0, newCoins)}`, inline: true }
    )
    .setColor(playerRoll > botRoll ? 0x00FF00 : playerRoll === botRoll ? 0xFFFF00 : 0xFF0000);

  await interaction.reply({ embeds: [embed] });
}

// ====================== BLACKJACK ======================

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (const suit of suits) for (const val of values) deck.push({ suit, val });
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(card) {
  if (['J', 'Q', 'K'].includes(card.val)) return 10;
  if (card.val === 'A') return 11;
  return parseInt(card.val);
}

function handTotal(hand) {
  let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter(c => c.val === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function handStr(hand, hideSecond = false) {
  return hand.map((c, i) => (hideSecond && i === 1) ? '🂠' : `${c.val}${c.suit}`).join('  ');
}

const bjGames = new Map();

async function handleBlackjack(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = await getUser(interaction.user.id, interaction.user.tag);
  const err = validateBet(user, bet);
  if (err) return interaction.reply({ content: err, ephemeral: true });

  if (bjGames.has(interaction.user.id)) {
    return interaction.reply({ content: '❌ You already have an active blackjack game. Finish it first.', ephemeral: true });
  }

  const deck = createDeck();
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];
  bjGames.set(interaction.user.id, { deck, playerHand, dealerHand, bet, userId: interaction.user.id });

  const playerTotal = handTotal(playerHand);

  if (playerTotal === 21) {
    bjGames.delete(interaction.user.id);
    const won = Math.floor(bet * 1.5);
    await updateCoins(interaction.user.id, user.coins + won);
    const embed = new EmbedBuilder()
      .setTitle('🃏 Blackjack — Natural Blackjack!')
      .setDescription(`🎉 Blackjack! You win **💰 ${won}**!`)
      .setColor(0x00FF00);
    return interaction.reply({ embeds: [embed] });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj_hit_${interaction.user.id}`).setLabel('Hit').setStyle(ButtonStyle.Primary).setEmoji('👊'),
    new ButtonBuilder().setCustomId(`bj_stand_${interaction.user.id}`).setLabel('Stand').setStyle(ButtonStyle.Secondary).setEmoji('✋')
  );

  const embed = new EmbedBuilder()
    .setTitle('🃏 Blackjack')
    .addFields(
      { name: `Your hand (${playerTotal})`, value: handStr(playerHand) },
      { name: 'Dealer hand', value: handStr(dealerHand, true) }
    )
    .setColor(0x5865F2)
    .setFooter({ text: `Bet: 💰 ${bet}` });

  await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleBlackjackButton(interaction) {
  const [, action, userId] = interaction.customId.split('_');
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ This is not your game.', ephemeral: true });
  }

  const game = bjGames.get(userId);
  if (!game) return interaction.reply({ content: '❌ No active game found.', ephemeral: true });

  const user = await getUser(userId, interaction.user.tag);

  if (action === 'hit') {
    game.playerHand.push(game.deck.pop());
    const total = handTotal(game.playerHand);

    if (total > 21) {
      bjGames.delete(userId);
      await updateCoins(userId, Math.max(0, user.coins - game.bet));
      const embed = new EmbedBuilder()
        .setTitle('🃏 Blackjack — Bust!')
        .addFields(
          { name: `Your hand (${total}) — BUST`, value: handStr(game.playerHand) },
          { name: `Dealer hand (${handTotal(game.dealerHand)})`, value: handStr(game.dealerHand) }
        )
        .setColor(0xFF0000)
        .setFooter({ text: `Lost 💰 ${game.bet}` });
      return interaction.update({ embeds: [embed], components: [] });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel('Hit').setStyle(ButtonStyle.Primary).setEmoji('👊'),
      new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel('Stand').setStyle(ButtonStyle.Secondary).setEmoji('✋')
    );

    const embed = new EmbedBuilder()
      .setTitle('🃏 Blackjack')
      .addFields(
        { name: `Your hand (${total})`, value: handStr(game.playerHand) },
        { name: 'Dealer hand', value: handStr(game.dealerHand, true) }
      )
      .setColor(0x5865F2)
      .setFooter({ text: `Bet: 💰 ${game.bet}` });

    return interaction.update({ embeds: [embed], components: [row] });
  }

  if (action === 'stand') {
    while (handTotal(game.dealerHand) < 17) game.dealerHand.push(game.deck.pop());

    const playerTotal = handTotal(game.playerHand);
    const dealerTotal = handTotal(game.dealerHand);
    bjGames.delete(userId);

    let result, newCoins, color;
    if (dealerTotal > 21 || playerTotal > dealerTotal) {
      result = `✅ You win! **${playerTotal}** vs **${dealerTotal}**`;
      newCoins = user.coins + game.bet;
      color = 0x00FF00;
    } else if (playerTotal === dealerTotal) {
      result = `🤝 Push! **${playerTotal}** vs **${dealerTotal}** — bet returned`;
      newCoins = user.coins;
      color = 0xFFFF00;
    } else {
      result = `❌ Dealer wins! **${playerTotal}** vs **${dealerTotal}**`;
      newCoins = user.coins - game.bet;
      color = 0xFF0000;
    }

    await updateCoins(userId, Math.max(0, newCoins));

    const embed = new EmbedBuilder()
      .setTitle('🃏 Blackjack — Result')
      .addFields(
        { name: `Your hand (${playerTotal})`, value: handStr(game.playerHand) },
        { name: `Dealer hand (${dealerTotal})`, value: handStr(game.dealerHand) }
      )
      .setDescription(result)
      .setColor(color)
      .setFooter({ text: `Balance: 💰 ${Math.max(0, newCoins)}` });

    return interaction.update({ embeds: [embed], components: [] });
  }
}

// ====================== CRASH ======================

const crashGames = new Map();

async function handleCrash(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = await getUser(interaction.user.id, interaction.user.tag);
  const err = validateBet(user, bet);
  if (err) return interaction.reply({ content: err, ephemeral: true });

  if (crashGames.has(interaction.user.id)) {
    return interaction.reply({ content: '❌ You already have an active crash game.', ephemeral: true });
  }

  await updateCoins(interaction.user.id, user.coins - bet);

  const crashAt = parseFloat((1 + Math.pow(Math.random(), 0.5) * 9).toFixed(2));
  let multiplier = 1.00;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`crash_cashout_${interaction.user.id}`).setLabel('Cash Out').setStyle(ButtonStyle.Success).setEmoji('💰')
  );

  const buildEmbed = (m, crashed = false, cashedOut = false) => new EmbedBuilder()
    .setTitle(crashed ? '💥 Crash!' : cashedOut ? '✅ Cashed Out!' : '📈 Crash — Rising...')
    .setDescription(crashed
      ? `The multiplier crashed at **${m}x**!\nYou lost 💰 **${bet}**`
      : cashedOut
        ? `You cashed out at **${m}x**!\nYou won 💰 **${Math.floor(bet * m)}**`
        : `Current multiplier: **${m}x**\nBet: 💰 ${bet}\n\nHit **Cash Out** before it crashes!`)
    .setColor(crashed ? 0xFF0000 : cashedOut ? 0x00FF00 : 0x5865F2);

  await interaction.reply({ embeds: [buildEmbed(multiplier)], components: [row] });

  const game = { bet, multiplier, crashAt, cashed: false, userId: interaction.user.id, interaction };
  crashGames.set(interaction.user.id, game);

  const interval = setInterval(async () => {
    const g = crashGames.get(interaction.user.id);
    if (!g || g.cashed) return clearInterval(interval);

    g.multiplier = parseFloat((g.multiplier + 0.10).toFixed(2));

    if (g.multiplier >= g.crashAt) {
      clearInterval(interval);
      crashGames.delete(interaction.user.id);
      try { await interaction.editReply({ embeds: [buildEmbed(g.multiplier, true)], components: [] }); } catch (_) {}
      return;
    }

    try {
      await interaction.editReply({ embeds: [buildEmbed(g.multiplier)], components: [row] });
    } catch (_) { clearInterval(interval); crashGames.delete(interaction.user.id); }
  }, 1500);

  game.interval = interval;
  crashGames.set(interaction.user.id, game);
}

async function handleCrashCashout(interaction) {
  const [, , userId] = interaction.customId.split('_');
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ This is not your game.', ephemeral: true });
  }

  const game = crashGames.get(userId);
  if (!game || game.cashed) return interaction.reply({ content: '❌ No active game or already cashed out.', ephemeral: true });

  game.cashed = true;
  clearInterval(game.interval);
  crashGames.delete(userId);

  const user = await getUser(userId, interaction.user.tag);
  const winnings = Math.floor(game.bet * game.multiplier);
  await updateCoins(userId, user.coins + winnings);

  const embed = new EmbedBuilder()
    .setTitle('✅ Cashed Out!')
    .setDescription(`You cashed out at **${game.multiplier}x**!\nYou won 💰 **${winnings}**`)
    .setColor(0x00FF00)
    .setFooter({ text: `Balance: 💰 ${user.coins + winnings}` });

  await interaction.update({ embeds: [embed], components: [] });
}

// ====================== HORSE RACE ======================

const HORSES = ['🐴', '🦄', '🏇', '🐎'];
const HORSE_NAMES = ['Shadow', 'Blaze', 'Storm', 'Thunder'];

async function handleHorserace(interaction) {
  const bet = interaction.options.getInteger('bet');
  const horseIndex = interaction.options.getInteger('horse') - 1;
  const user = await getUser(interaction.user.id, interaction.user.tag);
  const err = validateBet(user, bet);
  if (err) return interaction.reply({ content: err, ephemeral: true });

  if (horseIndex < 0 || horseIndex > 3) {
    return interaction.reply({ content: '❌ Pick a horse between 1 and 4.', ephemeral: true });
  }

  const positions = [0, 0, 0, 0];
  const speeds = HORSES.map(() => Math.random());

  const buildRaceEmbed = (finished = false, winner = null) => {
    const track = positions.map((pos, i) => {
      const bar = '▬'.repeat(pos) + HORSES[i] + '▬'.repeat(Math.max(0, 10 - pos));
      return `${HORSE_NAMES[i]}: [${bar}]`;
    }).join('\n');

    return new EmbedBuilder()
      .setTitle(finished ? `🏁 Race Over! ${HORSE_NAMES[winner]} wins!` : '🏇 Horse Race — Running...')
      .setDescription(track)
      .setColor(finished ? (winner === horseIndex ? 0x00FF00 : 0xFF0000) : 0x5865F2)
      .setFooter({ text: `You bet on ${HORSE_NAMES[horseIndex]} (${HORSES[horseIndex]}) | Bet: 💰 ${bet}` });
  };

  await interaction.reply({ embeds: [buildRaceEmbed()] });

  const raceInterval = setInterval(async () => {
    for (let i = 0; i < 4; i++) {
      if (positions[i] < 10) {
        positions[i] = Math.min(10, positions[i] + (Math.random() < speeds[i] ? 2 : 1));
      }
    }

    const winner = positions.findIndex(p => p >= 10);
    if (winner !== -1) {
      clearInterval(raceInterval);
      const won = winner === horseIndex;
      const payout = Math.floor(bet * 3.5);
      const newCoins = won ? user.coins + payout : user.coins - bet;
      await updateCoins(interaction.user.id, Math.max(0, newCoins));

      const finalEmbed = buildRaceEmbed(true, winner);
      finalEmbed.addFields(
        { name: won ? '✅ You won!' : '❌ You lost', value: won ? `+💰 ${payout}` : `-💰 ${bet}`, inline: true },
        { name: 'Balance', value: `💰 ${Math.max(0, newCoins)}`, inline: true }
      );

      try { await interaction.editReply({ embeds: [finalEmbed] }); } catch (_) {}
      return;
    }

    try { await interaction.editReply({ embeds: [buildRaceEmbed()] }); } catch (_) { clearInterval(raceInterval); }
  }, 1500);
}

// ====================== BALANCE ======================

async function handleBalance(interaction) {
  const target = interaction.options.getUser('target') || interaction.user;
  const user = await getUser(target.id, target.tag);

  const embed = new EmbedBuilder()
    .setTitle(`💰 ${target.username}'s Balance`)
    .setDescription(`**${user.coins}** coins`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
    .setColor(0xFFD700);

  await interaction.reply({ embeds: [embed] });
}

// ====================== ADMIN COIN COMMANDS ======================

async function handleAddCoins(interaction) {
  if (!isAdminOrOwner(interaction)) {
    return interaction.reply({ content: '❌ You need Administrator permission to use this command.', ephemeral: true });
  }

  const target = interaction.options.getUser('target');
  const amount = interaction.options.getInteger('amount');
  const user = await getUser(target.id, target.tag);
  const newCoins = user.coins + amount;
  await updateCoins(target.id, newCoins);

  const embed = new EmbedBuilder()
    .setTitle('✅ Coins Added')
    .addFields(
      { name: 'User', value: target.tag, inline: true },
      { name: 'Added', value: `💰 ${amount}`, inline: true },
      { name: 'New Balance', value: `💰 ${newCoins}`, inline: true }
    )
    .setColor(0x00FF00);

  await interaction.reply({ embeds: [embed] });
}

async function handleRemoveCoins(interaction) {
  if (!isAdminOrOwner(interaction)) {
    return interaction.reply({ content: '❌ You need Administrator permission to use this command.', ephemeral: true });
  }

  const target = interaction.options.getUser('target');
  const amount = interaction.options.getInteger('amount');
  const user = await getUser(target.id, target.tag);
  const newCoins = Math.max(0, user.coins - amount);
  await updateCoins(target.id, newCoins);

  const embed = new EmbedBuilder()
    .setTitle('✅ Coins Removed')
    .addFields(
      { name: 'User', value: target.tag, inline: true },
      { name: 'Removed', value: `💰 ${amount}`, inline: true },
      { name: 'New Balance', value: `💰 ${newCoins}`, inline: true }
    )
    .setColor(0xFF0000);

  await interaction.reply({ embeds: [embed] });
}

async function handleSetCoins(interaction) {
  if (!isAdminOrOwner(interaction)) {
    return interaction.reply({ content: '❌ You need Administrator permission to use this command.', ephemeral: true });
  }

  const target = interaction.options.getUser('target');
  const amount = interaction.options.getInteger('amount');
  await getUser(target.id, target.tag); // ensure user exists
  await updateCoins(target.id, amount);

  const embed = new EmbedBuilder()
    .setTitle('✅ Coins Set')
    .addFields(
      { name: 'User', value: target.tag, inline: true },
      { name: 'New Balance', value: `💰 ${amount}`, inline: true }
    )
    .setColor(0x5865F2);

  await interaction.reply({ embeds: [embed] });
}

// ====================== EXPORTS ======================

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('Gambling games and coin management')

    .addSubcommand(sub =>
      sub.setName('slots')
        .setDescription('Spin the slot machine')
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)))

    .addSubcommand(sub =>
      sub.setName('coinflip')
        .setDescription('Flip a coin — double or nothing')
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1))
        .addStringOption(opt => opt.setName('choice').setDescription('Heads or tails').setRequired(true)
          .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })))

    .addSubcommand(sub =>
      sub.setName('dice')
        .setDescription('Roll dice against the bot')
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)))

    .addSubcommand(sub =>
      sub.setName('blackjack')
        .setDescription('Play blackjack against the dealer')
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)))

    .addSubcommand(sub =>
      sub.setName('crash')
        .setDescription('Bet on a rising multiplier — cash out before it crashes')
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)))

    .addSubcommand(sub =>
      sub.setName('horserace')
        .setDescription('Bet on a horse race')
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1))
        .addIntegerOption(opt => opt.setName('horse').setDescription('Horse to bet on (1-4)').setRequired(true)
          .addChoices(
            { name: '1 - Shadow 🐴', value: 1 },
            { name: '2 - Blaze 🦄', value: 2 },
            { name: '3 - Storm 🏇', value: 3 },
            { name: '4 - Thunder 🐎', value: 4 }
          )))

    .addSubcommand(sub =>
      sub.setName('balance')
        .setDescription('Check your or another user\'s coin balance')
        .addUserOption(opt => opt.setName('target').setDescription('User to check (leave empty for yourself)')))

    .addSubcommand(sub =>
      sub.setName('addcoins')
        .setDescription('Add coins to a user (Admin/Owner only)')
        .addUserOption(opt => opt.setName('target').setDescription('User to give coins to').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to add (1-100,000)').setRequired(true).setMinValue(1).setMaxValue(100000)))

    .addSubcommand(sub =>
      sub.setName('removecoins')
        .setDescription('Remove coins from a user (Admin/Owner only)')
        .addUserOption(opt => opt.setName('target').setDescription('User to remove coins from').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to remove (1-100,000)').setRequired(true).setMinValue(1).setMaxValue(100000)))

    .addSubcommand(sub =>
      sub.setName('setcoins')
        .setDescription('Set a user\'s coins to an exact amount (Admin/Owner only)')
        .addUserOption(opt => opt.setName('target').setDescription('User to set coins for').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to set (0-100,000)').setRequired(true).setMinValue(0).setMaxValue(100000))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try {
      switch (sub) {
        case 'slots':       return handleSlots(interaction);
        case 'coinflip':    return handleCoinflip(interaction);
        case 'dice':        return handleDice(interaction);
        case 'blackjack':   return handleBlackjack(interaction);
        case 'crash':       return handleCrash(interaction);
        case 'horserace':   return handleHorserace(interaction);
        case 'balance':     return handleBalance(interaction);
        case 'addcoins':    return handleAddCoins(interaction);
        case 'removecoins': return handleRemoveCoins(interaction);
        case 'setcoins':    return handleSetCoins(interaction);
      }
    } catch (error) {
      console.error('Gamble error:', error);
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true });
    }
  },

  async handleButton(interaction) {
    if (interaction.customId.startsWith('bj_')) return handleBlackjackButton(interaction);
    if (interaction.customId.startsWith('crash_cashout_')) return handleCrashCashout(interaction);
  }
};
