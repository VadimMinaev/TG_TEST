const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
let TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TOKEN';

const LOGS_FILE = path.join(__dirname, '../data/logs.json');
const RULES_FILE = path.join(__dirname, '../data/rules.json');
const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');
const CRED_USER = 'vadmin';
const CRED_PASS = 'vadmin';
const sessions = new Map(); // token -> { username, timestamp }

// ЦЕНТРАЛИЗОВАННАЯ СИСТЕМА ПЕРЕВОДОВ
const fieldTranslations = {
  id: 'ID',
  subject: 'Тема',
  status: 'Статус',
  team: 'Команда',
  category: 'Категория',
  impact: 'Влияние',
  priority: 'Приоритет',
  urgency: 'Срочность',
  response_target_at: 'Крайний срок ответа',
  resolution_target_at: 'Крайний срок решения',
  created_at: 'Создан',
  updated_at: 'Обновлен',
  requested_by: {
    name: 'Инициатор запроса',
    account: { name: 'Организация' }
  },
  person: {
    name: 'Автор',
    account: { name: 'Организация' }
  },
  note: 'Комментарий',
  text: 'Текст',
  message: 'Сообщение',
  command: 'Команда',
  comment: 'Комментарий',
  event: 'Событие',
  object_id: 'ID объекта',
  account: 'Аккаунт',
  payload: 'Данные'
};

function getFieldTranslation(path) {
  const parts = path.split('.');
  let current = fieldTranslations;
  for (const part of parts) {
    if (current && current[part] !== undefined) {
      current = current[part];
    } else {
      return fieldTranslations[part] || part;
    }
  }
  return typeof current === 'string' ? current : path;
}

let db = { rules: [], logs: [] };
if (process.env.DATABASE_URL) {
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  (async () => {
    try {
      await client.connect();
      await client.query(`CREATE TABLE IF NOT EXISTS rules (id BIGINT PRIMARY KEY, data JSONB)`);
      await client.query(`CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, data JSONB)`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Загружаем глобальный токен из БД при старте
      try {
        const result = await client.query('SELECT value FROM settings WHERE key = $1', ['global_bot_token']);
        if (result.rows.length > 0 && result.rows[0].value && result.rows[0].value !== 'YOUR_TOKEN') {
          TELEGRAM_BOT_TOKEN = result.rows[0].value;
          console.log('Global bot token loaded from database');
        }
      } catch (err) {
        console.error('Error loading global bot token from database:', err);
      }
      
      db = client;
      console.log('DB connected and tables created');
    } catch (err) {
      console.error('DB init error:', err);
    }
  })();
} else {
  try {
    if (fs.existsSync(RULES_FILE)) {
      db.rules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
      console.log('Rules loaded from file');
    }
  } catch (e) {
    console.error('Error loading rules from file:', e);
  }
  try {
    if (fs.existsSync(LOGS_FILE)) {
      db.logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
      console.log('Logs loaded from file');
    }
  } catch (e) {
    console.error('Error loading logs from file:', e);
  }
}

function saveRules() {
  if (!process.env.DATABASE_URL) {
    try {
      fs.writeFileSync(RULES_FILE, JSON.stringify(db.rules, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving rules to file:', e);
    }
  }
}

function saveLogs() {
  if (!process.env.DATABASE_URL) {
    try {
      fs.writeFileSync(LOGS_FILE, JSON.stringify(db.logs, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving logs to file:', e);
    }
  }
}

function saveSettings() {
  if (!process.env.DATABASE_URL) {
    try {
      const settings = { global_bot_token: TELEGRAM_BOT_TOKEN };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving settings to file:', e);
    }
  }
}

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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
      db.query('DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 100)').catch(err => console.error('Log cleanup error:', err));
    } else {
      db.logs.unshift(logEntry);
      if (db.logs.length > 100) db.logs = db.logs.slice(0, 100);
      saveLogs();
    }
  } catch (e) {
    console.error('Log error:', e.message);
  }
}

const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && sessions.has(token)) {
    req.user = sessions.get(token);
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

const vadminOnly = (req, res, next) => {
  if (req.user && req.user.username === 'vadmin') {
    return next();
  }
  res.status(403).json({ error: 'Forbidden: Only vadmin can perform this action' });
};

// AUTH ROUTES
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Проверка vadmin
  if (username === CRED_USER && password === CRED_PASS) {
    const token = Date.now().toString();
    sessions.set(token, { username: CRED_USER, timestamp: Date.now() });
    return res.json({ token, status: 'success', username: CRED_USER });
  }
  
  // Проверка пользователей из БД
  if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
    try {
      const result = await db.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
          const token = Date.now().toString();
          sessions.set(token, { username: user.username, userId: user.id, timestamp: Date.now() });
          return res.json({ token, status: 'success', username: user.username });
        }
      }
    } catch (err) {
      console.error('DB login error:', err);
    }
  }
  
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/logout', auth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) sessions.delete(token);
  res.json({ status: 'ok' });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ 
    username: req.user.username,
    userId: req.user.userId || null
  });
});

