const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDB() {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      avatar TEXT,
      discriminator TEXT,
      access_token TEXT,
      refresh_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      response TEXT DEFAULT '',
      response_type TEXT DEFAULT 'text',
      embed_title TEXT DEFAULT '',
      embed_description TEXT DEFAULT '',
      embed_color TEXT DEFAULT '#06b6d4',
      embed_image TEXT DEFAULT '',
      embed_footer TEXT DEFAULT '',
      buttons TEXT DEFAULT '[]',
      components TEXT DEFAULT '[]',
      enabled INTEGER DEFAULT 1,
      cooldown INTEGER DEFAULT 0,
      required_role TEXT DEFAULT '',
      delete_command INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS bot_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  ]);

  const defaults = [
    ['bot_status', 'online'],
    ['bot_activity', 'SkyBlue Panel'],
    ['bot_activity_type', 'playing'],
    ['welcome_message', 'Sunucuya hoş geldin {user}!'],
    ['goodbye_message', '{user} sunucudan ayrıldı.'],
    ['welcome_channel', ''],
    ['goodbye_channel', ''],
    ['log_channel', ''],
    ['auto_role', ''],
    ['bot_prefix', '!'],
  ];

  for (const [key, value] of defaults) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO bot_settings (key, value) VALUES (?, ?)',
      args: [key, value],
    });
  }
}

const db = {
  initDB,

  async getAllCommands() {
    const result = await client.execute('SELECT * FROM commands WHERE enabled = 1 ORDER BY name ASC');
    return result.rows;
  },

  async getCommandByName(name) {
    const result = await client.execute({ sql: 'SELECT * FROM commands WHERE name = ?', args: [name] });
    return result.rows[0] || null;
  },

  async getSetting(key) {
    const result = await client.execute({ sql: 'SELECT value FROM bot_settings WHERE key = ?', args: [key] });
    return result.rows[0]?.value || null;
  },

  async getAllSettings() {
    const result = await client.execute('SELECT * FROM bot_settings');
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    return settings;
  },

  async addLog(type, user_id, user_name, details) {
    await client.execute({
      sql: 'INSERT INTO logs (type, user_id, user_name, details) VALUES (?, ?, ?, ?)',
      args: [type, user_id, user_name, details],
    });
  },
};

module.exports = db;
