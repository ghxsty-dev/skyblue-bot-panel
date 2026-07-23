require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, MediaGalleryBuilder, SeparatorBuilder, ThumbnailBuilder } = require('discord.js');
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
  await updateBotStatus();
  await deployCommands();
});

async function updateBotStatus() {
  const status = (await db.getSetting('bot_status')) || 'online';
  const activity = (await db.getSetting('bot_activity')) || 'SkyBlue Panel';
  const activityType = (await db.getSetting('bot_activity_type')) || 'playing';
  const activityTypes = { playing: 0, streaming: 1, listening: 2, watching: 3, competing: 5 };
  client.user.setPresence({
    status: status,
    activities: [{ name: activity, type: activityTypes[activityType] || 0 }],
  });
}

function buildButtons(buttonsJson, commandName) {
  try {
    const buttons = JSON.parse(buttonsJson || '[]');
    if (!buttons.length) return [];
    const styleMap = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger, link: ButtonStyle.Link };
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      const row = new ActionRowBuilder();
      buttons.slice(i, i + 5).forEach((b, idx) => {
        const btn = new ButtonBuilder().setStyle(styleMap[b.style] || ButtonStyle.Primary);
        if (b.label) btn.setLabel(b.label);
        if (b.emoji) btn.setEmoji(b.emoji);
        if (b.style === 'link') {
          btn.setURL(b.url || 'https://placeholder.com');
        } else {
          btn.setCustomId(`cmd_${commandName}_${i + idx}`);
        }
        row.addComponents(btn);
      });
      rows.push(row);
    }
    return rows;
  } catch (e) { return []; }
}

function buildComponentsV2(componentsJson) {
  try {
    const components = JSON.parse(componentsJson || '[]');
    if (!components.length) return [];

    const built = [];
    for (const comp of components) {
      switch (comp.type) {
        case 'container': {
          const container = new ContainerBuilder();
          if (comp.color) container.setColor(comp.color);
          if (comp.accent_color) container.setAccentColor(comp.accent_color);
          if (comp.spoiler) container.setSpoiler(comp.spoiler);
          if (comp.components) {
            for (const child of comp.components) {
              const builtChild = buildComponent(child);
              if (builtChild) container.addComponents(builtChild);
            }
          }
          built.push(container);
          break;
        }
        case 'section': {
          const builtComp = buildComponent(comp);
          if (builtComp) built.push(builtComp);
          break;
        }
        case 'text': {
          const builtComp = buildComponent(comp);
          if (builtComp) built.push(builtComp);
          break;
        }
        case 'media_gallery': {
          const builtComp = buildComponent(comp);
          if (builtComp) built.push(builtComp);
          break;
        }
        case 'separator': {
          const builtComp = buildComponent(comp);
          if (builtComp) built.push(builtComp);
          break;
        }
      }
    }
    return built;
  } catch (e) {
    console.error('Components v2 build hatası:', e);
    return [];
  }
}

function buildComponent(comp) {
  switch (comp.type) {
    case 'section': {
      const section = new SectionBuilder();
      if (comp.text) section.addTextDisplayComponents(new TextDisplayBuilder().setContent(comp.text));
      if (comp.thumbnail) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(comp.thumbnail));
      if (comp.button) {
        const styleMap = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger, link: ButtonStyle.Link };
        const btn = new ButtonBuilder().setStyle(styleMap[comp.button.style] || ButtonStyle.Primary);
        if (comp.button.label) btn.setLabel(comp.button.label);
        if (comp.button.emoji) btn.setEmoji(comp.button.emoji);
        if (comp.button.style === 'link') btn.setURL(comp.button.url || 'https://placeholder.com');
        else btn.setCustomId(comp.button.custom_id || 'section_btn');
        section.addButtonComponents(btn);
      }
      return section;
    }
    case 'text':
      return new TextDisplayBuilder().setContent(comp.content || '');
    case 'media_gallery': {
      const gallery = new MediaGalleryBuilder();
      if (comp.items) {
        for (const item of comp.items) {
          const media = {};
          if (item.url) media.url = item.url;
          if (item.spoiler) media.spoiler = true;
          gallery.addItems(media);
        }
      }
      return gallery;
    }
    case 'separator': {
      const sep = new SeparatorBuilder();
      if (comp.spacing) sep.setSpacing(comp.spacing);
      if (comp.divider === false) sep.setDivider(false);
      return sep;
    }
    case 'container': {
      const container = new ContainerBuilder();
      if (comp.color) container.setColor(comp.color);
      if (comp.accent_color) container.setAccentColor(comp.accent_color);
      if (comp.components) {
        for (const child of comp.components) {
          const builtChild = buildComponent(child);
          if (builtChild) container.addComponents(builtChild);
        }
      }
      return container;
    }
    default:
      return null;
  }
}

function buildReplyContent(command) {
  const componentsV2 = buildComponentsV2(command.components);
  const buttonRows = buildButtons(command.buttons, command.name);

  if (componentsV2.length > 0) {
    const result = { components: componentsV2 };
    if (buttonRows.length) {
      for (const row of buttonRows) {
        result.components.push(row);
      }
    }
    return result;
  }

  if (command.response_type === 'embed') {
    const embed = new EmbedBuilder()
      .setColor(command.embed_color || '#06b6d4')
      .setDescription(command.embed_description || command.response);
    if (command.embed_title) embed.setTitle(command.embed_title);
    if (command.embed_image) embed.setImage(command.embed_image);
    if (command.embed_footer) embed.setFooter({ text: command.embed_footer });
    const result = { embeds: [embed] };
    if (buttonRows.length) result.components = buttonRows;
    return result;
  }

  const result = { content: command.response || 'Komut yanıtı tanımlanmamış.' };
  if (buttonRows.length) result.components = buttonRows;
  return result;
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
  if (interaction.isButton()) {
    const parts = interaction.customId.split('_');
    if (parts[0] === 'cmd') {
      const cmdName = parts[1];
      const btnIdx = parseInt(parts[2]);
      const command = await db.getCommandByName(cmdName);
      if (!command) return;
      try {
        const buttons = JSON.parse(command.buttons || '[]');
        const btn = buttons[btnIdx];
        if (!btn || btn.style === 'link') return;
        if (btn.action_type === 'embed_reply') {
          const embed = new EmbedBuilder().setColor(command.embed_color || '#06b6d4').setDescription(btn.action_content || 'Buton yanıtı');
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        return interaction.reply({ content: btn.action_content || 'Butona basıldı!', ephemeral: true });
      } catch (e) {
        return interaction.reply({ content: '❌ Bir hata oluştu.', ephemeral: true });
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = await db.getCommandByName(interaction.commandName);
  if (!command) return;

  if (!command.enabled) {
    return interaction.reply({ content: '❌ Bu komut şu anda devre dışı.', ephemeral: true });
  }

  if (command.required_role) {
    const hasRole = interaction.member.roles.cache.some(r => r.name === command.required_role);
    if (!hasRole) {
      return interaction.reply({ content: `❌ Bu komutu kullanmak için **${command.required_role}** rolüne sahip olmalısınız.`, ephemeral: true });
    }
  }

  if (command.delete_command) {
    try { await interaction.deferReply(); } catch (e) {}
  }

  try {
    const replyContent = buildReplyContent(command);

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

(async () => {
  await db.initDB();
  console.log('  ✅ Veritabanı tabloları hazır.');
  client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.error('  ❌ Bot giriş hatası:', err.message);
  });
})();
