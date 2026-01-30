import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { RefreshCw } from 'lucide-react';

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
  const [message, setMessage] = useState<string | null>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) || null,
    [runs, selectedRunId]
  );

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getPollHistory();
      setRuns(data);
    } catch (error: any) {
      setMessage(error.message || 'Не удалось загрузить историю пуллинга');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-xl font-semibold">🧾 История пуллинга</h2>
        <button
          onClick={loadHistory}
          className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm transition-all hover:bg-[hsl(var(--accent))]"
        >
          <RefreshCw className="h-4 w-4" />
          Обновить
        </button>
      </div>

      {message && (
        <div className="mx-6 mt-4 rounded border border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] p-3 text-sm text-[hsl(var(--destructive))]">
          {message}
        </div>
      )}

      <div className="flex gap-8 p-6">
        <div className="w-[420px] border-r border-[hsl(var(--border))] pr-6">
          <div className="panel">
            <div className="mb-3 text-sm font-semibold">Список запусков</div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : runs.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">История пуста</p>
            ) : (
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="font-semibold">Дата</th>
                      <th className="font-semibold">Статус</th>
                      <th className="font-semibold">poll_id</th>
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
                        <td>{new Date(run.created_at).toLocaleString('ru-RU')}</td>
                        <td>{run.status}</td>
                        <td>{run.poll_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1">
          {selectedRun ? (
            <div className="panel space-y-4 text-sm">
              <div>
                <div className="mb-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">Запуск</div>
                <div>ID: <code>{selectedRun.id}</code></div>
                <div>poll_id: <code>{selectedRun.poll_id}</code></div>
                <div>Дата: {new Date(selectedRun.created_at).toLocaleString('ru-RU')}</div>
                <div>Статус: {selectedRun.status}</div>
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">Запрос</div>
                <div>Метод: {selectedRun.request_method || '-'}</div>
                <div>URL: <code>{selectedRun.request_url || '-'}</code></div>
                {selectedRun.request_headers && (
                  <pre className="mt-2 whitespace-pre-wrap rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-xs">
                    {selectedRun.request_headers}
                  </pre>
                )}
                {selectedRun.request_body && (
                  <pre className="mt-2 whitespace-pre-wrap rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-xs">
                    {selectedRun.request_body}
                  </pre>
                )}
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">Ответ</div>
                <div>HTTP: {selectedRun.response_status ?? '-'}</div>
                {selectedRun.response_headers && (
                  <pre className="mt-2 whitespace-pre-wrap rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-xs">
                    {selectedRun.response_headers}
                  </pre>
                )}
                {selectedRun.response_snippet && (
                  <pre className="mt-2 whitespace-pre-wrap rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-xs">
                    {selectedRun.response_snippet}
                  </pre>
                )}
              </div>

              {selectedRun.error_message && (
                <div className="rounded border border-[hsl(var(--destructive)_/_0.3)] bg-[hsl(var(--destructive)_/_0.08)] p-3 text-xs text-[hsl(var(--destructive))]">
                  Ошибка: {selectedRun.error_message}
                </div>
              )}
            </div>
          ) : (
            <div className="panel text-center text-[hsl(var(--muted-foreground))]">
              Выберите запуск слева для просмотра деталей.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
