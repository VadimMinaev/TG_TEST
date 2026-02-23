const API_BASE = '/api';

export interface Rule {
  id: number;
  name: string;
  condition: string;
  chatId: string;
  botToken?: string;
  messageTemplate?: string;
  enabled: boolean;
  authorId?: string | number;
  updated_at?: string;
  created_at?: string;
}

export interface WebhookLog {
  id: number;
  timestamp: string;
  status: string;
  matched: number;
  total_rules: number;
  payload: any;
  telegram_results?: any[];
}

export interface Poll {
  id: number;
  name: string;
  url: string;
  method: string;
  headersJson?: string;
  bodyJson?: string;
  conditionJson?: string;
  intervalSec: number;
  timeoutSec: number;
  chatId: string;
  botToken?: string;
  sendToTelegram?: boolean;
  messageTemplate?: string;
  onlyOnChange: boolean;
  continueAfterMatch: boolean;
  enabled: boolean;
  lastCheckedAt?: string;
  lastMatch?: boolean;
  lastError?: string;
}

export interface Account {
  id: number;
  name: string;
  slug?: string;
  created_at?: string;
}

export interface AccountCloneOptions {
  sourceAccountId?: number;
  include?: {
    rules?: boolean;
    polls?: boolean;
    integrations?: boolean;
    bots?: boolean;
  };
}

export interface User {
  id: number;
  username: string;
  name?: string | null;
  created_at?: string;
  updated_at?: string;
  account_id?: number;
  role?: 'administrator' | 'auditor';
  account_name?: string;
}

export interface Integration {
  id: number;
  name: string;
  enabled: boolean;
  triggerType: 'webhook' | 'polling';
  triggerCondition?: string;
  pollingUrl?: string;
  pollingMethod?: string;
  pollingHeaders?: string;
  pollingBody?: string;
  pollingInterval?: number;
  pollingCondition?: string;
  pollingContinueAfterMatch?: boolean;
  actionUrl?: string;
  actionMethod?: string;
  actionHeaders?: string;
  actionBody?: string;
  timeoutSec?: number;
  sendToTelegram?: boolean;
  chatId?: string;
  botToken?: string;
  messageTemplate?: string;
  authorId?: string | number;
}

export interface Bot {
  id: number;
  name: string;
  enabled: boolean;
  chatId: string;
  botToken?: string;
  messageType: 'text' | 'poll';
  // For text messages
  messageText?: string;
  // For Telegram polls
  pollQuestion?: string;
  pollOptions?: string;  // JSON array string
  pollIsAnonymous?: boolean;
  pollAllowsMultipleAnswers?: boolean;
  // Schedule
  scheduleType: 'recurring' | 'once'; // recurring = по дням, once = на дату
  scheduleDays: number[];  // 0=Sun, 1=Mon, ... 6=Sat (for recurring)
  scheduleDate?: string;   // YYYY-MM-DD (for once)
  scheduleTime: string;    // HH:MM
  scheduleTimezone: string; // e.g. Europe/Moscow
  // Meta
  lastRunAt?: string;
  lastError?: string;
  authorId?: string | number;
  created_at?: string;
  updated_at?: string;
}

export interface BotRun {
  id: number;
  bot_id: number;
  status: string;
  message_type: string;
  error_message?: string;
  created_at: string;
}

export interface AiBot {
  id: number;
  name: string;
  enabled: boolean;
  provider: 'gemini' | 'groq' | 'openai';
  telegramBotToken: string;
  apiKey: string;
  model: string;
  geminiApiKey?: string;
  geminiModel?: string;
  systemPrompt?: string;
  allowVoice: boolean;
  webhookUrl?: string;
  webhookSet?: boolean;
  created_at?: string;
  updated_at?: string;
  authorId?: string | number;
}

