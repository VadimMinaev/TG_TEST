const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '10mb' }));

// Serve static files from build directory in production
// In development, Vite dev server handles frontend (port 5173)
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
    app.use(express.static(path.join(__dirname, '../build')));
}

const PORT = process.env.PORT || 3000;
let TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TOKEN';

const LOGS_FILE = path.join(__dirname, '../data/logs.json');
const RULES_FILE = path.join(__dirname, '../data/rules.json');
const POLLS_FILE = path.join(__dirname, '../data/polls.json');
const POLL_RUNS_FILE = path.join(__dirname, '../data/poll_runs.json');
const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');
const SESSIONS_FILE = path.join(__dirname, '../data/sessions.json');

const CRED_USER = 'vadmin';
const CRED_PASS = 'vadmin';

let sessions = new Map();

// Загружаем сессии из файла
if (fs.existsSync(SESSIONS_FILE)) {
    try {
        const sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        sessions = new Map(sessionsData);
    } catch (err) {
        console.error('Error loading sessions:', err);
        sessions = new Map();
    }
}

function saveSessions() {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify([...sessions]));
    } catch (err) {
        console.error('Error saving sessions:', err);
    }
}

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

let db = { rules: [], logs: [], polls: [], pollRuns: [] };
let pollsCache = [];
const pollTimers = new Map();
let integrationsCache = [];
const integrationTimers = new Map();
let botsCache = [];
let botSchedulerInterval = null;
let dbConnected = false;

if (process.env.DATABASE_URL) {
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    (async () => {
        try {
            // Wait for DB to become ready (cold start)
            const connectWithRetry = async (attempts = 10, delayMs = 2000) => {
                for (let i = 1; i <= attempts; i += 1) {
                    try {
                        await client.connect();
                        return;
                    } catch (err) {
                        if (i === attempts) throw err;
                        console.warn(`DB not ready (attempt ${i}/${attempts}), retrying in ${delayMs}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }
                }
            };

            await connectWithRetry();
            await client.query(`
                CREATE TABLE IF NOT EXISTS accounts (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    slug VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slug VARCHAR(255)`);
            await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug) WHERE slug IS NOT NULL`);
            await client.query(`CREATE TABLE IF NOT EXISTS rules (id BIGINT PRIMARY KEY, data JSONB)`);
            await client.query(`ALTER TABLE rules ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id)`);
            await client.query(`CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, data JSONB)`);
            await client.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS account_id INTEGER`);
            await client.query(`CREATE TABLE IF NOT EXISTS polls (id BIGINT PRIMARY KEY, data JSONB)`);
            await client.query(`ALTER TABLE polls ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id)`);
            await client.query(`
                CREATE TABLE IF NOT EXISTS poll_runs (
                    id BIGSERIAL PRIMARY KEY,
                    poll_id BIGINT NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    matched BOOLEAN DEFAULT false,
                    sent BOOLEAN DEFAULT false,
                    error_message TEXT,
                    response_snippet TEXT,
                    request_method TEXT,
                    request_url TEXT,
                    request_headers TEXT,
                    request_body TEXT,
                    response_status INTEGER,
                    response_headers TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await client.query(`ALTER TABLE poll_runs ADD COLUMN IF NOT EXISTS account_id INTEGER`);
            await client.query(`ALTER TABLE poll_runs ADD COLUMN IF NOT EXISTS request_method TEXT`);
            await client.query(`ALTER TABLE poll_runs ADD COLUMN IF NOT EXISTS request_url TEXT`);
            await client.query(`ALTER TABLE poll_runs ADD COLUMN IF NOT EXISTS request_headers TEXT`);
            await client.query(`ALTER TABLE poll_runs ADD COLUMN IF NOT EXISTS request_body TEXT`);
            await client.query(`ALTER TABLE poll_runs ADD COLUMN IF NOT EXISTS response_status INTEGER`);
            await client.query(`ALTER TABLE poll_runs ADD COLUMN IF NOT EXISTS response_headers TEXT`);
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    account_id INTEGER REFERENCES accounts(id),
                    role VARCHAR(20) DEFAULT 'administrator',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id)`);
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'administrator'`);
            await client.query(`
                CREATE TABLE IF NOT EXISTS settings (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await client.query(`
                CREATE TABLE IF NOT EXISTS message_queue (
                    id SERIAL PRIMARY KEY,
                    bot_token TEXT NOT NULL,
                    chat_id TEXT NOT NULL,
                    message_text TEXT NOT NULL,
                    priority INTEGER DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'pending',
                    attempts INTEGER DEFAULT 0,
                    max_attempts INTEGER DEFAULT 3,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    sent_at TIMESTAMP,
                    error_message TEXT,
                    webhook_log_id INTEGER
                )
            `);
            await client.query(`ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS account_id INTEGER`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status, created_at)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_message_queue_chat_id ON message_queue(chat_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_poll_runs_poll_id ON poll_runs(poll_id, created_at)`);

            // Боты (scheduled bots)
            await client.query(`
                CREATE TABLE IF NOT EXISTS bots (
                    id BIGINT PRIMARY KEY,
                    data JSONB NOT NULL
                )
            `);
            await client.query(`ALTER TABLE bots ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id)`);
            await client.query(`
                CREATE TABLE IF NOT EXISTS bot_runs (
                    id BIGSERIAL PRIMARY KEY,
                    bot_id BIGINT NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    message_type VARCHAR(20),
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await client.query(`ALTER TABLE bot_runs ADD COLUMN IF NOT EXISTS account_id INTEGER`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_bot_runs_bot_id ON bot_runs(bot_id, created_at)`);

            // Интеграции
            await client.query(`
                CREATE TABLE IF NOT EXISTS integrations (
                    id BIGINT PRIMARY KEY,
                    data JSONB NOT NULL
                )
            `);
            await client.query(`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id)`);
            await client.query(`
                CREATE TABLE IF NOT EXISTS integration_runs (
                    id BIGSERIAL PRIMARY KEY,
                    integration_id BIGINT NOT NULL,
                    trigger_type VARCHAR(20) NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    trigger_data TEXT,
                    action_request TEXT,
                    action_response TEXT,
                    action_status INTEGER,
                    telegram_sent BOOLEAN DEFAULT false,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await client.query(`ALTER TABLE integration_runs ADD COLUMN IF NOT EXISTS account_id INTEGER`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_integration_runs_integration_id ON integration_runs(integration_id, created_at)`);

            // Загружаем глобальный токен из БД
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
            dbConnected = true;
            console.log('DB connected and tables created');

            // Migration: ensure default account and backfill account_id
            try {
                let defaultAccountId = null;
                const existing = await client.query(`SELECT id FROM accounts LIMIT 1`);
                if (existing.rows.length === 0) {
                    const ins = await client.query(`INSERT INTO accounts (name) VALUES ('Default') RETURNING id`);
                    defaultAccountId = ins.rows[0]?.id;
                } else {
                    defaultAccountId = existing.rows[0].id;
                }
                if (defaultAccountId != null) {
                    await client.query(`UPDATE accounts SET slug = REGEXP_REPLACE(LOWER(REGEXP_REPLACE(TRIM(COALESCE(name, '')), '\\s+', '_', 'g')), '[^a-z0-9_]', '', 'g') WHERE slug IS NULL`);
                    await client.query(`UPDATE accounts SET slug = 'account_' || id WHERE slug IS NULL OR slug = ''`);
                    await client.query('UPDATE users SET account_id = $1 WHERE account_id IS NULL', [defaultAccountId]);
                    await client.query('UPDATE users SET role = \'administrator\' WHERE role IS NULL', []);
                    await client.query('UPDATE rules SET account_id = $1 WHERE account_id IS NULL', [defaultAccountId]);
                    await client.query('UPDATE polls SET account_id = $1 WHERE account_id IS NULL', [defaultAccountId]);
                    await client.query('UPDATE integrations SET account_id = $1 WHERE account_id IS NULL', [defaultAccountId]);
                    await client.query('UPDATE bots SET account_id = $1 WHERE account_id IS NULL', [defaultAccountId]);
                    await client.query('UPDATE logs SET account_id = $1 WHERE account_id IS NULL', [defaultAccountId]);
                    await client.query('UPDATE poll_runs SET account_id = $1 WHERE account_id IS NULL', [defaultAccountId]);
                    await client.query('UPDATE integration_runs SET account_id = $1 WHERE account_id IS NULL', [defaultAccountId]);
                    await client.query('UPDATE bot_runs SET account_id = $1 WHERE account_id IS NULL', [defaultAccountId]);
                    await client.query('UPDATE message_queue SET account_id = $1 WHERE account_id IS NULL', [defaultAccountId]);
                }
            } catch (migErr) {
                console.error('Migration (accounts) error:', migErr);
            }

            await loadPollsCache();
            await loadBotsCache();
            startMessageQueueWorker();
            startPollWorkers();
            startBotScheduler();
            startIntegrationWorkers();
        } catch (err) {
            console.error('DB init error:', err);
            dbConnected = false;
            // Fallback to file mode if DB is unreachable
            process.env.DATABASE_URL = '';
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
    try {
        if (fs.existsSync(POLLS_FILE)) {
            db.polls = JSON.parse(fs.readFileSync(POLLS_FILE, 'utf8'));
            console.log('Polls loaded from file');
        }
    } catch (e) {
        console.error('Error loading polls from file:', e);
    }
    try {
        if (fs.existsSync(POLL_RUNS_FILE)) {
            db.pollRuns = JSON.parse(fs.readFileSync(POLL_RUNS_FILE, 'utf8'));
            console.log('Poll runs loaded from file');
        }
    } catch (e) {
        console.error('Error loading poll runs from file:', e);
    }
    pollsCache = db.polls;
    startPollWorkers();
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

function savePolls() {
    if (!process.env.DATABASE_URL) {
        try {
            fs.writeFileSync(POLLS_FILE, JSON.stringify(db.polls, null, 2), 'utf8');
        } catch (e) {
            console.error('Error saving polls to file:', e);
        }
    }
}

function savePollRuns() {
    if (!process.env.DATABASE_URL) {
        try {
            fs.writeFileSync(POLL_RUNS_FILE, JSON.stringify(db.pollRuns, null, 2), 'utf8');
        } catch (e) {
            console.error('Error saving poll runs to file:', e);
        }
    }
}

async function loadPollsCache() {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const result = await db.query('SELECT id, data, account_id FROM polls');
            pollsCache = result.rows.map(r => ({ ...r.data, id: r.id, account_id: r.account_id }));
        } catch (e) {
            console.error('Error loading polls from database:', e);
            pollsCache = [];
        }
    } else {
        pollsCache = db.polls || [];
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

function logWebhook(payload, matched, rules_count, telegram_results = [], accountId = null) {
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
            db.query('INSERT INTO logs (data, account_id) VALUES ($1, $2)', [logEntry, accountId]).catch(err => console.error('Log DB error:', err));
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

const auth = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token && sessions.has(token)) {
        const session = sessions.get(token);
        const now = Date.now();
        if (now - session.timestamp > 24 * 60 * 60 * 1000) {
            sessions.delete(token);
            saveSessions();
            res.status(401).json({ error: 'Session expired' });
            return;
        }
        req.user = session;
        // If non-vadmin has no accountId in session, try to load from DB (e.g. after migration or old session)
        if (session.username !== 'vadmin' && (session.accountId == null || session.accountId === undefined) && session.userId != null && process.env.DATABASE_URL && db && typeof db.query === 'function') {
            try {
                const r = await db.query('SELECT account_id FROM users WHERE id = $1', [session.userId]);
                if (r.rows[0] && r.rows[0].account_id != null) {
                    session.accountId = r.rows[0].account_id;
                    req.user.accountId = session.accountId;
                    saveSessions();
                }
            } catch (e) {
                console.error('Auth: failed to load account_id for user', session.userId, e.message);
            }
        }
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

/** For data endpoints: vadmin may pass account_id in query/body; normal user uses session accountId */
function getAccountId(req) {
    if (req.user.username === 'vadmin') {
        const q = req.query.account_id || req.body?.account_id;
        if (q != null) return parseInt(q, 10) || null;
        return null;
    }
    return req.user.accountId ?? null;
}

/** For create (POST): vadmin without account_id defaults to account 1 so creates don't fail */
function getAccountIdForCreate(req) {
    const id = getAccountId(req);
    if (id != null) return id;
    if (req.user.username === 'vadmin') return 1;
    return null;
}

/** Require account scope for non-vadmin; for vadmin optional (null = no filter for list-all) */
function requireAccountOrVadmin(req, res, next) {
    if (req.user.username === 'vadmin') return next();
    if (req.user.accountId != null) return next();
    res.status(403).json({ error: 'Account required' });
}

/** Auditor can only read (GET); block write methods */
function blockAuditorWrite(req, res, next) {
    if (req.user.role === 'auditor' && !['GET', 'HEAD'].includes(req.method)) {
        return res.status(403).json({ error: 'Аудитор может только просматривать данные' });
    }
    next();
}

// ────────────────────────────────────────────────────────────────
// НОВАЯ ФУНКЦИЯ ФОРМАТИРОВАНИЯ СООБЩЕНИЯ
// ────────────────────────────────────────────────────────────────
function formatMessage(fullBody, payload, rule = {}) {
    // Пользовательский шаблон, если указан
    if (rule.messageTemplate && typeof rule.messageTemplate === 'string' && rule.messageTemplate.trim()) {
        try {
            const templateFn = new Function('payload', `
                try {
                    return \`${rule.messageTemplate.replace(/`/g, '\\`')}\`;
                } catch (e) {
                    return '[Ошибка шаблона]: ' + e.message;
                }
            `);
            return templateFn(payload);
        } catch (e) {
            console.error('Template rendering error:', e);
            return `❌ Ошибка обработки шаблона: ${e.message}\n\nДанные:\n\`\`\`json\n${JSON.stringify(payload, null, 2).slice(0, 4000)}\n\`\`\``;
        }
    }

    // Старый надёжный fallback
    try {
        const messageParts = [];

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
        if (payload.status) {
            messageParts.push(`📊 ${getFieldTranslation('status')}: ${payload.status}`);
        }

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
                } catch {}
                messageParts.push(`⏰ ${getFieldTranslation(field)}: ${value}`);
            }
        }

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
                    } catch {
                        timestamp = note.created_at;
                    }
                }
                messageParts.push(`${index + 1}. ${author}${account ? ' @' + account : ''}${timestamp ? ' (' + timestamp + ')' : ''}: ${text}`);
            });
        }

        if (payload && (payload.text || payload.message) && !payload.note) {
            const author = payload.author || payload.person_name || fullBody.person_name || payload.requested_by?.name || 'Unknown';
            const account = payload.account?.name || payload.requested_by?.account?.name || '';
            const text = payload.text || payload.message;
            messageParts.push(`💬 ${getFieldTranslation('message')}: ${author}${account ? ' @' + account : ''}: ${text}`);
        }

        if (messageParts.length === 0) {
            const payloadJson = JSON.stringify(payload || fullBody, null, 2);
            const truncated = payloadJson.length > 3800 
                ? payloadJson.slice(0, 3797) + '...' 
                : payloadJson;
    
            messageParts.push(`📦 Полные данные (JSON):\n${truncated}`);
       }
        return messageParts.join('\n');
    } catch (e) {
        console.error('Format message error:', e.message);
        return `❌ Ошибка форматирования сообщения: ${e.message}\n📦 Данные:\n${JSON.stringify(payload || fullBody).slice(0, 4000)}`;
    }
}

