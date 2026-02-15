import { useEffect, useMemo, useState } from 'react';
import { api, Poll } from '../lib/api';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Breadcrumb } from '../components/Breadcrumb';

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
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) || null,
    [runs, selectedRunId]
  );

  const formatJsonBlock = (value?: string | null) => {
    if (!value) return '';
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  };

  // Маппинг ID пуллинга -> название
  const pollNames = useMemo(() => {
    const map: Record<number, string> = {};
    polls.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [polls]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const [historyData, pollsData] = await Promise.all([
        api.getPollHistory(),
        api.getPolls(),
      ]);
      setRuns(historyData);
      setPolls(pollsData);
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
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold">🧾 История пуллинга</h2>
            <div className="mt-1">
              <Breadcrumb 
                items={[
                  { label: 'Главная', path: '/' },
                  { label: 'Ист. пуллинга', active: true }
                ]} 
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadHistory}
            className="icon-button"
            title="Обновить"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleClearHistory}
            className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
            title="Очистить"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="split-layout p-6">
        <div className="split-left">
          <div className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">📋 Список запусков</h3>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{runs.length} записей</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : runs.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">История пуста</p>
            ) : (
              <div className="entity-list-scroll scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">Пуллинг</th>
                      <th className="px-2 py-2">Дата/Время</th>
                      <th className="px-2 py-2">Статус</th>
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
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{run.matched ? '📨' : '🔄'}</span>
                            <span className="font-medium text-xs truncate max-w-[150px]" title={pollNames[run.poll_id] || `#${run.poll_id}`}>
                              {pollNames[run.poll_id] || `#${run.poll_id}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs">{new Date(run.created_at).toLocaleString('ru-RU')}</td>
                        <td className="px-2 py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              run.status === 'success'
                                ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                                : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                            }`}
                          >
                            {run.status === 'success' ? 'Успех' : 'Ошибка'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          {selectedRun ? (
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Информация о запуске</h4>
                <div className="panel">
                  <div className="mb-2">
                    <strong>Пуллинг:</strong>{' '}
                    <span className="font-medium">{pollNames[selectedRun.poll_id] || '—'}</span>
                    <code className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">#{selectedRun.poll_id}</code>
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
                      {selectedRun.status === 'success' ? 'Успех' : 'Ошибка'}
                    </span>
                  </div>
                  <div className="mb-2">
                    <strong>Совпадение:</strong> {selectedRun.matched ? '✅ Да' : '❌ Нет'}
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
                      <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">
                        {formatJsonBlock(selectedRun.request_headers)}
                      </pre>
                    </div>
                  )}
                  {selectedRun.request_body && (
                    <div className="mt-3">
                      <strong>Body:</strong>
                      <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">
                        {formatJsonBlock(selectedRun.request_body)}
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
                      <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">
                        {formatJsonBlock(selectedRun.response_headers)}
                      </pre>
                    </div>
                  )}
                  {selectedRun.response_snippet && (
                    <div className="mt-3">
                      <strong>Body (фрагмент):</strong>
                      <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">
                        {formatJsonBlock(selectedRun.response_snippet)}
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
