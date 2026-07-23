const { ensureDB, getUserFromReq, db } = require('../_lib');

module.exports = async function handler(req, res) {
  await ensureDB();
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const logs = await db.getLogs(100);
    return res.json({ logs });
  }
  if (req.method === 'DELETE') {
    await db.clearLogs();
    await db.addLog('logs_clear', user.id, user.username, 'Loglar temizlendi');
    return res.json({ success: true });
  }
  res.status(405).json({ error: 'Method not allowed' });
};