app.get('/api/auth-status', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = token ? sessions.get(token) : null;
  res.json({ 
    authenticated: !!session,
    username: session ? session.username : null
  });
});

// USER MANAGEMENT ROUTES
app.get('/api/users', auth, async (req, res) => {
  if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
    try {
      const result = await db.query('SELECT id, username, created_at, updated_at FROM users ORDER BY created_at DESC');
      res.json(result.rows);
    } catch (err) {
      console.error('DB error:', err);
      res.status(500).json({ error: 'DB error' });
    }
  } else {
    res.json([]); // В файловом режиме пользователи не поддерживаются
  }
});

app.post('/api/users', auth, vadminOnly, async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (username === 'vadmin') {
    return res.status(400).json({ error: 'Cannot create vadmin user' });
  }
  
  if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
    try {
      // Проверка существования пользователя
      const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      
      // Хеширование пароля
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Создание пользователя
      const result = await db.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at, updated_at',
        [username, passwordHash]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('DB error:', err);
      if (err.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Username already exists' });
      }
      res.status(500).json({ error: 'DB error' });
    }
  } else {
    res.status(400).json({ error: 'User management requires database' });
  }
});

app.put('/api/users/:id/password', auth, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { password, oldPassword } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  
  if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
    try {
      // Проверка что пользователь меняет свой пароль или это vadmin
      const isVadmin = req.user.username === 'vadmin';
      
      if (!isVadmin) {
        // Если не vadmin, проверяем что пользователь меняет свой пароль
        if (req.user.userId !== userId) {
          return res.status(403).json({ error: 'You can only change your own password' });
        }
        
        // Проверяем старый пароль
        if (!oldPassword) {
          return res.status(400).json({ error: 'Old password is required' });
        }
        
        const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        const match = await bcrypt.compare(oldPassword, userResult.rows[0].password_hash);
        if (!match) {
          return res.status(401).json({ error: 'Invalid old password' });
        }
      } else {
        // vadmin может менять пароль без старого
        const userResult = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
      }
      
      // Хеширование нового пароля
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Обновление пароля
      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, userId]
      );
      
      res.json({ status: 'ok' });
    } catch (err) {
      console.error('DB error:', err);
      res.status(500).json({ error: 'DB error' });
    }
  } else {
    res.status(400).json({ error: 'User management requires database' });
  }
});

app.delete('/api/users/:id', auth, vadminOnly, async (req, res) => {
  const userId = parseInt(req.params.id);
  
  if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
    try {
      const result = await db.query('DELETE FROM users WHERE id = $1', [userId]);
      if (result.rowCount > 0) {
        res.json({ status: 'deleted' });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } catch (err) {
      console.error('DB error:', err);
      res.status(500).json({ error: 'DB error' });
    }
  } else {
    res.status(400).json({ error: 'User management requires database' });
  }
});

// TELEGRAM BOT ROUTES
app.post('/api/bot-token', auth, async (req, res) => {
  const newToken = req.body.botToken;
  if (!newToken || newToken === 'YOUR_TOKEN') {
    return res.status(400).json({ error: 'Invalid token' });
  }
  
  // Валидация токена
  try {
    const response = await axios.get(`https://api.telegram.org/bot${newToken}/getMe`);
    if (!response.data.ok) {
      return res.status(400).json({ error: 'Invalid bot token' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid bot token' });
  }
  
  TELEGRAM_BOT_TOKEN = newToken;
  
  // Сохраняем токен в БД или файл
  if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
    try {
      await db.query(
        'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
        ['global_bot_token', newToken]
      );
      console.log('Global bot token saved to database');
    } catch (err) {
      console.error('Error saving bot token to database:', err);
      // Продолжаем выполнение даже если не удалось сохранить в БД
    }
  } else {
    // Сохраняем в файл для файлового режима
    saveSettings();
    console.log('Global bot token saved to file');
  }
  
  res.json({ status: 'ok' });
});

app.get('/api/bot-token', auth, (req, res) => {
  const masked = TELEGRAM_BOT_TOKEN.substring(0, 5) + '***';
  res.json({ botToken: masked, isSet: TELEGRAM_BOT_TOKEN !== 'YOUR_TOKEN' });
});

app.post('/api/test-send', auth, async (req, res) => {
  const { chatId, message, botToken } = req.body;
  if (!chatId || !message) {
    return res.status(400).json({ error: 'chatId and message required' });
  }
  // Используем токен из запроса, если указан, иначе глобальный токен
  const token = botToken || TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TOKEN') {
    return res.status(400).json({ success: false, error: 'Bot token is required' });
  }
  try {
    const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message
    });
    res.json({ success: true, response: response.data });
  } catch (error) {
    console.error('Telegram send error:', error.response?.data || error.message);
    res.status(400).json({ success: false, error: error.response?.data || error.message });
  }
});

