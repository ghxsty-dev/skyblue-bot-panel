const { db, initDB } = require('../../lib/database');
const { getUserFromReq } = require('../../lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (!dbReady) { await initDB(); dbReady = true; }

  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const settings = await db.getAllSettings();
    return res.json({ settings });
  }

  if (req.method === 'POST') {
    const fields = [
      'bot_status', 'bot_activity', 'bot_activity_type',
      'welcome_message', 'goodbye_message', 'welcome_channel',
      'goodbye_channel', 'log_channel', 'auto_role', 'bot_prefix'
    ];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        await db.updateSetting(field, req.body[field]);
      }
    }
    await db.addLog('settings_update', user.id, user.username, 'Bot ayarları güncellendi');
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
