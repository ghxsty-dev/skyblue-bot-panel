require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const db = require('./database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

let isReady = false;

client.once('ready', async () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║     🤖 SkyBlue Bot Giriş Yaptı       ║`);
  console.log(`  ║     ${client.user.tag}              ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);

  isReady = true;
  updateBotStatus();
  await deployCommands();
});

function updateBotStatus() {
  const status = db.getSetting('bot_status') || 'online';
  const activity = db.getSetting('bot_activity') || 'SkyBlue Panel';
  const activityType = db.getSetting('bot_activity_type') || 'playing';

  const activityTypes = { playing: 0, streaming: 1, listening: 2, watching: 3, competing: 5 };

  client.user.setPresence({
    status: status,
    activities: [{ name: activity, type: activityTypes[activityType] || 0 }],
  });
}

async function deployCommands() {
  const commands = await db.getAllCommands();
  const slashCommands = commands.map(cmd => {
    const builder = new SlashCommandBuilder()
      .setName(cmd.name)
      .setDescription(cmd.description || 'SkyBlue komutu');
    if (cmd.required_role) builder.setDefaultMemberPermissions(0);
    return builder.toJSON();
  });

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
    console.log(`  ✅ ${slashCommands.length} komut Discord'a deploy edildi.`);
  } catch (error) {
    console.error('  ❌ Komut deploy hatası:', error);
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = await db.getCommandByName(interaction.commandName);
  if (!command) return;

  if (!command.enabled) {
    return interaction.reply({ content: '❌ Bu komut şu anda devre dışı.', ephemeral: true });
  }

  if (command.required_role) {
    const hasRole = interaction.member.roles.cache.some(r => r.name === command.required_role);
    if (!hasRole) {
      return interaction.reply({
        content: `❌ Bu komutu kullanmak için **${command.required_role}** rolüne sahip olmalısınız.`,
        ephemeral: true
      });
    }
  }

  if (command.delete_command) {
    try { await interaction.deferReply(); } catch (e) {}
  }

  try {
    let replyContent;
    if (command.response_type === 'embed') {
      const embed = new EmbedBuilder()
        .setColor(command.embed_color || '#06b6d4')
        .setDescription(command.embed_description || command.response);
      if (command.embed_title) embed.setTitle(command.embed_title);
      if (command.embed_image) embed.setImage(command.embed_image);
      replyContent = { embeds: [embed] };
    } else {
      replyContent = { content: command.response || 'Komut yanıtı tanımlanmamış.' };
    }

    if (command.delete_command && interaction.deferred) {
      await interaction.editReply(replyContent);
    } else {
      await interaction.reply(replyContent);
    }

    await db.addLog('command_use', interaction.user.id, interaction.user.username, `/${command.name} kullanıldı - ${interaction.guild?.name || 'DM'}`);
  } catch (error) {
    console.error(`Komut hatası (${command.name}):`, error);
    const errorMsg = { content: '❌ Komut çalıştırılırken bir hata oluştu.', ephemeral: true };
    if (interaction.deferred) { await interaction.editReply(errorMsg); }
    else { await interaction.reply(errorMsg); }
  }
});

client.on('guildMemberAdd', async (member) => {
  const welcomeMsg = await db.getSetting('welcome_message');
  const welcomeChannelId = await db.getSetting('welcome_channel');
  const autoRole = await db.getSetting('auto_role');

  if (autoRole) {
    try {
      const role = member.guild.roles.cache.get(autoRole);
      if (role) await member.roles.add(role);
    } catch (e) {}
  }

  if (welcomeMsg && welcomeChannelId) {
    const channel = member.guild.channels.cache.get(welcomeChannelId);
    if (channel) {
      const msg = welcomeMsg.replace('{user}', `<@${member.id}>`).replace('{server}', member.guild.name);
      channel.send(msg);
    }
  }
});

client.on('guildMemberRemove', async (member) => {
  const goodbyeMsg = await db.getSetting('goodbye_message');
  const goodbyeChannelId = await db.getSetting('goodbye_channel');

  if (goodbyeMsg && goodbyeChannelId) {
    const channel = member.guild.channels.cache.get(goodbyeChannelId);
    if (channel) {
      const msg = goodbyeMsg.replace('{user}', member.user.tag).replace('{server}', member.guild.name);
      channel.send(msg);
    }
  }
});

setInterval(async () => {
  if (isReady) {
    await deployCommands();
    await updateBotStatus();
  }
}, 60000);

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('  ❌ Bot giriş hatası:', err.message);
});
