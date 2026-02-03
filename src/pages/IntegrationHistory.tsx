import { useEffect, useMemo, useState } from 'react';
import { api, Integration, IntegrationRun } from '../lib/api';
import { RefreshCw, Trash2 } from 'lucide-react';

export function IntegrationHistory() {
  const [runs, setRuns] = useState<IntegrationRun[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) || null,
    [runs, selectedRunId]
  );

  // Маппинг ID интеграции -> название
  const integrationNames = useMemo(() => {
    const map: Record<number, string> = {};
    integrations.forEach((i) => {
      map[i.id] = i.name;
    });
    return map;
  }, [integrations]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const [historyData, integrationsData] = await Promise.all([
        api.getIntegrationHistory(),
        api.getIntegrations(),
      ]);
      setRuns(historyData);
      setIntegrations(integrationsData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Очистить историю интеграций?')) return;
    try {
      await api.clearIntegrationHistory();
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
        <h2 className="text-xl font-semibold">📜 История интеграций</h2>
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
          <div className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">📋 Список выполнений</h3>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{runs.length} записей</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : runs.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">История пуста</p>
            ) : (
              <div className="max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">Интеграция</th>
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
                            <span className="text-xs">
                              {run.trigger_type === 'webhook' ? '📥' : run.trigger_type === 'polling' ? '🔄' : '▶️'}
                            </span>
                            <span className="font-medium text-xs truncate max-w-[150px]" title={integrationNames[run.integration_id] || `#${run.integration_id}`}>
                              {integrationNames[run.integration_id] || `#${run.integration_id}`}
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
                <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Информация</h4>
                <div className="panel">
                  <div className="mb-2">
                    <strong>Интеграция:</strong>{' '}
                    <span className="font-medium">{integrationNames[selectedRun.integration_id] || '—'}</span>
                    <code className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">#{selectedRun.integration_id}</code>
                  </div>
                  <div className="mb-2">
                    <strong>Дата:</strong> {new Date(selectedRun.created_at).toLocaleString('ru-RU')}
                  </div>
                  <div className="mb-2">
                    <strong>Триггер:</strong>{' '}
                    {selectedRun.trigger_type === 'webhook' ? '📥 Webhook' : selectedRun.trigger_type === 'polling' ? '🔄 Polling' : '▶️ Ручной'}
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
                  <div>
                    <strong>Telegram:</strong> {selectedRun.telegram_sent ? '✅ Отправлено' : '❌ Нет'}
                  </div>
                </div>
              </div>

              {selectedRun.trigger_data && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Данные триггера</h4>
                  <div className="panel">
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs">
                      {selectedRun.trigger_data}
                    </pre>
                  </div>
                </div>
              )}

              {selectedRun.action_request && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Action запрос</h4>
                  <div className="panel">
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs">
                      {selectedRun.action_request}
                    </pre>
                  </div>
                </div>
              )}

              {selectedRun.action_response && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">
                    Action ответ (HTTP {selectedRun.action_status})
                  </h4>
                  <div className="panel">
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs">
                      {selectedRun.action_response}
                    </pre>
                  </div>
                </div>
              )}

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
              Выберите выполнение из списка
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
