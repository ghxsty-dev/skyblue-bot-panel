const { db, initDB } = require('../lib/database');

let dbReady = false;

module.exports = async function handler(req, res) {
  if (!dbReady) {
    await initDB();
    dbReady = true;
  }

  res.json({ status: 'ok', message: 'SkyBlue Panel API' });
};
