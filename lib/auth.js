const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'skyblue_jwt_secret_change_in_production';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, avatar: user.avatar },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function setAuthCookie(res, token) {
  const cookie = `sb_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
  res.setHeader('Set-Cookie', cookie);
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', 'sb_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}

function getUserFromReq(req) {
  const cookies = parseCookies(req);
  if (!cookies.sb_token) return null;
  return verifyToken(cookies.sb_token);
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const cookies = {};
  header.split(';').forEach(c => {
    const [key, ...val] = c.split('=');
    if (key) cookies[key.trim()] = decodeURIComponent(val.join('='));
  });
  return cookies;
}

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie, getUserFromReq, parseCookies, JWT_SECRET };