// RULES MANAGEMENT
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

app.get('/api/rules/:id', auth, async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    if (process.env.DATABASE_URL) {
      const result = await db.query('SELECT id, data FROM rules WHERE id = $1', [ruleId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      const rule = { ...result.rows[0].data, id: result.rows[0].id };
      // Возвращаем полный botToken для редактирования
      res.json(rule);
    } else {
      const rule = db.rules.find(r => r.id == ruleId);
      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      res.json(rule);
    }
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/rules', auth, async (req, res) => {
  try {
    const { botToken, ...ruleData } = req.body;
    if (!botToken || typeof botToken !== 'string' || !botToken.trim()) {
      return res.status(400).json({ error: 'Bot token is required' });
    }
    const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
    if (!response.data.ok) {
      return res.status(400).json({ error: 'Invalid bot token' });
    }
    const newRule = { id: Date.now(), ...ruleData, botToken, enabled: req.body.enabled !== false, encoding: 'utf8' };
    if (process.env.DATABASE_URL) {
      await db.query('INSERT INTO rules (id, data) VALUES ($1, $2)', [newRule.id, newRule]);
      res.json(newRule);
    } else {
      db.rules.push(newRule);
      saveRules();
      res.json(newRule);
    }
  } catch (error) {
    console.error('Error in /api/rules POST:', error.response?.data || error.message);
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
      if ('botToken' in req.body) {
        if (!botToken || typeof botToken !== 'string' || !botToken.trim()) {
          return res.status(400).json({ error: 'Bot token is required' });
        }
        const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
        if (!response.data.ok) {
          return res.status(400).json({ error: 'Invalid bot token' });
        }
        ruleData.botToken = botToken;
      }
      const updated = { ...existing, ...ruleData };
      if (!updated.botToken) {
        return res.status(400).json({ error: 'Bot token is required' });
      }
      await db.query('UPDATE rules SET data = $1 WHERE id = $2', [updated, ruleId]);
      res.json(updated);
    } else {
      const idx = db.rules.findIndex(r => r.id == ruleId);
      if (idx >= 0) {
        const { botToken, ...ruleData } = req.body;
        if ('botToken' in req.body) {
          if (!botToken || typeof botToken !== 'string' || !botToken.trim()) {
            return res.status(400).json({ error: 'Bot token is required' });
          }
          const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
          if (!response.data.ok) {
            return res.status(400).json({ error: 'Invalid bot token' });
          }
          ruleData.botToken = botToken;
        }
        const updated = { ...db.rules[idx], ...ruleData };
        if (!updated.botToken) {
          return res.status(400).json({ error: 'Bot token is required' });
        }
        db.rules[idx] = updated;
        saveRules();
        res.json(db.rules[idx]);
      } else {
        res.status(404).json({ error: 'not found' });
      }
    }
  } catch (error) {
    console.error('Error in /api/rules PUT:', error.response?.data || error.message);
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
        saveRules();
        res.json({ status: 'deleted' });
      } else {
        res.status(404).json({ error: 'Rule not found' });
      }
    }
  } catch (error) {
    console.error('Error in /api/rules DELETE:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WEBHOOK HANDLER
app.post('/webhook', async (req, res) => {
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

  let incomingPayload = req.body && typeof req.body === 'object' ? (req.body.payload ?? req.body) : req.body;

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

  const formatMessage = (fullBody, payload) => {
    try {
      const messageParts = [];

      // 1. Основная информация
      if (payload.id) {
        messageParts.push(`🆔 ${getFieldTranslation('id')}: ${payload.id}`);
      }
      if (payload.subject) {
        messageParts.push(`📋 ${getFieldTranslation('subject')}: ${payload.subject}`);
      }
      if (payload.requested_by?.name) {
        const account = payload.requested_by.account?.name || '';
        messageParts.push(`👤 ${getFieldTranslation('requested_by.name')}: ${payload.requested_by.name}${account ? ' @' + account : ''}`);
      }

      // 2. Статус
      if (payload.status) {
        messageParts.push(`📊 ${getFieldTranslation('status')}: ${payload.status}`);
      }

      // 3. SLA
      const slaFields = ['response_target_at', 'resolution_target_at'];
      for (const field of slaFields) {
        if (payload[field] && payload[field] !== null) {
          let value = payload[field];
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              value = date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          } catch (e) {
            console.error('Date formatting error:', e);
          }
          messageParts.push(`⏰ ${getFieldTranslation(field)}: ${value}`);
        }
      }

      // 4. Дополнительные поля (плоские)
      const additionalFields = [
        { key: 'team_name', trans: 'team' },
        { key: 'category', trans: 'category' },
        { key: 'impact', trans: 'impact' },
        { key: 'priority', trans: 'priority' },
        { key: 'urgency', trans: 'urgency' }
      ];
      for (const { key, trans } of additionalFields) {
        if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
          messageParts.push(`${getFieldTranslation(trans)}: ${payload[key]}`);
        }
      }

      // 5. Заметки
      const notes = payload.note ? (Array.isArray(payload.note) ? payload.note : [payload.note]) : [];
      if (notes.length > 0) {
        messageParts.push(`📝 ${getFieldTranslation('note')}:`);
        notes.forEach((note, index) => {
          const author = note.person?.name || note.person_name || 'Unknown';
          const account = note.account?.name || note.person?.account?.name || '';
          const text = note.text || '';
          let timestamp = '';

          if (note.created_at) {
            try {
              const date = new Date(note.created_at);
              if (!isNaN(date.getTime())) {
                timestamp = date.toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
              } else {
                timestamp = note.created_at;
              }
            } catch (e) {
              timestamp = note.created_at;
            }
          }

          messageParts.push(`${index + 1}. ${author}${account ? ' @' + account : ''}${timestamp ? ' (' + timestamp + ')' : ''}: ${text}`);
        });
      }

      // 6. Прямые сообщения
      if (payload && (payload.text || payload.message) && !payload.note) {
        const author = payload.author || payload.person_name || fullBody.person_name || payload.requested_by?.name || 'Unknown';
        const account = payload.account?.name || payload.requested_by?.account?.name || '';
        const text = payload.text || payload.message;
        messageParts.push(`💬 ${getFieldTranslation('message')}: ${author}${account ? ' @' + account : ''}: ${text}`);
      }

      // 7. Резерв
      if (messageParts.length === 0) {
        const infoParts = [];
        if (fullBody.event) infoParts.push(`Событие: ${fullBody.event}`);
        if (fullBody.object_id) infoParts.push(`ID объекта: ${fullBody.object_id}`);
        if (fullBody.person_name) infoParts.push(`Автор: ${fullBody.person_name}`);
        if (infoParts.length > 0) {
          messageParts.push(`ℹ️ Информация: ${infoParts.join(' | ')}`);
        } else {
          const payloadJson = JSON.stringify(payload || fullBody, null, 2);
          const truncated = payloadJson.length > 4000 ? payloadJson.slice(0, 3997) + '...' : payloadJson;
          messageParts.push(`📦 Данные:\n\`\`\`\n${truncated}\n\`\`\``);
        }
      }

      return messageParts.join('\n\n');
    } catch (e) {
      console.error('Format message error:', e.message);
      return `❌ Ошибка форматирования сообщения: ${e.message}\n\n📦 Данные:\n${JSON.stringify(payload || fullBody).slice(0, 4000)}`;
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
        // Используем токен из правила, если он есть, иначе используем глобальный резервный токен
        let token = rule.botToken;
        if (!token || token === 'YOUR_TOKEN' || token === 'ВАШ_ТОКЕН_ЗДЕСЬ') {
          // Используем глобальный резервный токен
          token = TELEGRAM_BOT_TOKEN;
          if (!token || token === 'YOUR_TOKEN') {
            telegram_results.push({ chatId: rule.chatId || null, success: false, error: 'No bot token configured in rule and no global token set' });
            continue;
          }
        }

        const chatIds = Array.isArray(rule.chatIds) ? rule.chatIds : (rule.chatId ? [rule.chatId] : []);
        if (chatIds.length === 0) {
          telegram_results.push({ chatId: null, success: false, error: 'No chatId configured for rule' });
          continue;
        }

        const messageText = formatMessage(req.body, incomingPayload);

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

// HEALTH CHECK & LOGS
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

app.get('/api/webhook-logs/:id', auth, async (req, res) => {
  const logId = parseInt(req.params.id);
  if (process.env.DATABASE_URL) {
    try {
      const result = await db.query('SELECT data FROM logs WHERE (data->>\'id\')::bigint = $1', [logId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Log not found' });
      }
      res.json(result.rows[0].data);
    } catch (err) {
      console.error('Logs DB error:', err);
      res.status(500).json({ error: 'DB error' });
    }
  } else {
    const log = db.logs.find(l => l.id === logId);
    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }
    res.json(log);
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
    saveLogs();
    res.json({ status: 'ok' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));