// ────────────────────────────────────────────────────────────────
// Функции очереди сообщений (без изменений)
// ────────────────────────────────────────────────────────────────

async function addMessageToQueue(botToken, chatId, messageText, priority = 0, webhookLogId = null, accountId = null) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return sendTelegramMessageDirect(botToken, chatId, messageText);
    }
    try {
        const result = await db.query(
            `INSERT INTO message_queue (bot_token, chat_id, message_text, priority, webhook_log_id, account_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [botToken, chatId, messageText, priority, webhookLogId, accountId]
        );
        return { queued: true, id: result.rows[0].id };
    } catch (error) {
        console.error('Error adding message to queue:', error);
        return sendTelegramMessageDirect(botToken, chatId, messageText);
    }
}

async function sendTelegramMessageDirect(botToken, chatId, messageText) {
    try {
        const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: messageText
        });
        return { success: true, response: response.data };
    } catch (error) {
        const errDetail = error.response?.data || error.message;
        console.error('Telegram send error:', errDetail);
        return { success: false, error: errDetail };
    }
}

async function getNextMessageFromQueue() {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') return null;
    try {
        const result = await db.query(
            `SELECT id, bot_token, chat_id, message_text, attempts, max_attempts
             FROM message_queue
             WHERE status = 'pending' AND created_at <= CURRENT_TIMESTAMP
             ORDER BY priority DESC, created_at ASC
             LIMIT 1 FOR UPDATE SKIP LOCKED`
        );
        if (result.rows.length === 0) return null;

        await db.query(`UPDATE message_queue SET status = 'processing' WHERE id = $1`, [result.rows[0].id]);
        return result.rows[0];
    } catch (error) {
        console.error('Error getting message from queue:', error);
        return null;
    }
}

async function updateMessageStatus(id, status, errorMessage = null) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') return;
    try {
        if (status === 'sent') {
            await db.query(`UPDATE message_queue SET status = $1, sent_at = CURRENT_TIMESTAMP WHERE id = $2`, [status, id]);
        } else if (status === 'failed') {
            await db.query(`UPDATE message_queue SET status = $1, error_message = $2, attempts = attempts + 1 WHERE id = $3`, [status, errorMessage, id]);
        } else {
            await db.query(`UPDATE message_queue SET status = $1 WHERE id = $2`, [status, id]);
        }
    } catch (error) {
        console.error('Error updating message status:', error);
    }
}

const rateLimiters = new Map();
function checkRateLimit(chatId) {
    const now = Date.now();
    const chatIdStr = String(chatId);
    const isGroup = chatIdStr.startsWith('-');
    const limitWindow = isGroup ? 60000 : 1000;
    const limitCount = isGroup ? 20 : 1;

    if (!rateLimiters.has(chatIdStr)) {
        rateLimiters.set(chatIdStr, { count: 0, resetAt: now + limitWindow });
    }
    const limiter = rateLimiters.get(chatIdStr);

    if (now >= limiter.resetAt) {
        limiter.count = 0;
        limiter.resetAt = now + limitWindow;
    }

    if (limiter.count >= limitCount) return false;
    limiter.count++;
    return true;
}

let globalMessageCount = 0;
let globalResetAt = Date.now() + 1000;
function checkGlobalRateLimit() {
    const now = Date.now();
    if (now >= globalResetAt) {
        globalMessageCount = 0;
        globalResetAt = now + 1000;
    }
    if (globalMessageCount >= 30) return false;
    globalMessageCount++;
    return true;
}

let workerRunning = false;
let workerInterval = null;

async function processMessageQueue() {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') return;
    if (!checkGlobalRateLimit()) return;

    const message = await getNextMessageFromQueue();
    if (!message) return;

    if (!checkRateLimit(message.chat_id)) {
        await updateMessageStatus(message.id, 'pending');
        return;
    }

    try {
        const result = await sendTelegramMessageDirect(message.bot_token, message.chat_id, message.message_text);
        if (result.success) {
            await updateMessageStatus(message.id, 'sent');
            console.log(`Message ${message.id} sent successfully to chat ${message.chat_id}`);
        } else {
            const isRateLimitError = result.error && (
                (typeof result.error === 'string' && result.error.includes('429')) ||
                (result.error.error_code === 429) ||
                (result.error.description && result.error.description.includes('Too Many Requests'))
            );

            if (isRateLimitError) {
                await db.query(
                    `UPDATE message_queue SET status = 'pending',
                     created_at = CURRENT_TIMESTAMP + INTERVAL '5 seconds',
                     error_message = $1, attempts = attempts + 1
                     WHERE id = $2`,
                    [JSON.stringify(result.error), message.id]
                );
                console.log(`Message ${message.id} rate limited, retry in 5s`);
            } else if (message.attempts + 1 >= message.max_attempts) {
                await updateMessageStatus(message.id, 'failed', JSON.stringify(result.error));
            } else {
                await updateMessageStatus(message.id, 'pending', JSON.stringify(result.error));
            }
        }
    } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        if (message.attempts + 1 >= message.max_attempts) {
            await updateMessageStatus(message.id, 'failed', error.message);
        } else {
            await updateMessageStatus(message.id, 'pending', error.message);
        }
    }
}

function startMessageQueueWorker() {
    if (workerRunning) return;
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        console.log('Message queue worker not started: database not available');
        return;
    }
    workerRunning = true;
    console.log('Message queue worker started');

    workerInterval = setInterval(() => {
        processMessageQueue().catch(err => console.error('Worker error:', err));
    }, 100);

    setInterval(async () => {
        try {
            await db.query(
                `DELETE FROM message_queue
                 WHERE (status = 'sent' AND sent_at < NOW() - INTERVAL '7 days')
                    OR (status = 'failed' AND created_at < NOW() - INTERVAL '7 days')`
            );
        } catch (error) {
            console.error('Error cleaning old queue messages:', error);
        }
    }, 3600000);
}

// ────────────────────────────────────────────────────────────────
// POLLING WORKER
// ────────────────────────────────────────────────────────────────

function normalizePoll(poll) {
    const intervalSec = Math.max(5, parseInt(poll.intervalSec, 10) || 60);
    return {
        id: poll.id,
        name: (poll.name || '').trim(),
        url: (poll.url || '').trim(),
        method: (poll.method || 'GET').toUpperCase(),
        headersJson: typeof poll.headersJson === 'string' ? poll.headersJson : '',
        bodyJson: typeof poll.bodyJson === 'string' ? poll.bodyJson : '',
        conditionJson: typeof poll.conditionJson === 'string' ? poll.conditionJson : '',
        messageTemplate: typeof poll.messageTemplate === 'string' ? poll.messageTemplate : '',
        chatId: (poll.chatId || '').toString().trim(),
        botToken: typeof poll.botToken === 'string' ? poll.botToken.trim() : '',
        enabled: poll.enabled !== false,
        onlyOnChange: poll.onlyOnChange !== false,
        continueAfterMatch: poll.continueAfterMatch !== false,
        timeoutSec: Math.max(3, parseInt(poll.timeoutSec, 10) || 10),
        intervalSec,
        lastCheckedAt: poll.lastCheckedAt || null,
        lastMatch: poll.lastMatch === true,
        lastError: poll.lastError || null,
        authorId: poll.authorId ?? 'vadmin'
    };
}

function parseJsonSafe(text, fallback) {
    if (!text || typeof text !== 'string') return fallback;
    try {
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

function getValueByPath(obj, path) {
    if (!obj || !path) return undefined;
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    return normalizedPath
        .split('.')
        .filter(Boolean)
        .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function evaluateConditionItem(item, payload) {
    const path = typeof item.path === 'string' ? item.path.trim() : '';
    if (!path) return false;
    const actual = getValueByPath(payload, path);
    const expected = item.value;
    const op = (item.op || '==').toString();

    if (op === 'exists') return actual !== undefined && actual !== null;

    const actualNum = Number(actual);
    const expectedNum = Number(expected);
    const bothNumeric = !Number.isNaN(actualNum) && !Number.isNaN(expectedNum);

    switch (op) {
        case '==':
            return actual == expected;
        case '!=':
            return actual != expected;
        case '>':
            return bothNumeric ? actualNum > expectedNum : false;
        case '<':
            return bothNumeric ? actualNum < expectedNum : false;
        case '>=':
            return bothNumeric ? actualNum >= expectedNum : false;
        case '<=':
            return bothNumeric ? actualNum <= expectedNum : false;
        case 'includes':
            if (Array.isArray(actual)) return actual.includes(expected);
            if (typeof actual === 'string') return actual.includes(String(expected));
            return false;
        default:
            return false;
    }
}

function evaluatePollCondition(conditionJson, payload) {
    if (!conditionJson) return true;
    const condition = typeof conditionJson === 'string' ? parseJsonSafe(conditionJson, null) : conditionJson;
    if (!condition || !Array.isArray(condition.conditions) || condition.conditions.length === 0) return true;
    const logic = (condition.logic || 'AND').toUpperCase();
    const results = condition.conditions.map(item => evaluateConditionItem(item, payload));
    return logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

async function persistPoll(poll) {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            await db.query('UPDATE polls SET data = $1 WHERE id = $2', [poll, poll.id]);
        } catch (e) {
            console.error('Error updating poll in database:', e);
        }
    } else {
        const idx = pollsCache.findIndex(p => p.id === poll.id);
        if (idx >= 0) {
            pollsCache[idx] = poll;
            db.polls = pollsCache;
            savePolls();
        }
    }
}

async function logPollRun(poll, data) {
    const run = {
        id: Date.now(),
        pollId: poll.id,
        status: data.status || 'success',
        matched: data.matched === true,
        sent: data.sent === true,
        errorMessage: data.errorMessage || null,
        responseSnippet: data.responseSnippet || null,
        requestMethod: data.requestMethod || null,
        requestUrl: data.requestUrl || null,
        requestHeaders: data.requestHeaders || null,
        requestBody: data.requestBody || null,
        responseStatus: data.responseStatus || null,
        responseHeaders: data.responseHeaders || null,
        createdAt: new Date().toISOString()
    };

    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const accountId = poll.account_id ?? null;
            await db.query(
                `INSERT INTO poll_runs (
                    poll_id, status, matched, sent, error_message, response_snippet,
                    request_method, request_url, request_headers, request_body,
                    response_status, response_headers, account_id
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                    run.pollId,
                    run.status,
                    run.matched,
                    run.sent,
                    run.errorMessage,
                    run.responseSnippet,
                    run.requestMethod,
                    run.requestUrl,
                    run.requestHeaders,
                    run.requestBody,
                    run.responseStatus,
                    run.responseHeaders,
                    accountId
                ]
            );
            await db.query(
                `DELETE FROM poll_runs
                 WHERE id NOT IN (
                    SELECT id FROM poll_runs ORDER BY created_at DESC LIMIT 100
                 )`
            );
        } catch (e) {
            console.error('Error saving poll run to database:', e);
        }
    } else {
        db.pollRuns.push(run);
        if (db.pollRuns.length > 100) {
            db.pollRuns = db.pollRuns.slice(-100);
        }
        savePollRuns();
    }
}

