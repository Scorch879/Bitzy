const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { google } = require('googleapis');
require('dotenv').config();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Google Sheets setup
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const auth = new google.auth.GoogleAuth({
  keyFile: 'service-account.json', // path to your Google Service Account JSON
  scopes: SCOPES,
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = '1fVXutF_IkloKyzT9AO_7F-68r6i55W6z7yEonYsQjlw';
const SHEET_NAME = 'Student_Data';

// New member joins
client.on('guildMemberAdd', async member => {
  try {
    const unverifiedRole = member.guild.roles.cache.find(r => r.name === 'Unverified');
    if (unverifiedRole) await member.roles.add(unverifiedRole);

    const verifyChannel = member.guild.channels.cache.find(ch => ch.name === 'verify');
    if (verifyChannel) {
      verifyChannel.send(`Welcome ${member}! Please type your Student ID here to get verified.`);
    }
  } catch (err) {
    console.error('Error assigning role or sending message:', err);
  }
});

// Track last attempt time per user to prevent spam
const userCooldown = new Map();

// Message listener for verification with auto-delete
client.on('messageCreate', async message => {
  if (message.author.bot) return; 
  if (message.channel.name !== 'verify') return; 

  const now = Date.now();
  const cooldown = 5000; // 5 seconds cooldown
  const lastAttempt = userCooldown.get(message.author.id) || 0;

  if (now - lastAttempt < cooldown) {
    await message.delete().catch(() => {});
    return; // ignore messages sent too quickly
  }
  userCooldown.set(message.author.id, now);

  const studentIDInput = message.content.trim();

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:D`,
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) {
      const replyMsg = await message.reply('⚠️ No student data found.');
      setTimeout(() => {
        replyMsg.delete().catch(() => {});
        message.delete().catch(() => {});
      }, 5000);
      return;
    }

    const student = rows.find(row => {
      const sheetID = String(row[0] || '').replace(/\u00A0/g, '').trim();
      const inputID = studentIDInput.replace(/\u00A0/g, '').trim();
      return sheetID === inputID;
    });

    if (!student) {
      const replyMsg = await message.reply('❌ Student ID not found. Please check your ID and try again.');
      setTimeout(() => {
        replyMsg.delete().catch(() => {});
        message.delete().catch(() => {});
      }, 5000);
      return;
    }

    // Assign roles
    const verifiedRole = message.guild.roles.cache.find(r => r.name === 'ka-CpE');
    const unverifiedRole = message.guild.roles.cache.find(r => r.name === 'Unverified');

    if (verifiedRole) await message.member.roles.add(verifiedRole);
    if (unverifiedRole) await message.member.roles.remove(unverifiedRole);

    const fullName = `${student[2]}`; 

    const replyMsg = await message.reply(`✅ Verified! Welcome, ${fullName}.`);
    setTimeout(() => {
      replyMsg.delete().catch(() => {});
      message.delete().catch(() => {});
    }, 5000); 

  } catch (err) {
    console.error('Verification error:', err);
    const replyMsg = await message.reply('⚠️ Verification system is temporarily unavailable.');
    setTimeout(() => {
      replyMsg.delete().catch(() => {});
      message.delete().catch(() => {});
    }, 5000); 
  }
});

// Login Discord bot
client.login(process.env.DISCORD_TOKEN);
