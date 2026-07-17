import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { CheckCircle2, CircleAlert, Clock3, Inbox, RefreshCw } from 'lucide-react';

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
    return <span className={`queue-status-badge ${badge.bg} ${badge.text}`}>{badge.label}</span>;
  };

  return (
    <div className="card queue-card">
      <div className="card-header queue-header">
        <div className="queue-title">
          <span className="queue-title-icon" aria-hidden="true">
            <Inbox size={18} />
          </span>
          <div>
            <h2>Очередь Telegram</h2>
            <p>Исходящие сообщения и состояние доставки</p>
          </div>
        </div>
        <div className="queue-toolbar">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            className="input-field queue-filter"
            aria-label="Фильтр по статусу"
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
            aria-label="Обновить очередь"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {stats && (
        <div className="queue-kpi-grid" aria-label="Статистика очереди">
          <div className="queue-kpi queue-kpi-total">
            <span className="queue-kpi-icon" aria-hidden="true"><Inbox size={17} /></span>
            <div className="queue-kpi-copy">
              <span>Всего</span>
              <strong>{stats.total || 0}</strong>
            </div>
          </div>
          <div className="queue-kpi queue-kpi-pending">
            <span className="queue-kpi-icon" aria-hidden="true"><Clock3 size={17} /></span>
            <div className="queue-kpi-copy">
              <span>Ожидает</span>
              <strong>{stats.stats?.pending || 0}</strong>
            </div>
          </div>
          <div className="queue-kpi queue-kpi-sent">
            <span className="queue-kpi-icon" aria-hidden="true"><CheckCircle2 size={17} /></span>
            <div className="queue-kpi-copy">
              <span>Отправлено</span>
              <strong>{stats.stats?.sent || 0}</strong>
            </div>
          </div>
          <div className="queue-kpi queue-kpi-failed">
            <span className="queue-kpi-icon" aria-hidden="true"><CircleAlert size={17} /></span>
            <div className="queue-kpi-copy">
              <span>Ошибка</span>
              <strong>{stats.stats?.failed || 0}</strong>
            </div>
          </div>
        </div>
      )}

      <div className="queue-content">
        {loading ? (
          <div className="queue-state">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="queue-state queue-empty-state">
            <Inbox size={24} />
            <p>История очереди пуста</p>
          </div>
        ) : (
          <div className="queue-table-wrap">
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
              <div className="queue-pagination">
                <div className="queue-pagination-meta">
                  Страница {pagination.page} из {pagination.totalPages} · всего {pagination.total}
                </div>
                <div className="queue-pagination-actions">
                  <button
                    type="button"
                    className="queue-page-button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={pagination.page <= 1}
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    className="queue-page-button"
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
