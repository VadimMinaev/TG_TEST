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

if (process.env.DATABASE_URL) {
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    (async () => {
        try {
            await client.connect();
            await client.query(`CREATE TABLE IF NOT EXISTS rules (id BIGINT PRIMARY KEY, data JSONB)`);
            await client.query(`CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, data JSONB)`);
            await client.query(`CREATE TABLE IF NOT EXISTS polls (id BIGINT PRIMARY KEY, data JSONB)`);
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
            await client.query(`CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status, created_at)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_message_queue_chat_id ON message_queue(chat_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_poll_runs_poll_id ON poll_runs(poll_id, created_at)`);

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
            console.log('DB connected and tables created');
            await loadPollsCache();
            startMessageQueueWorker();
            startPollWorkers();
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
            const result = await db.query('SELECT id, data FROM polls');
            pollsCache = result.rows.map(r => ({ ...r.data, id: r.id }));
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
        const session = sessions.get(token);
        const now = Date.now();
        if (now - session.timestamp > 24 * 60 * 60 * 1000) {
            sessions.delete(token);
            saveSessions();
            res.status(401).json({ error: 'Session expired' });
            return;
        }
        req.user = session;
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

function canModifyRule(rule, user) {
    const authorId = rule.authorId ?? 'vadmin';
    if (user.username === 'vadmin') return true;
    if (typeof authorId === 'number' && authorId === user.userId) return true;
    return false;
}

function canModifyPoll(poll, user) {
    const authorId = poll.authorId ?? 'vadmin';
    if (user.username === 'vadmin') return true;
    if (typeof authorId === 'number' && authorId === user.userId) return true;
    return false;
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
                    return \`[ОШИБКА В ШАБЛОНЕ]: \${e.message}\n\nДанные:\n\${JSON.stringify(payload, null, 2).slice(0, 4000)}\`;
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

async function addMessageToQueue(botToken, chatId, messageText, priority = 0, webhookLogId = null) {
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
        return sendTelegramMessageDirect(botToken, chatId, messageText);
    }
    try {
        const result = await db.query(
            `INSERT INTO message_queue (bot_token, chat_id, message_text, priority, webhook_log_id)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [botToken, chatId, messageText, priority, webhookLogId]
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

const pollTimers = new Map();

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
            await db.query(
                `INSERT INTO poll_runs (
                    poll_id, status, matched, sent, error_message, response_snippet,
                    request_method, request_url, request_headers, request_body,
                    response_status, response_headers
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
                    run.responseHeaders
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
                const result = await addMessageToQueue(botToken, poll.chatId, messageText, 0, null);
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
            const result = await db.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
            if (result.rows.length > 0) {
                const user = result.rows[0];
                const match = await bcrypt.compare(password, user.password_hash);
                if (match) {
                    const token = Date.now().toString();
                    sessions.set(token, { username: user.username, userId: user.id, timestamp: Date.now() });
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

app.get('/api/me', auth, (req, res) => {
    res.json({
        username: req.user.username,
        userId: req.user.userId || null
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
// УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ
// ────────────────────────────────────────────────────────────────

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
        res.json([]);
    }
});

app.post('/api/users', auth, vadminOnly, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username === 'vadmin') return res.status(400).json({ error: 'Cannot create vadmin user' });

    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
            const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
            if (existing.rows.length > 0) return res.status(400).json({ error: 'Username already exists' });

            const passwordHash = await bcrypt.hash(password, 10);
            const result = await db.query(
                'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at, updated_at',
                [username, passwordHash]
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

app.delete('/api/users/:id', auth, vadminOnly, async (req, res) => {
    const userId = parseInt(req.params.id);
    if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
        try {
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
    if (process.env.DATABASE_URL) {
        try {
            const result = await db.query('SELECT id, data FROM rules');
            rules = result.rows.map(r => ({ ...r.data, id: r.id }));
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
    try {
        let rule;
        if (process.env.DATABASE_URL) {
            const result = await db.query('SELECT id, data FROM rules WHERE id = $1', [ruleId]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
            rule = { ...result.rows[0].data, id: result.rows[0].id };
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

app.post('/api/rules', auth, async (req, res) => {
    try {
        const { botToken, messageTemplate = '', ...ruleData } = req.body;

        if (!botToken || typeof botToken !== 'string' || !botToken.trim()) {
            return res.status(400).json({ error: 'Bot token is required' });
        }

        const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
        if (!response.data.ok) {
            return res.status(400).json({ error: 'Invalid bot token' });
        }

        const authorId = req.user.userId || (req.user.username === 'vadmin' ? 'vadmin' : null);
        if (authorId === null) {
            return res.status(400).json({ error: 'Unable to determine rule author' });
        }

        const safeMessageTemplate = typeof messageTemplate === 'string' ? messageTemplate : '';
        const newRule = {
            id: Date.now(),
            ...ruleData,
            botToken,
            messageTemplate: safeMessageTemplate.trim(),
            enabled: req.body.enabled !== false,
            encoding: 'utf8',
            authorId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (process.env.DATABASE_URL) {
            await db.query('INSERT INTO rules (id, data) VALUES ($1, $2)', [newRule.id, newRule]);
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

app.put('/api/rules/:id', auth, async (req, res) => {
    try {
        const ruleId = parseInt(req.params.id);
        let rule;

        if (process.env.DATABASE_URL) {
            const result = await db.query('SELECT data FROM rules WHERE id = $1', [ruleId]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
            rule = result.rows[0].data;
        } else {
            const idx = db.rules.findIndex(r => r.id == ruleId);
            if (idx < 0) return res.status(404).json({ error: 'not found' });
            rule = db.rules[idx];
        }

        if (rule.authorId === undefined) rule.authorId = 'vadmin';

        if (!canModifyRule(rule, req.user)) {
            return res.status(403).json({ error: 'Only the rule author or vadmin can modify this rule' });
        }

        const { botToken, messageTemplate, ...ruleData } = req.body;

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

        const updated = {
            ...rule,
            ...ruleData,
            messageTemplate: messageTemplate !== undefined ? (messageTemplate || '').trim() : rule.messageTemplate || '',
            updated_at: new Date().toISOString()
        };

        if (!updated.botToken) {
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

app.delete('/api/rules/:id', auth, async (req, res) => {
    try {
        const ruleId = parseInt(req.params.id);
        let rule;

        if (process.env.DATABASE_URL) {
            const result = await db.query('SELECT data FROM rules WHERE id = $1', [ruleId]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
            rule = result.rows[0].data;
        } else {
            const idx = db.rules.findIndex(r => r.id == ruleId);
            if (idx < 0) return res.status(404).json({ error: 'Rule not found' });
            rule = db.rules[idx];
        }

        if (rule.authorId === undefined) rule.authorId = 'vadmin';

        if (!canModifyRule(rule, req.user)) {
            return res.status(403).json({ error: 'Only the rule author or vadmin can delete this rule' });
        }

        if (process.env.DATABASE_URL) {
            const deleteResult = await db.query('DELETE FROM rules WHERE id = $1', [ruleId]);
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
    try {
        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const result = await db.query('SELECT id, data FROM polls');
            const polls = result.rows.map(r => ({ ...r.data, id: r.id }));
            return res.json(polls);
        }
        return res.json(pollsCache || []);
    } catch (error) {
        console.error('Error loading polls:', error);
        res.status(500).json({ error: 'Failed to load polls' });
    }
});

app.post('/api/polls', auth, async (req, res) => {
    try {
        const authorId = req.user.userId || (req.user.username === 'vadmin' ? 'vadmin' : null);
        if (authorId === null) {
            return res.status(400).json({ error: 'Unable to determine poll author' });
        }

        const newPoll = normalizePoll({
            id: Date.now(),
            ...req.body,
            authorId
        });

        if (!newPoll.name || !newPoll.url || !newPoll.chatId) {
            return res.status(400).json({ error: 'name, url and chatId are required' });
        }

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            await db.query('INSERT INTO polls (id, data) VALUES ($1, $2)', [newPoll.id, newPoll]);
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

app.put('/api/polls/:id', auth, async (req, res) => {
    try {
        const pollId = parseInt(req.params.id, 10);
        let poll;

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const result = await db.query('SELECT data FROM polls WHERE id = $1', [pollId]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
            poll = result.rows[0].data;
        } else {
            poll = pollsCache.find(p => p.id === pollId);
            if (!poll) return res.status(404).json({ error: 'not found' });
        }

        if (!canModifyPoll(poll, req.user)) {
            return res.status(403).json({ error: 'Only the author or vadmin can modify this poll' });
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

app.delete('/api/polls/:id', auth, async (req, res) => {
    try {
        const pollId = parseInt(req.params.id, 10);
        let poll;

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const result = await db.query('SELECT data FROM polls WHERE id = $1', [pollId]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
            poll = result.rows[0].data;
            if (!canModifyPoll(poll, req.user)) {
                return res.status(403).json({ error: 'Only the author or vadmin can delete this poll' });
            }
            await db.query('DELETE FROM polls WHERE id = $1', [pollId]);
        } else {
            poll = pollsCache.find(p => p.id === pollId);
            if (!poll) return res.status(404).json({ error: 'not found' });
            if (!canModifyPoll(poll, req.user)) {
                return res.status(403).json({ error: 'Only the author or vadmin can delete this poll' });
            }
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

app.post('/api/polls/:id/run', auth, async (req, res) => {
    try {
        const pollId = parseInt(req.params.id, 10);
        let poll;

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
            const result = await db.query('SELECT data FROM polls WHERE id = $1', [pollId]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
            poll = result.rows[0].data;
        } else {
            poll = pollsCache.find(p => p.id === pollId);
            if (!poll) return res.status(404).json({ error: 'not found' });
        }

        if (!canModifyPoll(poll, req.user)) {
            return res.status(403).json({ error: 'Only the author or vadmin can run this poll' });
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
    try {
        const pollIdRaw = req.query.pollId;
        const pollId = pollIdRaw ? parseInt(pollIdRaw, 10) : null;
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));

        if (process.env.DATABASE_URL && db && typeof db.query === 'function') {
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

// ────────────────────────────────────────────────────────────────
// WEBHOOK — ОСНОВНОЙ ХЕНДЛЕР
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

            const messageText = formatMessage(req.body, incomingPayload, rule);

            let token = rule.botToken;
            if (!token || token === 'YOUR_TOKEN' || token === 'ВАШ_ТОКЕН_ЗДЕСЬ') {
                token = TELEGRAM_BOT_TOKEN;
                if (!token || token === 'YOUR_TOKEN') {
                    telegram_results.push({ chatId: rule.chatId || null, success: false, error: 'No bot token configured' });
                    continue;
                }
            }

            const chatIds = Array.isArray(rule.chatIds) ? rule.chatIds : (rule.chatId ? [rule.chatId] : []);
            if (chatIds.length === 0) {
                telegram_results.push({ chatId: null, success: false, error: 'No chatId configured' });
                continue;
            }

            for (const chat of chatIds) {
                try {
                    const queueResult = await addMessageToQueue(token, chat, messageText, 0, null);
                    if (queueResult.queued) {
                        telegram_results.push({ chatId: chat, success: true, queued: true, queueId: queueResult.id });
                    } else if (queueResult.success) {
                        telegram_results.push({ chatId: chat, success: true, response: queueResult.response });
                    } else {
                        telegram_results.push({ chatId: chat, success: false, error: queueResult.error });
                    }
                } catch (error) {
                    const errDetail = error.response?.data || error.message;
                    console.error('Error queuing message for chat', chat, errDetail);
                    telegram_results.push({ chatId: chat, success: false, error: errDetail });
                }
            }
        }
    }

    logWebhook(req.body, matched, rules.length, telegram_results);
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
    try {
        const stats = await db.query(`SELECT status, COUNT(*) as count FROM message_queue GROUP BY status`);
        const total = await db.query(`SELECT COUNT(*) as total FROM message_queue`);
        const pending = await db.query(`SELECT COUNT(*) as count FROM message_queue WHERE status = 'pending'`);

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
    if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') return res.json([]);

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const status = req.query.status;

        let query = `SELECT id, bot_token, chat_id, message_text, priority, status, attempts, max_attempts, created_at, sent_at, error_message FROM message_queue`;
        const params = [];
        if (status) {
            query += ` WHERE status = $1`;
            params.push(status);
        }
        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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

        let countQuery = 'SELECT COUNT(*) as total FROM message_queue';
        const countParams = [];
        if (status) {
            countQuery += ' WHERE status = $1';
            countParams.push(status);
        }
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