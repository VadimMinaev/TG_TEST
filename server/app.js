const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcrypt');
const FormData = require('form-data');
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
const TELEGRAM_BOT_TOKEN = 'YOUR_TOKEN';

const LOGS_FILE = path.join(__dirname, '../data/logs.json');
const RULES_FILE = path.join(__dirname, '../data/rules.json');
const POLLS_FILE = path.join(__dirname, '../data/polls.json');
const POLL_RUNS_FILE = path.join(__dirname, '../data/poll_runs.json');
const INTEGRATIONS_FILE = path.join(__dirname, '../data/integrations.json');
const INTEGRATION_RUNS_FILE = path.join(__dirname, '../data/integration_runs.json');
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
        name: 'Рнициатор запроса',
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

let db = { rules: [], logs: [], polls: [], pollRuns: [], integrationRuns: [] };
let pollsCache = [];
const pollTimers = new Map();
let integrationsCache = [];
const integrationTimers = new Map();
let botsCache = [];
let aiBotsCache = [];
let botSchedulerInterval = null;
let dbConnected = false;

// Reminder Engine globals
let reminderDispatcherInterval = null;
const pendingReminderInput = new Map();
const pendingTimezoneInput = new Map();
const pendingLanguageInput = new Map();
const pendingReminderConfirmation = new Map();
const aiBotSessions = new Map();
const aiProviderModelsCache = new Map();

async function ensureUniqueAccountNames(client) {
    const result = await client.query('SELECT id, name FROM accounts ORDER BY id');
    const usedNames = new Set();

    for (const row of result.rows) {
        const baseName = String(row.name || '').trim() || `account_${row.id}`;
        let candidate = baseName;
        let suffix = 1;
        let normalized = candidate.toLowerCase();

        while (usedNames.has(normalized)) {
            candidate = `${baseName}_${suffix}`;
            normalized = candidate.toLowerCase();
            suffix += 1;
        }

        usedNames.add(normalized);

        if (candidate !== row.name) {
            await client.query('UPDATE accounts SET name = $1 WHERE id = $2', [candidate, row.id]);
        }
    }
}

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
            await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bot_token TEXT`);
            await ensureUniqueAccountNames(client);
            await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug) WHERE slug IS NOT NULL`);
            await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_name_unique ON accounts ((LOWER(TRIM(name))))`);
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
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)`);
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
            await client.query(`
                CREATE TABLE IF NOT EXISTS ai_bots (
                    id BIGINT PRIMARY KEY,
                    data JSONB NOT NULL
                )
            `);
            await client.query(`ALTER TABLE ai_bots ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id)`);

            // Рнтеграции
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

            // ========== REMINDER ENGINE TABLES ==========
            // Пользователи Telegram
            await client.query(`
                CREATE TABLE IF NOT EXISTS telegram_users (
                    id BIGSERIAL PRIMARY KEY,
                    telegram_id BIGINT UNIQUE NOT NULL,
                    username VARCHAR(255),
                    first_name VARCHAR(255),
                    last_name VARCHAR(255),
                    language_code VARCHAR(10) DEFAULT 'ru',
                    language_is_set BOOLEAN DEFAULT false,
                    timezone VARCHAR(64) DEFAULT 'UTC',
                    timezone_is_set BOOLEAN DEFAULT false,
                    quiet_hours_start SMALLINT DEFAULT 23,
                    quiet_hours_end SMALLINT DEFAULT 7,
                    is_bot BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await client.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS language_is_set BOOLEAN DEFAULT false`);
            await client.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'UTC'`);
            await client.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS timezone_is_set BOOLEAN DEFAULT false`);
            await client.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS quiet_hours_start SMALLINT DEFAULT 23`);
            await client.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS quiet_hours_end SMALLINT DEFAULT 7`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON telegram_users(telegram_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_telegram_users_username ON telegram_users(username) WHERE username IS NOT NULL`);

            // Напоминания
            await client.query(`
                CREATE TABLE IF NOT EXISTS telegram_reminders (
                    id BIGSERIAL PRIMARY KEY,
                    telegram_user_id BIGINT NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
                    message TEXT NOT NULL,
                    run_at TIMESTAMP NOT NULL,
                    repeat_type VARCHAR(20) DEFAULT 'none',  -- none, interval, cron
                    repeat_config JSONB,  -- { interval_seconds: N } или { cron: "* * * * *" }
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    next_run_at TIMESTAMP
                )
            `);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_telegram_reminders_user_id ON telegram_reminders(telegram_user_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_telegram_reminders_next_run_at ON telegram_reminders(next_run_at) WHERE is_active = true`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_telegram_reminders_run_at ON telegram_reminders(run_at)`);

            // Логи отправки напоминаний
            await client.query(`
                CREATE TABLE IF NOT EXISTS reminder_logs (
                    id BIGSERIAL PRIMARY KEY,
                    reminder_id BIGINT NOT NULL REFERENCES telegram_reminders(id) ON DELETE CASCADE,
                    telegram_user_id BIGINT NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
                    status VARCHAR(20) NOT NULL,  -- sent, failed, skipped
                    message_text TEXT,
                    error_message TEXT,
                    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_reminder_logs_reminder_id ON reminder_logs(reminder_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_reminder_logs_user_id ON reminder_logs(telegram_user_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_reminder_logs_sent_at ON reminder_logs(sent_at)`);

            await client.query(`
                CREATE TABLE IF NOT EXISTS reminder_parse_fail_logs (
                    id BIGSERIAL PRIMARY KEY,
                    telegram_user_id BIGINT,
                    chat_id BIGINT,
                    input_text TEXT,
                    reason TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_reminder_parse_fail_logs_user_id ON reminder_parse_fail_logs(telegram_user_id, created_at DESC)`);

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
                    await client.query('UPDATE ai_bots SET account_id = $1 WHERE account_id IS NULL', [defaultAccountId]);
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
            await loadAiBotsCache();
            startMessageQueueWorker();
            startPollWorkers();
            startBotScheduler();
            startReminderDispatcher();
            startIntegrationWorkers().catch(err => console.error('Failed to start integration workers:', err));
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

    // Load integrations from file before starting integration workers (like polls).
    // Note: integrationsCache will be loaded and normalized by startIntegrationWorkers()
    try {
        if (fs.existsSync(POLL_RUNS_FILE)) {
            db.pollRuns = JSON.parse(fs.readFileSync(POLL_RUNS_FILE, 'utf8'));
            console.log('Poll runs loaded from file');
        }
    } catch (e) {
        console.error('Error loading poll runs from file:', e);
    }
    try {
        if (fs.existsSync(INTEGRATION_RUNS_FILE)) {
            db.integrationRuns = JSON.parse(fs.readFileSync(INTEGRATION_RUNS_FILE, 'utf8'));
            console.log('Integration runs loaded from file');
        }
    } catch (e) {
        console.error('Error loading integration runs from file:', e);
    }
    pollsCache = db.polls;
    startPollWorkers();
    startIntegrationWorkers().catch(err => console.error('Failed to start integration workers:', err));
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

function saveIntegrationRuns() {
    if (!process.env.DATABASE_URL) {
        try {
            fs.mkdirSync(path.dirname(INTEGRATION_RUNS_FILE), { recursive: true });
            fs.writeFileSync(INTEGRATION_RUNS_FILE, JSON.stringify(db.integrationRuns || [], null, 2), 'utf8');
        } catch (e) {
            console.error('Error saving integration runs to file:', e);
        }
    }
}

function loadIntegrationsFromFile() {
    try {
        if (!fs.existsSync(INTEGRATIONS_FILE)) return [];
        const raw = JSON.parse(fs.readFileSync(INTEGRATIONS_FILE, 'utf8'));
        return Array.isArray(raw) ? raw : [];
    } catch (e) {
        console.error('Error loading integrations from file:', e);
        return [];
    }
}

function saveIntegrationsToFile() {
    if (process.env.DATABASE_URL) return;
    try {
        fs.mkdirSync(path.dirname(INTEGRATIONS_FILE), { recursive: true });
        fs.writeFileSync(INTEGRATIONS_FILE, JSON.stringify(integrationsCache || [], null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving integrations to file:', e);
    }
}

async function persistIntegration(integration) {
    if (!integration || !integration.id) return;
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            await db.query('UPDATE integrations SET data = $1 WHERE id = $2', [integration, integration.id]);
        } catch (e) {
            console.error('Error updating integration in database:', e);
        }
    } else {
        const idx = integrationsCache.findIndex((i) => i.id === integration.id);
        if (idx === -1) {
            integrationsCache.push(integration);
        } else {
            integrationsCache[idx] = integration;
        }
        saveIntegrationsToFile();
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

async function getAccountToken(accountId) {
    if (accountId == null) return '';
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const result = await db.query('SELECT bot_token FROM accounts WHERE id = $1', [accountId]);
            const token = result.rows[0]?.bot_token;
            return typeof token === 'string' ? token.trim() : '';
        } catch (error) {
            console.error('Error loading account bot token:', error);
            return '';
        }
    }
    return '';
}

async function resolveBotToken(localToken, accountId = null) {
    const ownToken = typeof localToken === 'string' ? localToken.trim() : '';
    if (ownToken) return ownToken;

    const accountToken = await getAccountToken(accountId);
    if (accountToken && accountToken !== 'YOUR_TOKEN') return accountToken;

    return '';
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
// НОВАЯ Р¤РЈРќРљР¦РЯ Р¤РћР РњРђРўРР РћР’РђРќРЯ РЎРћРћР‘Р©Р•РќРЯ
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
            messageParts.push(`tg†” ${getFieldTranslation('id')}: ${payload.id}`);
        }
        if (payload.subject) {
            messageParts.push(`tg“‹ ${getFieldTranslation('subject')}: ${payload.subject}`);
        }
        if (payload.requested_by?.name) {
            const account = payload.requested_by.account?.name || '';
            messageParts.push(`tg‘¤ ${getFieldTranslation('requested_by.name')}: ${payload.requested_by.name}${account ? ' @' + account : ''}`);
        }
        if (payload.status) {
            messageParts.push(`tg“Љ ${getFieldTranslation('status')}: ${payload.status}`);
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
                messageParts.push(`v?° ${getFieldTranslation(field)}: ${value}`);
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
            messageParts.push(`tg“ќ ${getFieldTranslation('note')}:`);
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
            messageParts.push(`tg’¬ ${getFieldTranslation('message')}: ${author}${account ? ' @' + account : ''}: ${text}`);
        }

        if (messageParts.length === 0) {
            const payloadJson = JSON.stringify(payload || fullBody, null, 2);
            const truncated = payloadJson.length > 3800 
                ? payloadJson.slice(0, 3797) + '...' 
                : payloadJson;
    
            messageParts.push(`Полные данные (JSON):\n${truncated}`);
       }
        return messageParts.join('\n');
    } catch (e) {
        console.error('Format message error:', e.message);
        return `❌ Ошибка форматирования сообщения: ${e.message}\nДанные:\n${JSON.stringify(payload || fullBody).slice(0, 4000)}`;
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
        account_id: poll.account_id ?? null,
        name: (poll.name || '').trim(),
        url: (poll.url || '').trim(),
        method: (poll.method || 'GET').toUpperCase(),
        headersJson: typeof poll.headersJson === 'string' ? poll.headersJson : '',
        bodyJson: typeof poll.bodyJson === 'string' ? poll.bodyJson : '',
        conditionJson: typeof poll.conditionJson === 'string' ? poll.conditionJson : '',
        messageTemplate: typeof poll.messageTemplate === 'string' ? poll.messageTemplate : '',
        chatId: (poll.chatId || '').toString().trim(),
        botToken: typeof poll.botToken === 'string' ? poll.botToken.trim() : '',
        sendToTelegram: poll.sendToTelegram !== false,
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
        if (matched && poll.sendToTelegram !== false && (!poll.onlyOnChange || !poll.lastMatch)) {
            const botToken = await resolveBotToken(poll.botToken, poll.account_id);
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
// РђР’РўРћР РР—РђР¦РЯ Р РЈРџР РђР’Р›Р•РќРЕ РџРћР›Р¬Р—РћР’РђРўР•Р›РЇРњР
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
    let profile = null;
    if (!isVadmin && req.user.userId && process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const me = await db.query('SELECT name FROM users WHERE id = $1', [req.user.userId]);
            profile = me.rows[0] || null;
        } catch (e) {}
    }
    res.json({
        username: req.user.username,
        name: profile?.name || null,
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
        res.json({ authenticated: false, username: null, redirect: '/login' });
        return;
    }

    res.json({
        authenticated: !!session,
        username: session ? session.username : null,
        redirect: session ? null : '/login'
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

function normalizeAccountCloneOptions(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const sourceAccountId = raw.sourceAccountId != null ? parseInt(raw.sourceAccountId, 10) : null;
    if (!sourceAccountId || Number.isNaN(sourceAccountId)) return null;
    const include = raw.include && typeof raw.include === 'object' ? raw.include : {};
    const normalized = {
        sourceAccountId,
        include: {
            rules: Boolean(include.rules),
            polls: Boolean(include.polls),
            integrations: Boolean(include.integrations),
            bots: Boolean(include.bots),
        },
    };
    const hasAny = Object.values(normalized.include).some(Boolean);
    return hasAny ? normalized : null;
}

function createEntityIdFactory() {
    let seq = 0;
    return () => {
        seq += 1;
        return Date.now() * 1000 + seq;
    };
}

async function cloneEntitiesToAccount(client, sourceAccountId, targetAccountId, include) {
    const tablePlan = [
        { key: 'rules', table: 'rules' },
        { key: 'polls', table: 'polls' },
        { key: 'integrations', table: 'integrations' },
        { key: 'bots', table: 'bots' },
    ].filter((item) => include[item.key]);

    const counts = { rules: 0, polls: 0, integrations: 0, bots: 0 };
    if (tablePlan.length === 0) return counts;

    const nextId = createEntityIdFactory();

    for (const item of tablePlan) {
        const srcRows = await client.query(
            `SELECT id, data FROM ${item.table} WHERE account_id = $1 ORDER BY id`,
            [sourceAccountId]
        );
        for (const row of srcRows.rows) {
            const clonedId = nextId();
            const clonedData = { ...(row.data || {}), id: clonedId };
            await client.query(
                `INSERT INTO ${item.table} (id, data, account_id) VALUES ($1, $2, $3)`,
                [clonedId, clonedData, targetAccountId]
            );
            counts[item.key] += 1;
        }
    }

    return counts;
}

app.post('/api/accounts', auth, vadminOnly, async (req, res) => {
    const name = req.body.name && String(req.body.name).trim();
    const cloneOptions = normalizeAccountCloneOptions(req.body.cloneOptions);
    if (!name) return res.status(400).json({ error: 'Account name is required' });
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            await db.query('BEGIN');
            const duplicateByName = await db.query(
                'SELECT id FROM accounts WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
                [name]
            );
            if (duplicateByName.rows.length > 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Account name already exists' });
            }
            let slug = slugifyAccountName(name);
            const existing = await db.query('SELECT id FROM accounts WHERE slug = $1', [slug]);
            if (existing.rows.length > 0) {
                let n = 1;
                while ((await db.query('SELECT id FROM accounts WHERE slug = $1', [slug + '_' + n])).rows.length > 0) n++;
                slug = slug + '_' + n;
            }
            const inserted = await db.query(
                'INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at',
                [name, slug]
            );
            const created = inserted.rows[0];

            let cloned = { rules: 0, polls: 0, integrations: 0, bots: 0 };
            if (cloneOptions) {
                const sourceExists = await db.query('SELECT id FROM accounts WHERE id = $1', [cloneOptions.sourceAccountId]);
                if (sourceExists.rows.length === 0) {
                    await db.query('ROLLBACK');
                    return res.status(400).json({ error: 'Source account not found for cloning' });
                }
                cloned = await cloneEntitiesToAccount(
                    db,
                    cloneOptions.sourceAccountId,
                    created.id,
                    cloneOptions.include
                );
            }

            await db.query('COMMIT');
            res.status(201).json({ ...created, cloned });
        } catch (err) {
            try { await db.query('ROLLBACK'); } catch (_) {}
            console.error('DB error:', err);
            if (err && err.code === '23505') {
                return res.status(400).json({ error: 'Account name already exists' });
            }
            res.status(500).json({ error: 'DB error' });
        }
    } else {
        res.status(400).json({ error: 'Accounts require database' });
    }
});

app.delete('/api/accounts/:id', auth, vadminOnly, async (req, res) => {
    const accountId = parseInt(req.params.id, 10);
    if (!accountId) return res.status(400).json({ error: 'Invalid account id' });

    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            await db.query('BEGIN');

            const targetResult = await db.query('SELECT id, name FROM accounts WHERE id = $1', [accountId]);
            if (targetResult.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ error: 'Account not found' });
            }

            const mainResult = await db.query('SELECT id, name FROM accounts ORDER BY id ASC LIMIT 1');
            const mainAccountId = mainResult.rows[0]?.id;
            if (!mainAccountId) {
                await db.query('ROLLBACK');
                return res.status(500).json({ error: 'Main account not found' });
            }
            if (mainAccountId === accountId) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Cannot delete main account' });
            }

            const moveAccountData = async (tableName) => {
                const result = await db.query(
                    `UPDATE ${tableName} SET account_id = $1 WHERE account_id = $2`,
                    [mainAccountId, accountId]
                );
                return result.rowCount || 0;
            };

            const moved = {
                users: await moveAccountData('users'),
                rules: await moveAccountData('rules'),
                polls: await moveAccountData('polls'),
                integrations: await moveAccountData('integrations'),
                bots: await moveAccountData('bots'),
                logs: await moveAccountData('logs'),
                pollRuns: await moveAccountData('poll_runs'),
                integrationRuns: await moveAccountData('integration_runs'),
                botRuns: await moveAccountData('bot_runs'),
                messageQueue: await moveAccountData('message_queue'),
            };

            await db.query('DELETE FROM accounts WHERE id = $1', [accountId]);
            await db.query('COMMIT');

            sessions.forEach((session, token) => {
                if (session && session.accountId === accountId) {
                    sessions.set(token, { ...session, accountId: mainAccountId });
                }
            });
            saveSessions();

            res.json({
                status: 'deleted',
                moved,
                targetAccountId: accountId,
                targetAccountName: targetResult.rows[0].name,
                mainAccountId,
            });
        } catch (err) {
            try { await db.query('ROLLBACK'); } catch (_) {}
            console.error('DB error:', err);
            res.status(500).json({ error: 'DB error' });
        }
    } else {
        res.status(400).json({ error: 'Accounts require database' });
    }
});

// ────────────────────────────────────────────────────────────────
// РЈРџР РђР’Р›Р•РќРЕ РџРћР›Р¬Р—РћР’РђРўР•Р›РЇРњР
// ────────────────────────────────────────────────────────────────

app.get('/api/users', auth, async (req, res) => {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            if (req.user.username === 'vadmin') {
                const result = await db.query(
                    `SELECT u.id, u.username, u.name, u.created_at, u.updated_at, u.account_id, u.role, a.name as account_name
                     FROM users u LEFT JOIN accounts a ON u.account_id = a.id ORDER BY u.created_at DESC`
                );
                return res.json(result.rows);
            }
            const accountId = req.user.accountId;
            if (accountId == null) return res.json([]);
            const result = await db.query(
                'SELECT id, username, name, created_at, updated_at, account_id, role FROM users WHERE account_id = $1 ORDER BY created_at DESC',
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
    const { username, password, account_id, role, name } = req.body;
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
    const displayName = name != null && String(name).trim() ? String(name).trim().slice(0, 255) : null;

    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
            if (existing.rows.length > 0) return res.status(400).json({ error: 'Username already exists' });
            const accountExists = await db.query('SELECT id FROM accounts WHERE id = $1', [accountId]);
            if (accountExists.rows.length === 0) return res.status(400).json({ error: 'Account not found' });

            const passwordHash = await bcrypt.hash(password, 10);
            const result = await db.query(
                'INSERT INTO users (username, password_hash, account_id, role, name) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, name, created_at, updated_at, account_id, role',
                [username, passwordHash, accountId, roleVal, displayName]
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
    const { username, password, oldPassword, name } = req.body;

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
            if (name !== undefined) {
                const nextName = String(name || '').trim().slice(0, 255);
                updates.push(`name = $${idx++}`);
                values.push(nextName || null);
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

app.put('/api/users/:id', auth, async (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid user id' });
    if (!(process.env.DATABASE_URL && db && typeof db.query === 'function')) {
        return res.status(400).json({ error: 'User management requires database' });
    }

    const {
        username,
        password,
        role,
        account_id,
        name,
    } = req.body || {};

    const isVadmin = req.user.username === 'vadmin';
    try {
        const targetResult = await db.query(
            'SELECT id, account_id FROM users WHERE id = $1',
            [targetId]
        );
        if (targetResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const target = targetResult.rows[0];

        if (!isVadmin) {
            if (req.user.userId === targetId) return res.status(400).json({ error: 'Use /api/users/me to edit your own profile' });
            if (req.user.role !== 'administrator') return res.status(403).json({ error: 'Only administrator can edit users' });
            if (req.user.accountId == null || target.account_id !== req.user.accountId) {
                return res.status(403).json({ error: 'Can only edit users in your account' });
            }
        }

        const updates = [];
        const values = [];
        let idx = 1;

        if (username !== undefined && String(username).trim()) {
            const newUsername = String(username).trim();
            if (newUsername === 'vadmin') return res.status(400).json({ error: 'Reserved username' });
            const exists = await db.query('SELECT id FROM users WHERE username = $1 AND id != $2', [newUsername, targetId]);
            if (exists.rows.length > 0) return res.status(400).json({ error: 'Username already taken' });
            updates.push(`username = $${idx++}`);
            values.push(newUsername);
        }

        if (name !== undefined) {
            const nextName = String(name || '').trim().slice(0, 255);
            updates.push(`name = $${idx++}`);
            values.push(nextName || null);
        }

        if (password !== undefined && String(password) !== '') {
            updates.push(`password_hash = $${idx++}`);
            values.push(await bcrypt.hash(String(password), 10));
        }

        if (role !== undefined) {
            const normalizedRole = role === 'auditor' ? 'auditor' : 'administrator';
            updates.push(`role = $${idx++}`);
            values.push(normalizedRole);
        }

        if (account_id !== undefined && isVadmin) {
            const nextAccountId = account_id != null && String(account_id).trim() !== '' ? parseInt(account_id, 10) : null;
            if (nextAccountId == null || !Number.isFinite(nextAccountId)) return res.status(400).json({ error: 'Valid account is required' });
            const accountExists = await db.query('SELECT id FROM accounts WHERE id = $1', [nextAccountId]);
            if (accountExists.rows.length === 0) return res.status(400).json({ error: 'Account not found' });
            updates.push(`account_id = $${idx++}`);
            values.push(nextAccountId);
        }

        if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

        values.push(targetId);
        const result = await db.query(
            `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}
             RETURNING id, username, name, created_at, updated_at, account_id, role`,
            values
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('DB error:', err);
        if (err.code === '23505') return res.status(400).json({ error: 'Username already taken' });
        res.status(500).json({ error: 'DB error' });
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
// ТОКЕН БОТА (Account level)
// ────────────────────────────────────────────────────────────────

app.get('/api/account-bot-token', auth, async (req, res) => {
    try {
        const accountId = getAccountIdForCreate(req);
        if (accountId == null) return res.status(400).json({ error: 'Account required' });

        if (!(process.env.DATABASE_URL && db && typeof db.query === 'function')) {
            return res.json({ botToken: '', isSet: false });
        }

        const result = await db.query('SELECT bot_token FROM accounts WHERE id = $1', [accountId]);
        const token = typeof result.rows[0]?.bot_token === 'string' ? result.rows[0].bot_token.trim() : '';
        const masked = token ? token.substring(0, 10) + '...' : '';
        res.json({ botToken: masked, isSet: Boolean(token) });
    } catch (error) {
        console.error('Error loading account bot token:', error);
        res.status(500).json({ error: 'Failed to load account bot token' });
    }
});

app.post('/api/account-bot-token', auth, blockAuditorWrite, async (req, res) => {
    try {
        const accountId = getAccountIdForCreate(req);
        if (accountId == null) return res.status(400).json({ error: 'Account required' });
        if (!(process.env.DATABASE_URL && db && typeof db.query === 'function')) {
            return res.status(400).json({ error: 'Database is required' });
        }

        const tokenValue = typeof req.body.botToken === 'string' ? req.body.botToken.trim() : '';
        if (tokenValue) {
            try {
                const response = await axios.get(`https://api.telegram.org/bot${tokenValue}/getMe`);
                if (!response.data.ok) return res.status(400).json({ error: 'Invalid bot token' });
            } catch {
                return res.status(400).json({ error: 'Invalid bot token' });
            }
        }

        await db.query('UPDATE accounts SET bot_token = $1 WHERE id = $2', [tokenValue || null, accountId]);
        res.json({ status: 'ok', isSet: Boolean(tokenValue) });
    } catch (error) {
        console.error('Error saving account bot token:', error);
        res.status(500).json({ error: 'Failed to save account bot token' });
    }
});

