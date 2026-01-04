const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
let TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TOKEN';
const LOGS_FILE = path.join(__dirname, '../data/logs.json');
const CRED_USER = 'vadmin';
const CRED_PASS = 'vadmin';
const sessions = new Set();

// Database setup
const dbPath = path.join(__dirname, '../data/database.db');
const db = new sqlite3.Database(dbPath);
db.run(`CREATE TABLE IF NOT EXISTS rules (id INTEGER PRIMARY KEY, data TEXT)`);
db.run(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT)`);

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Log webhook
function logWebhook(payload, matched, rules_count, telegram_results = []) {
  try {
    const logEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      payload,
      matched,
      total_rules: rules_count,
      telegram_results,
      status: matched > 0 ? 'matched' : 'no_match'
    };
    db.run('INSERT INTO logs (data) VALUES (?)', JSON.stringify(logEntry), (err) => {
      if (err) console.error('Log DB error:', err);
      // Keep only last 100 logs
      db.run('DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 100)', (err) => {
        if (err) console.error('Log cleanup error:', err);
      });
    });
  } catch (e) {
    console.error('Log error:', e.message);
  }
}

// AUTH CHECK
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && sessions.has(token)) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// ROUTES
app.post('/api/login', (req, res) => {
  if (req.body.username === CRED_USER && req.body.password === CRED_PASS) {
    const token = Date.now().toString();
    sessions.add(token);
    return res.json({ token, status: 'success' });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/logout', auth, (req, res) => {
  const token = req.headers.authorization.replace('Bearer ', '');
  sessions.delete(token);
  res.json({ status: 'ok' });
});

app.get('/api/auth-status', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  res.json({ authenticated: token && sessions.has(token) });
});

app.post('/api/bot-token', auth, (req, res) => {
  const newToken = req.body.botToken;
  if (!newToken || newToken === 'YOUR_TOKEN') {
    return res.status(400).json({ error: 'Invalid token' });
  }
  
  TELEGRAM_BOT_TOKEN = newToken;
  // Save to .env
  try {
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=.*/, `TELEGRAM_BOT_TOKEN=${newToken}`);
    fs.writeFileSync(envPath, envContent);
  } catch (error) {
    console.error('Error saving to .env:', error);
    // Continue anyway, since token is updated in memory
  }
  res.json({ status: 'ok' });
});

app.get('/api/bot-token', auth, (req, res) => {
  const masked = TELEGRAM_BOT_TOKEN.substring(0, 5) + '***';
  res.json({ botToken: masked, isSet: true });
});

app.post('/api/test-send', auth, async (req, res) => {
  const { chatId, message } = req.body;
  if (!chatId || !message) {
    return res.status(400).json({ error: 'chatId and message required' });
  }
  try {
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: message
    });
    res.json({ success: true, response: response.data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get('/api/rules', auth, (req, res) => {
  db.all('SELECT id, data FROM rules', (err, rows) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ error: 'DB error' });
    }
    res.json(rows.map(r => ({ ...JSON.parse(r.data), id: r.id })));
  });
});

app.post('/api/rules', auth, async (req, res) => {
  try {
    const { botToken, ...ruleData } = req.body;
    
    if (botToken && botToken.trim()) {
      const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
      if (!response.data.ok) {
        return res.status(400).json({ error: 'Invalid bot token' });
      }
    }
    
    const newRule = { id: Date.now(), ...ruleData, botToken: botToken || '', enabled: req.body.enabled !== false };
    db.run('INSERT INTO rules (id, data) VALUES (?, ?)', newRule.id, JSON.stringify(newRule), function(err) {
      if (err) {
        console.error('DB insert error:', err);
        return res.status(500).json({ error: 'DB error' });
      }
      res.json(newRule);
    });
  } catch (error) {
    console.error('Error in /api/rules POST:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/rules/:id', auth, async (req, res) => {
  try {
    db.get('SELECT data FROM rules WHERE id = ?', req.params.id, (err, row) => {
      if (err) {
        console.error('DB get error:', err);
        return res.status(500).json({ error: 'DB error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'not found' });
      }
      const existing = JSON.parse(row.data);
      const { botToken, ...ruleData } = req.body;
      
      if ('botToken' in req.body && botToken && botToken.trim()) {
        const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
        if (!response.data.ok) {
          return res.status(400).json({ error: 'Invalid bot token' });
        }
      }
      
      if ('botToken' in req.body) {
        ruleData.botToken = botToken;
      }
      
      const updated = { ...existing, ...ruleData };
      db.run('UPDATE rules SET data = ? WHERE id = ?', JSON.stringify(updated), req.params.id, (err) => {
        if (err) {
          console.error('DB update error:', err);
          return res.status(500).json({ error: 'DB error' });
        }
        res.json(updated);
      });
    });
  } catch (error) {
    console.error('Error in /api/rules PUT:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/rules/:id', auth, (req, res) => {
  db.run('DELETE FROM rules WHERE id = ?', req.params.id, (err) => {
    if (err) {
      console.error('DB delete error:', err);
      return res.status(500).json({ error: 'DB error' });
    }
    res.json({ status: 'ok' });
  });
});

app.post('/api/test-rule', auth, (req, res) => {
  try {
    const fn = new Function('payload', `return ${req.body.condition}`);
    const result = fn(req.body.payload);
    res.json({ result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/webhook', async (req, res) => {
  const rules = (() => { try { return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')); } catch { return []; } })();
  let matched = 0;
  let telegram_results = [];
  
  for (const rule of rules) {
    if (!rule.enabled) continue;
    try {
      const fn = new Function('payload', `return ${rule.condition}`);
      if (fn(req.body)) {
        matched++;
        const token = rule.botToken || TELEGRAM_BOT_TOKEN;
        if (token && token !== 'YOUR_TOKEN' && token !== 'ВАШ_ТОКЕН_ЗДЕСЬ') {
          try {
            const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
              chat_id: rule.chatId,
              text: JSON.stringify(req.body, null, 2)
            });
            telegram_results.push({
              chatId: rule.chatId,
              success: true,
              response: response.data
            });
          } catch (error) {
            telegram_results.push({
              chatId: rule.chatId,
              success: false,
              error: error.response ? error.response.data : error.message
            });
          }
        }
      }
    } catch (e) {
      console.error('Rule evaluation error:', e.message);
    }
  }
  
  const sent = telegram_results.filter(r => r.success).length;
  logWebhook(req.body, matched, rules.length, telegram_results);
  res.json({ matched, sent });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/webhook-logs', auth, (req, res) => {
  db.all('SELECT data FROM logs ORDER BY id DESC', (err, rows) => {
    if (err) {
      console.error('Logs DB error:', err);
      return res.status(500).json({ error: 'DB error' });
    }
    res.json(rows.map(r => JSON.parse(r.data)));
  });
});

app.delete('/api/webhook-logs', auth, (req, res) => {
  db.run('DELETE FROM logs', (err) => {
    if (err) {
      console.error('Logs delete error:', err);
      return res.status(500).json({ error: 'DB error' });
    }
    res.json({ status: 'ok' });
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Server on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
