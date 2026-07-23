const { db, initDB } = require('../../lib/database');
const { getUserFromReq } = require('../../lib/auth');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (!dbReady) { await initDB(); dbReady = true; }

  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { id } = req.query;
    if (id) {
      const command = await db.getCommand(id);
      return res.json({ command });
    }
    const commands = await db.getAllCommands();
    return res.json({ commands });
  }

  if (req.method === 'POST') {
    if (req.body.toggle_id) {
      const cmd = await db.getCommand(req.body.toggle_id);
      if (cmd) {
        await db.updateCommand(req.body.toggle_id, { ...cmd, enabled: cmd.enabled ? 0 : 1 });
      }
      return res.json({ success: true });
    }

    const data = {
      name: (req.body.name || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase(),
      description: req.body.description || '',
      response: req.body.response || '',
      response_type: req.body.response_type || 'text',
      embed_title: req.body.embed_title || '',
      embed_description: req.body.embed_description || '',
      embed_color: req.body.embed_color || '#06b6d4',
      embed_image: req.body.embed_image || '',
      enabled: req.body.enabled ? 1 : 0,
      cooldown: parseInt(req.body.cooldown) || 0,
      required_role: req.body.required_role || '',
      delete_command: req.body.delete_command ? 1 : 0,
    };

    if (!data.name) return res.status(400).json({ error: 'Komut adı gerekli' });

    if (req.body.id) {
      await db.updateCommand(req.body.id, data);
      await db.addLog('command_update', user.id, user.username, `Komut güncellendi: /${data.name}`);
      return res.json({ success: true, id: req.body.id });
    } else {
      try {
        await db.createCommand(data);
        await db.addLog('command_create', user.id, user.username, `Yeni komut: /${data.name}`);
        return res.json({ success: true });
      } catch (e) {
        return res.status(400).json({ error: 'Bu isimde bir komut zaten var!' });
      }
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    const command = await db.getCommand(id);
    if (command) {
      await db.deleteCommand(id);
      await db.addLog('command_delete', user.id, user.username, `Komut silindi: /${command.name}`);
    }
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