app.post('/api/test-send', auth, async (req, res) => {
    const { chatId, message, botToken } = req.body;
    if (!chatId || !message) return res.status(400).json({ error: 'chatId and message required' });

    const token = await resolveBotToken(botToken, getAccountId(req));
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
// РЈРџР РђР’Р›Р•РќРЕ РџР РђР’РР›РђРњР
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
        const resolvedToken = await resolveBotToken(trimmedToken, accountId);
        const isEnabled = req.body.enabled !== false;

        if (isEnabled && (!resolvedToken || resolvedToken === 'YOUR_TOKEN')) {
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
            enabled: isEnabled,
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
                try {
                    const response = await axios.get(`https://api.telegram.org/bot${trimmedToken}/getMe`);
                    if (!response.data.ok) {
                        return res.status(400).json({ error: 'Invalid bot token' });
                    }
                } catch {
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

        const updatedEnabled = updated.enabled !== false;
        const resolvedToken = await resolveBotToken(updated.botToken, accountId);
        if (updatedEnabled && !resolvedToken) {
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

        if (!newPoll.name || !newPoll.url) {
            return res.status(400).json({ error: 'name and url are required' });
        }

        if (newPoll.sendToTelegram !== false && !newPoll.chatId) {
            return res.status(400).json({ error: 'chatId is required when Telegram notifications are enabled' });
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
            const token = await resolveBotToken(rule.botToken, accountId);
            if (!token) {
                telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Rule #${rule.id}`, chatId: rule.chatId || null, success: false, error: 'No bot token configured' });
                continue;
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

    // Выполнить интеграции, соответствующие этому РІPµP±C…уку
    await executeMatchingIntegrations(incomingPayload, 'webhook', accountId);

    logWebhook(req.body, matched, rules.length, telegram_results, accountId);
    res.json({ matched, telegram_results });
});

// ────────────────────────────────────────────────────────────────
// WEBHOOK — РћР‘Р©РЙ (все правила, для обратной совместимости)
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

            const token = await resolveBotToken(rule.botToken, rule.account_id ?? null);
            if (!token) {
                telegram_results.push({ ruleId: rule.id, ruleName: rule.name || `Rule #${rule.id}`, chatId: rule.chatId || null, success: false, error: 'No bot token configured' });
                continue;
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

    // Выполнить интеграции, соответствующие этому РІPµP±C…уку
    await executeMatchingIntegrations(incomingPayload, 'webhook', firstMatchedAccountId);

    logWebhook(req.body, matched, rules.length, telegram_results, firstMatchedAccountId);
    res.json({ matched, telegram_results });
});

// ────────────────────────────────────────────────────────────────
// Р”Р РЈР“РЕ РОУТЫ (логи, здоровье, очередь)
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
    const botToken = await resolveBotToken(bot.botToken, bot.account_id);
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
                        console.log(`Bot scheduler: executing bot ${bot.id} (${bot.name}) at ${currentTime} ${tz} [${bot.scheduleType}]`);
                        const botCopy = { ...bot };
                        await executeBot(botCopy);

                        // For 'once' bots: disable after successful run
                        if (bot.scheduleType === 'once') {
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

// Рстория ботов (MUST be before /api/bots/:id to avoid param capture)
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

// ============ AI BOTS (TELEGRAM -> GEMINI) API ============

async function loadAiBotsCache() {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const result = await db.query('SELECT id, data, account_id FROM ai_bots');
            aiBotsCache = result.rows.map((row) => ({ ...row.data, id: row.id, account_id: row.account_id }));
        } catch (e) {
            console.error('Error loading AI bots cache:', e);
            aiBotsCache = [];
        }
    }
}

function normalizeAiBot(input = {}) {
    const providerRaw = String(input.provider || 'gemini').toLowerCase();
    const provider =
        providerRaw === 'groq'
            ? 'groq'
            : (providerRaw === 'openai' ? 'openai' : (providerRaw === 'openrouter' ? 'openrouter' : 'gemini'));
    const apiKey = String(input.apiKey || input.geminiApiKey || '').trim();
    const defaultModel =
        provider === 'groq'
            ? 'llama-3.3-70b-versatile'
            : (provider === 'openai' ? 'gpt-4o-mini' : (provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gemini-2.0-flash'));
    const model = String(input.model || input.geminiModel || defaultModel).trim();
    return {
        id: input.id,
        name: String(input.name || '').trim(),
        enabled: input.enabled ?? true,
        provider,
        telegramBotToken: String(input.telegramBotToken || '').trim(),
        apiKey,
        model,
        // Backward compatibility for existing frontend/data paths.
        geminiApiKey: apiKey,
        geminiModel: model,
        systemPrompt: String(input.systemPrompt || ''),
        allowVoice: input.allowVoice !== false,
        webhookUrl: String(input.webhookUrl || ''),
        webhookSet: Boolean(input.webhookSet),
        created_at: input.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        authorId: input.authorId || null
    };
}

function escapeTelegramHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatAiTextForTelegram(rawText) {
    const escaped = escapeTelegramHtml(String(rawText || '').trim());
    if (!escaped) return '';

    // Keep code blocks readable and protected from further formatting replacements.
    const codeBlocks = [];
    let text = escaped.replace(/```([\s\S]*?)```/g, (_match, block) => {
        const idx = codeBlocks.length;
        codeBlocks.push(`<pre><code>${block}</code></pre>`);
        return `__CODE_BLOCK_${idx}__`;
    });

    // Inline code.
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold / italic.
    text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    text = text.replace(/__([^_]+)__/g, '<b>$1</b>');
    text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<i>$1</i>');
    text = text.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<i>$1</i>');

    // Headings -> bold line.
    text = text.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

    // Simple bullet list normalization.
    text = text.replace(/^\s*[-*]\s+/gm, '• ');

    // Restore code blocks.
    text = text.replace(/__CODE_BLOCK_(\d+)__/g, (_m, idx) => codeBlocks[Number(idx)] || '');

    // Telegram HTML supports new lines directly.
    return text;
}

function getAiBotSessionKey(aiBotId, chatId) {
    return `${aiBotId}:${chatId}`;
}

function cleanupAiBotSessions() {
    const now = Date.now();
    for (const [key, value] of aiBotSessions.entries()) {
        if (!value || (now - (value.updatedAt || 0)) > 2 * 60 * 60 * 1000) {
            aiBotSessions.delete(key);
        }
    }
}

function getAiBotSessionMessages(aiBotId, chatId) {
    cleanupAiBotSessions();
    const key = getAiBotSessionKey(aiBotId, chatId);
    const session = aiBotSessions.get(key);
    if (!session || !Array.isArray(session.messages)) return [];
    return session.messages.slice(-12);
}

function pushAiBotSessionMessage(aiBotId, chatId, role, text) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return;
    const key = getAiBotSessionKey(aiBotId, chatId);
    const previous = aiBotSessions.get(key) || { messages: [], updatedAt: Date.now() };
    const nextMessages = [...previous.messages, { role, text: normalizedText }].slice(-12);
    aiBotSessions.set(key, { messages: nextMessages, updatedAt: Date.now() });
}

function clearAiBotSession(aiBotId, chatId) {
    aiBotSessions.delete(getAiBotSessionKey(aiBotId, chatId));
}

async function getCachedOpenRouterModels() {
    const cacheKey = 'openrouter';
    const now = Date.now();
    const cached = aiProviderModelsCache.get(cacheKey);
    if (cached && cached.expiresAt > now && Array.isArray(cached.models) && cached.models.length > 0) {
        return cached.models;
    }

    const response = await axios.get('https://openrouter.ai/api/v1/models', { timeout: 20000 });
    const models = Array.isArray(response.data?.data)
        ? response.data.data
            .map((item) => String(item?.id || '').trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
        : [];

    if (models.length > 0) {
        aiProviderModelsCache.set(cacheKey, {
            models,
            expiresAt: now + 10 * 60 * 1000
        });
    }
    return models;
}

async function sendTelegramChatAction(botToken, chatId, action = 'typing') {
    try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
            chat_id: chatId,
            action
        });
    } catch (e) {
        console.error('[AI Bot] sendChatAction error:', e.response?.data || e.message);
    }
}

async function downloadTelegramFileAsBase64(botToken, fileId, fallbackMime = 'audio/ogg') {
    const getFileResponse = await axios.get(`https://api.telegram.org/bot${botToken}/getFile`, {
        params: { file_id: fileId },
        timeout: 30000
    });
    if (!getFileResponse.data?.ok || !getFileResponse.data?.result?.file_path) {
        throw new Error('Telegram getFile failed');
    }

    const filePath = getFileResponse.data.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const fileResponse = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 60000 });
    const buffer = Buffer.from(fileResponse.data);

    let mimeType = fallbackMime;
    const lowerPath = String(filePath).toLowerCase();
    if (lowerPath.endsWith('.mp3')) mimeType = 'audio/mpeg';
    if (lowerPath.endsWith('.m4a')) mimeType = 'audio/mp4';
    if (lowerPath.endsWith('.wav')) mimeType = 'audio/wav';
    if (lowerPath.endsWith('.oga') || lowerPath.endsWith('.ogg')) mimeType = 'audio/ogg';
    if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) mimeType = 'image/jpeg';
    if (lowerPath.endsWith('.png')) mimeType = 'image/png';
    if (lowerPath.endsWith('.webp')) mimeType = 'image/webp';
    if (lowerPath.endsWith('.gif')) mimeType = 'image/gif';

    return {
        base64: buffer.toString('base64'),
        mimeType
    };
}

function buildOpenAiStyleUserContent(text, imageData) {
    const normalizedText = String(text || '').trim();
    if (!imageData?.base64) {
        return normalizedText || 'Empty request';
    }
    return [
        {
            type: 'text',
            text: normalizedText || 'Опиши изображение'
        },
        {
            type: 'image_url',
            image_url: {
                url: `data:${imageData.mimeType || 'image/jpeg'};base64,${imageData.base64}`
            }
        }
    ];
}

function parseDataImageUrl(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\r\n]+)$/i);
    if (!match) return null;
    return {
        mimeType: String(match[1] || 'image/jpeg').toLowerCase(),
        base64: String(match[2] || '').replace(/\s+/g, '')
    };
}

function parseOpenAiCompatibleChoice(choice) {
    const textParts = [];
    const imageUrls = [];
    const inlineImages = [];
    const seenUrls = new Set();
    const seenInline = new Set();

    const addText = (value) => {
        const normalized = String(value || '').trim();
        if (!normalized) return;
        textParts.push(normalized);
    };

    const addImageLike = (value) => {
        if (value == null) return;
        const normalized = String(value).trim();
        if (!normalized) return;

        const inline = parseDataImageUrl(normalized);
        if (inline?.base64) {
            const key = `${inline.mimeType}:${inline.base64.slice(0, 64)}`;
            if (seenInline.has(key)) return;
            seenInline.add(key);
            inlineImages.push(inline);
            return;
        }

        if (/^https?:\/\//i.test(normalized)) {
            if (seenUrls.has(normalized)) return;
            seenUrls.add(normalized);
            imageUrls.push(normalized);
        }
    };

    const addInlineBase64 = (mimeType, b64) => {
        const normalized = String(b64 || '').replace(/\s+/g, '').trim();
        if (!normalized) return;
        const mime = String(mimeType || 'image/png').trim() || 'image/png';
        const key = `${mime}:${normalized.slice(0, 64)}`;
        if (seenInline.has(key)) return;
        seenInline.add(key);
        inlineImages.push({ mimeType: mime, base64: normalized });
    };

    const parseContent = (content) => {
        if (typeof content === 'string') {
            addText(content);
            return;
        }
        if (!Array.isArray(content)) return;

        for (const part of content) {
            if (typeof part === 'string') {
                addText(part);
                continue;
            }
            if (!part || typeof part !== 'object') continue;
            addText(part.text);
            addText(part.output_text);
            addText(part.content);
            addImageLike(part.image_url?.url);
            addImageLike(part.image_url);
            addImageLike(part.url);
            addImageLike(part.image?.url);
            addInlineBase64(part.mime_type || part.mimeType, part.b64_json || part.base64 || part.data);
        }
    };

    const message = choice?.message || {};
    parseContent(message.content);
    addText(choice?.text);

    const imageContainers = [];
    if (Array.isArray(message.images)) imageContainers.push(...message.images);
    if (Array.isArray(choice?.images)) imageContainers.push(...choice.images);

    for (const image of imageContainers) {
        if (!image || typeof image !== 'object') continue;
        addImageLike(image.image_url?.url);
        addImageLike(image.image_url);
        addImageLike(image.url);
        addInlineBase64(image.mime_type || image.mimeType, image.b64_json || image.base64 || image.data);
    }

    return {
        text: textParts.join('\n').trim(),
        imageUrls,
        inlineImages
    };
}

function extractImageUrlsFromAiText(text) {
    const source = String(text || '');
    const found = [];
    const seen = new Set();

    const addUrl = (url) => {
        const normalized = String(url || '').trim();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        found.push(normalized);
    };

    source.replace(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi, (_m, url) => {
        addUrl(url);
        return _m;
    });

    source.replace(/https?:\/\/[^\s<>()]+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>()]*)?/gi, (url) => {
        addUrl(url);
        return url;
    });

    return found;
}

function stripImageUrlsFromAiText(text) {
    return String(text || '')
        .replace(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi, ' ')
        .replace(/https?:\/\/[^\s<>()]+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>()]*)?/gi, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function runGeminiForAiBot(aiBot, chatId, text, attachments = {}) {
    const apiKey = String(aiBot.apiKey || aiBot.geminiApiKey || '').trim();
    const model = String(aiBot.model || aiBot.geminiModel || 'gemini-2.0-flash').trim();
    if (!apiKey) throw new Error('Gemini API key is missing');
    if (!model) throw new Error('Gemini model is missing');

    const history = getAiBotSessionMessages(aiBot.id, chatId);
    const historyContents = history.map((item) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.text }]
    }));

    const userParts = [];
    if (text) userParts.push({ text: String(text).trim() });
    if (attachments.audioData?.base64) {
        userParts.push({
            inline_data: {
                mime_type: attachments.audioData.mimeType || 'audio/ogg',
                data: attachments.audioData.base64
            }
        });
    }
    if (attachments.imageData?.base64) {
        userParts.push({
            inline_data: {
                mime_type: attachments.imageData.mimeType || 'image/jpeg',
                data: attachments.imageData.base64
            }
        });
    }
    if (!text && attachments.imageData?.base64 && !attachments.audioData?.base64) {
        userParts.push({ text: 'Опиши изображение' });
    }
    if (userParts.length === 0) userParts.push({ text: 'Empty request' });

    const payload = {
        contents: [
            ...historyContents,
            { role: 'user', parts: userParts }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
        }
    };

    const systemPrompt = String(aiBot.systemPrompt || '').trim();
    if (systemPrompt) {
        payload.systemInstruction = {
            role: 'system',
            parts: [{ text: systemPrompt }]
        };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await axios.post(url, payload, { timeout: 90000 });

    const candidate = response.data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const outputText = parts
        .map((part) => part?.text || '')
        .join('\n')
        .trim();
    const inlineImages = parts
        .map((part) => {
            const inline = part?.inlineData || part?.inline_data;
            if (!inline) return null;
            const base64 = String(inline.data || '').replace(/\s+/g, '').trim();
            if (!base64) return null;
            return {
                mimeType: String(inline.mimeType || inline.mime_type || 'image/png'),
                base64
            };
        })
        .filter(Boolean);

    if (!outputText && inlineImages.length === 0) {
        const blockedReason = response.data?.promptFeedback?.blockReason;
        if (blockedReason) {
            throw new Error(`Gemini blocked response: ${blockedReason}`);
        }
        throw new Error('Gemini returned empty response');
    }

    return { text: outputText, imageUrls: [], inlineImages };
}

async function runGroqForAiBot(aiBot, chatId, text, attachments = {}) {
    const apiKey = String(aiBot.apiKey || '').trim();
    const model = String(aiBot.model || 'llama-3.3-70b-versatile').trim();
    if (!apiKey) throw new Error('Groq API key is missing');
    if (!model) throw new Error('Groq model is missing');
    if (attachments.audioData?.base64) {
        throw new Error('Groq text API does not support Telegram audio in this mode');
    }

    const history = getAiBotSessionMessages(aiBot.id, chatId);
    const messages = [];

    const systemPrompt = String(aiBot.systemPrompt || '').trim();
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    for (const item of history) {
        messages.push({
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: item.text
        });
    }

    messages.push({
        role: 'user',
        content: String(text || '').trim() || 'Empty request'
    });

    const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
            model,
            messages,
            temperature: 0.7,
            max_tokens: 1024
        },
        {
            timeout: 90000,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    const outputText = String(response.data?.choices?.[0]?.message?.content || '').trim();
    if (!outputText) {
        throw new Error('Groq returned empty response');
    }
    return outputText;
}

async function runOpenAiForAiBot(aiBot, chatId, text, attachments = {}) {
    const apiKey = String(aiBot.apiKey || '').trim();
    const model = String(aiBot.model || 'gpt-4o-mini').trim();
    if (!apiKey) throw new Error('OpenAI API key is missing');
    if (!model) throw new Error('OpenAI model is missing');
    if (attachments.audioData?.base64) {
        throw new Error('OpenAI chat completions mode does not support Telegram audio in this path');
    }

    const history = getAiBotSessionMessages(aiBot.id, chatId);
    const messages = [];

    const systemPrompt = String(aiBot.systemPrompt || '').trim();
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    for (const item of history) {
        messages.push({
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: item.text
        });
    }

    messages.push({ role: 'user', content: buildOpenAiStyleUserContent(text, attachments.imageData) });

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model,
            messages,
            temperature: 0.7,
            max_tokens: 1024
        },
        {
            timeout: 90000,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    const parsed = parseOpenAiCompatibleChoice(response.data?.choices?.[0] || {});
    if (!parsed.text && parsed.imageUrls.length === 0 && parsed.inlineImages.length === 0) {
        throw new Error('OpenAI returned empty response');
    }
    return parsed;
}

