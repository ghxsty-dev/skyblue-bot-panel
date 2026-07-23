const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = {
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