async function executePoll(poll, options = {}) {
    if (!poll.enabled && !options.force) return;

    const headers = parseJsonSafe(poll.headersJson, {});
    const body = parseJsonSafe(poll.bodyJson, null);
    const timeout = poll.timeoutSec * 1000;
    const method = poll.method || 'GET';

    const requestHeadersText = poll.headersJson || '';
    const requestBodyText = poll.bodyJson || '';

    try {
        const requestConfig = {
            url: poll.url,
            method,
            headers,
            timeout
        };
        if (body !== null && !['GET', 'HEAD'].includes(method.toUpperCase())) {
            requestConfig.data = body;
        }
        const response = await axios(requestConfig);

        const payload = response.data ?? {};
        const matched = evaluatePollCondition(poll.conditionJson, payload);
        const responseHeadersText = response.headers ? JSON.stringify(response.headers) : null;
        const responseSnippet = (() => {
            try {
                const json = JSON.stringify(payload, null, 2);
                return json.length > 10000 ? `${json.slice(0, 9997)}...` : json;
            } catch {
                return null;
            }
        })();

        poll.lastCheckedAt = new Date().toISOString();
        poll.lastError = null;

        let sent = false;
        if (matched && (!poll.onlyOnChange || !poll.lastMatch)) {
            const botToken = poll.botToken || TELEGRAM_BOT_TOKEN;
            const messageText = formatMessage(payload, payload, { messageTemplate: poll.messageTemplate });
            if (botToken && poll.chatId) {
                const result = await addMessageToQueue(botToken, poll.chatId, messageText, 0, null, poll.account_id);
                sent = result && result.success !== false;
            }
        }

        if (matched && sent && poll.continueAfterMatch === false) {
            poll.enabled = false;
        }

        poll.lastMatch = matched;
        await persistPoll(poll);
        await logPollRun(poll, {
            status: 'success',
            matched,
            sent,
            responseSnippet,
            requestMethod: method,
            requestUrl: poll.url,
            requestHeaders: requestHeadersText,
            requestBody: requestBodyText,
            responseStatus: response.status,
            responseHeaders: responseHeadersText
        });
    } catch (error) {
        poll.lastCheckedAt = new Date().toISOString();
        poll.lastError = error.response?.data?.description || error.message || 'Unknown error';
        await persistPoll(poll);
        const errorResponse = error.response?.data;
        const errorSnippet = errorResponse
            ? (() => {
                try {
                    const json = JSON.stringify(errorResponse, null, 2);
                    return json.length > 10000 ? `${json.slice(0, 9997)}...` : json;
                } catch {
                    return null;
                }
            })()
            : null;
        await logPollRun(poll, {
            status: 'error',
            matched: false,
            sent: false,
            errorMessage: poll.lastError,
            responseSnippet: errorSnippet,
            requestMethod: method,
            requestUrl: poll.url,
            requestHeaders: requestHeadersText,
            requestBody: requestBodyText,
            responseStatus: error.response?.status || null,
            responseHeaders: error.response?.headers ? JSON.stringify(error.response.headers) : null
        });
    }
}

function stopPollWorkers() {
    for (const timer of pollTimers.values()) {
        clearInterval(timer);
    }
    pollTimers.clear();
}

function startPollWorkers() {
    stopPollWorkers();
    if (!pollsCache || pollsCache.length === 0) return;

    pollsCache.forEach(rawPoll => {
        const poll = normalizePoll(rawPoll);
        const timer = setInterval(() => {
            executePoll(poll).catch(err => console.error('Poll error:', err));
        }, poll.intervalSec * 1000);
        pollTimers.set(poll.id, timer);
    });
}

async function refreshPollWorkers() {
    await loadPollsCache();
    startPollWorkers();
}

// ────────────────────────────────────────────────────────────────
// АВТОРИЗАЦИЯ И УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ
// ────────────────────────────────────────────────────────────────

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (username === CRED_USER && password === CRED_PASS) {
        const token = Date.now().toString();
        sessions.set(token, { username: CRED_USER, timestamp: Date.now() });
        saveSessions();
        return res.json({ token, status: 'success', username: CRED_USER });
    }

    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const result = await db.query('SELECT id, username, password_hash, account_id, role FROM users WHERE username = $1', [username]);
            if (result.rows.length > 0) {
                const user = result.rows[0];
                const match = await bcrypt.compare(password, user.password_hash);
                if (match) {
                    const token = Date.now().toString();
                    sessions.set(token, {
                        username: user.username,
                        userId: user.id,
                        accountId: user.account_id,
                        role: user.role || 'administrator',
                        timestamp: Date.now()
                    });
                    saveSessions();
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
    saveSessions();
    res.json({ status: 'ok' });
});

app.get('/api/me', auth, async (req, res) => {
    const isVadmin = req.user.username === 'vadmin';
    let accountSlug = null;
    if (req.user.accountId && process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const acc = await db.query('SELECT slug FROM accounts WHERE id = $1', [req.user.accountId]);
            accountSlug = acc.rows[0]?.slug || ('account_' + req.user.accountId);
        } catch (e) {
            accountSlug = 'account_' + req.user.accountId;
        }
    }
    res.json({
        username: req.user.username,
        userId: req.user.userId || null,
        accountId: req.user.accountId ?? null,
        accountSlug: accountSlug || null,
        role: isVadmin ? 'administrator' : (req.user.role || 'administrator'),
        isVadmin
    });
});

app.get('/api/auth-status', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = token ? sessions.get(token) : null;

    if (session && Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
        sessions.delete(token);
        saveSessions();
        res.json({ authenticated: false });
        return;
    }

    res.json({
        authenticated: !!session,
        username: session ? session.username : null
    });
});

// ────────────────────────────────────────────────────────────────
// АККАУНТЫ (только vadmin)
// ────────────────────────────────────────────────────────────────

app.get('/api/accounts', auth, vadminOnly, async (req, res) => {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const result = await db.query('SELECT id, name, slug, created_at FROM accounts ORDER BY id');
            res.json(result.rows);
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'DB error' });
        }
    } else {
        res.json([]);
    }
});

function slugifyAccountName(name) {
    return String(name)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        || 'account';
}

app.post('/api/accounts', auth, vadminOnly, async (req, res) => {
    const name = req.body.name && String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'Account name is required' });
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            let slug = slugifyAccountName(name);
            const existing = await db.query('SELECT id FROM accounts WHERE slug = $1', [slug]);
            if (existing.rows.length > 0) {
                let n = 1;
                while ((await db.query('SELECT id FROM accounts WHERE slug = $1', [slug + '_' + n])).rows.length > 0) n++;
                slug = slug + '_' + n;
            }
            const result = await db.query('INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at', [name, slug]);
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'DB error' });
        }
    } else {
        res.status(400).json({ error: 'Accounts require database' });
    }
});

// ────────────────────────────────────────────────────────────────
// УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ
// ────────────────────────────────────────────────────────────────