async function runOpenRouterForAiBot(aiBot, chatId, text, attachments = {}) {
    const apiKey = String(aiBot.apiKey || '').trim();
    const model = String(aiBot.model || 'openai/gpt-4o-mini').trim();
    if (!apiKey) throw new Error('OpenRouter API key is missing');
    if (!model) throw new Error('OpenRouter model is missing');
    if (attachments.audioData?.base64) {
        throw new Error('OpenRouter chat completions mode does not support Telegram audio in this path');
    }

    const history = getAiBotSessionMessages(aiBot.id, chatId);
    const messages = [];

    const systemPrompt = String(aiBot.systemPrompt || '').trim();
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    for (const item of history) {
        messages.push({
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: item.text
        });
    }

    messages.push({ role: 'user', content: buildOpenAiStyleUserContent(text, attachments.imageData) });

    const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
            model,
            messages,
            temperature: 0.7,
            max_tokens: 1024
        },
        {
            timeout: 90000,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-Title': 'TG_TEST AI Bot'
            }
        }
    );

    const parsed = parseOpenAiCompatibleChoice(response.data?.choices?.[0] || {});
    if (!parsed.text && parsed.imageUrls.length === 0 && parsed.inlineImages.length === 0) {
        throw new Error('OpenRouter returned empty response');
    }
    return parsed;
}

async function runAiProviderForAiBot(aiBot, chatId, text, attachments = {}) {
    const provider = String(aiBot.provider || 'gemini').toLowerCase();
    const rawResult = provider === 'groq'
        ? await runGroqForAiBot(aiBot, chatId, text, attachments)
        : provider === 'openai'
            ? await runOpenAiForAiBot(aiBot, chatId, text, attachments)
            : provider === 'openrouter'
                ? await runOpenRouterForAiBot(aiBot, chatId, text, attachments)
                : await runGeminiForAiBot(aiBot, chatId, text, attachments);

    if (typeof rawResult === 'string') {
        return { text: rawResult, imageUrls: [], inlineImages: [] };
    }

    return {
        text: String(rawResult?.text || '').trim(),
        imageUrls: Array.isArray(rawResult?.imageUrls) ? rawResult.imageUrls.filter(Boolean) : [],
        inlineImages: Array.isArray(rawResult?.inlineImages) ? rawResult.inlineImages.filter((item) => item?.base64) : []
    };
}

async function fetchAiBotForWebhook(aiBotId) {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        const result = await db.query('SELECT id, data, account_id FROM ai_bots WHERE id = $1', [aiBotId]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return { ...row.data, id: row.id, account_id: row.account_id };
    }
    return aiBotsCache.find((item) => item.id === aiBotId) || null;
}

app.get('/api/ai/providers/models', auth, async (req, res) => {
    const provider = String(req.query.provider || 'openrouter').toLowerCase();
    try {
        if (provider === 'openrouter') {
            const models = await getCachedOpenRouterModels();
            return res.json({ provider, models });
        }
        if (provider === 'openai') {
            return res.json({ provider, models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'] });
        }
        if (provider === 'groq') {
            return res.json({ provider, models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'] });
        }
        return res.json({ provider: 'gemini', models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'] });
    } catch (error) {
        console.error('Error loading provider models:', provider, error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to load provider models' });
    }
});

app.get('/api/ai-bots', auth, async (req, res) => {
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const query = accountId != null
                ? db.query('SELECT id, data FROM ai_bots WHERE account_id = $1 ORDER BY id DESC', [accountId])
                : db.query('SELECT id, data FROM ai_bots ORDER BY id DESC');
            const result = await query;
            return res.json(result.rows.map((row) => ({ ...row.data, id: row.id })));
        }
        return res.json(aiBotsCache);
    } catch (error) {
        console.error('Error loading AI bots:', error);
        res.status(500).json({ error: 'Failed to load AI bots' });
    }
});

app.get('/api/ai-bots/:id', auth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const query = accountId != null
                ? db.query('SELECT id, data FROM ai_bots WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('SELECT id, data FROM ai_bots WHERE id = $1', [id]);
            const result = await query;
            if (result.rows.length === 0) return res.status(404).json({ error: 'AI bot not found' });
            return res.json({ ...result.rows[0].data, id: result.rows[0].id });
        }

        const aiBot = aiBotsCache.find((item) => item.id === id);
        if (!aiBot) return res.status(404).json({ error: 'AI bot not found' });
        res.json(aiBot);
    } catch (error) {
        console.error('Error loading AI bot:', error);
        res.status(500).json({ error: 'Failed to load AI bot' });
    }
});

app.post('/api/ai-bots', auth, blockAuditorWrite, async (req, res) => {
    try {
        const accountId = getAccountIdForCreate(req);
        if (accountId == null) return res.status(400).json({ error: 'Account required to create AI bot' });

        const payload = normalizeAiBot({
            ...req.body,
            id: Date.now(),
            authorId: req.user.userId || req.user.username
        });

        if (!payload.name) return res.status(400).json({ error: 'name is required' });
        if (!payload.telegramBotToken) return res.status(400).json({ error: 'telegramBotToken is required' });
        if (!payload.apiKey) return res.status(400).json({ error: 'apiKey is required' });
        if (!payload.model) return res.status(400).json({ error: 'model is required' });

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            await db.query('INSERT INTO ai_bots (id, data, account_id) VALUES ($1, $2, $3)', [payload.id, payload, accountId]);
            await loadAiBotsCache();
        } else {
            aiBotsCache.unshift(payload);
        }

        res.json(payload);
    } catch (error) {
        console.error('Error creating AI bot:', error);
        res.status(500).json({ error: 'Failed to create AI bot' });
    }
});

app.put('/api/ai-bots/:id', auth, blockAuditorWrite, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const accountId = getAccountId(req);
    try {
        let current = null;
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const query = accountId != null
                ? db.query('SELECT data FROM ai_bots WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('SELECT data FROM ai_bots WHERE id = $1', [id]);
            const result = await query;
            if (result.rows.length === 0) return res.status(404).json({ error: 'AI bot not found' });
            current = result.rows[0].data;
        } else {
            current = aiBotsCache.find((item) => item.id === id);
            if (!current) return res.status(404).json({ error: 'AI bot not found' });
        }

        const updated = normalizeAiBot({
            ...current,
            ...req.body,
            id,
            created_at: current.created_at || new Date().toISOString()
        });

        if (!updated.name) return res.status(400).json({ error: 'name is required' });
        if (!updated.telegramBotToken) return res.status(400).json({ error: 'telegramBotToken is required' });
        if (!updated.apiKey) return res.status(400).json({ error: 'apiKey is required' });
        if (!updated.model) return res.status(400).json({ error: 'model is required' });

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const query = accountId != null
                ? db.query('UPDATE ai_bots SET data = $1 WHERE id = $2 AND account_id = $3 RETURNING id', [updated, id, accountId])
                : db.query('UPDATE ai_bots SET data = $1 WHERE id = $2 RETURNING id', [updated, id]);
            const result = await query;
            if (result.rowCount === 0) return res.status(404).json({ error: 'AI bot not found' });
            await loadAiBotsCache();
        } else {
            const idx = aiBotsCache.findIndex((item) => item.id === id);
            if (idx === -1) return res.status(404).json({ error: 'AI bot not found' });
            aiBotsCache[idx] = updated;
        }

        res.json(updated);
    } catch (error) {
        console.error('Error updating AI bot:', error);
        res.status(500).json({ error: 'Failed to update AI bot' });
    }
});

app.delete('/api/ai-bots/:id', auth, blockAuditorWrite, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const accountId = getAccountId(req);
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const query = accountId != null
                ? db.query('DELETE FROM ai_bots WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('DELETE FROM ai_bots WHERE id = $1', [id]);
            await query;
            await loadAiBotsCache();
        } else {
            aiBotsCache = aiBotsCache.filter((item) => item.id !== id);
        }
        aiBotSessions.forEach((_value, key) => {
            if (String(key).startsWith(`${id}:`)) aiBotSessions.delete(key);
        });
        res.json({ status: 'deleted' });
    } catch (error) {
        console.error('Error deleting AI bot:', error);
        res.status(500).json({ error: 'Failed to delete AI bot' });
    }
});

app.post('/api/ai-bots/:id/webhook', auth, blockAuditorWrite, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const accountId = getAccountId(req);
    try {
        let aiBot = null;
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const query = accountId != null
                ? db.query('SELECT id, data FROM ai_bots WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('SELECT id, data FROM ai_bots WHERE id = $1', [id]);
            const result = await query;
            if (result.rows.length === 0) return res.status(404).json({ error: 'AI bot not found' });
            aiBot = { ...result.rows[0].data, id: result.rows[0].id };
        } else {
            aiBot = aiBotsCache.find((item) => item.id === id);
            if (!aiBot) return res.status(404).json({ error: 'AI bot not found' });
        }

        if (!aiBot.telegramBotToken) {
            return res.status(400).json({ error: 'telegramBotToken is required' });
        }

        const protocol = req.headers['x-forwarded-proto'] || (isProduction ? 'https' : 'http');
        const host = req.headers.host || 'localhost:3000';
        const webhookUrl = `${protocol}://${host}/api/telegram/ai/${id}/webhook`;

        const telegramResponse = await axios.post(`https://api.telegram.org/bot${aiBot.telegramBotToken}/setWebhook`, {
            url: webhookUrl
        });

        if (!telegramResponse.data?.ok) {
            return res.status(400).json({ error: telegramResponse.data?.description || 'Failed to set webhook' });
        }

        const updated = normalizeAiBot({
            ...aiBot,
            webhookUrl,
            webhookSet: true
        });

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const updateQuery = accountId != null
                ? db.query('UPDATE ai_bots SET data = $1 WHERE id = $2 AND account_id = $3 RETURNING id', [updated, id, accountId])
                : db.query('UPDATE ai_bots SET data = $1 WHERE id = $2 RETURNING id', [updated, id]);
            const result = await updateQuery;
            if (result.rowCount === 0) return res.status(404).json({ error: 'AI bot not found' });
            await loadAiBotsCache();
        } else {
            const idx = aiBotsCache.findIndex((item) => item.id === id);
            if (idx >= 0) aiBotsCache[idx] = updated;
        }

        res.json({ ok: true, webhookUrl });
    } catch (error) {
        console.error('Error setting AI bot webhook:', error.response?.data || error.message);
        res.status(400).json({ error: error.response?.data?.description || error.message || 'Failed to set webhook' });
    }
});

app.delete('/api/ai-bots/:id/webhook', auth, blockAuditorWrite, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const accountId = getAccountId(req);
    try {
        let aiBot = null;
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const query = accountId != null
                ? db.query('SELECT id, data FROM ai_bots WHERE id = $1 AND account_id = $2', [id, accountId])
                : db.query('SELECT id, data FROM ai_bots WHERE id = $1', [id]);
            const result = await query;
            if (result.rows.length === 0) return res.status(404).json({ error: 'AI bot not found' });
            aiBot = { ...result.rows[0].data, id: result.rows[0].id };
        } else {
            aiBot = aiBotsCache.find((item) => item.id === id);
            if (!aiBot) return res.status(404).json({ error: 'AI bot not found' });
        }

        if (!aiBot.telegramBotToken) {
            return res.status(400).json({ error: 'telegramBotToken is required' });
        }

        const telegramResponse = await axios.get(`https://api.telegram.org/bot${aiBot.telegramBotToken}/deleteWebhook`);
        if (!telegramResponse.data?.ok) {
            return res.status(400).json({ error: telegramResponse.data?.description || 'Failed to delete webhook' });
        }

        const updated = normalizeAiBot({
            ...aiBot,
            webhookUrl: '',
            webhookSet: false
        });

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const updateQuery = accountId != null
                ? db.query('UPDATE ai_bots SET data = $1 WHERE id = $2 AND account_id = $3 RETURNING id', [updated, id, accountId])
                : db.query('UPDATE ai_bots SET data = $1 WHERE id = $2 RETURNING id', [updated, id]);
            const result = await updateQuery;
            if (result.rowCount === 0) return res.status(404).json({ error: 'AI bot not found' });
            await loadAiBotsCache();
        } else {
            const idx = aiBotsCache.findIndex((item) => item.id === id);
            if (idx >= 0) aiBotsCache[idx] = updated;
        }

        res.json({ ok: true });
    } catch (error) {
        console.error('Error deleting AI bot webhook:', error.response?.data || error.message);
        res.status(400).json({ error: error.response?.data?.description || error.message || 'Failed to delete webhook' });
    }
});

app.post('/api/telegram/ai/:id/webhook', async (req, res) => {
    const aiBotId = parseInt(req.params.id, 10);
    if (!Number.isInteger(aiBotId) || aiBotId < 1) {
        return res.status(400).json({ ok: false, error: 'Invalid AI bot id' });
    }

    try {
        const aiBot = await fetchAiBotForWebhook(aiBotId);
        if (!aiBot || !aiBot.enabled) {
            return res.status(404).json({ ok: false, error: 'AI bot not found or disabled' });
        }
        if (!aiBot.telegramBotToken || !(aiBot.apiKey || aiBot.geminiApiKey)) {
            return res.status(400).json({ ok: false, error: 'AI bot is not fully configured' });
        }

        const update = req.body || {};
        const message = update.message;
        if (!message) return res.json({ ok: true });

        const chatId = message.chat?.id;
        if (!chatId) return res.json({ ok: true });

        const text = String(message.text || message.caption || '').trim();
        const lower = text.toLowerCase();
        if (lower === '/start' || lower === '/help') {
            const welcome = [
                'AI бот готов.',
                'Отправьте текстовый вопрос или голосовое сообщение.',
                'Команда /clear очищает временную память диалога.'
            ].join('\n');
            await sendTelegramMessage(aiBot.telegramBotToken, chatId, escapeTelegramHtml(welcome));
            return res.json({ ok: true });
        }
        if (lower === '/clear') {
            clearAiBotSession(aiBot.id, chatId);
            await sendTelegramMessage(aiBot.telegramBotToken, chatId, 'Контекст сессии очищен.');
            return res.json({ ok: true });
        }

        const hasVoice = Boolean(message.voice || message.audio);
        const hasPhoto = Array.isArray(message.photo) && message.photo.length > 0;
        if (!text && !hasVoice && !hasPhoto) return res.json({ ok: true });

        if (hasVoice && aiBot.allowVoice === false) {
            await sendTelegramMessage(aiBot.telegramBotToken, chatId, 'Голосовые сообщения выключены для этого AI бота.');
            return res.json({ ok: true });
        }

        await sendTelegramChatAction(aiBot.telegramBotToken, chatId, hasVoice ? 'record_voice' : 'typing');

        let audioPayload = null;
        if (hasVoice) {
            const fileId = message.voice?.file_id || message.audio?.file_id;
            const mime = message.voice ? 'audio/ogg' : (message.audio?.mime_type || 'audio/ogg');
            if (fileId) {
                audioPayload = await downloadTelegramFileAsBase64(aiBot.telegramBotToken, fileId, mime);
            }
        }

        let imagePayload = null;
        if (hasPhoto) {
            const photoVariants = message.photo || [];
            const bestPhoto = photoVariants.reduce((best, current) => {
                if (!best) return current;
                return (Number(current?.file_size || 0) > Number(best?.file_size || 0)) ? current : best;
            }, null) || photoVariants[photoVariants.length - 1];
            if (bestPhoto?.file_id) {
                imagePayload = await downloadTelegramFileAsBase64(aiBot.telegramBotToken, bestPhoto.file_id, 'image/jpeg');
            }
        }

        const aiResponse = await runAiProviderForAiBot(aiBot, chatId, text, { audioData: audioPayload, imageData: imagePayload });
        const aiText = String(aiResponse?.text || '');
        const imageUrls = Array.from(new Set([
            ...extractImageUrlsFromAiText(aiText),
            ...(Array.isArray(aiResponse?.imageUrls) ? aiResponse.imageUrls : [])
        ]));
        const inlineImages = Array.isArray(aiResponse?.inlineImages) ? aiResponse.inlineImages : [];
        for (const imageUrl of imageUrls.slice(0, 3)) {
            await sendTelegramPhoto(aiBot.telegramBotToken, chatId, imageUrl);
        }
        for (const imageData of inlineImages.slice(0, 3)) {
            await sendTelegramPhoto(aiBot.telegramBotToken, chatId, imageData);
        }
        const cleanedText = stripImageUrlsFromAiText(aiText);
        const prepared = formatAiTextForTelegram(cleanedText).slice(0, 3900);
        if (prepared) {
            await sendTelegramMessage(aiBot.telegramBotToken, chatId, prepared);
        } else if (imageUrls.length === 0 && inlineImages.length === 0) {
            await sendTelegramMessage(aiBot.telegramBotToken, chatId, 'Пустой ответ модели.');
        }
        res.json({ ok: true });
    } catch (error) {
        const statusCode = Number(error?.response?.status || 0);
        const apiErrorText =
            error?.response?.data?.error?.message ||
            error?.response?.data?.error?.status ||
            error?.response?.data?.error?.details?.[0]?.reason ||
            error?.message ||
            'unknown error';
        console.error('[AI Bot] Webhook processing error:', statusCode, error.response?.data || error.message);
        try {
            const aiBot = await fetchAiBotForWebhook(aiBotId);
            const chatId = req.body?.message?.chat?.id;
            if (aiBot?.telegramBotToken && chatId) {
                const provider = String(aiBot.provider || 'gemini').toUpperCase();
                const userMessage = statusCode === 429
                    ? `Лимит ${provider} исчерпан (429). Проверьте квоту/биллинг API key и попробуйте позже.`
                    : `Ошибка AI бота: ${escapeTelegramHtml(apiErrorText)}`;
                await sendTelegramMessage(aiBot.telegramBotToken, chatId, userMessage);
            }
        } catch (_e) {
            // ignore secondary errors
        }
        // Always return 200 to Telegram to avoid retry storm and duplicate user-visible errors.
        res.json({ ok: true, error: apiErrorText });
    }
});

// ============ REMINDER ENGINE ============

// ----- Telegram Users Service -----
async function getOrCreateTelegramUser(telegramUser) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return null;
    }
    try {
        // Try to find existing user
        const existing = await db.query(
            'SELECT * FROM telegram_users WHERE telegram_id = $1',
            [telegramUser.id]
        );
        if (existing.rows.length > 0) {
            // Update user info if changed
            const user = existing.rows[0];
            const needsUpdate = user.username !== telegramUser.username ||
                user.first_name !== telegramUser.first_name ||
                user.last_name !== telegramUser.last_name;
            if (needsUpdate) {
                await db.query(
                    `UPDATE telegram_users SET 
                        username = $1, first_name = $2, last_name = $3, updated_at = CURRENT_TIMESTAMP 
                    WHERE telegram_id = $4`,
                    [telegramUser.username, telegramUser.first_name, telegramUser.last_name, telegramUser.id]
                );
            }
            return user;
        }
        // Create new user
        const result = await db.query(
            `INSERT INTO telegram_users (telegram_id, username, first_name, last_name, language_code, language_is_set, timezone, timezone_is_set, is_bot)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                telegramUser.id,
                telegramUser.username || null,
                telegramUser.first_name || null,
                telegramUser.last_name || null,
                'ru',
                false,
                'UTC',
                false,
                telegramUser.is_bot || false
            ]
        );
        console.log(`[Reminder] New Telegram user created: ${telegramUser.id} (@${telegramUser.username || 'no_username'})`);
        return result.rows[0];
    } catch (err) {
        console.error('[Reminder] Error in getOrCreateTelegramUser:', err);
        return null;
    }
}

async function getTelegramUserById(telegramId) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') return null;
    try {
        const result = await db.query('SELECT * FROM telegram_users WHERE telegram_id = $1', [telegramId]);
        return result.rows[0] || null;
    } catch (err) {
        console.error('[Reminder] Error getting Telegram user:', err);
        return null;
    }
}

async function getUserTimeZone(telegramUserId) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') return 'UTC';
    try {
        const result = await db.query('SELECT timezone FROM telegram_users WHERE id = $1', [telegramUserId]);
        const tz = result.rows?.[0]?.timezone;
        return tz && isValidTimeZone(tz) ? tz : 'UTC';
    } catch (err) {
        console.error('[Reminder] Error getting user timezone:', err);
        return 'UTC';
    }
}

function isTimezoneSelectedForUser(telegramUser) {
    return Boolean(telegramUser?.timezone_is_set);
}

function isLanguageSelectedForUser(telegramUser) {
    return Boolean(telegramUser?.language_is_set);
}

async function setUserLanguage(telegramUserId, languageCode) {
    const allowed = ['ru', 'en'];
    if (!allowed.includes(languageCode)) {
        return { success: false, error: 'Invalid language' };
    }
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return { success: false, error: 'Database not available' };
    }
    try {
        await db.query(
            `UPDATE telegram_users
             SET language_code = $1, language_is_set = true, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [languageCode, telegramUserId]
        );
        return { success: true };
    } catch (err) {
        console.error('[Reminder] Error updating user language:', err);
        return { success: false, error: err.message };
    }
}

