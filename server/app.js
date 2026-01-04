const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
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
let db;
if (process.env.DATABASE_URL) {
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  (async () => {
    try {
      await client.connect();
      await client.query(`CREATE TABLE IF NOT EXISTS rules (id BIGINT PRIMARY KEY, data JSONB)`);
      await client.query(`CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, data JSONB)`);
      db = client;
      console.log('DB connected and tables created');
    } catch (err) {
      console.error('DB init error:', err);
      db = { rules: [], logs: [] }; // fallback
    }
  })();
} else {
  db = { rules: [], logs: [] };
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
    if (process.env.DATABASE_URL) {
      db.query('INSERT INTO logs (data) VALUES ($1)', [logEntry]).catch(err => console.error('Log DB error:', err));
      // Keep only last 100 logs
      db.query('DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 100)').catch(err => console.error('Log cleanup error:', err));
    } else {
      db.logs.unshift(logEntry);
      if (db.logs.length > 100) db.logs = db.logs.slice(0, 100);
    }
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
  // Note: In Railway, update TELEGRAM_BOT_TOKEN via dashboard env vars
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

app.get('/api/rules', auth, async (req, res) => {
  if (process.env.DATABASE_URL) {
    try {
      const result = await db.query('SELECT id, data FROM rules');
      res.json(result.rows.map(r => ({ ...r.data, id: r.id })));
    } catch (err) {
      console.error('DB error:', err);
      res.status(500).json({ error: 'DB error' });
    }
  } else {
    res.json(db.rules);
  }
});

app.post('/api/rules', auth, async (req, res) => {
  try {
    const { botToken, ...ruleData } = req.body;
    
    if (botToken && typeof botToken === 'string' && botToken.trim()) {
      const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
      if (!response.data.ok) {
        return res.status(400).json({ error: 'Invalid bot token' });
      }
    }
    
    const newRule = { id: Date.now(), ...ruleData, botToken: botToken || '', enabled: req.body.enabled !== false };
    if (process.env.DATABASE_URL) {
      await db.query('INSERT INTO rules (id, data) VALUES ($1, $2)', [newRule.id, newRule]);
      res.json(newRule);
    } else {
      db.rules.push(newRule);
      res.json(newRule);
    }
  } catch (error) {
    console.error('Error in /api/rules POST:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/rules/:id', auth, async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    if (process.env.DATABASE_URL) {
      const result = await db.query('SELECT data FROM rules WHERE id = $1', [ruleId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'not found' });
      }
      const existing = result.rows[0].data;
      const { botToken, ...ruleData } = req.body;
      
      if ('botToken' in req.body && botToken && typeof botToken === 'string' && botToken.trim()) {
        const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
        if (!response.data.ok) {
          return res.status(400).json({ error: 'Invalid bot token' });
        }
      }
      
      if ('botToken' in req.body) {
        ruleData.botToken = botToken;
      }
      
      const updated = { ...existing, ...ruleData };
      await db.query('UPDATE rules SET data = $1 WHERE id = $2', [updated, ruleId]);
      res.json(updated);
    } else {
      const idx = db.rules.findIndex(r => r.id == ruleId);
      if (idx >= 0) {
        const { botToken, ...ruleData } = req.body;
        
        if ('botToken' in req.body && botToken && typeof botToken === 'string' && botToken.trim()) {
          const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
          if (!response.data.ok) {
            return res.status(400).json({ error: 'Invalid bot token' });
          }
        }
        
        if ('botToken' in req.body) {
          ruleData.botToken = botToken;
        }
        
        db.rules[idx] = { ...db.rules[idx], ...ruleData };
        res.json(db.rules[idx]);
      } else {
        res.status(404).json({ error: 'not found' });
      }
    }
  } catch (error) {
    console.error('Error in /api/rules PUT:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/rules/:id', auth, async (req, res) => {
  const ruleId = parseInt(req.params.id);
  if (process.env.DATABASE_URL) {
    try {
      await db.query('DELETE FROM rules WHERE id = $1', [ruleId]);
      res.json({ status: 'ok' });
    } catch (err) {
      console.error('DB delete error:', err);
      res.status(500).json({ error: 'DB error' });
    }
  } else {
    db.rules = db.rules.filter(r => r.id != ruleId);
    res.json({ status: 'ok' });
  }
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

app.get('/api/webhook-logs', auth, async (req, res) => {
  if (process.env.DATABASE_URL) {
    try {
      const result = await db.query('SELECT data FROM logs ORDER BY id DESC');
      res.json(result.rows.map(r => r.data));
    } catch (err) {
      console.error('Logs DB error:', err);
      res.status(500).json({ error: 'DB error' });
    }
  } else {
    res.json(db.logs);
  }
});

app.delete('/api/webhook-logs', auth, async (req, res) => {
  if (process.env.DATABASE_URL) {
    try {
      await db.query('DELETE FROM logs');
      res.json({ status: 'ok' });
    } catch (err) {
      console.error('Logs delete error:', err);
      res.status(500).json({ error: 'DB error' });
    }
  } else {
    db.logs = [];
    res.json({ status: 'ok' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`✅ Server on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