app.get('/api/users', auth, async (req, res) => {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            if (req.user.username === 'vadmin') {
                const result = await db.query(
                    `SELECT u.id, u.username, u.created_at, u.updated_at, u.account_id, u.role, a.name as account_name
                     FROM users u LEFT JOIN accounts a ON u.account_id = a.id ORDER BY u.created_at DESC`
                );
                return res.json(result.rows);
            }
            const accountId = req.user.accountId;
            if (accountId == null) return res.json([]);
            const result = await db.query(
                'SELECT id, username, created_at, updated_at, account_id, role FROM users WHERE account_id = $1 ORDER BY created_at DESC',
                [accountId]
            );
            res.json(result.rows);
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'DB error' });
        }
    } else {
        res.json([]);
    }
});

app.post('/api/users', auth, async (req, res) => {
    const { username, password, account_id, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username === 'vadmin') return res.status(400).json({ error: 'Cannot create vadmin user' });
    const isVadmin = req.user.username === 'vadmin';
    let accountId = account_id != null ? parseInt(account_id, 10) : null;
    if (isVadmin) {
        if (accountId == null) return res.status(400).json({ error: 'Account is required' });
    } else {
        if (req.user.role !== 'administrator') return res.status(403).json({ error: 'Only administrator can create users in the account' });
        accountId = req.user.accountId ?? null;
        if (accountId == null) return res.status(400).json({ error: 'Account is required' });
    }
    const roleVal = role === 'auditor' ? 'auditor' : 'administrator';

    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
            if (existing.rows.length > 0) return res.status(400).json({ error: 'Username already exists' });
            const accountExists = await db.query('SELECT id FROM accounts WHERE id = $1', [accountId]);
            if (accountExists.rows.length === 0) return res.status(400).json({ error: 'Account not found' });

            const passwordHash = await bcrypt.hash(password, 10);
            const result = await db.query(
                'INSERT INTO users (username, password_hash, account_id, role) VALUES ($1, $2, $3, $4) RETURNING id, username, created_at, updated_at, account_id, role',
                [username, passwordHash, accountId, roleVal]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error('DB error:', err);
            if (err.code === '23505') return res.status(400).json({ error: 'Username already exists' });
            res.status(500).json({ error: 'DB error' });
        }
    } else {
        res.status(400).json({ error: 'User management requires database' });
    }
});

/** Update own profile (login/username and password). Non-vadmin only for self. */
app.put('/api/users/me', auth, async (req, res) => {
    if (req.user.username === 'vadmin') return res.status(400).json({ error: 'vadmin profile cannot be changed here' });
    const userId = req.user.userId;
    if (!userId) return res.status(401).json({ error: 'User not found' });
    const { username, password, oldPassword } = req.body;

    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const updates = [];
            const values = [];
            let idx = 1;
            if (username !== undefined && String(username).trim()) {
                const newUsername = String(username).trim();
                const existing = await db.query('SELECT id FROM users WHERE username = $1 AND id != $2', [newUsername, userId]);
                if (existing.rows.length > 0) return res.status(400).json({ error: 'Username already taken' });
                updates.push(`username = $${idx++}`);
                values.push(newUsername);
            }
            if (password !== undefined && password !== '') {
                const userRow = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
                if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                if (!oldPassword || !await bcrypt.compare(oldPassword, userRow.rows[0].password_hash)) {
                    return res.status(401).json({ error: 'Invalid old password' });
                }
                updates.push(`password_hash = $${idx++}`);
                values.push(await bcrypt.hash(password, 10));
            }
            values.push(userId);
            if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
            await db.query(
                `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`,
                values
            );
            res.json({ status: 'ok' });
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'DB error' });
        }
    } else {
        res.status(400).json({ error: 'Requires database' });
    }
});

app.put('/api/users/:id/password', auth, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { password, oldPassword } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const isVadmin = req.user.username === 'vadmin';
            if (!isVadmin) {
                if (req.user.userId !== userId) return res.status(403).json({ error: 'You can only change your own password' });
                if (!oldPassword) return res.status(400).json({ error: 'Old password required' });

                const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
                if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                if (!await bcrypt.compare(oldPassword, userResult.rows[0].password_hash)) {
                    return res.status(401).json({ error: 'Invalid old password' });
                }
            } else {
                const exists = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
                if (exists.rows.length === 0) return res.status(404).json({ error: 'User not found' });
            }

            const passwordHash = await bcrypt.hash(password, 10);
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

app.delete('/api/users/:id', auth, async (req, res) => {
    const userId = parseInt(req.params.id);
    if (userId === req.user.userId) return res.status(400).json({ error: 'Cannot delete yourself' });
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const isVadmin = req.user.username === 'vadmin';
            if (!isVadmin) {
                if (req.user.role !== 'administrator') return res.status(403).json({ error: 'Only administrator can delete users' });
                const target = await db.query('SELECT account_id FROM users WHERE id = $1', [userId]);
                if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                if (target.rows[0].account_id !== req.user.accountId) return res.status(403).json({ error: 'Can only delete users in your account' });
            }
            const result = await db.query('DELETE FROM users WHERE id = $1', [userId]);
            if (result.rowCount > 0) res.json({ status: 'deleted' });
            else res.status(404).json({ error: 'User not found' });
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'DB error' });
        }
    } else {
        res.status(400).json({ error: 'User management requires database' });
    }
});

// ────────────────────────────────────────────────────────────────
// ТОКЕН БОТА
// ────────────────────────────────────────────────────────────────

app.post('/api/bot-token', auth, async (req, res) => {
    const newToken = req.body.botToken;
    if (!newToken || newToken === 'YOUR_TOKEN') return res.status(400).json({ error: 'Invalid token' });

    try {
        const response = await axios.get(`https://api.telegram.org/bot${newToken}/getMe`);
        if (!response.data.ok) return res.status(400).json({ error: 'Invalid bot token' });
    } catch {
        return res.status(400).json({ error: 'Invalid bot token' });
    }

    TELEGRAM_BOT_TOKEN = newToken;

    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            await db.query(
                'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
                ['global_bot_token', newToken]
            );
            console.log('Global bot token saved to database');
        } catch (err) {
            console.error('Error saving bot token to database:', err);
        }
    } else {
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
    if (!chatId || !message) return res.status(400).json({ error: 'chatId and message required' });

    const token = botToken || TELEGRAM_BOT_TOKEN;
    if (!token || token === 'YOUR_TOKEN') return res.status(400).json({ success: false, error: 'Bot token is required' });

    try {
        const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: message
        });
        res.json({ success: true, response: response.data });
    } catch (error) {
        console.error('Telegram send error:', error.response?.data || error.message);
        let errorMessage = 'Неизвестная ошибка';
        if (error.response?.data) {
            const telegramError = error.response.data;
            errorMessage = telegramError.description || `Ошибка ${telegramError.error_code || 'неизвестная'}`;
        } else {
            errorMessage = error.message;
        }
        res.status(400).json({ success: false, error: errorMessage });
    }
});

// ────────────────────────────────────────────────────────────────
// УПРАВЛЕНИЕ ПРАВИЛАМИ
// ────────────────────────────────────────────────────────────────

app.get('/api/rules', auth, async (req, res) => {
    let rules = [];
    const accountId = getAccountId(req);
    if (process.env.DATABASE_URL) {
        try {
            if (accountId != null) {
                const result = await db.query('SELECT id, data FROM rules WHERE account_id = $1', [accountId]);
                rules = result.rows.map(r => ({ ...r.data, id: r.id }));
            } else {
                const result = await db.query('SELECT id, data, account_id FROM rules');
                rules = result.rows.map(r => ({ ...r.data, id: r.id, account_id: r.account_id }));
            }
        } catch (err) {
            console.error('DB error:', err);
            return res.status(500).json({ error: 'DB error' });
        }
    } else {
        rules = db.rules;
    }

    rules = rules.map(r => {
        if (r.authorId === undefined) r.authorId = 'vadmin';
        r.botToken = typeof r.botToken === 'string' ? r.botToken : '';
        r.messageTemplate = typeof r.messageTemplate === 'string' ? r.messageTemplate : '';
        return r;
    });

    res.json(rules);
});

app.get('/api/rules/:id', auth, async (req, res) => {
    const ruleId = parseInt(req.params.id);
    const accountId = getAccountId(req);
    try {
        let rule;
        if (process.env.DATABASE_URL) {
            const q = accountId != null
                ? db.query('SELECT id, data FROM rules WHERE id = $1 AND account_id = $2', [ruleId, accountId])
                : db.query('SELECT id, data FROM rules WHERE id = $1', [ruleId]);
            const result = await q;
            if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
            const row = result.rows[0];
            rule = { ...row.data, id: row.id };
        } else {
            rule = db.rules.find(r => r.id == ruleId);
            if (!rule) return res.status(404).json({ error: 'Rule not found' });
        }
        if (rule.authorId === undefined) rule.authorId = 'vadmin';
        rule.messageTemplate = rule.messageTemplate || '';
        res.json(rule);
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ error: 'DB error' });
    }
});

