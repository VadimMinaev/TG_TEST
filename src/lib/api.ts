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
  messageTemplate?: string;
  onlyOnChange: boolean;
  continueAfterMatch: boolean;
  enabled: boolean;
  lastCheckedAt?: string;
  lastMatch?: boolean;
  lastError?: string;
}

export interface User {
  id: number;
  username: string;
  created_at?: string;
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
  actionUrl?: string;
  actionMethod?: string;
  actionHeaders?: string;
  actionBody?: string;
  timeoutSec?: number;
  chatId?: string;
  botToken?: string;
  messageTemplate?: string;
  authorId?: string | number;
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
  getQueueHistory: async (page = 1, status?: string) => {
    let url = `${API_BASE}/message-queue/history?page=${page}&limit=50`;
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

  // Users
  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_BASE}/users`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  createUser: async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create user');
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
