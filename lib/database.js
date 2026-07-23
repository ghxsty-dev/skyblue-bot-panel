const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
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
  async getUser(id) {
    const result = await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
    return result.rows[0] || null;
  },

  async upsertUser(id, username, avatar, discriminator, access_token, refresh_token) {
    await client.execute({
      sql: `INSERT INTO users (id, username, avatar, discriminator, access_token, refresh_token)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              username = excluded.username, avatar = excluded.avatar,
              discriminator = excluded.discriminator, access_token = excluded.access_token,
              refresh_token = excluded.refresh_token`,
      args: [id, username, avatar, discriminator, access_token, refresh_token],
    });
  },

  async getAllCommands() {
    const result = await client.execute('SELECT * FROM commands ORDER BY created_at DESC');
    return result.rows;
  },

  async getEnabledCommands() {
    const result = await client.execute('SELECT * FROM commands WHERE enabled = 1 ORDER BY name ASC');
    return result.rows;
  },

  async getCommand(id) {
    const result = await client.execute({ sql: 'SELECT * FROM commands WHERE id = ?', args: [id] });
    return result.rows[0] || null;
  },

  async getCommandByName(name) {
    const result = await client.execute({ sql: 'SELECT * FROM commands WHERE name = ?', args: [name] });
    return result.rows[0] || null;
  },

  async createCommand(data) {
    const result = await client.execute({
      sql: `INSERT INTO commands (name, description, response, response_type, embed_title, embed_description, embed_color, embed_image, enabled, cooldown, required_role, delete_command)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.name, data.description, data.response, data.response_type,
        data.embed_title, data.embed_description, data.embed_color, data.embed_image,
        data.enabled, data.cooldown, data.required_role, data.delete_command,
      ],
    });
    return result;
  },

  async updateCommand(id, data) {
    await client.execute({
      sql: `UPDATE commands SET
              name = ?, description = ?, response = ?, response_type = ?,
              embed_title = ?, embed_description = ?, embed_color = ?, embed_image = ?,
              enabled = ?, cooldown = ?, required_role = ?, delete_command = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [
        data.name, data.description, data.response, data.response_type,
        data.embed_title, data.embed_description, data.embed_color, data.embed_image,
        data.enabled, data.cooldown, data.required_role, data.delete_command, id,
      ],
    });
  },

  async deleteCommand(id) {
    await client.execute({ sql: 'DELETE FROM commands WHERE id = ?', args: [id] });
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

  async updateSetting(key, value) {
    await client.execute({
      sql: `INSERT INTO bot_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      args: [key, value],
    });
  },

  async addLog(type, user_id, user_name, details) {
    await client.execute({
      sql: 'INSERT INTO logs (type, user_id, user_name, details) VALUES (?, ?, ?, ?)',
      args: [type, user_id, user_name, details],
    });
  },

  async getLogs(limit = 50) {
    const result = await client.execute({
      sql: 'SELECT * FROM logs ORDER BY created_at DESC LIMIT ?',
      args: [limit],
    });
    return result.rows;
  },

  async clearLogs() {
    await client.execute('DELETE FROM logs');
  },

  async getStats() {
    const [total, enabled, users, logs] = await Promise.all([
      client.execute('SELECT COUNT(*) as count FROM commands'),
      client.execute('SELECT COUNT(*) as count FROM commands WHERE enabled = 1'),
      client.execute('SELECT COUNT(*) as count FROM users'),
      client.execute('SELECT COUNT(*) as count FROM logs'),
    ]);
    return {
      totalCommands: total.rows[0].count,
      enabledCommands: enabled.rows[0].count,
      totalUsers: users.rows[0].count,
      totalLogs: logs.rows[0].count,
    };
  },
};

module.exports = { client, db, initDB };