app.post('/api/rules', auth, blockAuditorWrite, async (req, res) => {
    try {
        const accountId = getAccountIdForCreate(req);
        if (accountId == null) return res.status(400).json({ error: 'Account required to create rule' });

        const { botToken, messageTemplate = '', ...ruleData } = req.body;
        const trimmedToken = typeof botToken === 'string' ? botToken.trim() : '';
        const resolvedToken = trimmedToken || TELEGRAM_BOT_TOKEN;

        if (!resolvedToken || resolvedToken === 'YOUR_TOKEN') {
            return res.status(400).json({ error: 'Bot token is required' });
        }

        // Validate with Telegram only when rule has its own token; if empty we use env token at runtime
        if (trimmedToken) {
            try {
                const response = await axios.get(`https://api.telegram.org/bot${trimmedToken}/getMe`);
                if (!response.data.ok) {
                    return res.status(400).json({ error: 'Invalid bot token' });
                }
            } catch (err) {
                return res.status(400).json({ error: 'Invalid bot token or network error' });
            }
        }

        const authorId = req.user.userId || (req.user.username === 'vadmin' ? 'vadmin' : null);
        const safeMessageTemplate = typeof messageTemplate === 'string' ? messageTemplate : '';
        const newRule = {
            id: Date.now(),
            ...ruleData,
            botToken: trimmedToken,
            messageTemplate: safeMessageTemplate.trim(),
            enabled: req.body.enabled !== false,
            encoding: 'utf8',
            authorId: authorId ?? 'vadmin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (process.env.DATABASE_URL) {
            await db.query('INSERT INTO rules (id, data, account_id) VALUES ($1, $2, $3)', [newRule.id, newRule, accountId]);
        } else {
            db.rules.push(newRule);
            saveRules();
        }

        res.json(newRule);
    } catch (error) {
        console.error('Error in /api/rules POST:', error.response?.data || error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/rules/:id', auth, blockAuditorWrite, async (req, res) => {
    try {
        const ruleId = parseInt(req.params.id);
        const accountId = getAccountId(req);
        let rule;

        if (process.env.DATABASE_URL) {
            const q = accountId != null
                ? db.query('SELECT data FROM rules WHERE id = $1 AND account_id = $2', [ruleId, accountId])
                : db.query('SELECT data FROM rules WHERE id = $1', [ruleId]);
            const result = await q;
            if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
            rule = result.rows[0].data;
        } else {
            const idx = db.rules.findIndex(r => r.id == ruleId);
            if (idx < 0) return res.status(404).json({ error: 'not found' });
            rule = db.rules[idx];
        }

        if (rule.authorId === undefined) rule.authorId = 'vadmin';

        const { botToken, messageTemplate, ...ruleData } = req.body;

        if ('botToken' in req.body) {
            if (typeof botToken !== 'string') {
                return res.status(400).json({ error: 'Bot token must be a string' });
            }
            const trimmedToken = botToken.trim();
            if (trimmedToken) {
                const response = await axios.get(`https://api.telegram.org/bot${trimmedToken}/getMe`);
                if (!response.data.ok) {
                    return res.status(400).json({ error: 'Invalid bot token' });
                }
            }
            ruleData.botToken = trimmedToken;
        }

        const updated = {
            ...rule,
            ...ruleData,
            messageTemplate: messageTemplate !== undefined ? (messageTemplate || '').trim() : rule.messageTemplate || '',
            updated_at: new Date().toISOString()
        };

        if (!updated.botToken && (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'YOUR_TOKEN')) {
            return res.status(400).json({ error: 'Bot token is required' });
        }

        if (process.env.DATABASE_URL) {
            await db.query('UPDATE rules SET data = $1 WHERE id = $2', [updated, ruleId]);
        } else {
            const idx = db.rules.findIndex(r => r.id == ruleId);
            db.rules[idx] = updated;
            saveRules();
        }

        res.json(updated);
    } catch (error) {
        console.error('Error in /api/rules PUT:', error.response?.data || error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/rules/:id', auth, blockAuditorWrite, async (req, res) => {
    try {
        const ruleId = parseInt(req.params.id);
        const accountId = getAccountId(req);

        if (process.env.DATABASE_URL) {
            const deleteQ = accountId != null
                ? db.query('DELETE FROM rules WHERE id = $1 AND account_id = $2', [ruleId, accountId])
                : db.query('DELETE FROM rules WHERE id = $1', [ruleId]);
            const deleteResult = await deleteQ;
            if (deleteResult.rowCount > 0) {
                res.json({ status: 'deleted' });
            } else {
                res.status(404).json({ error: 'Rule not found' });
            }
        } else {
            const idx = db.rules.findIndex(r => r.id == ruleId);
            db.rules.splice(idx, 1);
            saveRules();
            res.json({ status: 'deleted' });
        }
    } catch (error) {
        console.error('Error in /api/rules DELETE:', error.response?.data || error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ────────────────────────────────────────────────────────────────
// POLLING CONFIG
// ────────────────────────────────────────────────────────────────

app.get('/api/polls', auth, async (req, res) => {
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            if (accountId != null) {
                const result = await db.query('SELECT id, data FROM polls WHERE account_id = $1', [accountId]);
                return res.json(result.rows.map(r => ({ ...r.data, id: r.id })));
            }
            const result = await db.query('SELECT id, data FROM polls');
            return res.json(result.rows.map(r => ({ ...r.data, id: r.id })));
        }
        return res.json(pollsCache || []);
    } catch (error) {
        console.error('Error loading polls:', error);
        res.status(500).json({ error: 'Failed to load polls' });
    }
});

app.post('/api/polls', auth, blockAuditorWrite, async (req, res) => {
    try {
        const accountId = getAccountIdForCreate(req);
        if (accountId == null) return res.status(400).json({ error: 'Account required to create poll' });

        const authorId = req.user.userId || (req.user.username === 'vadmin' ? 'vadmin' : null);
        const newPoll = normalizePoll({
            id: Date.now(),
            ...req.body,
            authorId: authorId ?? 'vadmin'
        });

        if (!newPoll.name || !newPoll.url || !newPoll.chatId) {
            return res.status(400).json({ error: 'name, url and chatId are required' });
        }

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            await db.query('INSERT INTO polls (id, data, account_id) VALUES ($1, $2, $3)', [newPoll.id, newPoll, accountId]);
        } else {
            pollsCache.push(newPoll);
            db.polls = pollsCache;
            savePolls();
        }

        await refreshPollWorkers();
        res.json(newPoll);
    } catch (error) {
        console.error('Error creating poll:', error);
        res.status(500).json({ error: 'Failed to create poll' });
    }
});

app.put('/api/polls/:id', auth, blockAuditorWrite, async (req, res) => {
    try {
        const pollId = parseInt(req.params.id, 10);
        const accountId = getAccountId(req);
        let poll;

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const q = accountId != null
                ? db.query('SELECT data FROM polls WHERE id = $1 AND account_id = $2', [pollId, accountId])
                : db.query('SELECT data FROM polls WHERE id = $1', [pollId]);
            const result = await q;
            if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
            poll = result.rows[0].data;
        } else {
            poll = pollsCache.find(p => p.id === pollId);
            if (!poll) return res.status(404).json({ error: 'not found' });
        }

        const updated = normalizePoll({
            ...poll,
            ...req.body,
            id: pollId,
            authorId: poll.authorId ?? 'vadmin'
        });

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            await db.query('UPDATE polls SET data = $1 WHERE id = $2', [updated, pollId]);
        } else {
            const idx = pollsCache.findIndex(p => p.id === pollId);
            pollsCache[idx] = updated;
            db.polls = pollsCache;
            savePolls();
        }

        await refreshPollWorkers();
        res.json(updated);
    } catch (error) {
        console.error('Error updating poll:', error);
        res.status(500).json({ error: 'Failed to update poll' });
    }
});

app.delete('/api/polls/:id', auth, blockAuditorWrite, async (req, res) => {
    try {
        const pollId = parseInt(req.params.id, 10);
        const accountId = getAccountId(req);

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const deleteQ = accountId != null
                ? db.query('DELETE FROM polls WHERE id = $1 AND account_id = $2', [pollId, accountId])
                : db.query('DELETE FROM polls WHERE id = $1', [pollId]);
            const deleteResult = await deleteQ;
            if (deleteResult.rowCount === 0) return res.status(404).json({ error: 'not found' });
        } else {
            const poll = pollsCache.find(p => p.id === pollId);
            if (!poll) return res.status(404).json({ error: 'not found' });
            pollsCache = pollsCache.filter(p => p.id !== pollId);
            db.polls = pollsCache;
            savePolls();
        }

        await refreshPollWorkers();
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Error deleting poll:', error);
        res.status(500).json({ error: 'Failed to delete poll' });
    }
});

app.post('/api/polls/:id/run', auth, blockAuditorWrite, async (req, res) => {
    try {
        const pollId = parseInt(req.params.id, 10);
        const accountId = getAccountId(req);
        let poll;

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const q = accountId != null
                ? db.query('SELECT data FROM polls WHERE id = $1 AND account_id = $2', [pollId, accountId])
                : db.query('SELECT data FROM polls WHERE id = $1', [pollId]);
            const result = await q;
            if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
            poll = result.rows[0].data;
        } else {
            poll = pollsCache.find(p => p.id === pollId);
            if (!poll) return res.status(404).json({ error: 'not found' });
        }

        const normalized = normalizePoll(poll);
        await executePoll(normalized, { force: true });
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Error running poll:', error);
        res.status(500).json({ error: 'Failed to run poll' });
    }
});

app.get('/api/polls/history', auth, async (req, res) => {
    const accountId = getAccountId(req);
    try {
        const pollIdRaw = req.query.pollId;
        const pollId = pollIdRaw ? parseInt(pollIdRaw, 10) : null;
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            if (accountId != null) {
                const result = await db.query(
                    `SELECT id, poll_id, status, matched, sent, error_message, response_snippet,
                            request_method, request_url, request_headers, request_body,
                            response_status, response_headers, created_at
                     FROM poll_runs
                     WHERE account_id = $1 AND ($2::bigint IS NULL OR poll_id = $2)
                     ORDER BY created_at DESC
                     LIMIT $3`,
                    [accountId, pollId, limit]
                );
                return res.json(result.rows);
            }
            const result = await db.query(
                `SELECT id, poll_id, status, matched, sent, error_message, response_snippet,
                        request_method, request_url, request_headers, request_body,
                        response_status, response_headers, created_at
                 FROM poll_runs
                 WHERE ($1::bigint IS NULL OR poll_id = $1)
                 ORDER BY created_at DESC
                 LIMIT $2`,
                [pollId, limit]
            );
            return res.json(result.rows);
        }

        let runs = db.pollRuns || [];
        if (pollId) {
            runs = runs.filter(r => r.pollId === pollId);
        }
        runs = runs.slice(-limit).reverse();
        res.json(runs.map(run => ({
            id: run.id,
            poll_id: run.pollId,
            status: run.status,
            matched: run.matched,
            sent: run.sent,
            error_message: run.errorMessage,
            response_snippet: run.responseSnippet,
            request_method: run.requestMethod,
            request_url: run.requestUrl,
            request_headers: run.requestHeaders,
            request_body: run.requestBody,
            response_status: run.responseStatus,
            response_headers: run.responseHeaders,
            created_at: run.createdAt
        })));
    } catch (error) {
        console.error('Error loading poll history:', error);
        res.status(500).json({ error: 'Failed to load poll history' });
    }
});

app.delete('/api/polls/history', auth, blockAuditorWrite, async (req, res) => {
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            if (accountId != null) {
                await db.query('DELETE FROM poll_runs WHERE account_id = $1', [accountId]);
            } else {
                await db.query('DELETE FROM poll_runs');
            }
        } else {
            db.pollRuns = [];
            savePollRuns();
        }
        res.json({ status: 'cleared' });
    } catch (error) {
        console.error('Error clearing poll history:', error);
        res.status(500).json({ error: 'Failed to clear poll history' });
    }
});

// ────────────────────────────────────────────────────────────────
// WEBHOOK — ПО АККАУНТУ: /webhook/:accountSlug
// ────────────────────────────────────────────────────────────────

app.post('/webhook/:accountSlug', async (req, res) => {
    const accountSlug = (req.params.accountSlug || '').trim().toLowerCase();
    if (!accountSlug) return res.status(400).json({ error: 'Account slug required' });

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

    let accountId = null;
    let rules = [];
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const acc = await db.query('SELECT id FROM accounts WHERE slug = $1', [accountSlug]);
            if (acc.rows.length === 0) return res.status(404).json({ error: 'Account not found', slug: accountSlug });
            accountId = acc.rows[0].id;
            const result = await db.query('SELECT id, data, account_id FROM rules WHERE account_id = $1', [accountId]);
            rules = result.rows.map(r => ({ ...r.data, id: r.id, account_id: r.account_id }));
        } catch (err) {
            console.error('DB error in webhook by slug:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    } else {
        return res.status(503).json({ error: 'Webhook by account requires database' });
    }

    let incomingPayload = req.body && typeof req.body === 'object' ? (req.body.payload ?? req.body) : req.body;
    let matched = 0;
    let telegram_results = [];

    for (const rule of rules) {
        if (!rule || rule.enabled === false) continue;
        let ruleMatches = false;
        try {
            const safeFn = new Function('payload', `
                try {
                    return ${rule.condition || 'false'};
                } catch (e) {
                    console.error('Condition evaluation error in rule ${rule.id || "(no id)"}:', e.message);
                    return false;
                }
            `);
            ruleMatches = !!safeFn(incomingPayload);
        } catch (evalErr) {
            console.error('Rule evaluation setup error for rule', rule.id || '(no id):', evalErr);
        }
        if (ruleMatches) {
            matched++;
            const messageText = formatMessage(req.body, incomingPayload, rule);
            let token = rule.botToken;
            if (!token || token === 'YOUR_TOKEN' || token === 'ВАШ_ТОКЕН_ЗДЕСЬ') {
                token = TELEGRAM_BOT_TOKEN;
                if (!token || token === 'YOUR_TOKEN') {
                    telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: rule.chatId || null, success: false, error: 'No bot token configured' });
                    continue;
                }
            }
            const chatIds = Array.isArray(rule.chatIds) ? rule.chatIds : (rule.chatId ? [rule.chatId] : []);
            if (chatIds.length === 0) {
                telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: null, success: false, error: 'No chatId configured' });
                continue;
            }
            for (const chat of chatIds) {
                try {
                    const queueResult = await addMessageToQueue(token, chat, messageText, 0, null, accountId);
                    if (queueResult.queued) {
                        telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: chat, success: true, queued: true, queueId: queueResult.id });
                    } else if (queueResult.success) {
                        telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: chat, success: true, response: queueResult.response });
                    } else {
                        telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: chat, success: false, error: queueResult.error });
                    }
                } catch (error) {
                    const errDetail = error.response?.data || error.message;
                    telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: chat, success: false, error: errDetail });
                }
            }
        }
    }

    logWebhook(req.body, matched, rules.length, telegram_results, accountId);
    res.json({ matched, telegram_results });
});

