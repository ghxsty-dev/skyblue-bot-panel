const { db, initDB } = require('../lib/database');
const { signToken, setAuthCookie } = require('../lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (!dbReady) { await initDB(); dbReady = true; }

  const { code } = req.query;
  if (!code) return res.redirect('/');

  try {
    const fetch = (await import('node-fetch')).default;

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) return res.redirect('/?error=token_failed');

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const guilds = await guildsRes.json();

    const avatarUrl = userData.avatar
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator || '0') % 5}.png`;

    const userObj = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: avatarUrl,
      guilds: guilds.filter(g => (g.permissions & 0x20) === 0x20),
    };

    const token = signToken(userObj);
    setAuthCookie(res, token);

    await db.upsertUser(userData.id, userData.username, avatarUrl, userData.discriminator, tokenData.access_token, tokenData.refresh_token);
    await db.addLog('login', userData.id, userData.username, 'Panel girişi yapıldı');

    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect('/?error=auth_failed');
  }
};