async function setUserQuietHours(telegramUserId, startHour, endHour) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return { success: false, error: 'Database not available' };
    }
    const start = parseInt(String(startHour), 10);
    const end = parseInt(String(endHour), 10);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > 23 || end < 0 || end > 23) {
        return { success: false, error: 'Invalid quiet hours' };
    }
    try {
        await db.query(
            `UPDATE telegram_users
             SET quiet_hours_start = $1, quiet_hours_end = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [start, end, telegramUserId]
        );
        return { success: true };
    } catch (err) {
        console.error('[Reminder] Error updating quiet hours:', err);
        return { success: false, error: err.message };
    }
}

async function setUserTimeZone(telegramUserId, timeZone) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return { success: false, error: 'Database not available' };
    }

    if (!isValidTimeZone(timeZone)) {
        return { success: false, error: 'Invalid timezone' };
    }

    try {
        await db.query(
            `UPDATE telegram_users
             SET timezone = $1, timezone_is_set = true, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [timeZone, telegramUserId]
        );
        return { success: true };
    } catch (err) {
        console.error('[Reminder] Error updating user timezone:', err);
        return { success: false, error: err.message };
    }
}

// ----- Reminder Service -----
async function createReminder(telegramUserId, message, runAt, repeatType = 'none', repeatConfig = null) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return { success: false, error: 'Database not available' };
    }
    try {
        const nextRunAt = runAt;
        const result = await db.query(
            `INSERT INTO telegram_reminders (telegram_user_id, message, run_at, repeat_type, repeat_config, next_run_at)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [telegramUserId, message, runAt, repeatType, repeatConfig ? JSON.stringify(repeatConfig) : null, nextRunAt]
        );
        console.log(`[Reminder] Created reminder ${result.rows[0].id} for user ${telegramUserId} at ${runAt}`);
        return { success: true, reminder: result.rows[0] };
    } catch (err) {
        console.error('[Reminder] Error creating reminder:', err);
        return { success: false, error: err.message };
    }
}

async function getUserReminders(telegramUserId, activeOnly = true) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') return [];
    try {
        const query = activeOnly
            ? 'SELECT * FROM telegram_reminders WHERE telegram_user_id = $1 AND is_active = true ORDER BY run_at ASC'
            : 'SELECT * FROM telegram_reminders WHERE telegram_user_id = $1 ORDER BY created_at DESC';
        const result = await db.query(query, [telegramUserId]);
        return result.rows;
    } catch (err) {
        console.error('[Reminder] Error getting reminders:', err);
        return [];
    }
}

async function deleteReminder(reminderId, telegramUserId) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return { success: false, error: 'Database not available' };
    }
    try {
        const result = await db.query(
            'DELETE FROM telegram_reminders WHERE id = $1 AND telegram_user_id = $2 RETURNING *',
            [reminderId, telegramUserId]
        );
        if (result.rows.length > 0) {
            console.log(`[Reminder] Deleted reminder ${reminderId}`);
            return { success: true };
        }
        return { success: false, error: 'Reminder not found' };
    } catch (err) {
        console.error('[Reminder] Error deleting reminder:', err);
        return { success: false, error: err.message };
    }
}

async function deactivateReminder(reminderId, telegramUserId) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return { success: false, error: 'Database not available' };
    }
    try {
        const result = await db.query(
            `UPDATE telegram_reminders SET is_active = false, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1 AND telegram_user_id = $2 RETURNING *`,
            [reminderId, telegramUserId]
        );
        if (result.rows.length > 0) {
            return { success: true };
        }
        return { success: false, error: 'Reminder not found' };
    } catch (err) {
        console.error('[Reminder] Error deactivating reminder:', err);
        return { success: false, error: err.message };
    }
}

async function logReminderSend(reminderId, telegramUserId, status, messageText, errorMessage = null) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') return;
    try {
        await db.query(
            `INSERT INTO reminder_logs (reminder_id, telegram_user_id, status, message_text, error_message)
             VALUES ($1, $2, $3, $4, $5)`,
            [reminderId, telegramUserId, status, messageText, errorMessage]
        );
        // Cleanup old logs
        await db.query(
            `DELETE FROM reminder_logs WHERE id NOT IN (
                SELECT id FROM reminder_logs ORDER BY sent_at DESC LIMIT 500
            )`
        );
    } catch (err) {
        console.error('[Reminder] Error logging reminder send:', err);
    }
}

async function logReminderParseFailure(telegramUserId, chatId, inputText, reason) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') return;
    try {
        await db.query(
            `INSERT INTO reminder_parse_fail_logs (telegram_user_id, chat_id, input_text, reason)
             VALUES ($1, $2, $3, $4)`,
            [telegramUserId || null, chatId || null, String(inputText || ''), String(reason || 'parse_failed')]
        );
    } catch (err) {
        console.error('[Reminder] Error logging parse failure:', err);
    }
}

// ----- Command Parser -----
function isValidTimeZone(timeZone) {
    try {
        Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
        return true;
    } catch {
        return false;
    }
}

function getTimeZoneParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(date);

    const value = (type) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
    return {
        year: value('year'),
        month: value('month'),
        day: value('day'),
        hour: value('hour'),
        minute: value('minute'),
        second: value('second')
    };
}

function zonedDateTimeToUtc(year, month, day, hour, minute, timeZone) {
    let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

    for (let i = 0; i < 6; i++) {
        const actual = getTimeZoneParts(new Date(utcMs), timeZone);
        const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, 0, 0);
        const diff = desiredAsUtc - actualAsUtc;
        if (diff === 0) break;
        utcMs += diff;
    }

    return new Date(utcMs);
}

function getWeekdayInTimeZone(date, timeZone) {
    const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[short];
}

function parseReminderCommand(args, timeZone = 'UTC') {
    // Supported formats:
    // /remind 10m Купить молоко
    // /remind 1h Встреча
    // /remind 1d Позвонить
    // /remind 2025-02-20 14:00 Совещание
    // /remind every 1h Принять лекарство
    // /remind cron 0 9 * * * Утренняя зарядка
    
    if (!args || args.length === 0) {
        return { error: 'Укажите время и текст. Пример: /remind 10m Купить молоко' };
    }
    
    const result = {
        message: null,
        runAt: null,
        repeatType: 'none',
        repeatConfig: null,
        error: null
    };
    
    const firstArg = args[0].toLowerCase();
    
    // Check for repeat types
    if (firstArg === 'every' && args.length >= 2) {
        result.repeatType = 'interval';
        const interval = parseInterval(args[1]);
        if (!interval) {
            return { error: 'Неверный формат интервала. Пример: 10m, 1h, 1d' };
        }
        result.repeatConfig = { interval_seconds: interval };
        result.runAt = new Date(Date.now() + interval * 1000);
        result.message = args.slice(2).join(' ') || 'Напоминание';
        return result;
    }
    
    if (firstArg === 'cron' && args.length >= 6) {
        result.repeatType = 'cron';
        const cronExpr = args.slice(1, 6).join(' ');
        result.repeatConfig = { cron: cronExpr };
        result.message = args.slice(6).join(' ') || 'Напоминание';
        // For cron, calculate next run
        const nextRun = parseCronNextRun(cronExpr);
        result.runAt = nextRun || new Date(Date.now() + 60000);
        return result;
    }
    
    // Check for date format: YYYY-MM-DD HH:MM
    const dateMatch = args[0].match(/^(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch && args.length >= 2) {
        const timeMatch = args[1].match(/^(\d{1,2}:\d{2})$/);
        if (timeMatch) {
            const [y, m, d] = args[0].split('-').map((v) => parseInt(v, 10));
            const [hh, mm] = args[1].split(':').map((v) => parseInt(v, 10));
            const dateTime = zonedDateTimeToUtc(y, m, d, hh, mm, timeZone);
            if (isNaN(dateTime.getTime())) {
                return { error: 'Неверная дата или время' };
            }
            result.runAt = dateTime;
            result.message = args.slice(2).join(' ') || 'Напоминание';
            return result;
        }
    }
    
    // Check for relative time: 10m, 1h, 1d
    const interval = parseInterval(args[0]);
    if (interval) {
        result.runAt = new Date(Date.now() + interval * 1000);
        result.message = args.slice(1).join(' ') || 'Напоминание';
        return result;
    }
    
    // Natural language fallback:
    // "позвонить в офис через 20 минут", "позвонить завтра в 10", "call mom tomorrow at 10"
    const naturalParsed = parseNaturalLanguageReminder(args.join(' '), timeZone);
    if (!naturalParsed.error) {
        return naturalParsed;
    }

    return { error: 'Неверный формат. Примеры:\n/remind 10m Купить молоко\n/remind 1h Встреча\n/remind 2026-02-21 10:00 Совещание\n/remind every 1h Принять лекарство\nили: Позвонить завтра в 10\nили: Встреча 28 февраля 2026 года в 12:00' };
}

function parseReminderTextInput(text, timeZone = 'UTC') {
    if (!text || typeof text !== 'string') {
        return { error: 'Пустое сообщение' };
    }

    const trimmed = text.trim();
    if (!trimmed) {
        return { error: 'Пустое сообщение' };
    }

    // Format: "<текст> | <время>"
    // Example: "Позвонить маме | 2026-02-21 10:00"
    const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2) {
        const message = parts[0];
        const timePart = parts[1];
        const timeArgs = timePart.split(/\s+/).filter(Boolean);
        const parsedByArgs = parseReminderCommand([...timeArgs, message], timeZone);
        if (!parsedByArgs.error) {
            parsedByArgs.message = message;
            return parsedByArgs;
        }

        const parsedNatural = parseNaturalLanguageReminder(`${message} ${timePart}`, timeZone);
        if (!parsedNatural.error) {
            parsedNatural.message = message || parsedNatural.message || 'Напоминание';
            return parsedNatural;
        }

        return parsedByArgs;
    }

    // Default format is identical to /remind args without command itself.
    return parseReminderCommand(trimmed.split(/\s+/), timeZone);
}

function parseMonthToken(tokenRaw) {
    const token = String(tokenRaw || '').trim().toLowerCase().replace(/\./g, '');
    if (!token) return null;

    if (/^\d{1,2}$/.test(token)) {
        const monthNum = parseInt(token, 10);
        return monthNum >= 1 && monthNum <= 12 ? monthNum : null;
    }

    const monthMap = {
        'янв': 1, 'январь': 1, 'января': 1, 'jan': 1, 'january': 1,
        'фев': 2, 'февр': 2, 'февраль': 2, 'февраля': 2, 'feb': 2, 'february': 2,
        'мар': 3, 'март': 3, 'марта': 3, 'mar': 3, 'march': 3,
        'апр': 4, 'апрель': 4, 'апреля': 4, 'apr': 4, 'april': 4,
        'май': 5, 'мая': 5, 'may': 5,
        'июн': 6, 'июнь': 6, 'июня': 6, 'jun': 6, 'june': 6,
        'июл': 7, 'июль': 7, 'июля': 7, 'jul': 7, 'july': 7,
        'авг': 8, 'август': 8, 'августа': 8, 'aug': 8, 'august': 8,
        'сен': 9, 'сент': 9, 'сентябрь': 9, 'сентября': 9, 'sep': 9, 'sept': 9, 'september': 9,
        'окт': 10, 'октябрь': 10, 'октября': 10, 'oct': 10, 'october': 10,
        'ноя': 11, 'ноябрь': 11, 'ноября': 11, 'nov': 11, 'november': 11,
        'дек': 12, 'декабрь': 12, 'декабря': 12, 'dec': 12, 'december': 12,
    };

    return monthMap[token] || null;
}

function parseFlexibleTimeToken(tokenRaw) {
    const token = String(tokenRaw || '').trim();
    if (!token) return null;

    if (/^\d{1,2}:\d{2}$/.test(token)) {
        const [h, m] = token.split(':').map((v) => parseInt(v, 10));
        return isValidHourMinute(h, m) ? { hour: h, minute: m } : null;
    }

    if (/^\d{1,4}$/.test(token)) {
        if (token.length <= 2) {
            const h = parseInt(token, 10);
            return isValidHourMinute(h, 0) ? { hour: h, minute: 0 } : null;
        }
        if (token.length === 3) {
            const h = parseInt(token.slice(0, 1), 10);
            const m = parseInt(token.slice(1), 10);
            return isValidHourMinute(h, m) ? { hour: h, minute: m } : null;
        }
        const h = parseInt(token.slice(0, 2), 10);
        const m = parseInt(token.slice(2), 10);
        return isValidHourMinute(h, m) ? { hour: h, minute: m } : null;
    }

    return null;
}

function parseYearToken(yearRaw) {
    const yearNum = parseInt(String(yearRaw || ''), 10);
    if (!Number.isFinite(yearNum)) return null;
    if (yearNum < 100) return 2000 + yearNum;
    return yearNum;
}

function buildExplicitDateReminder(message, dayRaw, monthRaw, yearRaw, timeRaw, timeZone) {
    const messageText = String(message || '').trim();
    if (!messageText) return null;

    const day = parseInt(String(dayRaw || ''), 10);
    const month = parseMonthToken(monthRaw);
    const year = parseYearToken(yearRaw);
    const time = parseFlexibleTimeToken(timeRaw);

    if (!Number.isInteger(day) || day < 1 || day > 31 || !month || !year || !time) {
        return null;
    }

    const runAt = zonedDateTimeToUtc(year, month, day, time.hour, time.minute, timeZone);
    if (Number.isNaN(runAt.getTime())) return null;

    return {
        message: messageText,
        runAt,
        repeatType: 'none',
        repeatConfig: null,
        error: null
    };
}

function parseExplicitDateTimeReminder(text, timeZone = 'UTC') {
    const normalized = String(text || '').trim();
    if (!normalized) return null;

    // Date first: "20 фев 2026 в 11:57 Встреча с командой"
    // Also supports separators and typo "ы" instead of "в".
    let m = normalized.match(
        /^(\d{1,2})[\s./-]+([a-zа-яё]{1,12}|\d{1,2})[\s./-]+(\d{2,4})(?:\s+(?:г|г\.|год|year))?\s*(?:в|at)?\s*([0-9:]{1,5})\s+(.+)$/i
    );
    if (m) {
        return buildExplicitDateReminder(m[5], m[1], m[2], m[3], m[4], timeZone);
    }

    // Message first: "Встреча с командой 20 02 26 ы 1145"
    m = normalized.match(
        /^(.+?)\s+(\d{1,2})[\s./-]+([a-zа-яё]{1,12}|\d{1,2})[\s./-]+(\d{2,4})(?:\s+(?:г|г\.|год|year))?\s*(?:в|at)?\s*([0-9:]{1,5})$/i
    );
    if (m) {
        return buildExplicitDateReminder(m[1], m[2], m[3], m[4], m[5], timeZone);
    }

    return null;
}

function parseColloquialTime(hourRaw, minuteRaw, periodWordRaw) {
    let hour = parseInt(String(hourRaw || ''), 10);
    let minute = minuteRaw != null ? parseInt(String(minuteRaw), 10) : 0;
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    const period = String(periodWordRaw || '').toLowerCase();
    if (['вечера', 'pm', 'p.m.', 'вечером'].includes(period) && hour < 12) hour += 12;
    if (['ночи'].includes(period) && hour === 12) hour = 0;
    if (['утра', 'am', 'a.m.'].includes(period) && hour === 12) hour = 0;
    return isValidHourMinute(hour, minute) ? { hour, minute } : null;
}

function parseNaturalLanguageReminder(rawText, timeZone = 'UTC') {
    if (!rawText || typeof rawText !== 'string') {
        return { error: 'Пустое сообщение' };
    }

    const text = rawText.trim().replace(/\s+/g, ' ');
    if (!text) {
        return { error: 'Пустое сообщение' };
    }

    // 0) Explicit date/time in RU/EN month formats:
    // "20 фев 2026 в 11:57 Встреча с командой"
    // "Встреча с командой 20 02 26 ы 1145"
    const explicitDateTime = parseExplicitDateTimeReminder(text, timeZone);
    if (explicitDateTime) {
        return explicitDateTime;
    }

    // 0.1) "через полчаса" / "in half an hour"
    {
        const m = text.match(/^(.*)\s+(?:через\s+полчаса|in\s+half\s+an?\s+hour)$/i);
        if (m) {
            const message = (m[1] || '').trim();
            if (message) {
                return {
                    message,
                    runAt: new Date(Date.now() + 30 * 60 * 1000),
                    repeatType: 'none',
                    repeatConfig: null,
                    error: null
                };
            }
        }
    }

    // 0.2) "полдень / midday"
    {
        const m = text.match(/^(.*)\s+(?:сегодня|today|завтра|tomorrow)?\s*(?:в|at)?\s*(полдень|midday|noon)$/i);
        if (m) {
            const message = (m[1] || '').trim();
            if (message) {
                const nowInTz = getTimeZoneParts(new Date(), timeZone);
                const runAt = zonedDateTimeToUtc(nowInTz.year, nowInTz.month, nowInTz.day, 12, 0, timeZone);
                if (runAt.getTime() <= Date.now()) {
                    const nextDay = new Date(Date.UTC(nowInTz.year, nowInTz.month - 1, nowInTz.day + 1, 0, 0, 0));
                    return {
                        message,
                        runAt: zonedDateTimeToUtc(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), 12, 0, timeZone),
                        repeatType: 'none',
                        repeatConfig: null,
                        error: null
                    };
                }
                return { message, runAt, repeatType: 'none', repeatConfig: null, error: null };
            }
        }
    }

    // 1) "<message> через 20 минут" / "<message> in 20 minutes"
    {
        const m = text.match(/^(.*)\s+(?:через|in)\s+(\d+)\s*(минут[ауы]?|мин|minute|minutes|час|часа|часов|hour|hours|день|дня|дней|day|days|недел[яиюь]|week|weeks)$/i);
        if (m) {
            const message = (m[1] || '').trim();
            const value = parseInt(m[2], 10);
            const unit = normalizeNaturalUnit(m[3]);
            const seconds = convertUnitToSeconds(value, unit);
            if (message && seconds > 0) {
                return {
                    message,
                    runAt: new Date(Date.now() + seconds * 1000),
                    repeatType: 'none',
                    repeatConfig: null,
                    error: null
                };
            }
        }
    }

    // 2) "<message> каждые 10 минут" / "<message> every 10 minutes"
    {
        const m = text.match(/^(.*)\s+(?:каждые|каждый|every)\s+(\d+)\s*(минут[ауы]?|мин|minute|minutes|час|часа|часов|hour|hours|день|дня|дней|day|days|недел[яиюь]|week|weeks)$/i);
        if (m) {
            const message = (m[1] || '').trim();
            const value = parseInt(m[2], 10);
            const unit = normalizeNaturalUnit(m[3]);
            const seconds = convertUnitToSeconds(value, unit);
            if (message && seconds > 0) {
                return {
                    message,
                    runAt: new Date(Date.now() + seconds * 1000),
                    repeatType: 'interval',
                    repeatConfig: { interval_seconds: seconds },
                    error: null
                };
            }
        }
    }

    // 3) "<message> завтра в 10[:30]" / "tomorrow at 10[:30]"
    {
        const m = text.match(/^(.*)\s+(сегодня|today|завтра|tomorrow|послезавтра|day after tomorrow)(?:\s+(?:в|at|ы)\s+([0-9:]{1,5}))?$/i);
        if (m) {
            const message = (m[1] || '').trim();
            const dayWord = String(m[2] || '').toLowerCase();
            const parsedTime = m[3] != null ? parseFlexibleTimeToken(m[3]) : { hour: 9, minute: 0 };
            if (!message || !parsedTime || !isValidHourMinute(parsedTime.hour, parsedTime.minute)) {
                return { error: 'Неверное время. Рспользуйте часы 0-23 и минуты 0-59' };
            }

            let offsetDays = 0;
            if (dayWord === 'завтра' || dayWord === 'tomorrow') offsetDays = 1;
            if (dayWord === 'послезавтра' || dayWord === 'day after tomorrow') offsetDays = 2;

            const nowInTz = getTimeZoneParts(new Date(), timeZone);
            const localDay = new Date(Date.UTC(nowInTz.year, nowInTz.month - 1, nowInTz.day + offsetDays, 0, 0, 0));
            let runAt = zonedDateTimeToUtc(
                localDay.getUTCFullYear(),
                localDay.getUTCMonth() + 1,
                localDay.getUTCDate(),
                parsedTime.hour,
                parsedTime.minute,
                timeZone
            );

            if (runAt.getTime() <= Date.now()) {
                const nextLocalDay = new Date(Date.UTC(localDay.getUTCFullYear(), localDay.getUTCMonth(), localDay.getUTCDate() + 1, 0, 0, 0));
                runAt = zonedDateTimeToUtc(
                    nextLocalDay.getUTCFullYear(),
                    nextLocalDay.getUTCMonth() + 1,
                    nextLocalDay.getUTCDate(),
                    parsedTime.hour,
                    parsedTime.minute,
                    timeZone
                );
            }

            return {
                message,
                runAt,
                repeatType: 'none',
                repeatConfig: null,
                error: null
            };
        }
    }

    // 3.1) "<message> в 9 вечера" / "at 9 pm"
    {
        const m = text.match(/^(.*)\s+(?:сегодня|today|завтра|tomorrow)?\s*(?:в|at)\s+(\d{1,2})(?::(\d{2}))?\s*(утра|дня|вечера|ночи|am|pm|a\.m\.|p\.m\.)$/i);
        if (m) {
            const message = (m[1] || '').trim();
            const parsedTime = parseColloquialTime(m[2], m[3], m[4]);
            if (message && parsedTime) {
                const nowInTz = getTimeZoneParts(new Date(), timeZone);
                let runAt = zonedDateTimeToUtc(nowInTz.year, nowInTz.month, nowInTz.day, parsedTime.hour, parsedTime.minute, timeZone);
                if (runAt.getTime() <= Date.now()) {
                    const nextDay = new Date(Date.UTC(nowInTz.year, nowInTz.month - 1, nowInTz.day + 1, 0, 0, 0));
                    runAt = zonedDateTimeToUtc(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), parsedTime.hour, parsedTime.minute, timeZone);
                }
                return { message, runAt, repeatType: 'none', repeatConfig: null, error: null };
            }
        }
    }

    // 4) "<message> в понедельник в 10" / "<message> on monday at 10"
    {
        const m = text.match(/^(.*)\s+(?:в|on)\s+(понедельник|вторник|среда|среду|четверг|пятница|пятницу|суббота|субботу|воскресенье|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:в|at|ы)?\s*([0-9:]{1,5}))?$/i);
        if (m) {
            const message = (m[1] || '').trim();
            const weekdayWord = String(m[2] || '').toLowerCase();
            const parsedTime = m[3] != null ? parseFlexibleTimeToken(m[3]) : { hour: 9, minute: 0 };
            const weekday = parseWeekday(weekdayWord);
            if (!message || weekday == null || !parsedTime || !isValidHourMinute(parsedTime.hour, parsedTime.minute)) {
                return { error: 'Неверный формат дня недели или времени' };
            }

            const runAt = nextWeekdayAt(weekday, parsedTime.hour, parsedTime.minute, timeZone);
            return {
                message,
                runAt,
                repeatType: 'none',
                repeatConfig: null,
                error: null
            };
        }
    }

    // 5) "по будням в 9" / "on weekdays at 9"
    {
        const m = text.match(/^(.*)\s+(?:по\s+будням|on\s+weekdays)\s+(?:в|at)\s+(\d{1,2})(?::(\d{2}))?$/i);
        if (m) {
            const message = (m[1] || '').trim();
            const hour = parseInt(m[2], 10);
            const minute = m[3] ? parseInt(m[3], 10) : 0;
            if (message && isValidHourMinute(hour, minute)) {
                const cronExpr = `${minute} ${hour} * * 1-5`;
                const nextRun = parseCronNextRun(cronExpr) || new Date(Date.now() + 60000);
                return {
                    message,
                    runAt: nextRun,
                    repeatType: 'cron',
                    repeatConfig: { cron: cronExpr },
                    error: null
                };
            }
        }
    }

    return { error: 'Не удалось распознать естественный формат' };
}

function normalizeNaturalUnit(unitRaw) {
    const unit = String(unitRaw || '').toLowerCase();
    if (['мин', 'минута', 'минут', 'минуты', 'minute', 'minutes'].includes(unit)) return 'm';
    if (['час', 'часа', 'часов', 'hour', 'hours'].includes(unit)) return 'h';
    if (['день', 'дня', 'дней', 'day', 'days'].includes(unit)) return 'd';
    if (['неделя', 'недели', 'неделю', 'недель', 'week', 'weeks'].includes(unit)) return 'w';
    return null;
}

function convertUnitToSeconds(value, unit) {
    if (!Number.isFinite(value) || value < 1 || !unit) return 0;
    switch (unit) {
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        case 'w': return value * 604800;
        default: return 0;
    }
}

function isValidHourMinute(hour, minute) {
    return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function parseWeekday(wordRaw) {
    const word = String(wordRaw || '').toLowerCase();
    const map = {
        'воскресенье': 0,
        'monday': 1,
        'понедельник': 1,
        'tuesday': 2,
        'вторник': 2,
        'wednesday': 3,
        'среда': 3,
        'среду': 3,
        'thursday': 4,
        'четверг': 4,
        'friday': 5,
        'пятница': 5,
        'пятницу': 5,
        'saturday': 6,
        'суббота': 6,
        'субботу': 6,
        'sunday': 0,
    };
    return map[word];
}

function nextWeekdayAt(weekday, hour, minute, timeZone = 'UTC') {
    const now = new Date();
    const nowParts = getTimeZoneParts(now, timeZone);
    const todayWeekday = getWeekdayInTimeZone(now, timeZone);

    let delta = weekday - todayWeekday;
    if (delta < 0) delta += 7;

    const todayCandidate = zonedDateTimeToUtc(nowParts.year, nowParts.month, nowParts.day, hour, minute, timeZone);
    if (delta === 0 && todayCandidate.getTime() <= now.getTime()) {
        delta = 7;
    }

    const targetLocalDate = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day + delta, 0, 0, 0));
    return zonedDateTimeToUtc(
        targetLocalDate.getUTCFullYear(),
        targetLocalDate.getUTCMonth() + 1,
        targetLocalDate.getUTCDate(),
        hour,
        minute,
        timeZone
    );
}

function isInQuietHoursInTimeZone(date, timeZone, quietStart, quietEnd) {
    const start = Number(quietStart);
    const end = Number(quietEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
    const hour = getTimeZoneParts(date, timeZone).hour;
    // start == end means quiet mode is disabled
    if (start === end) return false;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end;
}

function nextAllowedTimeAfterQuiet(date, timeZone, quietStart, quietEnd) {
    const start = Number(quietStart);
    const end = Number(quietEnd);
    const local = getTimeZoneParts(date, timeZone);
    let y = local.year;
    let m = local.month;
    let d = local.day;
    const h = local.hour;

    // start == end means quiet mode disabled
    if (start === end) return date;

    if (start < end) {
        if (h >= start && h < end) {
            return zonedDateTimeToUtc(y, m, d, end, 0, timeZone);
        }
        return date;
    }

    // quiet window crosses midnight (e.g. 23 -> 7)
    if (h >= start) {
        const nextDay = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
        y = nextDay.getUTCFullYear();
        m = nextDay.getUTCMonth() + 1;
        d = nextDay.getUTCDate();
        return zonedDateTimeToUtc(y, m, d, end, 0, timeZone);
    }
    if (h < end) {
        return zonedDateTimeToUtc(y, m, d, end, 0, timeZone);
    }
    return date;
}

function normalizeLanguageInput(input) {
    const value = String(input || '').trim().toLowerCase();
    if (!value) return null;
    if (['ru', 'русский', 'russian', 'рус'].includes(value)) return 'ru';
    if (['en', 'english', 'английский', 'англ'].includes(value)) return 'en';
    return null;
}

function isRussianLanguage(languageCode) {
    return String(languageCode || 'ru').toLowerCase() === 'ru';
}

function reminderUiText(key, languageCode = 'ru') {
    const ru = isRussianLanguage(languageCode);
    const dict = {
        quickActionsTitle: ru ? 'Выберите действие:' : 'Choose an action:',
        quickCreate: ru ? 'Создать' : 'Create',
        quickList: ru ? 'Мои напоминания' : 'My reminders',
        quickSettings: ru ? 'Настройки' : 'Settings',
        quickHelp: ru ? 'Помощь' : 'Help',
        languageSaved: ru ? 'Язык сохранен' : 'Language saved',
        languageUpdated: ru ? 'Язык обновлен' : 'Language updated',
        timezoneSaved: ru ? 'Часовой пояс сохранен' : 'Timezone saved',
        timezoneUpdated: ru ? 'Часовой пояс обновлен' : 'Timezone updated'
    };
    return dict[key] || '';
}

function parseInterval(str) {
    // Parse: 10m, 1h, 1d, 1w
    const match = str.match(/^(\d+)([mhdw])$/i);
    if (!match) return null;
    
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        case 'w': return value * 604800;
        default: return null;
    }
}

function parseCronNextRun(cronExpr) {
    // Simplified cron parser for: minute hour day month weekday
    // Returns next run Date or null
    try {
        const parts = cronExpr.split(/\s+/);
        if (parts.length !== 5) return null;
        
        const [minute, hour, day, month, weekday] = parts.map(p => p === '*' ? null : parseInt(p, 10));
        const now = new Date();
        const next = new Date(now);
        next.setMinutes(0, 0, 0);
        next.setHours(next.getHours() + 1);
        
        // Simple implementation: find next matching time within 7 days
        for (let i = 0; i < 7 * 24 * 60; i++) {
            next.setMinutes(next.getMinutes() + 1);
            
            if (minute !== null && next.getMinutes() !== minute) continue;
            if (hour !== null && next.getHours() !== hour) continue;
            if (day !== null && next.getDate() !== day) continue;
            if (month !== null && (next.getMonth() + 1) !== month) continue;
            if (weekday !== null && next.getDay() !== weekday) continue;
            
            return next;
        }
        return null;
    } catch {
        return null;
    }
}

function runReminderParserSelfTests() {
    const cases = [
        { text: 'Позвонить завтра в 10', tz: 'Europe/Moscow' },
        { text: '20 фев 2026 в 11:57 Встреча с командой', tz: 'Europe/Moscow' },
        { text: 'Встреча 28 февраля 2026 года в 12:00', tz: 'Europe/Moscow' },
        { text: 'Встреча с командой 20 02 26 ы 1145', tz: 'Europe/Moscow' },
        { text: 'check report in half an hour', tz: 'America/New_York' },
        { text: 'drink water every 2 hours', tz: 'Asia/Almaty' },
        { text: 'review roadmap on weekdays at 9', tz: 'Europe/Berlin' },
    ];

    let passed = 0;
    let failed = 0;
    for (const c of cases) {
        const parsed = parseReminderTextInput(c.text, c.tz);
        if (!parsed.error && parsed.message && parsed.runAt) {
            passed += 1;
        } else {
            failed += 1;
            console.error('[Reminder SelfTest] FAIL:', c, parsed);
        }
    }
    console.log(`[Reminder SelfTest] passed=${passed} failed=${failed}`);
}

function formatReminderDate(date, timeZone = 'UTC') {
    return date.toLocaleString('ru-RU', {
        timeZone,
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatReminderList(reminders, timeZone = 'UTC') {
    if (!reminders || reminders.length === 0) {
        return 'У вас нет активных напоминаний';
    }
    
    const lines = [`Напоминания (${reminders.length})`, ''];
    reminders.forEach((r, i) => {
        const runAt = new Date(r.run_at);
        const dateStr = formatReminderDate(runAt, timeZone);
        const isPast = runAt.getTime() < Date.now();
        const repeatInfo = r.repeat_type === 'interval'
            ? ` • каждые ${Math.max(1, Math.round((r.repeat_config?.interval_seconds || 0) / 60))} мин`
            : r.repeat_type === 'cron'
                ? ` • ${r.repeat_config?.cron || 'по расписанию'}`
                : '';
        const activeInfo = r.is_active ? '' : ' • отключено';
        const pastInfo = isPast ? ' • просрочено' : '';
        const message = String(r.message || '').trim();
        const shortMessage = message.length > 90 ? `${message.slice(0, 90).trimEnd()}...` : message;

        lines.push(`#${i + 1} ${shortMessage}`);
        lines.push(`${dateStr}${pastInfo}${repeatInfo}${activeInfo}`);
        if (i < reminders.length - 1) {
            lines.push('----------------');
            lines.push('');
        }
    });

    lines.push('');
    lines.push('Удалить: /delete номер');
    
    return lines.join('\n');
}

