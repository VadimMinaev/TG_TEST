import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { RefreshCw, Trash2 } from 'lucide-react';

type PollRun = {
  id: number;
  poll_id: number;
  status: string;
  matched: boolean;
  sent: boolean;
  error_message?: string | null;
  response_snippet?: string | null;
  request_method?: string | null;
  request_url?: string | null;
  request_headers?: string | null;
  request_body?: string | null;
  response_status?: number | null;
  response_headers?: string | null;
  created_at: string;
};

export function PollingHistory() {
  const [runs, setRuns] = useState<PollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) || null,
    [runs, selectedRunId]
  );

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getPollHistory();
      setRuns(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Вы уверены, что хотите очистить всю историю пуллинга?')) return;
    
    try {
      await api.clearPollHistory();
      setRuns([]);
      setSelectedRunId(null);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-xl font-semibold">🧾 История пуллинга</h2>
        <div className="flex gap-2">
          <button
            onClick={loadHistory}
            className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm transition-all hover:bg-[hsl(var(--accent))]"
          >
            <RefreshCw className="h-4 w-4" />
            Обновить
          </button>
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-2 rounded bg-[hsl(var(--destructive))] px-3 py-2 text-sm text-[hsl(var(--destructive-foreground))] transition-all hover:bg-[hsl(var(--destructive)_/_0.9)]"
          >
            <Trash2 className="h-4 w-4" />
            Очистить
          </button>
        </div>
      </div>

      <div className="split-layout p-6">
        <div className="split-left">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
            </div>
          ) : runs.length === 0 ? (
            <p className="py-20 text-center text-[hsl(var(--muted-foreground))]">История пуста</p>
          ) : (
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin">
              <table className="table-basic w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-[hsl(var(--border))] text-left">
                    <th className="text-xs font-semibold">Дата/Время</th>
                    <th className="text-xs font-semibold">Статус</th>
                    <th className="text-xs font-semibold">Результат</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                        selectedRunId === run.id ? 'bg-[hsl(var(--accent))]' : ''
                      }`}
                    >
                      <td className="text-xs">{new Date(run.created_at).toLocaleString('ru-RU')}</td>
                      <td>
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            run.status === 'success'
                              ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                              : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                          }`}
                        >
                          {run.status === 'success' ? '✅ Успех' : '❌ Ошибка'}
                        </span>
                      </td>
                      <td className="text-xs">
                        {run.matched ? '📨 Отправлено' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="split-right">
          {selectedRun ? (
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Информация о запуске</h4>
                <div className="panel">
                  <div className="mb-2">
                    <strong>ID:</strong> <code>{selectedRun.id}</code>
                  </div>
                  <div className="mb-2">
                    <strong>Poll ID:</strong> <code>{selectedRun.poll_id}</code>
                  </div>
                  <div className="mb-2">
                    <strong>Дата/Время:</strong> {new Date(selectedRun.created_at).toLocaleString('ru-RU')}
                  </div>
                  <div className="mb-2">
                    <strong>Статус:</strong>{' '}
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        selectedRun.status === 'success'
                          ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                          : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                      }`}
                    >
                      {selectedRun.status}
                    </span>
                  </div>
                  <div>
                    <strong>Отправлено в Telegram:</strong> {selectedRun.sent ? '✅ Да' : '❌ Нет'}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Запрос</h4>
                <div className="panel">
                  <div className="mb-2">
                    <strong>Метод:</strong> {selectedRun.request_method || '—'}
                  </div>
                  <div className="mb-2">
                    <strong>URL:</strong> <code className="break-all">{selectedRun.request_url || '—'}</code>
                  </div>
                  {selectedRun.request_headers && (
                    <div className="mt-3">
                      <strong>Headers:</strong>
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-[hsl(var(--muted))] p-2 text-xs">
                        {selectedRun.request_headers}
                      </pre>
                    </div>
                  )}
                  {selectedRun.request_body && (
                    <div className="mt-3">
                      <strong>Body:</strong>
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-[hsl(var(--muted))] p-2 text-xs">
                        {selectedRun.request_body}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Ответ</h4>
                <div className="panel">
                  <div className="mb-2">
                    <strong>HTTP статус:</strong> {selectedRun.response_status ?? '—'}
                  </div>
                  {selectedRun.response_headers && (
                    <div className="mt-3">
                      <strong>Headers:</strong>
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-[hsl(var(--muted))] p-2 text-xs">
                        {selectedRun.response_headers}
                      </pre>
                    </div>
                  )}
                  {selectedRun.response_snippet && (
                    <div className="mt-3">
                      <strong>Body (фрагмент):</strong>
                      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-[hsl(var(--muted))] p-2 text-xs">
                        {selectedRun.response_snippet}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {selectedRun.error_message && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--destructive))]">Ошибка</h4>
                  <div className="panel border-[hsl(var(--destructive)_/_0.3)] bg-[hsl(var(--destructive)_/_0.05)]">
                    <pre className="whitespace-pre-wrap break-words text-xs text-[hsl(var(--destructive))]">
                      {selectedRun.error_message}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="py-20 text-center text-[hsl(var(--muted-foreground))]">
              Выберите запуск из списка слева для просмотра деталей
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
