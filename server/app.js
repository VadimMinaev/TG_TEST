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
// Функция для сохранения сессий
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
await client.query(`
CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status, created_at);
`);
await client.query(`
CREATE INDEX IF NOT EXISTS idx_message_queue_chat_id ON message_queue(chat_id);
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
// Запускаем worker для обработки очереди сообщений
startMessageQueueWorker();
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

// ✅ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ПРОВЕРКА ДОСТУПА К ПРАВИЛУ
function canModifyRule(rule, user) {
  // Если правило не имеет автора — считаем, что автор vadmin
  const authorId = rule.authorId ?? 'vadmin';

  // vadmin может всё
  if (user.username === 'vadmin') return true;

  // Обычный пользователь может только своё
  if (typeof authorId === 'number' && authorId === user.userId) return true;

  // Если автор — vadmin, а текущий пользователь не vadmin — нельзя
  return false;
}

// MESSAGE QUEUE FUNCTIONS
async function addMessageToQueue(botToken, chatId, messageText, priority = 0, webhookLogId = null) {
if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
// Если БД нет, отправляем напрямую (fallback для файлового режима)
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
// Fallback: отправляем напрямую при ошибке
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
if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
return null;
}
try {
const result = await db.query(
`SELECT id, bot_token, chat_id, message_text, attempts, max_attempts
FROM message_queue
WHERE status = 'pending' AND created_at <= CURRENT_TIMESTAMP
ORDER BY priority DESC, created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED`
);
if (result.rows.length === 0) {
return null;
}
// Обновляем статус на 'processing'
await db.query(
`UPDATE message_queue SET status = 'processing' WHERE id = $1`,
[result.rows[0].id]
);
return result.rows[0];
} catch (error) {
console.error('Error getting message from queue:', error);
return null;
}
}
async function updateMessageStatus(id, status, errorMessage = null) {
if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
return;
}
try {
if (status === 'sent') {
await db.query(
`UPDATE message_queue SET status = $1, sent_at = CURRENT_TIMESTAMP WHERE id = $2`,
[status, id]
);
} else if (status === 'failed') {
await db.query(
`UPDATE message_queue SET status = $1, error_message = $2, attempts = attempts + 1 WHERE id = $3`,
[status, errorMessage, id]
);
} else {
await db.query(
`UPDATE message_queue SET status = $1 WHERE id = $2`,
[status, id]
);
}
} catch (error) {
console.error('Error updating message status:', error);
}
}
// Rate limiting: отслеживание отправок по чатам и токенам
const rateLimiters = new Map(); // chatId -> { count: number, resetAt: timestamp }
function checkRateLimit(chatId) {
const now = Date.now();
const chatIdStr = String(chatId);
// Проверяем лимит для приватных чатов: 1 сообщение в секунду
// Для групп: 20 сообщений в минуту
// Определяем тип чата по ID (группы имеют отрицательные ID)
const isGroup = chatIdStr.startsWith('-');
const limitWindow = isGroup ? 60000 : 1000; // 1 минута для групп, 1 секунда для приватных
const limitCount = isGroup ? 20 : 1;
if (!rateLimiters.has(chatIdStr)) {
rateLimiters.set(chatIdStr, { count: 0, resetAt: now + limitWindow });
}
const limiter = rateLimiters.get(chatIdStr);
// Сбрасываем счетчик если окно истекло
if (now >= limiter.resetAt) {
limiter.count = 0;
limiter.resetAt = now + limitWindow;
}
// Проверяем лимит
if (limiter.count >= limitCount) {
return false; // Лимит превышен
}
limiter.count++;
return true; // Можно отправить
}
// Глобальный лимит: 30 сообщений в секунду
let globalMessageCount = 0;
let globalResetAt = Date.now() + 1000;
function checkGlobalRateLimit() {
const now = Date.now();
if (now >= globalResetAt) {
globalMessageCount = 0;
globalResetAt = now + 1000;
}
if (globalMessageCount >= 30) {
return false; // Глобальный лимит превышен
}
globalMessageCount++;
return true;
}
// Worker для обработки очереди сообщений
let workerRunning = false;
let workerInterval = null;
async function processMessageQueue() {
if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
return;
}
// Проверяем глобальный лимит
if (!checkGlobalRateLimit()) {
return; // Пропускаем итерацию если глобальный лимит превышен
}
const message = await getNextMessageFromQueue();
if (!message) {
return; // Нет сообщений в очереди
}
// Проверяем лимит для конкретного чата
if (!checkRateLimit(message.chat_id)) {
// Лимит превышен, возвращаем сообщение в очередь
await updateMessageStatus(message.id, 'pending');
return;
}
try {
const result = await sendTelegramMessageDirect(
message.bot_token,
message.chat_id,
message.message_text
);
if (result.success) {
await updateMessageStatus(message.id, 'sent');
console.log(`Message ${message.id} sent successfully to chat ${message.chat_id}`);
} else {
// Проверяем, является ли ошибка 429 (Too Many Requests)
const isRateLimitError = result.error && (
(typeof result.error === 'string' && result.error.includes('429')) ||
(result.error.error_code === 429) ||
(result.error.description && result.error.description.includes('Too Many Requests'))
);
// Для ошибок rate limit увеличиваем задержку перед следующей попыткой
if (isRateLimitError) {
// Возвращаем в очередь с небольшой задержкой (через 5 секунд)
await db.query(
`UPDATE message_queue SET status = 'pending',
created_at = CURRENT_TIMESTAMP + INTERVAL '5 seconds',
error_message = $1, attempts = attempts + 1
WHERE id = $2`,
[JSON.stringify(result.error), message.id]
);
console.log(`Message ${message.id} rate limited, will retry in 5 seconds`);
} else if (message.attempts + 1 >= message.max_attempts) {
await updateMessageStatus(message.id, 'failed', JSON.stringify(result.error));
console.error(`Message ${message.id} failed after ${message.attempts + 1} attempts`);
} else {
// Возвращаем в очередь для повторной попытки
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
if (workerRunning) {
return;
}
if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
console.log('Message queue worker not started: database not available');
return;
}
workerRunning = true;
console.log('Message queue worker started');
// Обрабатываем очередь каждые 100мс (10 раз в секунду)
workerInterval = setInterval(() => {
processMessageQueue().catch(err => {
console.error('Worker error:', err);
});
}, 100);
// Очистка старых записей из очереди (старше 7 дней)
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
}, 3600000); // Каждый час
}
// AUTH ROUTES
app.post('/api/login', async (req, res) => {
const { username, password } = req.body;
// Проверка vadmin
if (username === CRED_USER && password === CRED_PASS) {
const token = Date.now().toString();
sessions.set(token, { username: CRED_USER, timestamp: Date.now() });
saveSessions();
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
// Извлекаем читаемое сообщение об ошибке из ответа Telegram API
let errorMessage = 'Неизвестная ошибка';
if (error.response?.data) {
const telegramError = error.response.data;
if (typeof telegramError === 'string') {
errorMessage = telegramError;
} else if (telegramError.description) {
errorMessage = telegramError.description;
} else if (telegramError.error_code) {
errorMessage = `Ошибка ${telegramError.error_code}: ${telegramError.description || 'Неизвестная ошибка Telegram API'}`;
} else {
errorMessage = JSON.stringify(telegramError);
}
} else if (error.message) {
errorMessage = error.message;
}
res.status(400).json({ success: false, error: errorMessage });
}
});
// RULES MANAGEMENT
app.get('/api/rules', auth, async (req, res) => {
if (process.env.DATABASE_URL) {
try {
const result = await db.query('SELECT id, data FROM rules');
let rules = result.rows.map(r => ({ ...r.data, id: r.id }));
rules = rules.map(r => {
  // Обратная совместимость: если нет authorId — автор vadmin
  if (r.authorId === undefined) r.authorId = 'vadmin';
  r.botToken = typeof r.botToken === 'string' ? r.botToken : '';
  return r;
});
res.json(rules);
} catch (err) {
console.error('DB error:', err);
res.status(500).json({ error: 'DB error' });
}
} else {
let rules = db.rules.map(r => {
  if (r.authorId === undefined) r.authorId = 'vadmin';
  return { ...r, botToken: typeof r.botToken === 'string' ? r.botToken : '' };
});
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
let rule = { ...result.rows[0].data, id: result.rows[0].id };
if (rule.authorId === undefined) rule.authorId = 'vadmin';
res.json(rule);
} else {
let rule = db.rules.find(r => r.id == ruleId);
if (!rule) {
return res.status(404).json({ error: 'Rule not found' });
}
if (rule.authorId === undefined) rule.authorId = 'vadmin';
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
// ✅ ДОБАВЛЯЕМ АВТОРА
const authorId = req.user.userId || (req.user.username === 'vadmin' ? 'vadmin' : null);
if (authorId === null) {
  return res.status(400).json({ error: 'Unable to determine rule author' });
}
const newRule = { 
  id: Date.now(), 
  ...ruleData, 
  botToken, 
  enabled: req.body.enabled !== false, 
  encoding: 'utf8',
  authorId  // ← сохраняем автора
};
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
let rule;
if (process.env.DATABASE_URL) {
const result = await db.query('SELECT data FROM rules WHERE id = $1', [ruleId]);
if (result.rows.length === 0) {
return res.status(404).json({ error: 'not found' });
}
rule = result.rows[0].data;
if (rule.authorId === undefined) rule.authorId = 'vadmin';
} else {
const idx = db.rules.findIndex(r => r.id == ruleId);
if (idx < 0) return res.status(404).json({ error: 'not found' });
rule = db.rules[idx];
if (rule.authorId === undefined) rule.authorId = 'vadmin';
}
// ✅ ПРОВЕРКА ПРАВ ДОСТУПА
if (!canModifyRule(rule, req.user)) {
  return res.status(403).json({ error: 'Only the rule author or vadmin can modify this rule' });
}
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
const updated = { ...rule, ...ruleData };
if (!updated.botToken) {
return res.status(400).json({ error: 'Bot token is required' });
}
if (process.env.DATABASE_URL) {
await db.query('UPDATE rules SET data = $1 WHERE id = $2', [updated, ruleId]);
res.json(updated);
} else {
db.rules[db.rules.findIndex(r => r.id == ruleId)] = updated;
saveRules();
res.json(updated);
}
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
if (result.rows.length === 0) {
return res.status(404).json({ error: 'Rule not found' });
}
rule = result.rows[0].data;
if (rule.authorId === undefined) rule.authorId = 'vadmin';
// ✅ ПРОВЕРКА
if (!canModifyRule(rule, req.user)) {
  return res.status(403).json({ error: 'Only the rule author or vadmin can delete this rule' });
}
const deleteResult = await db.query('DELETE FROM rules WHERE id = $1', [ruleId]);
if (deleteResult.rowCount > 0) {
res.json({ status: 'deleted' });
} else {
res.status(404).json({ error: 'Rule not found' });
}
} else {
const idx = db.rules.findIndex(r => r.id == ruleId);
if (idx < 0) return res.status(404).json({ error: 'Rule not found' });
rule = db.rules[idx];
if (rule.authorId === undefined) rule.authorId = 'vadmin';
// ✅ ПРОВЕРКА
if (!canModifyRule(rule, req.user)) {
  return res.status(403).json({ error: 'Only the rule author or vadmin can delete this rule' });
}
db.rules.splice(idx, 1);
saveRules();
res.json({ status: 'deleted' });
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
// Обратная совместимость: если правила без authorId — игнорируем, т.к. не влияет на webhook
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
messageParts.push(`📦 Данные:
\`\`\`
${truncated}
\`\`\``);
}
}
return messageParts.join('\n'); // ✅ ИСПРАВЛЕНО: теперь корректно
} catch (e) {
console.error('Format message error:', e.message);
return `❌ Ошибка форматирования сообщения: ${e.message}
📦 Данные:
${JSON.stringify(payload || fullBody).slice(0, 4000)}`;
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
// Добавляем сообщение в очередь вместо прямой отправки
const queueResult = await addMessageToQueue(token, chat, messageText, 0, null);
if (queueResult.queued) {
telegram_results.push({ chatId: chat, success: true, queued: true, queueId: queueResult.id });
} else if (queueResult.success) {
// Fallback: сообщение отправлено напрямую (если БД недоступна)
telegram_results.push({ chatId: chat, success: true, response: queueResult.response });
} else {
telegram_results.push({ chatId: chat, success: false, error: queueResult.error });
}
} catch (error) {
const errDetail = error.response?.data || error.message;
console.error('Error adding message to queue for chat', chat, errDetail);
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
// MESSAGE QUEUE STATUS
app.get('/api/message-queue/status', auth, async (req, res) => {
if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
return res.json({
available: false,
message: 'Message queue requires database'
});
}
try {
const stats = await db.query(`
SELECT
status,
COUNT(*) as count
FROM message_queue
GROUP BY status
`);
const total = await db.query(`
SELECT COUNT(*) as total FROM message_queue
`);
const pending = await db.query(`
SELECT COUNT(*) as count FROM message_queue WHERE status = 'pending'
`);
const statsObj = {};
stats.rows.forEach(row => {
statsObj[row.status] = parseInt(row.count);
});
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
// MESSAGE QUEUE HISTORY
app.get('/api/message-queue/history', auth, async (req, res) => {
if (!process.env.DATABASE_URL || !db || typeof db.query !== 'function') {
return res.json([]);
}
try {
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 50;
const offset = (page - 1) * limit;
const status = req.query.status; // Опциональный фильтр по статусу
let query = `
SELECT
id,
bot_token,
chat_id,
message_text,
priority,
status,
attempts,
max_attempts,
created_at,
sent_at,
error_message
FROM message_queue
`;
const params = [];
if (status) {
query += ` WHERE status = $1`;
params.push(status);
}
query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
params.push(limit, offset);
const result = await db.query(query, params);
// Маскируем токены для безопасности
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
// Получаем общее количество для пагинации
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