// ----- Telegram Webhook Handler -----
async function handleTelegramUpdate(update) {
    try {
        // Extract user info
        const user = update.message?.from || update.callback_query?.from;
        if (!user) {
            console.log('[Telegram] Update without user, skipping');
            return { ok: true };
        }
        
        // Auto-create or get user
        const telegramUser = await getOrCreateTelegramUser(user);
        if (!telegramUser) {
            console.error('[Telegram] Failed to create/get user');
            return { ok: false, error: 'Failed to create user' };
        }
        
        // Handle message
        if (update.message && update.message.text) {
            const text = update.message.text;
            const chatId = update.message.chat.id;
            
            // Check if it's a command
            if (text.startsWith('/')) {
                return await handleTelegramCommand(text, chatId, telegramUser);
            }

            if (pendingLanguageInput.has(telegramUser.id)) {
                return await handlePendingLanguageInput(text, chatId, telegramUser);
            }

            if (pendingTimezoneInput.has(telegramUser.id)) {
                return await handlePendingTimezoneInput(text, chatId, telegramUser);
            }
            
            // Handle pending two-step reminder creation: /remind -> user text
            if (pendingReminderInput.has(telegramUser.id)) {
                return await handlePendingReminderInput(text, chatId, telegramUser);
            }

            // Handle non-command messages (no active conversation)
            return { ok: true };
        }
        
        // Handle callback query (inline buttons)
        if (update.callback_query) {
            return await handleCallbackQuery(update.callback_query, telegramUser);
        }
        
        return { ok: true };
    } catch (err) {
        console.error('[Telegram] Error handling update:', err);
        return { ok: false, error: err.message };
    }
}

async function handleTelegramCommand(text, chatId, telegramUser) {
    const parts = text.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    console.log(`[Telegram] Command: ${command} from user ${telegramUser.telegram_id}`);

    const onboardingAllowed = ['/start', '/settings', '/help', '/cancel'];
    if (!isLanguageSelectedForUser(telegramUser) && !onboardingAllowed.includes(command)) {
        const botToken = await getReminderBotToken();
        pendingLanguageInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
        await sendLanguageSelectionPrompt(
            botToken,
            chatId,
            '⚠️ Перед использованием бота нужно выбрать язык.\n\nОтправьте:\nru\nили\nen\n\nИли командой:\n/settings language ru'
        );
        return { ok: true };
    }

    if (!isTimezoneSelectedForUser(telegramUser) && !onboardingAllowed.includes(command)) {
        const botToken = await getReminderBotToken();
        pendingTimezoneInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
        await sendTimeZoneSelectionPrompt(
            botToken,
            chatId,
            '⚠️ Перед использованием бота нужно выбрать часовой пояс.\n\nОтправьте, например:\nEurope/Moscow\nAsia/Almaty\nAmerica/New_York\n\nИли командой:\n/settings timezone Europe/Moscow'
        );
        return { ok: true };
    }
    
    switch (command) {
        case '/start':
            return await handleStartCommand(chatId, telegramUser);
        
        case '/help':
            return await handleHelpCommand(chatId);
        
        case '/add':
            return await handleAddCommand(args, chatId, telegramUser);
        
        case '/remind':
            return await handleRemindCommand(args, chatId, telegramUser);
        
        case '/list':
        case '/myreminders':
        case '/reminders':
            return await handleMyRemindersCommand(args, chatId, telegramUser);
        
        case '/formats':
            return await handleFormatsCommand(chatId);
        
        case '/settings':
            return await handleSettingsCommand(args, chatId, telegramUser);
        
        case '/cancel':
            return await handleCancelCommand(chatId, telegramUser);
        
        case '/delete':
            return await handleDeleteCommand(args, chatId, telegramUser);
        
        default:
            return { ok: true }; // Unknown command, ignore
    }
}

async function handleStartCommand(chatId, telegramUser) {
    const botToken = await getReminderBotToken();

    if (!isLanguageSelectedForUser(telegramUser)) {
        pendingLanguageInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
        const message = `Привет, ${telegramUser.first_name || 'пользователь'}!

Перед началом работы нужно выбрать язык.

Отправьте одним сообщением:
ru
или
en

Или командой:
/settings language ru`;
        await sendLanguageSelectionPrompt(botToken, chatId, message);
        return { ok: true };
    }

    if (!isTimezoneSelectedForUser(telegramUser)) {
        pendingTimezoneInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
        const message = `Привет, ${telegramUser.first_name || 'пользователь'}!

Перед началом работы нужно выбрать часовой пояс.

Отправьте одним сообщением, например:
Europe/Moscow
Asia/Almaty
America/New_York

Или командой:
/settings timezone Europe/Moscow`;
        await sendTimeZoneSelectionPrompt(botToken, chatId, message);
        return { ok: true };
    }

    const message = `Привет, ${telegramUser.first_name || 'пользователь'}!

Я помогу создавать и отправлять вам напоминания в Telegram.

Основные возможности:
- Добавление напоминаний: /add или /remind
- Разовые и повторяющиеся напоминания
- Настройка языка: /settings language ru|en
- Настройка часового пояса: /settings timezone Europe/Moscow
- Просмотр списка: /list

Полная справка и список команд: /help`;

    await sendTelegramMessage(botToken, chatId, message);
    return { ok: true };
}
async function handleHelpCommand(chatId) {
    const botToken = await getReminderBotToken();
    const message = `Справка по напоминаниям

Как добавить напоминание:
- Пошагово: /add (текст -> время -> подтверждение)
- Одной строкой: /remind ...

Поддерживаемые форматы времени:
- Интервал: "через 20 минут", "10m", "1h"
- Дата/время: "2026-02-21 10:00", "20 фев 2026 в 11:57"
- Естественный язык: "завтра в 10", "в понедельник 1200"
- Повтор: "каждые 10 минут", "по будням в 9", "/remind cron 0 9 * * 1-5 ..."

Управление:
- /list - список напоминаний
- /delete - удалить напоминание по номеру
- /settings - язык, часовой пояс, тихий режим
- /cancel - отменить текущий шаг

Команды:
/start
/help
/add
/remind
/list
/delete
/formats
/settings
/cancel`;

    await sendTelegramMessage(botToken, chatId, message);
    return { ok: true };
}
async function handleAddCommand(args, chatId, telegramUser) {
    const botToken = await getReminderBotToken();

    if (!args || args.length === 0) {
        pendingReminderInput.set(telegramUser.id, { mode: 'wizard', step: 'text', chatId, createdAt: Date.now() });
        await sendTelegramMessage(
            botToken,
            chatId,
            'Шаг 1/2: введите текст напоминания.\n\nПример:\nВстреча с командой\n\nДля отмены: /cancel'
        );
        return { ok: true };
    }

    return await handleRemindCommand(args, chatId, telegramUser);
}

async function handleFormatsCommand(chatId) {
    const botToken = await getReminderBotToken();
    const message = `Поддерживаемые форматы даты и времени:

1) Через интервал:
/remind 10m Текст
/remind 2h Текст
/remind 1d Текст
/remind через 20 минут Текст
/remind 1w Текст

2) Конкретная дата и время:
/remind 2026-02-20 14:00 Текст
/add -> 20 фев 2026 в 11:57 Встреча с командой
/add -> 28 февраля 2026 года в 12:00 Встреча с командой
/add -> Встреча с командой 20 02 26 в 1145
/add -> в понедельник 1200

3) Повтор:
/remind every 10m Текст
/remind каждые 10 минут Текст
/remind every 1d Текст
/remind cron 0 9 * * * Текст

4) Естественный язык:
/add -> Позвонить завтра в 10
/add -> Встреча 28 февраля 2026 года в 12:00
/add -> Встреча с командой 20 02 26 в 1145
/add -> check report in half an hour

Примечание:
- Часовой пояс берется из /settings
- Для отмены текущего шага: /cancel`;

    await sendTelegramMessage(botToken, chatId, message);
    return { ok: true };
}
async function handleSettingsCommand(args, chatId, telegramUser) {
    const botToken = await getReminderBotToken();
    const currentTimeZone = await getUserTimeZone(telegramUser.id);
    const command = String(args?.[0] || '').toLowerCase();
    const value = args?.[1];
    const value2 = args?.[2];

    if (!command && !isLanguageSelectedForUser(telegramUser)) {
        pendingLanguageInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
        await sendLanguageSelectionPrompt(botToken, chatId, 'Выберите язык:');
        return { ok: true };
    }

    if (!command && isLanguageSelectedForUser(telegramUser) && !isTimezoneSelectedForUser(telegramUser)) {
        pendingTimezoneInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
        await sendTimeZoneSelectionPrompt(botToken, chatId, 'Выберите часовой пояс:');
        return { ok: true };
    }

    if ((command === 'language' || command === 'lang') && value) {
        const normalizedLanguage = normalizeLanguageInput(value);
        if (!normalizedLanguage) {
            await sendLanguageSelectionPrompt(
                botToken,
                chatId,
                `Неверный язык: ${value}\n\nПример:\n/settings language ru\n/settings language en`
            );
            return { ok: true };
        }

        const saveResult = await setUserLanguage(telegramUser.id, normalizedLanguage);
        if (!saveResult.success) {
            await sendTelegramMessage(botToken, chatId, `Не удалось сохранить язык: ${saveResult.error}`);
            return { ok: true };
        }

        telegramUser.language_code = normalizedLanguage;
        telegramUser.language_is_set = true;
        pendingLanguageInput.delete(telegramUser.id);

        if (!isTimezoneSelectedForUser(telegramUser)) {
            pendingTimezoneInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
            await sendTimeZoneSelectionPrompt(
                botToken,
                chatId,
                `Язык обновлен: ${normalizedLanguage}\n\nТеперь выберите часовой пояс, например:\nEurope/Moscow`
            );
            return { ok: true };
        }

        await sendReminderQuickActions(
            botToken,
            chatId,
            `${reminderUiText('languageUpdated', normalizedLanguage)}: ${normalizedLanguage}`,
            normalizedLanguage
        );
        return { ok: true };
    }

    if ((command === 'timezone' || command === 'tz') && value) {
        if (!isLanguageSelectedForUser(telegramUser)) {
            pendingLanguageInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
            await sendLanguageSelectionPrompt(
                botToken,
                chatId,
                'Сначала выберите язык.\nВведите: ru или en\nили /settings language ru'
            );
            return { ok: true };
        }

        if (!isValidTimeZone(value)) {
            await sendTimeZoneSelectionPrompt(
                botToken,
                chatId,
                `Неверный часовой пояс: ${value}\n\nПример:\n/settings timezone Europe/Moscow\n/settings timezone Asia/Almaty\n/settings timezone America/New_York`
            );
            return { ok: true };
        }

        const saveResult = await setUserTimeZone(telegramUser.id, value);
        if (!saveResult.success) {
            await sendTelegramMessage(botToken, chatId, `Не удалось сохранить часовой пояс: ${saveResult.error}`);
            return { ok: true };
        }

        telegramUser.timezone = value;
        telegramUser.timezone_is_set = true;
        pendingTimezoneInput.delete(telegramUser.id);
        await sendReminderQuickActions(
            botToken,
            chatId,
            `${reminderUiText('timezoneUpdated', telegramUser.language_code)}: ${value}`,
            telegramUser.language_code
        );
        return { ok: true };
    }

    if ((command === 'quiet' || command === 'sleep') && value && value2) {
        const saveResult = await setUserQuietHours(telegramUser.id, value, value2);
        if (!saveResult.success) {
            await sendTelegramMessage(botToken, chatId, `Не удалось сохранить quiet hours: ${saveResult.error}`);
            return { ok: true };
        }
        telegramUser.quiet_hours_start = parseInt(value, 10);
        telegramUser.quiet_hours_end = parseInt(value2, 10);
        await sendTelegramMessage(botToken, chatId, `Тихий режим обновлен: ${value}:00 - ${value2}:00`);
        return { ok: true };
    }

    const message = `Настройки напоминаний

Текущий язык: ${telegramUser.language_code || 'ru'}
Текущий часовой пояс: ${currentTimeZone}
Тихий режим: ${telegramUser.quiet_hours_start ?? 23}:00 - ${telegramUser.quiet_hours_end ?? 7}:00

Чтобы изменить язык:
/settings language ru
/settings language en

Чтобы изменить пояс:
/settings timezone Europe/Moscow
/settings timezone Asia/Almaty
/settings timezone America/New_York

Тихий режим:
/settings quiet 23 7
`;
    await sendTelegramMessage(botToken, chatId, message, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Язык', callback_data: 'open:settings:language' },
                    { text: 'Часовой пояс', callback_data: 'open:settings:timezone' }
                ],
                [
                    { text: 'Тихий режим', callback_data: 'open:settings:quiet' }
                ]
            ]
        }
    });
    return { ok: true };
}