// ────────────────────────────────────────────────────────────────
// WEBHOOK — ОБЩИЙ (все правила, для обратной совместимости)
// ────────────────────────────────────────────────────────────────

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
            const result = await db.query('SELECT id, data, account_id FROM rules');
            rules = result.rows.map(r => ({ ...r.data, id: r.id, account_id: r.account_id }));
        } catch (err) {
            console.error('DB error in webhook:', err);
            rules = [];
        }
    } else {
        rules = db.rules;
    }

    let matched = 0;
    let telegram_results = [];
    let firstMatchedAccountId = null;

    for (const rule of rules) {
        if (!rule || rule.enabled === false) continue;

        let ruleMatches = false;
        try {
            const safeFn = new Function('payload', `
                try {
                    return ${rule.condition || 'false'};
                } catch (e) {
                    console.error('Condition evaluation error in rule ${rule.id || "(no id)"}:', e.message);
                    return false;
                }
            `);
            ruleMatches = !!safeFn(incomingPayload);
        } catch (evalErr) {
            console.error('Rule evaluation setup error for rule', rule.id || '(no id):', evalErr.message);
        }

        if (ruleMatches) {
            matched++;
            if (firstMatchedAccountId == null && rule.account_id != null) firstMatchedAccountId = rule.account_id;

            const messageText = formatMessage(req.body, incomingPayload, rule);

            let token = rule.botToken;
            if (!token || token === 'YOUR_TOKEN' || token === 'ВАШ_ТОКЕН_ЗДЕСЬ') {
                token = TELEGRAM_BOT_TOKEN;
                if (!token || token === 'YOUR_TOKEN') {
                    telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: rule.chatId || null, success: false, error: 'No bot token configured' });
                    continue;
                }
            }

            const chatIds = Array.isArray(rule.chatIds) ? rule.chatIds : (rule.chatId ? [rule.chatId] : []);
            if (chatIds.length === 0) {
                telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: null, success: false, error: 'No chatId configured' });
                continue;
            }

            for (const chat of chatIds) {
                try {
                    const queueResult = await addMessageToQueue(token, chat, messageText, 0, null, rule.account_id);
                    if (queueResult.queued) {
                        telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: chat, success: true, queued: true, queueId: queueResult.id });
                    } else if (queueResult.success) {
                        telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: chat, success: true, response: queueResult.response });
                    } else {
                        telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: chat, success: false, error: queueResult.error });
                    }
                } catch (error) {
                    const errDetail = error.response?.data || error.message;
                    console.error('Error queuing message for chat', chat, errDetail);
                    telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Правило #${rule.id}`, chatId: chat, success: false, error: errDetail });
                }
            }
        }
    }

    logWebhook(req.body, matched, rules.length, telegram_results, firstMatchedAccountId);
    res.json({ matched, telegram_results });
});

// ────────────────────────────────────────────────────────────────
// ДРУГИЕ РОУТЫ (логи, здоровье, очередь)
// ────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/message-queue/status', auth, async (req, res) => {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return res.json({ available: false, message: 'Message queue requires database' });
    }
    const accountId = getAccountId(req);
    try {
        const whereClause = accountId != null ? ' WHERE account_id = $1' : '';
        const params = accountId != null ? [accountId] : [];
        const stats = await db.query(`SELECT status, COUNT(*) as count FROM message_queue${whereClause} GROUP BY status`, params);
        const total = await db.query(`SELECT COUNT(*) as total FROM message_queue${whereClause}`, params);
        const pendingQ = accountId != null
            ? db.query(`SELECT COUNT(*) as count FROM message_queue WHERE status = 'pending' AND account_id = $1`, [accountId])
            : db.query(`SELECT COUNT(*) as count FROM message_queue WHERE status = 'pending'`);
        const pending = await pendingQ;

        const statsObj = {};
        stats.rows.forEach(row => statsObj[row.status] = parseInt(row.count));

        res.json({
            available: true,
            total: parseInt(total.rows[0].total),
            pending: parseInt(pending.rows[0].count),
            stats: statsObj,
            workerRunning: workerRunning
        });
    } catch (error) {
        console.error('Error getting queue status:', error);
        res.status(500).json({ error: 'Failed to get queue status' });
    }
});

app.get('/api/message-queue/history', auth, async (req, res) => {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') return res.json({ messages: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });

    const accountId = getAccountId(req);
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const status = req.query.status;

        const conditions = [];
        const params = [];
        if (accountId != null) {
            conditions.push(`account_id = $${params.length + 1}`);
            params.push(accountId);
        }
        if (status) {
            conditions.push(`status = $${params.length + 1}`);
            params.push(status);
        }
        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

        const query = `SELECT id, bot_token, chat_id, message_text, priority, status, attempts, max_attempts, created_at, sent_at, error_message FROM message_queue${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const result = await db.query(query, params);

        const messages = result.rows.map(row => ({
            id: row.id,
            botToken: row.bot_token ? row.bot_token.substring(0, 10) + '...' : null,
            chatId: row.chat_id,
            messageText: row.message_text.length > 100 ? row.message_text.substring(0, 100) + '...' : row.message_text,
            messageTextFull: row.message_text,
            priority: row.priority,
            status: row.status,
            attempts: row.attempts,
            maxAttempts: row.max_attempts,
            createdAt: row.created_at,
            sentAt: row.sent_at,
            errorMessage: row.error_message
        }));

        const countQuery = `SELECT COUNT(*) as total FROM message_queue${whereClause}`;
        const countParams = params.slice(0, -2);
        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);

        res.json({
            messages,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error getting queue history:', error);
        res.status(500).json({ error: 'Failed to get queue history' });
    }
});

app.get('/api/webhook-logs', auth, async (req, res) => {
    const accountId = getAccountId(req);
    if (process.env.DATABASE_URL) {
        try {
            if (accountId != null) {
                const result = await db.query('SELECT data FROM logs WHERE account_id = $1 ORDER BY id DESC', [accountId]);
                return res.json(result.rows.map(r => r.data));
            }
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
    const accountId = getAccountId(req);
    if (process.env.DATABASE_URL) {
        try {
            const q = accountId != null
                ? db.query('SELECT data FROM logs WHERE (data->>\'id\')::bigint = $1 AND account_id = $2', [logId, accountId])
                : db.query('SELECT data FROM logs WHERE (data->>\'id\')::bigint = $1', [logId]);
            const result = await q;
            if (result.rows.length === 0) return res.status(404).json({ error: 'Log not found' });
            res.json(result.rows[0].data);
        } catch (err) {
            console.error('Logs DB error:', err);
            res.status(500).json({ error: 'DB error' });
        }
    } else {
        const log = db.logs.find(l => l.id === logId);
        if (!log) return res.status(404).json({ error: 'Log not found' });
        res.json(log);
    }
});

app.delete('/api/webhook-logs', auth, blockAuditorWrite, async (req, res) => {
    const accountId = getAccountId(req);
    if (process.env.DATABASE_URL) {
        try {
            if (accountId != null) {
                await db.query('DELETE FROM logs WHERE account_id = $1', [accountId]);
            } else {
                await db.query('DELETE FROM logs');
            }
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

// ============ BOTS (SCHEDULED) API ============

async function loadBotsCache() {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const result = await db.query('SELECT id, data, account_id FROM bots');
            botsCache = result.rows.map(r => ({ ...r.data, id: r.id, account_id: r.account_id }));
        } catch (e) {
            console.error('Error loading bots cache:', e);
            botsCache = [];
        }
    }
}

async function logBotRun(botId, data) {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            await db.query(
                `INSERT INTO bot_runs (bot_id, status, message_type, error_message, account_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [botId, data.status || 'success', data.messageType || 'text', data.errorMessage || null, data.accountId ?? null]
            );
            // Cleanup old runs
            await db.query(
                `DELETE FROM bot_runs WHERE id NOT IN (
                    SELECT id FROM bot_runs ORDER BY created_at DESC LIMIT 200
                )`
            );
        } catch (e) {
            console.error('Error logging bot run:', e);
        }
    }
}

