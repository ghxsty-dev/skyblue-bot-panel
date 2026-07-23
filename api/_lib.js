const jwt = require('jsonwebtoken');
const { createClient } = require('@libsql/client');

const JWT_SECRET = process.env.JWT_SECRET || 'skyblue_jwt_secret_change_in_production';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function initDB() {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL, avatar TEXT, discriminator TEXT,
      access_token TEXT, refresh_token TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '', response TEXT DEFAULT '', response_type TEXT DEFAULT 'text',
      embed_title TEXT DEFAULT '', embed_description TEXT DEFAULT '', embed_color TEXT DEFAULT '#06b6d4',
      embed_image TEXT DEFAULT '', embed_footer TEXT DEFAULT '',
      buttons TEXT DEFAULT '[]',
      enabled INTEGER DEFAULT 1, cooldown INTEGER DEFAULT 0,
      required_role TEXT DEFAULT '', delete_command INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS bot_settings (
      key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
      user_id TEXT, user_name TEXT, details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  ]);

  try {
    await client.execute("ALTER TABLE commands ADD COLUMN buttons TEXT DEFAULT '[]'");
  } catch(e) {}
  try {
    await client.execute("ALTER TABLE commands ADD COLUMN embed_footer TEXT DEFAULT ''");
  } catch(e) {}

  const defaults = [
    ['bot_status', 'online'], ['bot_activity', 'SkyBlue Panel'],
    ['bot_activity_type', 'playing'], ['welcome_message', 'Sunucuya hoş geldin {user}!'],
    ['goodbye_message', '{user} sunucudan ayrıldı.'], ['welcome_channel', ''],
    ['goodbye_channel', ''], ['log_channel', ''], ['auto_role', ''], ['bot_prefix', '!'],
  ];
  for (const [key, value] of defaults) {
    await client.execute({ sql: 'INSERT OR IGNORE INTO bot_settings (key, value) VALUES (?, ?)', args: [key, value] });
  }
}

let dbReady = false;
async function ensureDB() { if (!dbReady) { await initDB(); dbReady = true; } }

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, avatar: user.avatar }, JWT_SECRET, { expiresIn: '7d' });
}

function getUserFromReq(req) {
  const header = req.headers?.cookie || '';
  const cookies = {};
  header.split(';').forEach(c => {
    const [key, ...val] = c.split('=');
    if (key) cookies[key.trim()] = decodeURIComponent(val.join('='));
  });
  if (!cookies.sb_token) return null;
  try { return jwt.verify(cookies.sb_token, JWT_SECRET); } catch { return null; }
}

const db = {
  async getUser(id) { return (await client.execute({ sql: 'SELECT * FROM users WHERE id=?', args: [id] })).rows[0] || null; },
  async upsertUser(id, username, avatar, discriminator, access_token, refresh_token) {
    await client.execute({ sql: `INSERT INTO users (id,username,avatar,discriminator,access_token,refresh_token) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,avatar=excluded.avatar,discriminator=excluded.discriminator,access_token=excluded.access_token,refresh_token=excluded.refresh_token`, args: [id,username,avatar,discriminator,access_token,refresh_token] });
  },
  async getAllCommands() { return (await client.execute('SELECT * FROM commands ORDER BY created_at DESC')).rows; },
  async getEnabledCommands() { return (await client.execute('SELECT * FROM commands WHERE enabled=1 ORDER BY name ASC')).rows; },
  async getCommand(id) { return (await client.execute({ sql: 'SELECT * FROM commands WHERE id=?', args: [id] })).rows[0] || null; },
  async getCommandByName(name) { return (await client.execute({ sql: 'SELECT * FROM commands WHERE name=?', args: [name] })).rows[0] || null; },
  async createCommand(d) { return await client.execute({ sql: 'INSERT INTO commands (name,description,response,response_type,embed_title,embed_description,embed_color,embed_image,embed_footer,buttons,enabled,cooldown,required_role,delete_command) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', args: [d.name,d.description,d.response,d.response_type,d.embed_title,d.embed_description,d.embed_color,d.embed_image,d.embed_footer||'',d.buttons||'[]',d.enabled,d.cooldown,d.required_role,d.delete_command] }); },
  async updateCommand(id, d) { await client.execute({ sql: 'UPDATE commands SET name=?,description=?,response=?,response_type=?,embed_title=?,embed_description=?,embed_color=?,embed_image=?,embed_footer=?,buttons=?,enabled=?,cooldown=?,required_role=?,delete_command=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', args: [d.name,d.description,d.response,d.response_type,d.embed_title,d.embed_description,d.embed_color,d.embed_image,d.embed_footer||'',d.buttons||'[]',d.enabled,d.cooldown,d.required_role,d.delete_command,id] }); },
  async deleteCommand(id) { await client.execute({ sql: 'DELETE FROM commands WHERE id=?', args: [id] }); },
  async getSetting(key) { const r = await client.execute({ sql: 'SELECT value FROM bot_settings WHERE key=?', args: [key] }); return r.rows[0]?.value || null; },
  async getAllSettings() { const r = await client.execute('SELECT * FROM bot_settings'); const s = {}; for (const row of r.rows) s[row.key] = row.value; return s; },
  async updateSetting(key, value) { await client.execute({ sql: 'INSERT INTO bot_settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP', args: [key,value] }); },
  async addLog(type, user_id, user_name, details) { await client.execute({ sql: 'INSERT INTO logs (type,user_id,user_name,details) VALUES (?,?,?,?)', args: [type,user_id,user_name,details] }); },
  async getLogs(limit=50) { return (await client.execute({ sql: 'SELECT * FROM logs ORDER BY created_at DESC LIMIT ?', args: [limit] })).rows; },
  async clearLogs() { await client.execute('DELETE FROM logs'); },
  async getStats() {
    const [t,e,u,l] = await Promise.all([client.execute('SELECT COUNT(*) as c FROM commands'),client.execute('SELECT COUNT(*) as c FROM commands WHERE enabled=1'),client.execute('SELECT COUNT(*) as c FROM users'),client.execute('SELECT COUNT(*) as c FROM logs')]);
    return { totalCommands: t.rows[0].c, enabledCommands: e.rows[0].c, totalUsers: u.rows[0].c, totalLogs: l.rows[0].c };
  },
};

module.exports = { ensureDB, signToken, getUserFromReq, db };