export interface Reminder {
  id: number;
  telegram_user_id: number;
  telegram_id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  message: string;
  run_at: string;
  repeat_type: 'none' | 'interval' | 'cron';
  repeat_config?: any;
  is_active: boolean;
  next_run_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReminderLog {
  id: number;
  reminder_id: number;
  telegram_user_id: number;
  status: 'sent' | 'failed' | 'skipped' | string;
  message_text?: string;
  error_message?: string;
  sent_at?: string;
}

export interface IntegrationRun {
  id: number;
  integration_id: number;
  trigger_type: string;
  status: string;
  trigger_data?: string;
  action_request?: string;
  action_response?: string;
  action_status?: number;
  telegram_sent: boolean;
  error_message?: string;
  created_at: string;
}

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Auth
  login: async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    return res.json();
  },

  logout: async () => {
    const token = localStorage.getItem('authToken');
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  },

  me: async () => {
    const res = await fetch(`${API_BASE}/me`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  authStatus: async () => {
    const res = await fetch(`${API_BASE}/auth-status`, { headers: getHeaders() });
    return res.json();
  },

  // Rules
  getRules: async (): Promise<Rule[]> => {
    const res = await fetch(`${API_BASE}/rules`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch rules');
    return res.json();
  },

  getRule: async (id: number): Promise<Rule> => {
    const res = await fetch(`${API_BASE}/rules/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch rule');
    return res.json();
  },

  createRule: async (rule: Partial<Rule>) => {
    const res = await fetch(`${API_BASE}/rules`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(rule),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create rule');
    }
    return res.json();
  },

  updateRule: async (id: number, rule: Partial<Rule>) => {
    const res = await fetch(`${API_BASE}/rules/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(rule),
    });
    if (!res.ok) throw new Error('Failed to update rule');
    return res.json();
  },

  deleteRule: async (id: number) => {
    const res = await fetch(`${API_BASE}/rules/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete rule');
  },

  // Logs
  getWebhookLogs: async (): Promise<WebhookLog[]> => {
    const res = await fetch(`${API_BASE}/webhook-logs`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  },

  getWebhookLog: async (id: number): Promise<WebhookLog> => {
    const res = await fetch(`${API_BASE}/webhook-logs/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch log');
    return res.json();
  },

  clearWebhookLogs: async () => {
    const res = await fetch(`${API_BASE}/webhook-logs`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to clear logs');
  },

  // Queue
  getQueueHistory: async (page = 1, status?: string, limit = 50) => {
    let url = `${API_BASE}/message-queue/history?page=${page}&limit=${limit}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch queue');
    return res.json();
  },

  getQueueStatus: async () => {
    const res = await fetch(`${API_BASE}/message-queue/status`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch queue status');
    return res.json();
  },

  // Testing
  testSend: async (chatId: string, message: string, botToken?: string) => {
    const res = await fetch(`${API_BASE}/test-send`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ chatId, message, botToken }),
    });
    return res.json();
  },

  saveBotToken: async (botToken: string) => {
    const res = await fetch(`${API_BASE}/bot-token`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ botToken }),
    });
    if (!res.ok) throw new Error('Failed to save token');
    return res.json();
  },

  // Polls
  getPolls: async (): Promise<Poll[]> => {
    const res = await fetch(`${API_BASE}/polls`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch polls');
    return res.json();
  },

  createPoll: async (poll: Partial<Poll>) => {
    const res = await fetch(`${API_BASE}/polls`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(poll),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create poll');
    }
    return res.json();
  },

  updatePoll: async (id: number, poll: Partial<Poll>) => {
    const res = await fetch(`${API_BASE}/polls/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(poll),
    });
    if (!res.ok) throw new Error('Failed to update poll');
    return res.json();
  },

  deletePoll: async (id: number) => {
    const res = await fetch(`${API_BASE}/polls/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete poll');
  },

  runPoll: async (id: number) => {
    const res = await fetch(`${API_BASE}/polls/${id}/run`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to run poll');
    }
    return res.json();
  },

  getPollHistory: async (pollId?: string) => {
    let url = `${API_BASE}/polls/history?limit=100`;
    if (pollId) url += `&pollId=${pollId}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch poll history');
    return res.json();
  },

  clearPollHistory: async () => {
    const res = await fetch(`${API_BASE}/polls/history`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to clear poll history');
  },

  // Integrations
  getIntegrations: async (): Promise<Integration[]> => {
    const res = await fetch(`${API_BASE}/integrations`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch integrations');
    return res.json();
  },

  getIntegration: async (id: number): Promise<Integration> => {
    const res = await fetch(`${API_BASE}/integrations/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch integration');
    return res.json();
  },

  createIntegration: async (data: Partial<Integration>): Promise<Integration> => {
    const res = await fetch(`${API_BASE}/integrations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create integration');
    return res.json();
  },

  updateIntegration: async (id: number, data: Partial<Integration>): Promise<Integration> => {
    const res = await fetch(`${API_BASE}/integrations/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update integration');
    return res.json();
  },

  deleteIntegration: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/integrations/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete integration');
  },

  runIntegration: async (id: number, testData?: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/integrations/${id}/run`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ testData }),
    });
    if (!res.ok) throw new Error('Failed to run integration');
    return res.json();
  },

  getIntegrationHistory: async (): Promise<IntegrationRun[]> => {
    const res = await fetch(`${API_BASE}/integrations/history/all`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch integration history');
    return res.json();
  },

  clearIntegrationHistory: async (): Promise<void> => {
    const res = await fetch(`${API_BASE}/integrations/history/all`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to clear history');
  },

  // Bots
  getBots: async (): Promise<Bot[]> => {
    const res = await fetch(`${API_BASE}/bots`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch bots');
    return res.json();
  },

  getBot: async (id: number): Promise<Bot> => {
    const res = await fetch(`${API_BASE}/bots/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch bot');
    return res.json();
  },

  createBot: async (bot: Partial<Bot>): Promise<Bot> => {
    const res = await fetch(`${API_BASE}/bots`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(bot),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create bot');
    }
    return res.json();
  },

  updateBot: async (id: number, bot: Partial<Bot>): Promise<Bot> => {
    const res = await fetch(`${API_BASE}/bots/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(bot),
    });
    if (!res.ok) throw new Error('Failed to update bot');
    return res.json();
  },

  deleteBot: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/bots/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete bot');
  },

  runBot: async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE}/bots/${id}/run`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to run bot');
    }
    return res.json();
  },

  getBotHistory: async (botId?: number): Promise<BotRun[]> => {
    let url = `${API_BASE}/bots/history?limit=100`;
    if (botId) url += `&botId=${botId}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch bot history');
    return res.json();
  },

  clearBotHistory: async (): Promise<void> => {
    const res = await fetch(`${API_BASE}/bots/history`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to clear bot history');
  },

  getAccountBotToken: async (): Promise<{ botToken: string; isSet: boolean }> => {
    const res = await fetch(`${API_BASE}/account-bot-token`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load account bot token');
    return res.json();
  },

  saveAccountBotToken: async (botToken: string) => {
    const res = await fetch(`${API_BASE}/account-bot-token`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ botToken }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to save account bot token');
    }
    return res.json();
  },

  // Reminders
  getReminders: async (): Promise<Reminder[]> => {
    const res = await fetch(`${API_BASE}/reminders`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch reminders');
    return res.json();
  },

  // AI Bots
  getAiBots: async (): Promise<AiBot[]> => {
    const res = await fetch(`${API_BASE}/ai-bots`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch AI bots');
    return res.json();
  },

  getAiBot: async (id: number): Promise<AiBot> => {
    const res = await fetch(`${API_BASE}/ai-bots/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch AI bot');
    return res.json();
  },

  createAiBot: async (data: Partial<AiBot>): Promise<AiBot> => {
    const res = await fetch(`${API_BASE}/ai-bots`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create AI bot');
    }
    return res.json();
  },

  updateAiBot: async (id: number, data: Partial<AiBot>): Promise<AiBot> => {
    const res = await fetch(`${API_BASE}/ai-bots/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update AI bot');
    }
    return res.json();
  },

  deleteAiBot: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/ai-bots/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete AI bot');
    }
  },

  setAiBotWebhook: async (id: number): Promise<{ ok: boolean; webhookUrl: string }> => {
    const res = await fetch(`${API_BASE}/ai-bots/${id}/webhook`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to set AI bot webhook');
    }
    return res.json();
  },

  deleteAiBotWebhook: async (id: number): Promise<{ ok: boolean }> => {
    const res = await fetch(`${API_BASE}/ai-bots/${id}/webhook`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete AI bot webhook');
    }
    return res.json();
  },

  updateReminder: async (id: number, data: Partial<Reminder> & { runAt?: string; repeatType?: 'none' | 'interval' | 'cron'; repeatConfig?: any; isActive?: boolean; nextRunAt?: string | null }): Promise<Reminder> => {
    const res = await fetch(`${API_BASE}/reminders/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update reminder');
    }
    return res.json();
  },

  deleteReminder: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/reminders/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete reminder');
    }
  },

  getReminderHistory: async (id: number): Promise<ReminderLog[]> => {
    const res = await fetch(`${API_BASE}/reminders/${id}/history`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch reminder history');
    return res.json();
  },

  // Accounts (vadmin only)
  getAccounts: async (): Promise<Account[]> => {
    const res = await fetch(`${API_BASE}/accounts`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
  },

  createAccount: async (name: string, cloneOptions?: AccountCloneOptions) => {
    const res = await fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, cloneOptions }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create account');
    }
    return res.json();
  },

  deleteAccount: async (id: number) => {
    const res = await fetch(`${API_BASE}/accounts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete account');
    }
    return res.json();
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_BASE}/users`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  createUser: async (
    username: string,
    password: string,
    accountId: number,
    role: 'administrator' | 'auditor',
    name?: string
  ) => {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, password, account_id: accountId, role, name }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create user');
    }
    return res.json();
  },

  updateMe: async (data: { username?: string; password?: string; oldPassword?: string; name?: string }) => {
    const res = await fetch(`${API_BASE}/users/me`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to update profile');
    }
    return res.json();
  },

  updateUser: async (
    id: number,
    data: {
      username?: string;
      password?: string;
      role?: 'administrator' | 'auditor';
      account_id?: number;
      name?: string;
    }
  ) => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update user');
    }
    return res.json();
  },

  deleteUser: async (id: number) => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete user');
  },

  changePassword: async (userId: number, oldPassword: string, newPassword: string) => {
    const res = await fetch(`${API_BASE}/users/${userId}/password`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ oldPassword, password: newPassword }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to change password');
    }
    return res.json();
  },
};
