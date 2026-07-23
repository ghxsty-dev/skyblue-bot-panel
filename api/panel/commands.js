const { db, initDB } = require('../../lib/database');
const { getUserFromReq } = require('../../lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (!dbReady) { await initDB(); dbReady = true; }

  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const commands = await db.getAllCommands();
  res.json({ commands });
};