async function handleCancelCommand(chatId, telegramUser) {
    const botToken = await getReminderBotToken();
    pendingReminderInput.delete(telegramUser.id);
    pendingReminderConfirmation.delete(telegramUser.id);
    if (pendingLanguageInput.has(telegramUser.id)) {
        await sendLanguageSelectionPrompt(
            botToken,
            chatId,
            'Выбор языка обязателен.\nВведите: ru или en'
        );
        return { ok: true };
    }
    if (pendingTimezoneInput.has(telegramUser.id)) {
        await sendTimeZoneSelectionPrompt(
            botToken,
            chatId,
            'Выбор часового пояса обязателен.\nВведите, например: Europe/Moscow'
        );
        return { ok: true };
    }
    await sendTelegramMessage(botToken, chatId, 'Текущая операция отменена.');
    return { ok: true };
}

async function handlePendingLanguageInput(text, chatId, telegramUser) {
    const botToken = await getReminderBotToken();
    const normalizedLanguage = normalizeLanguageInput(text);
    if (!normalizedLanguage) {
        await sendLanguageSelectionPrompt(
            botToken,
            chatId,
            `❌ Неверный язык: ${text}\n\nВведите: ru или en`
        );
        return { ok: true };
    }

    const saveResult = await setUserLanguage(telegramUser.id, normalizedLanguage);
    if (!saveResult.success) {
        await sendTelegramMessage(botToken, chatId, `❌ Не удалось сохранить язык: ${saveResult.error}`);
        return { ok: true };
    }

    telegramUser.language_code = normalizedLanguage;
    telegramUser.language_is_set = true;
    pendingLanguageInput.delete(telegramUser.id);

    if (!isTimezoneSelectedForUser(telegramUser)) {
        pendingTimezoneInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
        await sendTimeZoneSelectionPrompt(
            botToken,
            chatId,
            `Язык сохранен: ${normalizedLanguage}\nТеперь выберите часовой пояс, например: Europe/Moscow`
        );
        return { ok: true };
    }

    await sendReminderQuickActions(
        botToken,
        chatId,
        `${reminderUiText('languageSaved', normalizedLanguage)}: ${normalizedLanguage}`,
        normalizedLanguage
    );
    return { ok: true };
}

async function handlePendingTimezoneInput(text, chatId, telegramUser) {
    const botToken = await getReminderBotToken();
    const candidate = String(text || '').trim();
    if (!isValidTimeZone(candidate)) {
        await sendTimeZoneSelectionPrompt(
            botToken,
            chatId,
            `❌ Неверный часовой пояс: ${candidate}\n\nПримеры корректных значений:\nEurope/Moscow\nAsia/Almaty\nAmerica/New_York`
        );
        return { ok: true };
    }

    const saveResult = await setUserTimeZone(telegramUser.id, candidate);
    if (!saveResult.success) {
        await sendTelegramMessage(botToken, chatId, `❌ Не удалось сохранить часовой пояс: ${saveResult.error}`);
        return { ok: true };
    }

    telegramUser.timezone = candidate;
    telegramUser.timezone_is_set = true;
    pendingTimezoneInput.delete(telegramUser.id);
    await sendReminderQuickActions(
        botToken,
        chatId,
        `${reminderUiText('timezoneSaved', telegramUser.language_code)}: ${candidate}`,
        telegramUser.language_code
    );
    return { ok: true };
}

async function createReminderFromParsed(parsed, chatId, telegramUser) {
    const botToken = await getReminderBotToken();
    const userTimeZone = await getUserTimeZone(telegramUser.id);
    const result = await createReminder(
        telegramUser.id,
        parsed.message,
        parsed.runAt,
        parsed.repeatType,
        parsed.repeatConfig
    );

    if (result.success) {
        const runAtDate = new Date(parsed.runAt);
        const dateStr = formatReminderDate(runAtDate, userTimeZone);
        const repeatInfo = parsed.repeatType === 'interval'
            ? ` (повтор каждые ${Math.round(parsed.repeatConfig.interval_seconds / 60)} мин)`
            : parsed.repeatType === 'cron' ? ' (по расписанию)' : '';

        await sendTelegramMessage(
            botToken,
            chatId,
            `Напоминание создано!\n\n${dateStr}${repeatInfo}\n${userTimeZone}\n${parsed.message}`
        );
    } else {
        await sendTelegramMessage(botToken, chatId, `❌ Ошибка: ${result.error}`);
    }
}

function buildReminderConfirmationText(parsed, userTimeZone) {
    const runAtDate = new Date(parsed.runAt);
    const dateStr = formatReminderDate(runAtDate, userTimeZone);
    const repeatInfo = parsed.repeatType === 'interval'
        ? `\nПовтор: каждые ${Math.round(parsed.repeatConfig.interval_seconds / 60)} мин`
        : parsed.repeatType === 'cron'
            ? `\nПовтор: cron (${parsed.repeatConfig?.cron || ''})`
            : '';

    return `Проверьте данные перед сохранением:

Текст: ${parsed.message}
Дата и время: ${dateStr}
Часовой пояс: ${userTimeZone}${repeatInfo}`;
}

async function maybeConfirmOrCreateReminder(parsed, chatId, telegramUser, sourceMode = 'single') {
    const botToken = await getReminderBotToken();
    const userTimeZone = await getUserTimeZone(telegramUser.id);
    const parsedRunAt = new Date(parsed.runAt);

    if (parsed.repeatType === 'none' && parsedRunAt.getTime() <= Date.now()) {
        pendingReminderConfirmation.set(telegramUser.id, {
            action: 'past_time',
            parsed,
            sourceMode,
            chatId,
            createdAt: Date.now()
        });
        await sendTelegramMessage(
            botToken,
            chatId,
            `⚠️ Указанное время уже прошло:\n${formatReminderDate(parsedRunAt, userTimeZone)}\n\nПеренести на завтра в это же время?`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Да, на завтра', callback_data: 'confirm:past:tomorrow' },
                            { text: 'Нет, изменить', callback_data: 'confirm:edit' }
                        ]
                    ]
                }
            }
        );
        return { ok: true };
    }

    pendingReminderConfirmation.set(telegramUser.id, {
        action: 'create',
        parsed,
        sourceMode,
        chatId,
        createdAt: Date.now()
    });
    await sendTelegramMessage(
        botToken,
        chatId,
        buildReminderConfirmationText(parsed, userTimeZone),
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Сохранить', callback_data: 'confirm:create' },
                        { text: 'Изменить', callback_data: 'confirm:edit' }
                    ]
                ]
            }
        }
    );
    return { ok: true };
}

async function handlePendingReminderInput(text, chatId, telegramUser) {
    const botToken = await getReminderBotToken();
    const userTimeZone = await getUserTimeZone(telegramUser.id);
    const pending = pendingReminderInput.get(telegramUser.id);

    if (!pending) {
        return { ok: true };
    }

    if (pending.mode === 'wizard' && pending.step === 'text') {
        const reminderText = String(text || '').trim();
        if (!reminderText) {
            await sendTelegramMessage(botToken, chatId, '❌ Текст не может быть пустым. Введите текст напоминания.');
            return { ok: true };
        }
        pendingReminderInput.set(telegramUser.id, {
            ...pending,
            step: 'when',
            message: reminderText
        });
        await sendTelegramMessage(
            botToken,
            chatId,
            `Шаг 2/2: укажите дату/время.\n\nПримеры:\nзавтра в 10\nв понедельник 1200\n20 фев 2026 в 11:57\n28 февраля 2026 года в 12:00\n20 02 26 в 1145`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Сегодня 18:00', callback_data: 'addwhen:today18' },
                            { text: 'Завтра 10:00', callback_data: 'addwhen:tomorrow10' }
                        ],
                        [
                            { text: '+1 час', callback_data: 'addwhen:plus1h' },
                            { text: '+1 день', callback_data: 'addwhen:plus1d' }
                        ]
                    ]
                }
            }
        );
        return { ok: true };
    }

    let parsed;
    if (pending.mode === 'wizard' && pending.step === 'when') {
        const combined = `${pending.message} ${text}`;
        parsed = parseNaturalLanguageReminder(combined, userTimeZone);
    } else {
        parsed = parseReminderTextInput(text, userTimeZone);
    }

    if (parsed.error) {
        await logReminderParseFailure(telegramUser.id, chatId, text, parsed.error);
        const smartHints = `\n\nВарианты:\n• завтра в 10\n• ${new Date().getHours() + 1}00\n• 20 фев 2026 в 11:57\n• 28 февраля 2026 года в 12:00`;
        await sendTelegramMessage(
            botToken,
            chatId,
            `❌ ${parsed.error}${smartHints}\n\nПопробуйте снова.\nПримеры:\n10m Купить молоко\n2026-02-21 10:00 Позвонить в офис\nКупить продукты | 2026-02-21 19:00\nПодготовить отчёт завтра в 10\nПозвонить клиенту в понедельник 1200\nПозвонить клиенту 28 февраля 2026 года в 12:00\nCall team tomorrow at 10\n\nДля отмены: /cancel`
        );
        return { ok: true };
    }

    pendingReminderInput.delete(telegramUser.id);
    return await maybeConfirmOrCreateReminder(parsed, chatId, telegramUser, pending.mode || 'single');
}

async function handleRemindCommand(args, chatId, telegramUser) {
    const botToken = await getReminderBotToken();
    if (!args || args.length === 0) {
        pendingReminderInput.set(telegramUser.id, { mode: 'single', step: 'full', chatId, createdAt: Date.now() });
        await sendTelegramMessage(
            botToken,
            chatId,
            'Введите напоминание и время одним сообщением.\n\nПримеры:\n10m Купить молоко\n2026-02-21 10:00 Позвонить в офис\nКупить продукты | 2026-02-21 19:00\nПодготовить отчёт завтра в 10\nПозвонить клиенту в понедельник 1200\nПозвонить клиенту 28 февраля 2026 года в 12:00\nCall team tomorrow at 10\n\nДля отмены: /cancel'
        );
        return { ok: true };
    }

    const userTimeZone = await getUserTimeZone(telegramUser.id);
    const parsed = parseReminderCommand(args, userTimeZone);

    if (parsed.error) {
        await logReminderParseFailure(telegramUser.id, chatId, args.join(' '), parsed.error);
        await sendTelegramMessage(botToken, chatId, `❌ ${parsed.error}`);
        return { ok: true };
    }

    return await maybeConfirmOrCreateReminder(parsed, chatId, telegramUser, 'single');
}

async function handleMyRemindersCommand(args, chatId, telegramUser) {
    const botToken = await getReminderBotToken();
    const showAll = args?.includes('all');
    const reminders = await getUserReminders(telegramUser.id, !showAll);
    const userTimeZone = await getUserTimeZone(telegramUser.id);
    let filtered = reminders;

    if (args?.includes('today')) {
        const now = new Date();
        filtered = filtered.filter((r) => {
            const d = new Date(r.run_at);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        });
    } else if (args?.includes('week')) {
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        filtered = filtered.filter((r) => {
            const ts = new Date(r.run_at).getTime();
            return ts >= now && ts <= now + weekMs;
        });
    }

    const queryArg = args?.find((a) => a.startsWith('q='));
    if (queryArg) {
        const query = decodeURIComponent(queryArg.slice(2)).toLowerCase();
        filtered = filtered.filter((r) => String(r.message || '').toLowerCase().includes(query));
    }

    const pageArg = args?.find((a) => a.startsWith('page='));
    const page = Math.max(1, parseInt(pageArg?.split('=')[1] || '1', 10) || 1);
    const perPage = 10;
    const start = (page - 1) * perPage;
    const paged = filtered.slice(start, start + perPage);
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

    let message = formatReminderList(paged, userTimeZone);
    if (filtered.length > perPage) {
        message += `\n\nСтраница ${page}/${totalPages}. Команда: /list page=${Math.min(totalPages, page + 1)}`;
    }
    await sendTelegramMessage(botToken, chatId, message);
    return { ok: true };
}

async function handleDeleteCommand(args, chatId, telegramUser) {
    const botToken = await getReminderBotToken();
    
    if (args.length === 0) {
        // Show reminders with numbers for deletion
        const reminders = await getUserReminders(telegramUser.id, true);
        const userTimeZone = await getUserTimeZone(telegramUser.id);
        if (reminders.length === 0) {
            await sendTelegramMessage(botToken, chatId, 'У вас нет напоминаний для удаления');
            return { ok: true };
        }

        const message = ['Выберите напоминание для удаления (отправьте номер):'].concat(
            reminders.map((r, i) => `${i + 1}. ${formatReminderDate(new Date(r.run_at), userTimeZone)} — ${r.message}`)
        ).join('\n');

        await sendTelegramMessage(botToken, chatId, message);
        return { ok: true };
    }

    const reminderNum = parseInt(args[0], 10);
    if (isNaN(reminderNum) || reminderNum < 1) {
        await sendTelegramMessage(botToken, chatId, 'Укажите номер напоминания');
        return { ok: true };
    }

    const reminders = await getUserReminders(telegramUser.id, true);
    if (reminderNum > reminders.length) {
        await sendTelegramMessage(botToken, chatId, 'Напоминание с таким номером не найдено');
        return { ok: true };
    }

    const reminder = reminders[reminderNum - 1];
    const result = await deactivateReminder(reminder.id, telegramUser.id);

    if (result.success) {
        await sendTelegramMessage(botToken, chatId, `Напоминание "${reminder.message}" удалено`);
    } else {
        await sendTelegramMessage(botToken, chatId, 'Ошибка при удалении напоминания');
    }

    return { ok: true };
}

async function handleCallbackQuery(callbackQuery, telegramUser) {
    const botToken = await getReminderBotToken();
    const chatId = callbackQuery.message?.chat?.id;
    const data = callbackQuery.data || '';

    if (data.startsWith('action:')) {
        const action = data.split(':')[1];
        if (action === 'add') await handleAddCommand([], chatId, telegramUser);
        if (action === 'list') await handleMyRemindersCommand([], chatId, telegramUser);
        if (action === 'settings') await handleSettingsCommand([], chatId, telegramUser);
        if (action === 'help') await handleHelpCommand(chatId);
        await answerTelegramCallbackQuery(botToken, callbackQuery.id);
        return { ok: true };
    }

    if (data.startsWith('setlang:')) {
        const langValue = data.split(':')[1];
        const normalizedLanguage = normalizeLanguageInput(langValue);
        if (!normalizedLanguage) {
            await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Неверный язык');
            return { ok: true };
        }
        const saveResult = await setUserLanguage(telegramUser.id, normalizedLanguage);
        if (!saveResult.success) {
            await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Ошибка сохранения языка');
            return { ok: true };
        }
        telegramUser.language_code = normalizedLanguage;
        telegramUser.language_is_set = true;
        pendingLanguageInput.delete(telegramUser.id);
        if (!isTimezoneSelectedForUser(telegramUser)) {
            pendingTimezoneInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
            await sendTimeZoneSelectionPrompt(botToken, chatId, 'Язык сохранен. Теперь выберите часовой пояс.');
        } else {
            await sendReminderQuickActions(
                botToken,
                chatId,
                `${reminderUiText('languageSaved', telegramUser.language_code)}. ${reminderUiText('quickActionsTitle', telegramUser.language_code)}`,
                telegramUser.language_code
            );
        }
        await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Язык сохранен');
        return { ok: true };
    }

    if (data === 'open:settings:language') {
        pendingLanguageInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
        await sendLanguageSelectionPrompt(botToken, chatId, 'Выберите язык:');
        await answerTelegramCallbackQuery(botToken, callbackQuery.id);
        return { ok: true };
    }

    if (data === 'open:settings:timezone') {
        if (!isLanguageSelectedForUser(telegramUser)) {
            pendingLanguageInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
            await sendLanguageSelectionPrompt(botToken, chatId, 'Сначала выберите язык:');
            await answerTelegramCallbackQuery(botToken, callbackQuery.id);
            return { ok: true };
        }
        pendingTimezoneInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
        await sendTimeZoneSelectionPrompt(botToken, chatId, 'Выберите часовой пояс:');
        await answerTelegramCallbackQuery(botToken, callbackQuery.id);
        return { ok: true };
    }

    if (data === 'open:settings:quiet') {
        await sendQuietHoursSelectionPrompt(
            botToken,
            chatId,
            `Текущий тихий режим: ${telegramUser.quiet_hours_start ?? 23}:00 - ${telegramUser.quiet_hours_end ?? 7}:00\n\nВыберите пресет:`
        );
        await answerTelegramCallbackQuery(botToken, callbackQuery.id);
        return { ok: true };
    }

    if (data.startsWith('setquiet:')) {
        const parts = data.split(':');
        const start = parseInt(parts[1], 10);
        const end = parseInt(parts[2], 10);
        const saveResult = await setUserQuietHours(telegramUser.id, start, end);
        if (!saveResult.success) {
            await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Ошибка сохранения тихого режима');
            return { ok: true };
        }
        telegramUser.quiet_hours_start = start;
        telegramUser.quiet_hours_end = end;
        await sendTelegramMessage(
            botToken,
            chatId,
            start === end
                ? 'Тихий режим отключен'
                : `Тихий режим обновлен: ${start}:00 - ${end}:00`
        );
        await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Тихий режим сохранен');
        return { ok: true };
    }

    if (data.startsWith('settz:')) {
        const tzValue = data.substring('settz:'.length);
        if (tzValue === 'manual') {
            pendingTimezoneInput.set(telegramUser.id, { chatId, createdAt: Date.now() });
            await sendTelegramMessage(botToken, chatId, 'Введите часовой пояс вручную, например: Europe/Moscow');
            await answerTelegramCallbackQuery(botToken, callbackQuery.id);
            return { ok: true };
        }
        if (!isValidTimeZone(tzValue)) {
            await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Неверный timezone');
            return { ok: true };
        }
        const saveResult = await setUserTimeZone(telegramUser.id, tzValue);
        if (!saveResult.success) {
            await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Ошибка сохранения timezone');
            return { ok: true };
        }
        telegramUser.timezone = tzValue;
        telegramUser.timezone_is_set = true;
        pendingTimezoneInput.delete(telegramUser.id);
        await sendReminderQuickActions(
            botToken,
            chatId,
            `${reminderUiText('timezoneSaved', telegramUser.language_code)}: ${tzValue}`,
            telegramUser.language_code
        );
        await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Timezone сохранен');
        return { ok: true };
    }

    if (data.startsWith('addwhen:')) {
        const pending = pendingReminderInput.get(telegramUser.id);
        if (!pending || pending.mode !== 'wizard' || pending.step !== 'when' || !pending.message) {
            await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Сначала начните /add');
            return { ok: true };
        }
        const key = data.split(':')[1];
        let inputText = '';
        if (key === 'today18') inputText = `${pending.message} сегодня в 18:00`;
        if (key === 'tomorrow10') inputText = `${pending.message} завтра в 10:00`;
        if (key === 'plus1h') inputText = `${pending.message} через 1 час`;
        if (key === 'plus1d') inputText = `${pending.message} через 1 день`;

        const userTimeZone = await getUserTimeZone(telegramUser.id);
        const parsed = parseNaturalLanguageReminder(inputText, userTimeZone);
        if (parsed.error) {
            await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Не удалось распознать');
            return { ok: true };
        }
        pendingReminderInput.delete(telegramUser.id);
        await maybeConfirmOrCreateReminder(parsed, chatId, telegramUser);
        await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Время выбрано');
        return { ok: true };
    }

    if (data === 'confirm:create') {
        const pending = pendingReminderConfirmation.get(telegramUser.id);
        if (pending?.parsed) {
            await createReminderFromParsed(pending.parsed, chatId, telegramUser);
            pendingReminderConfirmation.delete(telegramUser.id);
            await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Сохранено');
            return { ok: true };
        }
    }

    if (data === 'confirm:edit') {
        const pending = pendingReminderConfirmation.get(telegramUser.id);
        pendingReminderConfirmation.delete(telegramUser.id);

        if (pending?.sourceMode === 'wizard' && pending?.parsed?.message) {
            pendingReminderInput.set(telegramUser.id, {
                mode: 'wizard',
                step: 'when',
                message: pending.parsed.message,
                chatId,
                createdAt: Date.now()
            });
            await sendTelegramMessage(
                botToken,
                chatId,
                `Ок, изменим время для:\n${pending.parsed.message}\n\nУкажите новую дату/время.`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Сегодня 18:00', callback_data: 'addwhen:today18' },
                                { text: 'Завтра 10:00', callback_data: 'addwhen:tomorrow10' }
                            ],
                            [
                                { text: '+1 час', callback_data: 'addwhen:plus1h' },
                                { text: '+1 день', callback_data: 'addwhen:plus1d' }
                            ]
                        ]
                    }
                }
            );
        } else {
            pendingReminderInput.set(telegramUser.id, { mode: 'single', step: 'full', chatId, createdAt: Date.now() });
            await sendTelegramMessage(botToken, chatId, 'Ок, отправьте напоминание заново одним сообщением.');
        }
        await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Введите заново');
        return { ok: true };
    }

    if (data === 'confirm:past:tomorrow') {
        const pending = pendingReminderConfirmation.get(telegramUser.id);
        if (pending?.parsed?.runAt) {
            const runAt = new Date(pending.parsed.runAt);
            runAt.setDate(runAt.getDate() + 1);
            pending.parsed.runAt = runAt;
            await createReminderFromParsed(pending.parsed, chatId, telegramUser);
            pendingReminderConfirmation.delete(telegramUser.id);
            await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Перенесено на завтра');
            return { ok: true };
        }
    }

    if (data.startsWith('snooze:')) {
        const [, action, reminderIdRaw] = data.split(':');
        const reminderId = parseInt(reminderIdRaw, 10);
        if (Number.isNaN(reminderId)) {
            await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Некорректный reminder');
            return { ok: true };
        }
        const result = await db.query('SELECT * FROM telegram_reminders WHERE id = $1 AND telegram_user_id = $2', [reminderId, telegramUser.id]);
        const baseReminder = result.rows?.[0];
        if (!baseReminder) {
            await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Reminder не найден');
            return { ok: true };
        }
        let nextRun = new Date();
        if (action === '10m') nextRun = new Date(Date.now() + 10 * 60 * 1000);
        if (action === '1h') nextRun = new Date(Date.now() + 60 * 60 * 1000);
        if (action === 'tomorrow') {
            nextRun = new Date();
            nextRun.setDate(nextRun.getDate() + 1);
            nextRun.setHours(9, 0, 0, 0);
        }
        await createReminder(telegramUser.id, baseReminder.message, nextRun, 'none', null);
        await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Создано повторное напоминание');
        return { ok: true };
    }

    if (data.startsWith('off:')) {
        const reminderId = parseInt(data.split(':')[1], 10);
        if (!Number.isNaN(reminderId)) {
            await deactivateReminder(reminderId, telegramUser.id);
        }
        await answerTelegramCallbackQuery(botToken, callbackQuery.id, 'Отключено');
        return { ok: true };
    }

    await answerTelegramCallbackQuery(botToken, callbackQuery.id);
    return { ok: true };
}

