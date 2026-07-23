const { signToken, setAuthCookie } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  clearAuthCookie(res);
  res.redirect('/');
};

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', 'sb_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}
