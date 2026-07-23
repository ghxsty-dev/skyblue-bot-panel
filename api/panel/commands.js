const { ensureDB, getUserFromReq, db } = require('../_lib');

module.exports = async function handler(req, res) {
  await ensureDB();
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const commands = await db.getAllCommands();
  res.json({ commands });
};
