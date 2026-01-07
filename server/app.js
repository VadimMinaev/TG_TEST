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
let db = { rules: [], logs: [] }; // Default to in-memory
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
      // Keep in-memory fallback
    }
  })();
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
      let rules = result.rows.map(r => ({ ...r.data, id: r.id }));
      rules = rules.map(r => ({ ...r, botToken: typeof r.botToken === 'string' ? r.botToken : '' }));
      res.json(rules);
    } catch (err) {
      console.error('DB error:', err);
      res.status(500).json({ error: 'DB error' });
    }
  } else {
    let rules = db.rules;
    rules = rules.map(r => ({ ...r, botToken: typeof r.botToken === 'string' ? r.botToken : '' }));
    res.json(rules);
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
    
    const newRule = { id: Date.now(), ...ruleData, botToken: (typeof botToken === 'string' ? botToken : '') || '', enabled: req.body.enabled !== false };
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
        ruleData.botToken = (typeof botToken === 'string' ? botToken : '') || '';
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
  try {
    const ruleId = parseInt(req.params.id);
    if (process.env.DATABASE_URL) {
      const result = await db.query('DELETE FROM rules WHERE id = $1', [ruleId]);
      if (result.rowCount > 0) {
        res.json({ status: 'deleted' });
      } else {
        res.status(404).json({ error: 'Rule not found' });
      }
    } else {
      const idx = db.rules.findIndex(r => r.id == ruleId);
      if (idx >= 0) {
        db.rules.splice(idx, 1);
        res.json({ status: 'deleted' });
      } else {
        res.status(404).json({ error: 'Rule not found' });
      }
    }
  } catch (error) {
    console.error('Error in /api/rules DELETE:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/webhook', async (req, res) => {
  // Handle webhook verification
  if (req.body.event === 'webhook.verify') {
    const callbackUrl = req.body.payload?.callback;
    if (callbackUrl) {
      try {
        await axios.get(callbackUrl);
        console.log('Webhook verified successfully');
      } catch (error) {
        console.error('Webhook verification failed:', error.message);
      }
    }
    res.json({ verified: true });
    return;
  }

  // Determine the actual payload passed to rule conditions
  const incomingPayload = req.body && typeof req.body === 'object' ? (req.body.payload ?? req.body) : req.body;

  // Load rules
  let rules = [];
  if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
    try {
      const result = await db.query('SELECT data FROM rules');
      rules = result.rows.map(r => r.data);
    } catch (err) {
      console.error('DB error in webhook:', err);
      rules = [];
    }
  } else {
    rules = db.rules;
  }

  let matched = 0;
  let telegram_results = [];

  const formatMessage = (fullBody, payload, rule) => {
    try {
      let messageParts = [];

      // Add subject if present
      if (payload.subject) {
        messageParts.push(`📋 Subject: ${payload.subject}`);
      }

      // Add requested by if present
      if (payload.requested_by?.name) {
        const account = payload.requested_by.account?.name || '';
        messageParts.push(`👤 Requested by: ${payload.requested_by.name}${account ? ' @' + account : ''}`);
      }

      // Handle notes array
      if (payload && Array.isArray(payload.note) && payload.note.length > 0) {
        messageParts.push('📝 Notes:');
        payload.note.forEach((note, index) => {
          const author = note.person?.name || note.person_name || 'Unknown';
          const account = note.account?.name || note.person?.account?.name || '';
          const text = note.text || '';
          const timestamp = note.created_at ? new Date(note.created_at).toLocaleString('ru-RU') : '';
          messageParts.push(`${index + 1}. ${author}${account ? ' @' + account : ''}${timestamp ? ' (' + timestamp + ')' : ''}: ${text}`);
        });
      }

      // Handle direct text/message fields
      if (payload && (payload.text || payload.message) && !Array.isArray(payload.note)) {
        const author = payload.author || payload.person_name || fullBody.person_name || payload.requested_by?.name || 'Unknown';
        const account = payload.account?.name || payload.requested_by?.account?.name || '';
        const text = payload.text || payload.message;
        messageParts.push(`💬 Message: ${author}${account ? ' @' + account : ''}: ${text}`);
      }

      // Handle command/comment structure (legacy)
      if (payload && payload.command && payload.comment && !Array.isArray(payload.note) && !payload.text && !payload.message) {
        const author = payload.author || fullBody.person_name || 'Unknown';
        messageParts.push(`⚙️ Command: ${author}: ${payload.command} - ${payload.comment}`);
      }

      // Add ID if present
      if (payload.id) {
        messageParts.push(`🆔 ID: ${payload.id}`);
      }

      // If no specific content, add generic info
      if (messageParts.length === 0) {
        const parts = [];
        if (fullBody.event) parts.push(`Event: ${fullBody.event}`);
        if (fullBody.object_id) parts.push(`Object ID: ${fullBody.object_id}`);
        if (fullBody.person_name) parts.push(`By: ${fullBody.person_name}`);
        if (parts.length > 0) {
          messageParts.push('ℹ️ Info: ' + parts.join(' | '));
        } else {
          messageParts.push('📦 Payload: ' + JSON.stringify(payload || fullBody).slice(0, 4000));
        }
      }

      return messageParts.join('\n\n');
    } catch (e) {
      console.error('Format message error:', e.message);
      return '❌ Error formatting message: ' + JSON.stringify(payload || fullBody).slice(0, 4000);
    }
  };

  for (const rule of rules) {
    if (!rule || rule.enabled === false) continue;
    try {
      const fn = new Function('payload', `return ${rule.condition}`);
      let ruleMatches = false;
      try {
        ruleMatches = !!fn(incomingPayload);
      } catch (evalErr) {
        console.error('Rule evaluation error for rule', rule.id || '(no id):', evalErr.message);
      }
      if (ruleMatches) {
        matched++;
        const token = rule.botToken || TELEGRAM_BOT_TOKEN;
        if (!token || token === 'YOUR_TOKEN' || token === 'ВАШ_ТОКЕН_ЗДЕСЬ') {
          telegram_results.push({ chatId: rule.chatId || null, success: false, error: 'No bot token configured' });
          continue;
        }

        // Support single chatId or array of chatIds
        const chatIds = Array.isArray(rule.chatIds) ? rule.chatIds : (rule.chatId ? [rule.chatId] : []);
        if (chatIds.length === 0) {
          telegram_results.push({ chatId: null, success: false, error: 'No chatId configured for rule' });
          continue;
        }

        const messageText = formatMessage(req.body, incomingPayload, rule);

        for (const chat of chatIds) {
          try {
            const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
              chat_id: chat,
              text: messageText
            });
            telegram_results.push({ chatId: chat, success: true, response: response.data });
          } catch (error) {
            const errDetail = error.response?.data || error.message;
            console.error('Telegram send error for chat', chat, errDetail);
            telegram_results.push({ chatId: chat, success: false, error: errDetail });
          }
        }
      }
    } catch (e) {
      console.error('Rule handler error:', e.message);
    }
  }

  const sent = telegram_results.filter(r => r.success).length;
  logWebhook(req.body, matched, rules.length, telegram_results);
  res.json({ matched, sent, telegram_results });
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