async function executeBot(bot) {
    const botToken = bot.botToken || TELEGRAM_BOT_TOKEN;
    if (!botToken || botToken === 'YOUR_TOKEN') {
        await logBotRun(bot.id, { status: 'error', messageType: bot.messageType, errorMessage: 'No bot token configured', accountId: bot.account_id });
        return;
    }
    if (!bot.chatId) {
        await logBotRun(bot.id, { status: 'error', messageType: bot.messageType, errorMessage: 'No chat ID configured', accountId: bot.account_id });
        return;
    }

    try {
        if (bot.messageType === 'poll') {
            // Send Telegram poll using sendPoll API
            let options;
            try {
                options = JSON.parse(bot.pollOptions || '[]');
            } catch {
                options = [];
            }

            if (!bot.pollQuestion || !Array.isArray(options) || options.length < 2) {
                await logBotRun(bot.id, { status: 'error', messageType: 'poll', errorMessage: 'Invalid poll question or options', accountId: bot.account_id });
                return;
            }

            const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendPoll`, {
                chat_id: bot.chatId,
                question: bot.pollQuestion,
                options: options,
                is_anonymous: bot.pollIsAnonymous !== false,
                allows_multiple_answers: bot.pollAllowsMultipleAnswers === true
            });

            if (response.data && response.data.ok) {
                // Update last run time
                bot.lastRunAt = new Date().toISOString();
                bot.lastError = null;
                if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
                    await db.query('UPDATE bots SET data = $1 WHERE id = $2', [bot, bot.id]);
                }
                await logBotRun(bot.id, { status: 'success', messageType: 'poll', accountId: bot.account_id });
                console.log(`Bot ${bot.id} (${bot.name}): poll sent to ${bot.chatId}`);
            } else {
                throw new Error(response.data?.description || 'Unknown Telegram error');
            }
        } else {
            // Send text message
            if (!bot.messageText) {
                await logBotRun(bot.id, { status: 'error', messageType: 'text', errorMessage: 'No message text', accountId: bot.account_id });
                return;
            }

            const result = await addMessageToQueue(botToken, bot.chatId, bot.messageText, 0, null, bot.account_id);
            bot.lastRunAt = new Date().toISOString();
            bot.lastError = null;
            if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
                await db.query('UPDATE bots SET data = $1 WHERE id = $2', [bot, bot.id]);
            }
            await logBotRun(bot.id, { status: 'success', messageType: 'text', accountId: bot.account_id });
            console.log(`Bot ${bot.id} (${bot.name}): text message sent to ${bot.chatId}`);
        }
    } catch (error) {
        const errMsg = error.response?.data?.description || error.message || 'Unknown error';
        bot.lastRunAt = new Date().toISOString();
        bot.lastError = errMsg;
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            await db.query('UPDATE bots SET data = $1 WHERE id = $2', [bot, bot.id]);
        }
        await logBotRun(bot.id, { status: 'error', messageType: bot.messageType, errorMessage: errMsg, accountId: bot.account_id });
        console.error(`Bot ${bot.id} (${bot.name}) error:`, errMsg);
    }
}

// Track which bots already ran today to prevent duplicate sends
const botRanToday = new Map(); // botId -> "YYYY-MM-DD"

function startBotScheduler() {
    if (botSchedulerInterval) clearInterval(botSchedulerInterval);

    // Check every 30 seconds
    botSchedulerInterval = setInterval(async () => {
        if (!botsCache || botsCache.length === 0) return;

        for (const bot of botsCache) {
            if (!bot.enabled) continue;
            if (!bot.scheduleTime) continue;

            try {
                const tz = bot.scheduleTimezone || 'Europe/Moscow';
                const now = new Date();

                // Get current time in bot's timezone
                const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: tz,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                const parts = formatter.formatToParts(now);
                const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
                const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
                const currentTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

                // Get date and day of week in bot's timezone
                const dateFormatter = new Intl.DateTimeFormat('en-CA', {
                    timeZone: tz,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
                const dateStr = dateFormatter.format(now); // YYYY-MM-DD

                const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
                const dayOfWeek = tzDate.getDay(); // 0=Sun, 1=Mon, ...

                let shouldRun = false;

                if (bot.scheduleType === 'once') {
                    // Run on specific date at specific time
                    shouldRun = dateStr === bot.scheduleDate && currentTime === bot.scheduleTime;
                } else {
                    // Recurring: run on matching day and time
                    shouldRun = bot.scheduleDays.includes(dayOfWeek) && currentTime === bot.scheduleTime;
                }

                if (shouldRun) {
                    const runKey = `${bot.id}-${dateStr}`;
                    if (!botRanToday.has(runKey)) {
                        botRanToday.set(runKey, true);
                        console.log(`Bot scheduler: executing bot ${bot.id} (${bot.name}) at ${currentTime} ${tz} [${scheduleType}]`);
                        const botCopy = { ...bot };
                        await executeBot(botCopy);

                        // For 'once' bots: disable after successful run
                        if (scheduleType === 'once') {
                            botCopy.enabled = false;
                            if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
                                await db.query('UPDATE bots SET data = $1 WHERE id = $2', [botCopy, botCopy.id]);
                            }
                            console.log(`Bot ${bot.id} (${bot.name}): one-time bot disabled after execution`);
                        }

                        // Reload cache to get updated lastRunAt
                        await loadBotsCache();
                    }
                }
            } catch (err) {
                console.error(`Bot scheduler error for bot ${bot.id}:`, err);
            }
        }

        // Cleanup old entries from botRanToday (keep only today's entries)
        const today = new Date().toISOString().split('T')[0];
        for (const [key] of botRanToday) {
            if (!key.endsWith(today)) {
                botRanToday.delete(key);
            }
        }
    }, 30000); // Check every 30 seconds

    console.log('Bot scheduler started (checking every 30s)');
}

// CRUD для ботов
app.get('/api/bots', auth, async (req, res) => {
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            if (accountId != null) {
                const result = await db.query('SELECT id, data FROM bots WHERE account_id = $1 ORDER BY id DESC', [accountId]);
                return res.json(result.rows.map(r => ({ ...r.data, id: r.id })));
            }
            const result = await db.query('SELECT id, data FROM bots ORDER BY id DESC');
            return res.json(result.rows.map(r => ({ ...r.data, id: r.id })));
        }
        res.json(botsCache);
    } catch (error) {
        console.error('Error loading bots:', error);
        res.status(500).json({ error: 'Failed to load bots' });
    }
});

// История ботов (MUST be before /api/bots/:id to avoid param capture)
app.get('/api/bots/history', auth, async (req, res) => {
    const accountId = getAccountId(req);
    try {
        const botIdRaw = req.query.botId;
        const botId = botIdRaw ? parseInt(botIdRaw, 10) : null;
        const limit = Math.min(200, parseInt(req.query.limit) || 100);

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            if (accountId != null) {
                const result = await db.query(
                    `SELECT id, bot_id, status, message_type, error_message, created_at
                     FROM bot_runs WHERE account_id = $1 AND ($2::bigint IS NULL OR bot_id = $2)
                     ORDER BY created_at DESC LIMIT $3`,
                    [accountId, botId, limit]
                );
                return res.json(result.rows);
            }
            const result = await db.query(
                `SELECT id, bot_id, status, message_type, error_message, created_at
                 FROM bot_runs WHERE ($1::bigint IS NULL OR bot_id = $1) ORDER BY created_at DESC LIMIT $2`,
                [botId, limit]
            );
            return res.json(result.rows);
        }
        res.json([]);
    } catch (error) {
        console.error('Error loading bot history:', error);
        res.status(500).json({ error: 'Failed to load bot history' });
    }
});

app.delete('/api/bots/history', auth, blockAuditorWrite, async (req, res) => {
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            if (accountId != null) {
                await db.query('DELETE FROM bot_runs WHERE account_id = $1', [accountId]);
            } else {
                await db.query('DELETE FROM bot_runs');
            }
        }
        res.json({ status: 'cleared' });
    } catch (error) {
        console.error('Error clearing bot history:', error);
        res.status(500).json({ error: 'Failed to clear bot history' });
    }
});

app.get('/api/bots/:id', auth, async (req, res) => {
    const id = parseInt(req.params.id);
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const q = accountId != null
                ? db.query('SELECT id, data FROM bots WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('SELECT id, data FROM bots WHERE id = $1', [id]);
            const result = await q;
            if (result.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });
            return res.json({ ...result.rows[0].data, id: result.rows[0].id });
        }
        const bot = botsCache.find(b => b.id === id);
        if (!bot) return res.status(404).json({ error: 'Bot not found' });
        res.json(bot);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get bot' });
    }
});

app.post('/api/bots', auth, blockAuditorWrite, async (req, res) => {
    try {
        const accountId = getAccountIdForCreate(req);
        if (accountId == null) return res.status(400).json({ error: 'Account required to create bot' });

        const newBot = {
            id: Date.now(),
            name: req.body.name || 'Новый бот',
            enabled: req.body.enabled ?? true,
            chatId: req.body.chatId || '',
            botToken: req.body.botToken || '',
            messageType: req.body.messageType || 'text',
            messageText: req.body.messageText || '',
            pollQuestion: req.body.pollQuestion || '',
            pollOptions: req.body.pollOptions || '[]',
            pollIsAnonymous: req.body.pollIsAnonymous !== false,
            pollAllowsMultipleAnswers: req.body.pollAllowsMultipleAnswers === true,
            scheduleType: req.body.scheduleType || 'recurring',
            scheduleDays: req.body.scheduleDays || [1, 2, 3, 4, 5],
            scheduleDate: req.body.scheduleDate || '',
            scheduleTime: req.body.scheduleTime || '09:00',
            scheduleTimezone: req.body.scheduleTimezone || 'Europe/Moscow',
            lastRunAt: null,
            lastError: null,
            authorId: req.user.userId || req.user.username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (!newBot.name || !newBot.chatId) {
            return res.status(400).json({ error: 'name and chatId are required' });
        }

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            await db.query('INSERT INTO bots (id, data, account_id) VALUES ($1, $2, $3)', [newBot.id, newBot, accountId]);
        } else {
            botsCache.push(newBot);
        }

        await loadBotsCache();
        res.json(newBot);
    } catch (error) {
        console.error('Error creating bot:', error);
        res.status(500).json({ error: 'Failed to create bot' });
    }
});

app.put('/api/bots/:id', auth, blockAuditorWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const accountId = getAccountId(req);
    try {
        let existing;
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const q = accountId != null
                ? db.query('SELECT data FROM bots WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('SELECT data FROM bots WHERE id = $1', [id]);
            const result = await q;
            if (result.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });
            existing = result.rows[0].data;
        } else {
            existing = botsCache.find(b => b.id === id);
            if (!existing) return res.status(404).json({ error: 'Bot not found' });
        }

        const updated = {
            ...existing,
            ...req.body,
            id,
            updated_at: new Date().toISOString()
        };

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            await db.query('UPDATE bots SET data = $1 WHERE id = $2', [updated, id]);
        } else {
            const idx = botsCache.findIndex(b => b.id === id);
            if (idx >= 0) botsCache[idx] = updated;
        }

        await loadBotsCache();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update bot' });
    }
});

app.delete('/api/bots/:id', auth, blockAuditorWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const deleteQ = accountId != null
                ? db.query('DELETE FROM bots WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('DELETE FROM bots WHERE id = $1', [id]);
            const dr = await deleteQ;
            if (dr.rowCount > 0) await db.query('DELETE FROM bot_runs WHERE bot_id = $1', [id]);
        } else {
            botsCache = botsCache.filter(b => b.id !== id);
        }

        await loadBotsCache();
        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete bot' });
    }
});

// Ручной запуск бота
app.post('/api/bots/:id/run', auth, blockAuditorWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const accountId = getAccountId(req);
    try {
        let bot;
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const q = accountId != null
                ? db.query('SELECT id, data, account_id FROM bots WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('SELECT id, data, account_id FROM bots WHERE id = $1', [id]);
            const result = await q;
            if (result.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });
            const row = result.rows[0];
            bot = { ...row.data, id: row.id, account_id: row.account_id };
        } else {
            bot = botsCache.find(b => b.id === id);
            if (!bot) return res.status(404).json({ error: 'Bot not found' });
        }

        await executeBot(bot);
        await loadBotsCache();
        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to run bot' });
    }
});

// ============ INTEGRATIONS API ============

async function loadIntegrationsCache() {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const result = await db.query('SELECT id, data, account_id FROM integrations');
            integrationsCache = result.rows.map(r => ({ ...r.data, id: r.id, account_id: r.account_id }));
        } catch (e) {
            console.error('Error loading integrations cache:', e);
        }
    }
}

function stopIntegrationWorkers() {
    for (const timer of integrationTimers.values()) {
        clearInterval(timer);
    }
    integrationTimers.clear();
}

function startIntegrationWorkers() {
    stopIntegrationWorkers();
    loadIntegrationsCache().catch(err => console.error('Integration cache load error:', err));
}

async function logIntegrationRun(integrationId, data) {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            await db.query(
                `INSERT INTO integration_runs (
                    integration_id, trigger_type, status, trigger_data,
                    action_request, action_response, action_status,
                    telegram_sent, error_message, account_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    integrationId,
                    data.triggerType || 'manual',
                    data.status || 'success',
                    data.triggerData || null,
                    data.actionRequest || null,
                    data.actionResponse || null,
                    data.actionStatus || null,
                    data.telegramSent || false,
                    data.errorMessage || null,
                    data.accountId ?? null
                ]
            );
            // Cleanup old runs
            await db.query(
                `DELETE FROM integration_runs WHERE id NOT IN (
                    SELECT id FROM integration_runs ORDER BY created_at DESC LIMIT 200
                )`
            );
        } catch (e) {
            console.error('Error logging integration run:', e);
        }
    }
}

