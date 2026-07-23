const { signToken } = require('../_lib');

module.exports = async function handler(req, res) {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/');

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.redirect('/?error=token_failed');

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();
    if (!userData.id) return res.redirect('/?error=user_failed');

    const { ensureDB, db } = require('../_lib');
    await ensureDB();

    const allowed = await db.isAllowedUser(userData.id);
    if (!allowed) {
      return res.redirect('/?error=not_allowed');
    }

    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const guilds = await guildsRes.json();

    const avatarUrl = userData.avatar
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator || '0') % 5}.png`;

    const userObj = {
      id: userData.id, username: userData.username, discriminator: userData.discriminator,
      avatar: avatarUrl, guilds: guilds.filter(g => (g.permissions & 0x20) === 0x20),
    };

    const token = signToken(userObj);
    res.setHeader('Set-Cookie', `sb_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7*24*60*60}`);

    try {
      await db.upsertUser(userData.id, userData.username, avatarUrl, userData.discriminator, tokenData.access_token, tokenData.refresh_token);
      await db.addLog('login', userData.id, userData.username, 'Panel girişi yapıldı');
    } catch (dbErr) {
      console.error('DB error (non-blocking):', dbErr.message);
    }

    return res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth error:', err.message);
    return res.redirect('/?error=auth_failed');
  }
};