// Получить токен бота напоминаний (из settings)
async function getReminderBotToken() {
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const result = await db.query('SELECT value FROM settings WHERE key = $1', ['reminder_bot_token']);
            if (result.rows.length > 0 && result.rows[0].value && result.rows[0].value !== 'YOUR_TOKEN') {
                return result.rows[0].value;
            }
        } catch (e) {
            console.error('[Reminder] Error getting bot token:', e);
        }
    }
    return '';
}

async function sendTelegramMessage(botToken, chatId, text, options = {}) {
    try {
        const payload = {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            ...options
        };
        const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, payload);
        return { success: true, response: response.data };
    } catch (error) {
        const errDetail = error.response?.data || error.message;
        console.error('[Telegram] Send message error:', errDetail);
        return { success: false, error: errDetail };
    }
}

async function sendTelegramPhoto(botToken, chatId, photo, caption = '') {
    try {
        const dataUriImage = typeof photo === 'string' ? parseDataImageUrl(photo) : null;
        const inlineImage = photo && typeof photo === 'object' && photo.base64
            ? { mimeType: String(photo.mimeType || 'image/png'), base64: String(photo.base64) }
            : null;

        let response;
        if (dataUriImage || inlineImage) {
            const image = dataUriImage || inlineImage;
            const mimeType = String(image.mimeType || 'image/png').toLowerCase();
            const ext = mimeType.includes('png')
                ? 'png'
                : mimeType.includes('webp')
                    ? 'webp'
                    : mimeType.includes('gif')
                        ? 'gif'
                        : 'jpg';
            const form = new FormData();
            form.append('chat_id', String(chatId));
            if (caption) {
                form.append('caption', String(caption).slice(0, 1024));
                form.append('parse_mode', 'HTML');
            }
            form.append('photo', Buffer.from(String(image.base64), 'base64'), {
                filename: `ai-image.${ext}`,
                contentType: mimeType
            });
            response = await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, form, {
                headers: form.getHeaders(),
                maxBodyLength: Infinity
            });
        } else {
            const payload = {
                chat_id: chatId,
                photo,
                caption: caption ? String(caption).slice(0, 1024) : undefined,
                parse_mode: 'HTML'
            };
            response = await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, payload);
        }
        return { success: true, response: response.data };
    } catch (error) {
        const errDetail = error.response?.data || error.message;
        console.error('[Telegram] Send photo error:', errDetail);
        return { success: false, error: errDetail };
    }
}

async function answerTelegramCallbackQuery(botToken, callbackQueryId, text = '') {
    try {
        await axios.post(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            callback_query_id: callbackQueryId,
            text: text || undefined,
            show_alert: false
        });
    } catch (error) {
        const errDetail = error.response?.data || error.message;
        console.error('[Telegram] answerCallbackQuery error:', errDetail);
    }
}

async function sendLanguageSelectionPrompt(botToken, chatId, text) {
    return await sendTelegramMessage(botToken, chatId, text, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Русский', callback_data: 'setlang:ru' },
                    { text: 'English', callback_data: 'setlang:en' }
                ]
            ]
        }
    });
}

async function sendTimeZoneSelectionPrompt(botToken, chatId, text) {
    return await sendTelegramMessage(botToken, chatId, text, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Europe/Moscow', callback_data: 'settz:Europe/Moscow' },
                    { text: 'Asia/Almaty', callback_data: 'settz:Asia/Almaty' }
                ],
                [
                    { text: 'America/New_York', callback_data: 'settz:America/New_York' },
                    { text: 'Asia/Tashkent', callback_data: 'settz:Asia/Tashkent' }
                ],
                [
                    { text: 'Ввести вручную', callback_data: 'settz:manual' }
                ]
            ]
        }
    });
}

async function sendQuietHoursSelectionPrompt(botToken, chatId, text) {
    return await sendTelegramMessage(botToken, chatId, text, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '23:00-07:00', callback_data: 'setquiet:23:7' },
                    { text: '22:00-08:00', callback_data: 'setquiet:22:8' }
                ],
                [
                    { text: '00:00-06:00', callback_data: 'setquiet:0:6' },
                    { text: 'Выкл', callback_data: 'setquiet:0:0' }
                ]
            ]
        }
    });
}


async function sendReminderQuickActions(botToken, chatId, text = null, languageCode = 'ru') {
    const messageText = text || reminderUiText('quickActionsTitle', languageCode);
    return await sendTelegramMessage(botToken, chatId, messageText, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: reminderUiText('quickCreate', languageCode), callback_data: 'action:add' },
                    { text: reminderUiText('quickList', languageCode), callback_data: 'action:list' }
                ],
                [
                    { text: reminderUiText('quickSettings', languageCode), callback_data: 'action:settings' },
                    { text: reminderUiText('quickHelp', languageCode), callback_data: 'action:help' }
                ]
            ]
        }
    });
}

// ----- Reminder Dispatcher Worker -----
async function processDueReminders() {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') return;
    
    try {
        const now = new Date();
        
        // Get all due reminders
        const result = await db.query(
            `SELECT r.*, u.telegram_id, u.username, u.timezone, u.quiet_hours_start, u.quiet_hours_end
             FROM telegram_reminders r
             JOIN telegram_users u ON r.telegram_user_id = u.id
             WHERE r.is_active = true 
               AND r.next_run_at <= $1
             ORDER BY r.next_run_at ASC`,
            [now]
        );
        
        for (const reminder of result.rows) {
            await sendDueReminder(reminder);
        }
    } catch (err) {
        console.error('[Reminder Dispatcher] Error processing due reminders:', err);
    }
}