async function executeIntegration(integration, triggerData = null, triggerType = 'manual') {
    if (!integration.enabled && triggerType !== 'manual') return null;

    const runData = {
        triggerType,
        triggerData: triggerData ? JSON.stringify(triggerData).slice(0, 2000) : null,
        status: 'success',
        telegramSent: false
    };

    try {
        // Выполняем action если указан URL
        if (integration.actionUrl) {
            const actionHeaders = integration.actionHeaders ? parseJsonSafe(integration.actionHeaders, {}) : {};
            let actionBody = integration.actionBody || '';
            
            // Подставляем данные триггера в body если есть шаблон
            if (triggerData && actionBody) {
                actionBody = actionBody.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
                    const keys = path.split('.');
                    let value = triggerData;
                    for (const key of keys) {
                        value = value?.[key];
                    }
                    return value !== undefined ? String(value) : match;
                });
            }

            // Парсим body как JSON для лога и для отправки
            let parsedBody = null;
            if (actionBody && !['GET', 'HEAD'].includes(integration.actionMethod)) {
                parsedBody = parseJsonSafe(actionBody, actionBody);
            }

            runData.actionRequest = JSON.stringify({
                method: integration.actionMethod || 'POST',
                url: integration.actionUrl,
                headers: actionHeaders,
                body: parsedBody
            }).slice(0, 2000);

            const response = await fetch(integration.actionUrl, {
                method: integration.actionMethod || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...actionHeaders
                },
                body: parsedBody ? JSON.stringify(parsedBody) : undefined,
                signal: AbortSignal.timeout((integration.timeoutSec || 30) * 1000)
            });

            const responseText = await response.text();
            runData.actionStatus = response.status;
            runData.actionResponse = responseText.slice(0, 2000); // Truncated for logging
            runData.fullResponse = responseText; // Full response for template

            if (!response.ok) {
                runData.status = 'error';
                runData.errorMessage = `Action API returned ${response.status}`;
            }
        }

        // Отправляем в Telegram если включено и настроено
        if (integration.sendToTelegram && integration.chatId && runData.status === 'success') {
            const botToken = integration.botToken || TELEGRAM_BOT_TOKEN;
            let message = integration.messageTemplate || `Интеграция "${integration.name}" выполнена`;
            
            // Данные для шаблона: response (ответ action API) и trigger (данные триггера)
            let responseData = null;
            // Используем полный ответ для шаблона (не обрезанный)
            if (runData.fullResponse) {
                responseData = parseJsonSafe(runData.fullResponse, null);
            } else if (runData.actionResponse) {
                responseData = parseJsonSafe(runData.actionResponse, null);
            }
            
            // Fallback на пустой объект чтобы избежать null errors
            const safePayload = responseData || triggerData || {};
            const safeResponse = responseData || {};
            const safeTrigger = triggerData || {};
            
            // Рендерим шаблон с поддержкой ${...} синтаксиса
            if (message && (message.includes('${') || message.includes('{{'))) {
                try {
                    // Поддержка ${payload.field} и ${response.field} и ${trigger.field}
                    const templateFn = new Function('payload', 'response', 'trigger', `
                        try {
                            return \`${message.replace(/`/g, '\\`')}\`;
                        } catch (e) {
                            return '[Ошибка шаблона]: ' + e.message;
                        }
                    `);
                    message = templateFn(safePayload, safeResponse, safeTrigger);
                } catch (templateErr) {
                    console.error('Template error:', templateErr);
                    // Fallback на простую замену {{field}}
                    if (safePayload) {
                        message = message.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
                            const keys = path.split('.');
                            let value = safePayload;
                            for (const key of keys) {
                                value = value?.[key];
                            }
                            return value !== undefined ? String(value) : match;
                        });
                    }
                }
            }

            try {
                await addMessageToQueue(botToken, integration.chatId, message, 0, null, integration.account_id);
                runData.telegramSent = true;
            } catch (tgError) {
                console.error('Telegram send error:', tgError);
            }
        }

    } catch (error) {
        runData.status = 'error';
        runData.errorMessage = error.message;
    }

    runData.accountId = integration.account_id ?? null;
    await logIntegrationRun(integration.id, runData);
    return runData;
}

// CRUD для интеграций
app.get('/api/integrations', auth, async (req, res) => {
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            if (accountId != null) {
                const result = await db.query('SELECT id, data FROM integrations WHERE account_id = $1 ORDER BY id DESC', [accountId]);
                return res.json(result.rows.map(r => ({ ...r.data, id: r.id })));
            }
            const result = await db.query('SELECT id, data FROM integrations ORDER BY id DESC');
            return res.json(result.rows.map(r => ({ ...r.data, id: r.id })));
        }
        res.json(integrationsCache);
    } catch (error) {
        console.error('Error loading integrations:', error);
        res.status(500).json({ error: 'Failed to load integrations' });
    }
});

app.get('/api/integrations/:id', auth, async (req, res) => {
    const id = parseInt(req.params.id);
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const q = accountId != null
                ? db.query('SELECT id, data, account_id FROM integrations WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('SELECT id, data, account_id FROM integrations WHERE id = $1', [id]);
            const result = await q;
            if (result.rows.length === 0) return res.status(404).json({ error: 'Integration not found' });
            return res.json({ ...result.rows[0].data, id: result.rows[0].id });
        }
        const integration = integrationsCache.find(i => i.id === id);
        if (!integration) return res.status(404).json({ error: 'Integration not found' });
        res.json(integration);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get integration' });
    }
});

app.post('/api/integrations', auth, blockAuditorWrite, async (req, res) => {
    try {
        const accountId = getAccountIdForCreate(req);
        if (accountId == null) return res.status(400).json({ error: 'Account required to create integration' });

        const newIntegration = {
            id: Date.now(),
            name: req.body.name || 'Новая интеграция',
            enabled: req.body.enabled ?? true,
            triggerType: req.body.triggerType || 'webhook',
            triggerCondition: req.body.triggerCondition || '',
            pollingUrl: req.body.pollingUrl || '',
            pollingMethod: req.body.pollingMethod || 'GET',
            pollingHeaders: req.body.pollingHeaders || '',
            pollingBody: req.body.pollingBody || '',
            pollingInterval: req.body.pollingInterval || 60,
            pollingCondition: req.body.pollingCondition || '',
            actionUrl: req.body.actionUrl || '',
            actionMethod: req.body.actionMethod || 'POST',
            actionHeaders: req.body.actionHeaders || '',
            actionBody: req.body.actionBody || '',
            timeoutSec: req.body.timeoutSec || 30,
            chatId: req.body.chatId || '',
            botToken: req.body.botToken || '',
            messageTemplate: req.body.messageTemplate || '',
            authorId: req.user.userId || req.user.username
        };

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            await db.query('INSERT INTO integrations (id, data, account_id) VALUES ($1, $2, $3)', [newIntegration.id, newIntegration, accountId]);
        } else {
            integrationsCache.push(newIntegration);
        }

        await loadIntegrationsCache();
        res.json(newIntegration);
    } catch (error) {
        console.error('Error creating integration:', error);
        res.status(500).json({ error: 'Failed to create integration' });
    }
});

app.put('/api/integrations/:id', auth, blockAuditorWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const accountId = getAccountId(req);
    try {
        const updated = { ...req.body, id };
        
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const updateQ = accountId != null
                ? db.query('UPDATE integrations SET data = $1 WHERE id = $2 AND account_id = $3 RETURNING id', [updated, id, accountId])
                : db.query('UPDATE integrations SET data = $1 WHERE id = $2 RETURNING id', [updated, id]);
            const result = await updateQ;
            if (result.rowCount === 0) return res.status(404).json({ error: 'Integration not found' });
        } else {
            const idx = integrationsCache.findIndex(i => i.id === id);
            if (idx === -1) return res.status(404).json({ error: 'Integration not found' });
            integrationsCache[idx] = updated;
        }

        await loadIntegrationsCache();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update integration' });
    }
});

app.delete('/api/integrations/:id', auth, blockAuditorWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const deleteQ = accountId != null
                ? db.query('DELETE FROM integrations WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('DELETE FROM integrations WHERE id = $1', [id]);
            const dr = await deleteQ;
            if (dr.rowCount > 0) await db.query('DELETE FROM integration_runs WHERE integration_id = $1', [id]);
        } else {
            integrationsCache = integrationsCache.filter(i => i.id !== id);
        }
        
        await loadIntegrationsCache();
        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete integration' });
    }
});

// Ручной запуск интеграции
app.post('/api/integrations/:id/run', auth, blockAuditorWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const accountId = getAccountId(req);
    try {
        let integration;
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const q = accountId != null
                ? db.query('SELECT id, data, account_id FROM integrations WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('SELECT id, data, account_id FROM integrations WHERE id = $1', [id]);
            const result = await q;
            if (result.rows.length === 0) return res.status(404).json({ error: 'Integration not found' });
            const row = result.rows[0];
            integration = { ...row.data, id: row.id, account_id: row.account_id };
        } else {
            integration = integrationsCache.find(i => i.id === id);
            if (!integration) return res.status(404).json({ error: 'Integration not found' });
        }

        const result = await executeIntegration(integration, req.body.testData || null, 'manual');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to run integration' });
    }
});

// История интеграций
app.get('/api/integrations/history/all', auth, async (req, res) => {
    const accountId = getAccountId(req);
    try {
        const limit = Math.min(200, parseInt(req.query.limit) || 100);
        
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            if (accountId != null) {
                const result = await db.query(
                    `SELECT id, integration_id, trigger_type, status, trigger_data,
                            action_request, action_response, action_status,
                            telegram_sent, error_message, created_at
                     FROM integration_runs WHERE account_id = $1
                     ORDER BY created_at DESC LIMIT $2`,
                    [accountId, limit]
                );
                return res.json(result.rows);
            }
            const result = await db.query(
                `SELECT id, integration_id, trigger_type, status, trigger_data,
                        action_request, action_response, action_status,
                        telegram_sent, error_message, created_at
                 FROM integration_runs ORDER BY created_at DESC LIMIT $1`,
                [limit]
            );
            return res.json(result.rows);
        }
        res.json([]);
    } catch (error) {
        console.error('Error loading integration history:', error);
        res.status(500).json({ error: 'Failed to load history' });
    }
});

app.delete('/api/integrations/history/all', auth, blockAuditorWrite, async (req, res) => {
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            if (accountId != null) {
                await db.query('DELETE FROM integration_runs WHERE account_id = $1', [accountId]);
            } else {
                await db.query('DELETE FROM integration_runs');
            }
        }
        res.json({ status: 'cleared' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

// SPA fallback - only in production
// In development, Vite dev server handles all frontend routes
if (isProduction) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../build', 'index.html'));
    });
}

const server = app.listen(PORT, () => {
    console.log(`Server on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
