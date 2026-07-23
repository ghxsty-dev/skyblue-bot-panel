const { ensureDB, getUserFromReq, db } = require('../_lib');

module.exports = async function handler(req, res) {
  await ensureDB();
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const stats = await db.getStats();
  const settings = await db.getAllSettings();
  const logs = await db.getLogs(10);
  res.json({ user, stats, settings, logs });
};