async function sendDueReminder(reminder) {
    try {
        const timeZone = isValidTimeZone(reminder.timezone) ? reminder.timezone : 'UTC';
        const quietStart = reminder.quiet_hours_start ?? 23;
        const quietEnd = reminder.quiet_hours_end ?? 7;
        if (isInQuietHoursInTimeZone(new Date(), timeZone, quietStart, quietEnd)) {
            const deferred = nextAllowedTimeAfterQuiet(new Date(), timeZone, quietStart, quietEnd);
            await db.query(
                `UPDATE telegram_reminders SET next_run_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [deferred, reminder.id]
            );
            return;
        }

        const botToken = await getReminderBotToken();
        const messageText = `Напоминание\n\n${reminder.message}`;
        const sendResult = await sendTelegramMessage(
            botToken,
            reminder.telegram_id,
            messageText,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '+10м', callback_data: `snooze:10m:${reminder.id}` },
                            { text: '+1ч', callback_data: `snooze:1h:${reminder.id}` },
                            { text: 'Завтра', callback_data: `snooze:tomorrow:${reminder.id}` }
                        ],
                        [
                            { text: 'Отключить', callback_data: `off:${reminder.id}` }
                        ]
                    ]
                }
            }
        );
        
        const sent = !!sendResult?.success;
        
        // Log the send
        await logReminderSend(
            reminder.id,
            reminder.telegram_user_id,
            sent ? 'sent' : 'failed',
            messageText,
            sent ? null : JSON.stringify(sendResult)
        );
        
        if (sent) {
            // Handle repeat
            if (reminder.repeat_type === 'interval' && reminder.repeat_config?.interval_seconds) {
                const nextRun = new Date(Date.now() + reminder.repeat_config.interval_seconds * 1000);
                await db.query(
                    `UPDATE telegram_reminders SET next_run_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                    [nextRun, reminder.id]
                );
            } else if (reminder.repeat_type === 'cron' && reminder.repeat_config?.cron) {
                const nextRun = parseCronNextRun(reminder.repeat_config.cron);
                if (nextRun) {
                    await db.query(
                        `UPDATE telegram_reminders SET next_run_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                        [nextRun, reminder.id]
                    );
                } else {
                    // Invalid cron, deactivate
                    await db.query(
                        `UPDATE telegram_reminders SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                        [reminder.id]
                    );
                }
            } else {
                // One-time reminder, deactivate
                await db.query(
                    `UPDATE telegram_reminders SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                    [reminder.id]
                );
            }
            
            console.log(`[Reminder] Sent reminder ${reminder.id} to user ${reminder.telegram_id}`);
        } else {
            console.error(`[Reminder] Failed to send reminder ${reminder.id}:`, sendResult);
        }
    } catch (err) {
        console.error('[Reminder] Error sending due reminder:', err);
        await logReminderSend(reminder.id, reminder.telegram_user_id, 'failed', reminder.message, err.message);
    }
}

function startReminderDispatcher() {
    if (reminderDispatcherInterval) clearInterval(reminderDispatcherInterval);
    
    // Check every 30 seconds for due reminders
    reminderDispatcherInterval = setInterval(() => {
        processDueReminders().catch(err => console.error('[Reminder Dispatcher] Error:', err));
    }, 30000);
    
    console.log('[Reminder] Dispatcher started (checking every 30s)');
}

function stopReminderDispatcher() {
    if (reminderDispatcherInterval) {
        clearInterval(reminderDispatcherInterval);
        reminderDispatcherInterval = null;
        console.log('[Reminder] Dispatcher stopped');
    }
}

// API endpoint for Telegram webhook
app.post('/api/telegram/webhook', async (req, res) => {
    const update = req.body;
    
    // Log incoming update
    if (update.message) {
        const chatId = update.message.chat?.id;
        const text = update.message.text;
        const from = update.message.from;
        console.log(`[Telegram Webhook] Message from ${from?.username || from?.id}: ${text} (chat: ${chatId})`);
    } else if (update.callback_query) {
        console.log(`[Telegram Webhook] Callback query from ${update.callback_query.from?.id}`);
    }
    
    // Process the update
    const result = await handleTelegramUpdate(update);
    
    if (result.ok) {
        res.json({ ok: true });
    } else {
        res.status(400).json({ ok: false, error: result.error });
    }
});

// API endpoints for reminder management (web interface)
app.get('/api/reminders', auth, async (req, res) => {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return res.json([]);
    }

    try {
        const result = await db.query(
            `SELECT
                r.id,
                r.telegram_user_id,
                r.message,
                r.run_at,
                r.repeat_type,
                r.repeat_config,
                r.is_active,
                r.created_at,
                r.updated_at,
                r.next_run_at,
                u.telegram_id,
                u.username,
                u.first_name,
                u.last_name
             FROM telegram_reminders r
             JOIN telegram_users u ON u.id = r.telegram_user_id
             ORDER BY r.created_at DESC`
        );

        res.json(result.rows);
    } catch (err) {
        console.error('[API] Error getting reminders:', err);
        res.status(500).json({ error: 'Failed to get reminders' });
    }
});

app.put('/api/reminders/:id', auth, blockAuditorWrite, async (req, res) => {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return res.status(500).json({ error: 'Database not available' });
    }

    const reminderId = Number(req.params.id);
    if (!Number.isInteger(reminderId) || reminderId < 1) {
        return res.status(400).json({ error: 'Invalid reminder id' });
    }

    const {
        message,
        runAt,
        repeatType,
        repeatConfig,
        isActive,
        nextRunAt,
    } = req.body || {};

    const fields = [];
    const values = [];

    const addField = (sqlPart, value) => {
        values.push(value);
        fields.push(`${sqlPart} = $${values.length}`);
    };

    if (message !== undefined) {
        const normalizedMessage = String(message).trim();
        if (!normalizedMessage) {
            return res.status(400).json({ error: 'Message is required' });
        }
        addField('message', normalizedMessage);
    }

    if (runAt !== undefined) {
        const parsedRunAt = new Date(runAt);
        if (Number.isNaN(parsedRunAt.getTime())) {
            return res.status(400).json({ error: 'Invalid runAt date' });
        }
        addField('run_at', parsedRunAt);
    }

    if (repeatType !== undefined) {
        const allowed = ['none', 'interval', 'cron'];
        if (!allowed.includes(repeatType)) {
            return res.status(400).json({ error: 'Invalid repeatType' });
        }
        addField('repeat_type', repeatType);
    }

    if (repeatConfig !== undefined) {
        if (repeatConfig !== null && typeof repeatConfig !== 'object') {
            return res.status(400).json({ error: 'Invalid repeatConfig' });
        }
        addField('repeat_config', repeatConfig);
    }

    if (isActive !== undefined) {
        addField('is_active', Boolean(isActive));
    }

    if (nextRunAt !== undefined) {
        if (nextRunAt === null || nextRunAt === '') {
            addField('next_run_at', null);
        } else {
            const parsedNextRunAt = new Date(nextRunAt);
            if (Number.isNaN(parsedNextRunAt.getTime())) {
                return res.status(400).json({ error: 'Invalid nextRunAt date' });
            }
            addField('next_run_at', parsedNextRunAt);
        }
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(reminderId);

    try {
        const result = await db.query(
            `UPDATE telegram_reminders
             SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${values.length}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('[API] Error updating reminder:', err);
        res.status(500).json({ error: 'Failed to update reminder' });
    }
});

app.delete('/api/reminders/:id', auth, blockAuditorWrite, async (req, res) => {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return res.status(500).json({ error: 'Database not available' });
    }

    const reminderId = Number(req.params.id);
    if (!Number.isInteger(reminderId) || reminderId < 1) {
        return res.status(400).json({ error: 'Invalid reminder id' });
    }

    try {
        const result = await db.query(
            `UPDATE telegram_reminders
             SET is_active = false, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [reminderId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('[API] Error deleting reminder:', err);
        res.status(500).json({ error: 'Failed to delete reminder' });
    }
});

app.get('/api/reminders/:id/history', auth, async (req, res) => {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return res.json([]);
    }

    const reminderId = Number(req.params.id);
    if (!Number.isInteger(reminderId) || reminderId < 1) {
        return res.status(400).json({ error: 'Invalid reminder id' });
    }

    try {
        const result = await db.query(
            `SELECT id, reminder_id, telegram_user_id, status, message_text, error_message, sent_at
             FROM reminder_logs
             WHERE reminder_id = $1
             ORDER BY sent_at DESC
             LIMIT 20`,
            [reminderId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[API] Error getting reminder history:', err);
        res.status(500).json({ error: 'Failed to get reminder history' });
    }
});

// ============ INTEGRATIONS API ============

async function loadIntegrationsCache() {
    console.log('tg“Ґ Loading integrations cache...');
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const result = await db.query('SELECT id, data, account_id FROM integrations');
            integrationsCache = result.rows
                .map(r => ({ ...r.data, id: r.id, account_id: r.account_id }))
                .map(normalizeIntegration)
                .filter(Boolean);
            console.log(`v?… Loaded ${integrationsCache.length} integrations from database`);
            return true;
        } catch (e) {
            console.error('Error loading integrations cache from DB:', e);
            return false;
        }
    }

    integrationsCache = loadIntegrationsFromFile()
        .map(normalizeIntegration)
        .filter(Boolean);
    console.log(`v?… Loaded ${integrationsCache.length} integrations from file`);
    return true;
}

function normalizeIntegration(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const interval = Number(raw.pollingInterval);
    const timeout = Number(raw.timeoutSec);
    return {
        ...raw,
        enabled: raw.enabled ?? true,
        triggerType: raw.triggerType || 'webhook',
        triggerCondition: raw.triggerCondition || '',
        pollingUrl: raw.pollingUrl || '',
        pollingMethod: (raw.pollingMethod || 'GET').toUpperCase(),
        pollingHeaders: raw.pollingHeaders || '',
        pollingBody: raw.pollingBody || '',
        pollingInterval: Number.isFinite(interval) && interval > 0 ? interval : 60,
        pollingCondition: raw.pollingCondition || '',
        pollingContinueAfterMatch: raw.pollingContinueAfterMatch ?? false,
        actionUrl: raw.actionUrl || '',
        actionMethod: (raw.actionMethod || 'POST').toUpperCase(),
        actionHeaders: raw.actionHeaders || '',
        actionBody: raw.actionBody || '',
        timeoutSec: Number.isFinite(timeout) && timeout > 0 ? timeout : 30,
        chatId: raw.chatId || '',
        botToken: raw.botToken || '',
        messageTemplate: raw.messageTemplate || '',
        sendToTelegram: raw.sendToTelegram ?? false
    };
}

function evaluateIntegrationCondition(condition, response) {
    if (!condition || typeof condition !== 'string') {
        console.log(`   [EVAL] No condition or not string`);
        return true;
    }
    try {
        const fn = new Function('payload', 'response', `return !!(${condition});`);
        const result = Boolean(fn(response ?? {}, response ?? {}));
        console.log(`   [EVAL] Condition "${condition}" evaluated to ${result}`);
        return result;
    } catch (e) {
        console.error(`   [EVAL] Condition evaluation failed for "${condition}":`, e.message);
        return false;
    }
}

async function executeIntegrationPolling(integration) {
    if (!integration || !integration.enabled || integration.triggerType !== 'polling' || !integration.pollingUrl) {
        return;
    }

    console.log(`tg”„ Polling integration ${integration.id} (${integration.name})...`);

    const headers = parseJsonSafe(integration.pollingHeaders, {});
    const body = parseJsonSafe(integration.pollingBody, null);
    const method = (integration.pollingMethod || 'GET').toUpperCase();
    const timeout = (integration.timeoutSec || 30) * 1000;

    const requestConfig = {
        url: integration.pollingUrl,
        method,
        headers,
        timeout
    };
    if (body !== null && !['GET', 'HEAD'].includes(method)) {
        requestConfig.data = body;
    }

    const runData = {
        triggerType: 'polling',
        status: 'success',
        triggerData: null,
        telegramSent: false,
        accountId: integration.account_id ?? null
    };

    try {
        console.log(`   tg“¤ ${method} ${integration.pollingUrl}`);
        const response = await axios(requestConfig);
        console.log(`   v?“ Got response: ${response.status}`);
        const responseData = response.data ?? {};
        runData.triggerData = JSON.stringify(responseData).slice(0, 2000);
        const conditionMet = evaluateIntegrationCondition(integration.pollingCondition, responseData);
        console.log(`   Condition: ${integration.pollingCondition ? conditionMet : 'no condition'}`);
        if (!conditionMet) {
            console.log(`   v?­пёЏ Condition not met, skipping action`);
            runData.status = 'skipped';
            runData.errorMessage = 'Condition not met';
            await logIntegrationRun(integration.id, runData);
            return;
        }
        console.log(`   v?… Executing action...`);
        const runResult = await executeIntegration(integration, responseData, 'polling');
        // Если интеграция сработала успешно и pollingContinueAfterMatch равно false, то выключаем интеграцию
        if (
            runResult?.status === 'success' &&
            integration.pollingContinueAfterMatch === false
        ) {
            console.log(`   ⚙️ Disabling integration ${integration.id} after match (pollingContinueAfterMatch=false)`);
            integration.enabled = false;
            await persistIntegration(integration);
            const timer = integrationTimers.get(integration.id);
            if (timer) {
                clearInterval(timer);
                integrationTimers.delete(integration.id);
            }
        }
    } catch (error) {
        console.error(`   v?— Integration polling error [${integration.id}]:`, error.message);
        runData.status = 'error';
        runData.errorMessage = error.message;
        await logIntegrationRun(integration.id, runData);
    }
}

function scheduleIntegrationTimers() {
    const list = Array.isArray(integrationsCache) ? integrationsCache : [];
    let scheduled = 0;

    console.log(`tg“‹ Processing ${list.length} integrations for polling...`);

    list.forEach(raw => {
        const integration = normalizeIntegration(raw);
        if (!integration) {
            console.warn('⚠️ Skipping invalid integration (null after normalize)');
            return;
        }

        console.log(
            `tg”Ќ Integration ${integration.id}: enabled=${integration.enabled}, triggerType="${integration.triggerType}", pollingUrl="${integration.pollingUrl}"`
        );

        if (!integration.enabled) {
            console.log(`v?ёпёЏ Integration ${integration.id} (${integration.name}) is disabled`);
            return;
        }
        if (integration.triggerType !== 'polling') {
            console.log(`v?­пёЏ Integration ${integration.id} (${integration.name}) has triggerType: ${integration.triggerType} (skip)`);
            return;
        }
        if (!integration.pollingUrl || integration.pollingUrl.trim() === '') {
            console.warn(`⚠️ Integration ${integration.id} (${integration.name}) has empty pollingUrl`);
            return;
        }

        const intervalMs = Math.max(1, integration.pollingInterval || 60) * 1000;
        
        console.log(`⚡ Integration ${integration.id}: executing first poll immediately...`);
        // Запускаем первую проверку сразу
        executeIntegrationPolling(integration).catch(err => console.error('Integration polling failed (immediate):', integration.id, err.message));
        
        // Затем запускаем по таймеру
        const timer = setInterval(() => {
            executeIntegrationPolling(integration).catch(err => console.error('Integration polling failed:', integration.id, err.message));
        }, intervalMs);
        integrationTimers.set(integration.id, timer);

        console.log(`v?… Scheduled polling for ${integration.name} (ID: ${integration.id}) every ${integration.pollingInterval}s`);
        scheduled += 1;
    });

    console.log(`v?Ё Successfully scheduled ${scheduled} polling integrations`);
}

function stopIntegrationWorkers() {
    for (const timer of integrationTimers.values()) {
        clearInterval(timer);
    }
    integrationTimers.clear();
}

async function startIntegrationWorkers() {
    console.log('tgљЂ Starting integration workers...');
    stopIntegrationWorkers();
    const ok = await loadIntegrationsCache();
    if (!ok) {
        console.warn('⚠️ Integration cache not loaded; skipping polling scheduling');
        return;
    }
    console.log(`tg“¦ Integration cache loaded with ${integrationsCache.length} items`);
    scheduleIntegrationTimers();
    console.log('v?… Integration workers started');
}

async function refreshIntegrationWorkers() {
    await startIntegrationWorkers();
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
            console.error('Error logging integration run to DB:', e);
        }
    } else {
        // File-based mode: log to in-memory array
        try {
            const runRecord = {
                id: Date.now(),
                integration_id: integrationId,
                trigger_type: data.triggerType || 'manual',
                status: data.status || 'success',
                trigger_data: data.triggerData || null,
                action_request: data.actionRequest || null,
                action_response: data.actionResponse || null,
                action_status: data.actionStatus || null,
                telegram_sent: data.telegramSent || false,
                error_message: data.errorMessage || null,
                account_id: data.accountId ?? null,
                created_at: new Date().toISOString()
            };
        
            if (!Array.isArray(db.integrationRuns)) {
                db.integrationRuns = [];
            }
            
            db.integrationRuns.push(runRecord);
            
            // Keep only last 200 runs
            if (db.integrationRuns.length > 200) {
                db.integrationRuns = db.integrationRuns.slice(-200);
            }
            
            saveIntegrationRuns();
        } catch (e) {
            console.error('Error logging integration run to file:', e);
        }
    }
}

// Выполнить интеграции, соответствующие РІPµP±C…уку
async function executeMatchingIntegrations(payload, triggerType = 'webhook', accountId = null) {
    try {
        let integrations = [];
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            if (accountId != null) {
                const result = await db.query('SELECT id, data, account_id FROM integrations WHERE account_id = $1', [accountId]);
                integrations = result.rows.map(r => ({ ...r.data, id: r.id, account_id: r.account_id }));
            } else {
                const result = await db.query('SELECT id, data, account_id FROM integrations');
                integrations = result.rows.map(r => ({ ...r.data, id: r.id, account_id: r.account_id }));
            }
        } else {
            integrations = integrationsCache;
        }

        // Нормализуем интеграции
        const normalizedIntegrations = integrations.map(normalizeIntegration).filter(Boolean);

        // Найдем интеграции, которые должны сработать
        for (const integration of normalizedIntegrations) {
            // Проверяем, что интеграция включена и имеет тип webhook
            if (!integration.enabled || integration.triggerType !== 'webhook') {
                continue;
            }

            // Проверяем условие срабатывания интеграции
            let shouldExecute = true;
            if (integration.triggerCondition) {
                try {
                    const fn = new Function('payload', `
                        try {
                            return ${integration.triggerCondition};
                        } catch (e) {
                            console.error('Condition evaluation error in integration ${integration.id || "(no id)"}:', e.message);
                            return false;
                        }
                    `);
                    shouldExecute = !!fn(payload);
                } catch (evalErr) {
                    console.error('Integration condition evaluation setup error for integration', integration.id || '(no id):', evalErr.message);
                    shouldExecute = false;
                }
            }

            if (shouldExecute) {
                // Выполняем интеграцию
                await executeIntegration(integration, payload, 'webhook');

                // Для РІPµP±C…ук-интеграций нет специального поля "продолжать после совпадения", 
                // так как они срабатывают при каждом РІPµP±C…уке. Это поле используется только для polling интеграций.
                // Но если в будущем добавится такое поле, логика будет такой:
                // if (integration.triggerType === 'webhook' && integration.webhookContinueAfterMatch === false) {
                //     console.log(`   ⚙️ Disabling integration ${integration.id} after match (webhookContinueAfterMatch=false)`);
                //     integration.enabled = false;
                //     await persistIntegration(integration);
                // }
            }
        }
    } catch (error) {
        console.error('Error executing matching integrations:', error);
    }
}

async function executeIntegration(integration, triggerData = null, triggerType = 'manual') {
    if (!integration.enabled && triggerType !== 'manual') return null;

    // Парсим triggerData если это JSON строка
    let parsedTriggerData = triggerData;
    if (typeof triggerData === 'string') {
        try {
            parsedTriggerData = JSON.parse(triggerData);
            console.log(`[PARSE] Parsed triggerData from string`);
        } catch (e) {
            console.log(`[PARSE] triggerData is not JSON, keeping as is`);
            parsedTriggerData = triggerData;
        }
    }

    const runData = {
        triggerType,
        triggerData: triggerData ? (typeof triggerData === 'string' ? triggerData : JSON.stringify(triggerData)).slice(0, 2000) : null,
        status: 'success',
        telegramSent: false
    };

    try {
        // Проверяем условие перед выполнением action
        let shouldExecuteAction = true;
        
        // Для polling: условие уже проверено в executeIntegrationPolling, не проверяем еще раз
        // Для webhook: проверяем triggerCondition если есть
        if (triggerType === 'webhook' && integration.triggerCondition) {
            console.log(`[WEBHOOK] Checking condition: ${integration.triggerCondition}`);
            shouldExecuteAction = evaluateIntegrationCondition(integration.triggerCondition, parsedTriggerData);
            console.log(`[WEBHOOK] Condition result: ${shouldExecuteAction}`);
        } 
        // Для manual: проверяем условие основного триггера если есть
        else if (triggerType === 'manual') {
            // Определяем какое условие проверять в зависимости от типа триггера интеграции
            const conditionToCheck = integration.triggerType === 'polling' 
                ? integration.pollingCondition 
                : integration.triggerCondition;
            
            if (conditionToCheck) {
                console.log(`[MANUAL] Integration type: ${integration.triggerType}, checking condition: ${conditionToCheck}`);
                shouldExecuteAction = evaluateIntegrationCondition(conditionToCheck, parsedTriggerData);
                console.log(`[MANUAL] Condition result: ${shouldExecuteAction}`);
            } else {
                console.log(`[MANUAL] No condition to check`);
            }
        }

        if (!shouldExecuteAction) {
            console.log(`v?­пёЏ Skipping action: condition not met`);
            runData.status = 'skipped';
            runData.errorMessage = 'Condition not met';
            await logIntegrationRun(integration.id, runData);
            return runData;
        }

        // Выполняем action если указан URL
        if (integration.actionUrl) {
            const actionHeaders = integration.actionHeaders ? parseJsonSafe(integration.actionHeaders, {}) : {};
            let actionBody = integration.actionBody || '';
            
            // Подставляем данные триггера в body если есть шаблон
            if (parsedTriggerData && actionBody) {
                actionBody = actionBody.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
                    const keys = path.split('.');
                    let value = parsedTriggerData;
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
            const botToken = await resolveBotToken(integration.botToken, integration.account_id);
            let message = integration.messageTemplate || `Рнтеграция "${integration.name}" выполнена`;
            
            // Данные для шаблона: response (ответ action API) и trigger (данные триггера)
            let responseData = null;
            // Рспользуем полный ответ для шаблона (не обрезанный)
            if (runData.fullResponse) {
                responseData = parseJsonSafe(runData.fullResponse, null);
            } else if (runData.actionResponse) {
                responseData = parseJsonSafe(runData.actionResponse, null);
            }
            
            // Fallback на пустой объект чтобы избежать null errors
            const safePayload = responseData || parsedTriggerData || {};
            const safeResponse = responseData || {};
            const safeTrigger = parsedTriggerData || {};
            
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

        const triggerType = req.body.triggerType === 'polling' ? 'polling' : 'webhook';
        const newIntegration = {
            id: Date.now(),
            name: req.body.name || 'Новая интеграция',
            enabled: req.body.enabled ?? true,
            triggerType,
            triggerCondition: req.body.triggerCondition || '',
            pollingUrl: req.body.pollingUrl || '',
            pollingMethod: (req.body.pollingMethod || 'GET').toString(),
            pollingHeaders: req.body.pollingHeaders || '',
            pollingBody: req.body.pollingBody || '',
            pollingInterval: Math.max(1, Number(req.body.pollingInterval) || 60),
            pollingCondition: req.body.pollingCondition || '',
            pollingContinueAfterMatch: triggerType === 'webhook' ? null : (req.body.pollingContinueAfterMatch ?? false),
            actionUrl: req.body.actionUrl || '',
            actionMethod: (req.body.actionMethod || 'POST').toString(),
            actionHeaders: req.body.actionHeaders || '',
            actionBody: req.body.actionBody || '',
            timeoutSec: Math.max(1, Number(req.body.timeoutSec) || 30),
            chatId: req.body.chatId || '',
            botToken: req.body.botToken || '',
            messageTemplate: req.body.messageTemplate || '',
            sendToTelegram: req.body.sendToTelegram ?? false,
            authorId: req.user.userId || req.user.username
        };

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            await db.query('INSERT INTO integrations (id, data, account_id) VALUES ($1, $2, $3)', [newIntegration.id, newIntegration, accountId]);
        } else {
            integrationsCache.push(newIntegration);
            saveIntegrationsToFile();
        }

        await refreshIntegrationWorkers();
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
        // Apply defaults for missing fields and ensure proper types
        const triggerType = req.body.triggerType === 'polling' ? 'polling' : 'webhook';
        const updated = {
            ...req.body,
            id,
            name: req.body.name || 'Новая интеграция',
            enabled: req.body.enabled ?? true,
            triggerType,
            triggerCondition: req.body.triggerCondition || '',
            pollingUrl: req.body.pollingUrl || '',
            pollingMethod: (req.body.pollingMethod || 'GET').toString(),
            pollingHeaders: req.body.pollingHeaders || '',
            pollingBody: req.body.pollingBody || '',
            pollingInterval: Math.max(1, Number(req.body.pollingInterval) || 60),
            pollingCondition: req.body.pollingCondition || '',
            pollingContinueAfterMatch: triggerType === 'webhook' ? null : (req.body.pollingContinueAfterMatch ?? false),
            actionUrl: req.body.actionUrl || '',
            actionMethod: (req.body.actionMethod || 'POST').toString(),
            actionHeaders: req.body.actionHeaders || '',
            actionBody: req.body.actionBody || '',
            timeoutSec: Math.max(1, Number(req.body.timeoutSec) || 30),
            chatId: req.body.chatId || '',
            botToken: req.body.botToken || '',
            messageTemplate: req.body.messageTemplate || '',
            sendToTelegram: req.body.sendToTelegram ?? false
        };
        
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
            saveIntegrationsToFile();
        }

        await refreshIntegrationWorkers();
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
            saveIntegrationsToFile();
        }
        
        await refreshIntegrationWorkers();
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

        // Нормализуем интеграцию
        integration = normalizeIntegration(integration);
        
        let triggerData = req.body.testData || null;
        
        // Если это polling интеграция - сначала делаем polling запрос
        if (integration.triggerType === 'polling' && integration.pollingUrl) {
            const headers = parseJsonSafe(integration.pollingHeaders, {});
            const body = parseJsonSafe(integration.pollingBody, null);
            const method = (integration.pollingMethod || 'GET').toUpperCase();
            const timeout = (integration.timeoutSec || 30) * 1000;

            const requestConfig = {
                url: integration.pollingUrl,
                method,
                headers,
                timeout
            };
            if (body !== null && !['GET', 'HEAD'].includes(method)) {
                requestConfig.data = body;
            }

            try {
                const response = await axios(requestConfig);
                triggerData = response.data ?? {};
            } catch (error) {
                return res.status(500).json({ error: `Polling failed: ${error.message}` });
            }
        }

        const result = await executeIntegration(integration, triggerData, 'manual');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to run integration' });
    }
});

// Рстория интеграций
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
        
        // File-based mode
        if (!Array.isArray(db.integrationRuns)) {
            return res.json([]);
        }
        
        const runs = db.integrationRuns
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit)
            .map(r => ({
                id: r.id,
                integration_id: r.integration_id,
                trigger_type: r.trigger_type,
                status: r.status,
                trigger_data: r.trigger_data,
                action_request: r.action_request,
                action_response: r.action_response,
                action_status: r.action_status,
                telegram_sent: r.telegram_sent,
                error_message: r.error_message,
                created_at: r.created_at
            }));
        
        res.json(runs);
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
        } else {
            // File-based mode
            db.integrationRuns = [];
            saveIntegrationRuns();
        }
        res.json({ status: 'cleared' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

// ============ REMINDER SETTINGS API ============

// Получить настройки напоминаний (маска токена)
app.get('/api/reminders/settings', auth, async (req, res) => {
    try {
        let botToken = TELEGRAM_BOT_TOKEN;
        let botUsername = '';
        
        // Проверяем, есть ли отдельный токен для напоминаний в settings
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const result = await db.query('SELECT value FROM settings WHERE key = $1', ['reminder_bot_token']);
            if (result.rows.length > 0 && result.rows[0].value) {
                botToken = result.rows[0].value;
            }
        }
        
        // Получаем username бота
        if (botToken && botToken !== 'YOUR_TOKEN') {
            try {
                const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
                if (response.data.ok) {
                    botUsername = response.data.result.username;
                }
            } catch (e) {
                console.error('[Reminder Settings] Error getting bot info:', e.message);
            }
        }
        
        // Проверяем webhook
        let webhookUrl = '';
        let webhookSet = false;
        if (botToken && botToken !== 'YOUR_TOKEN') {
            try {
                const response = await axios.get(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
                if (response.data.ok && response.data.result.url) {
                    webhookUrl = response.data.result.url;
                    webhookSet = webhookUrl.includes('/api/telegram/webhook');
                }
            } catch (e) {
                console.error('[Reminder Settings] Error getting webhook info:', e.message);
            }
        }
        
        res.json({
            botToken: botToken && botToken !== 'YOUR_TOKEN' ? botToken.substring(0, 10) + '...' : '',
            botUsername,
            webhookUrl,
            webhookSet
        });
    } catch (error) {
        console.error('[Reminder Settings] Error:', error);
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

// РЎРѕC…ранить токен бота напоминаний
app.post('/api/reminders/settings/token', auth, async (req, res) => {
    const { botToken } = req.body;
    
    if (!botToken || botToken === 'YOUR_TOKEN') {
        return res.status(400).json({ error: 'Invalid bot token' });
    }
    
    // Проверяем токен
    try {
        const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
        if (!response.data.ok) {
            return res.status(400).json({ error: 'Invalid bot token' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Invalid bot token' });
    }
    
    // РЎРѕC…раняем в БД
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            await db.query(
                'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
                ['reminder_bot_token', botToken]
            );
            console.log('[Reminder] Bot token saved to database');
        } catch (err) {
            console.error('[Reminder] Error saving bot token:', err);
            return res.status(500).json({ error: 'Failed to save token' });
        }
    }
    
    // Получаем username
    let botUsername = '';
    try {
        const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
        botUsername = response.data.result.username;
    } catch (e) {}
    
    res.json({ ok: true, botUsername });
});

// Установить webhook для напоминаний
app.post('/api/reminders/settings/webhook', auth, async (req, res) => {
    let botToken = '';

    // Проверяем, есть ли отдельный токен для напоминаний
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const result = await db.query('SELECT value FROM settings WHERE key = $1', ['reminder_bot_token']);
            if (result.rows.length > 0 && result.rows[0].value && result.rows[0].value !== 'YOUR_TOKEN') {
                botToken = result.rows[0].value;
            }
        } catch (err) {
            console.error('[Reminder] Error getting bot token:', err);
        }
    }
    
    if (!botToken || botToken === 'YOUR_TOKEN') {
        return res.status(400).json({ error: 'Bot token not configured' });
    }
    
    // Определяем домен
    let domain = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || (isProduction ? 'https' : 'http');
    const webhookUrl = `${protocol}://${domain}/api/telegram/webhook`;
    
    try {
        const response = await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
            url: webhookUrl
        });
        
        if (response.data.ok) {
            res.json({ ok: true, webhookUrl });
        } else {
            res.status(400).json({ error: response.data.description || 'Failed to set webhook' });
        }
    } catch (error) {
        console.error('[Reminder] Error setting webhook:', error);
        res.status(400).json({ error: error.response?.data?.description || error.message });
    }
});

// Удалить webhook
app.delete('/api/reminders/settings/webhook', auth, async (req, res) => {
    let botToken = '';

    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const result = await db.query('SELECT value FROM settings WHERE key = $1', ['reminder_bot_token']);
            if (result.rows.length > 0 && result.rows[0].value && result.rows[0].value !== 'YOUR_TOKEN') {
                botToken = result.rows[0].value;
            }
        } catch (err) {
            console.error('[Reminder] Error getting bot token:', err);
        }
    }

    if (!botToken || botToken === 'YOUR_TOKEN') {
        return res.status(400).json({ error: 'Bot token not configured' });
    }
    
    try {
        const response = await axios.get(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
        if (response.data.ok) {
            res.json({ ok: true });
        } else {
            res.status(400).json({ error: response.data.description || 'Failed to delete webhook' });
        }
    } catch (error) {
        console.error('[Reminder] Error deleting webhook:', error);
        res.status(400).json({ error: error.response?.data?.description || error.message });
    }
});

// ============ REMINDER SETTINGS API ============

// SPA fallback - only in production
// In development, Vite dev server handles all frontend routes
if (isProduction) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../build', 'index.html'));
    });
}

const server = app.listen(PORT, () => {
    console.log(`Server on http://localhost:${PORT}`);
    if (String(process.env.REMINDER_PARSER_SELFTEST || '').toLowerCase() === '1') {
        runReminderParserSelfTests();
    }
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));





