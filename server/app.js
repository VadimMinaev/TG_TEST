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
const RULES_FILE = path.join(__dirname, '../data/rules.json');
const LOGS_FILE = path.join(__dirname, '../data/logs.json');
const CRED_USER = 'vadmin';
const CRED_PASS = 'vadmin';
const sessions = new Set();

// Log webhook
function logWebhook(payload, matched, rules_count, telegram_results = []) {
  try {
    let logs = [];
    if (fs.existsSync(LOGS_FILE)) {
      logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    }
    logs.unshift({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      payload,
      matched,
      total_rules: rules_count,
      telegram_results,
      status: matched > 0 ? 'matched' : 'no_match'
    });
    if (logs.length > 100) logs = logs.slice(0, 100);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
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
  const envPath = path.join(__dirname, '../.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=.*/, `TELEGRAM_BOT_TOKEN=${newToken}`);
  fs.writeFileSync(envPath, envContent);
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
  try {
    const data = fs.readFileSync(RULES_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

app.post('/api/rules', auth, async (req, res) => {
  const rules = (() => { try { return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')); } catch { return []; } })();
  const { botToken, ...ruleData } = req.body;
  
  if (botToken) {
    try {
      const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
      if (!response.data.ok) {
        return res.status(400).json({ error: 'Invalid bot token' });
      }
    } catch (error) {
      return res.status(400).json({ error: 'Bot token validation failed', details: error.response?.data || error.message });
    }
  }
  
  const newRule = { id: Date.now(), ...ruleData, botToken: botToken || '', enabled: req.body.enabled !== false };
  rules.push(newRule);
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
  res.json(newRule);
});

app.put('/api/rules/:id', auth, async (req, res) => {
  const rules = (() => { try { return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')); } catch { return []; } })();
  const idx = rules.findIndex(r => r.id == req.params.id);
  if (idx >= 0) {
    const { botToken, ...ruleData } = req.body;
    
    if (botToken !== undefined) {
      if (botToken) {
        try {
          const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
          if (!response.data.ok) {
            return res.status(400).json({ error: 'Invalid bot token' });
          }
        } catch (error) {
          return res.status(400).json({ error: 'Bot token validation failed', details: error.response?.data || error.message });
        }
      }
      ruleData.botToken = botToken;
    }
    
    rules[idx] = { ...rules[idx], ...ruleData };
    fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
    res.json(rules[idx]);
  } else {
    res.status(404).json({ error: 'not found' });
  }
});

app.delete('/api/rules/:id', auth, (req, res) => {
  let rules = (() => { try { return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')); } catch { return []; } })();
  rules = rules.filter(r => r.id != req.params.id);
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
  res.json({ status: 'ok' });
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
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
      res.json(logs);
    } else {
      res.json([]);
    }
  } catch (e) {
    res.json([]);
  }
});

app.delete('/api/webhook-logs', auth, (req, res) => {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      fs.unlinkSync(LOGS_FILE);
    }
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`✅ Server on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
