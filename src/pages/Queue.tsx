import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { RefreshCw } from 'lucide-react';

export function Queue() {
  const [messages, setMessages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState<{ page: number; totalPages: number; total: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadQueue();
    loadStats();
  }, [filter, page]);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const data = await api.getQueueHistory(page, filter);
      setMessages(data.messages || []);
      setPagination(data.pagination || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.getQueueStatus();
      setStats(data);
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-orange-500', text: 'text-white', label: '⏳ Ожидает' },
      processing: { bg: 'bg-blue-500', text: 'text-white', label: '🔄 Обрабатывается' },
      sent: { bg: 'bg-green-500', text: 'text-white', label: '✅ Отправлено' },
      failed: { bg: 'bg-red-500', text: 'text-white', label: '❌ Ошибка' },
    };
    const badge = badges[status] || { bg: 'bg-gray-500', text: 'text-white', label: status };
    return (
      <span className={`rounded px-2 py-1 text-xs ${badge.bg} ${badge.text}`}>{badge.label}</span>
    );
  };

  return (
    <div className="card" style={{ overflow: 'clip' }}>
      <div className="card-header">
        <h2 className="text-xl font-semibold">📬 Очередь сообщений в Telegram</h2>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            className="input-field"
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option value="">Все статусы</option>
            <option value="pending">Ожидает</option>
            <option value="processing">Обрабатывается</option>
            <option value="sent">Отправлено</option>
            <option value="failed">Ошибка</option>
          </select>
          <button
            onClick={loadQueue}
            className="icon-button"
            title="Обновить"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 queue-stats-sticky">
          <div className="panel">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Всего</div>
            <div className="text-2xl font-semibold">{stats.total || 0}</div>
          </div>
          <div className="panel">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Ожидает</div>
            <div className="text-2xl font-semibold text-orange-500">{stats.stats?.pending || 0}</div>
          </div>
          <div className="panel">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Отправлено</div>
            <div className="text-2xl font-semibold text-green-500">{stats.stats?.sent || 0}</div>
          </div>
          <div className="panel">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Ошибка</div>
            <div className="text-2xl font-semibold text-red-500">{stats.stats?.failed || 0}</div>
          </div>
        </div>
      )}

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-20 text-center text-[hsl(var(--muted-foreground))]">История очереди пуста</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-basic w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-[hsl(var(--border))] text-left">
                  <th className="text-sm font-semibold">ID</th>
                  <th className="text-sm font-semibold">Статус</th>
                  <th className="text-sm font-semibold">Chat ID</th>
                  <th className="text-sm font-semibold">Сообщение</th>
                  <th className="text-sm font-semibold">Попытки</th>
                  <th className="text-sm font-semibold">Создано</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg.id} className="border-b border-[hsl(var(--border))]">
                    <td>
                      <code className="text-xs">{msg.id}</code>
                    </td>
                    <td>{getStatusBadge(msg.status)}</td>
                    <td>
                      <code className="text-xs">{msg.chatId}</code>
                    </td>
                    <td className="max-w-xs">
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm" title={msg.messageTextFull}>
                        {msg.messageText}
                      </div>
                    </td>
                    <td className="text-sm">
                      <span className={msg.attempts >= msg.maxAttempts ? 'text-red-500' : ''}>
                        {msg.attempts}/{msg.maxAttempts}
                      </span>
                    </td>
                    <td className="text-xs">{new Date(msg.createdAt).toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  Страница {pagination.page} из {pagination.totalPages} · всего {pagination.total}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-[hsl(var(--border))] px-3 py-1.5 text-xs disabled:opacity-50"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={pagination.page <= 1}
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[hsl(var(--border))] px-3 py-1.5 text-xs disabled:opacity-50"
                    onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Вперед
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
