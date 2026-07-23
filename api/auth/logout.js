module.exports = async function handler(req, res) {
  res.setHeader('Set-Cookie', 'sb_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.redirect('/');
};
