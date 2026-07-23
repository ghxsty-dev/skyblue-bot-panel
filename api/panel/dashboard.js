const { db, initDB } = require('../../lib/database');
const { getUserFromReq } = require('../../lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (!dbReady) { await initDB(); dbReady = true; }

  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const stats = await db.getStats();
  const settings = await db.getAllSettings();
  const logs = await db.getLogs(10);

  res.json({ user, stats, settings, logs });
};
