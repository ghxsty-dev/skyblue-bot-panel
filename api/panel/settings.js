const { ensureDB, getUserFromReq, db } = require('../_lib');

module.exports = async function handler(req, res) {
  await ensureDB();
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const settings = await db.getAllSettings();
    return res.json({ settings });
  }
  if (req.method === 'POST') {
    const fields = ['bot_status','bot_activity','bot_activity_type','welcome_message','goodbye_message','welcome_channel','goodbye_channel','log_channel','auto_role','bot_prefix'];
    for (const f of fields) { if (req.body[f] !== undefined) await db.updateSetting(f, req.body[f]); }
    await db.addLog('settings_update', user.id, user.username, 'Bot ayarları güncellendi');
    return res.json({ success: true });
  }
  res.status(405).json({ error: 'Method not allowed' });
};
