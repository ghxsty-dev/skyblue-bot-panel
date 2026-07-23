const { ensureDB, getUserFromReq, db } = require('../_lib');

const ADMIN_IDS = ['1336335753566748824'];

module.exports = async function handler(req, res) {
  await ensureDB();
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!ADMIN_IDS.includes(String(user.id))) return res.status(403).json({ error: 'Yetkiniz yok' });

  if (req.method === 'GET') {
    const users = await db.getAllowedUsers();
    return res.json({ users, adminIds: ADMIN_IDS });
  }

  if (req.method === 'POST') {
    const { id, username } = req.body;
    if (!id || !/^\d{17,20}$/.test(id)) return res.status(400).json({ error: 'Geçersiz Discord ID' });
    await db.addAllowedUser(id, username || '', user.username);
    await db.addLog('admin_action', user.id, user.username, `Erişim verildi: ${id} (${username || 'bilinmiyor'})`);
    return res.json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID gerekli' });
    if (ADMIN_IDS.includes(id)) return res.status(400).json({ error: 'Admin ID silinemez' });
    await db.removeAllowedUser(id);
    await db.addLog('admin_action', user.id, user.username, `Erişim kaldırıldı: ${id}`);
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
