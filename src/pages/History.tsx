import { useEffect, useState } from 'react';
import { api, WebhookLog } from '../lib/api';
import { RefreshCw, Trash2 } from 'lucide-react';

export function History() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getWebhookLogs();
      setLogs(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Вы уверены, что хотите очистить всю историю?')) return;
    
    try {
      await api.clearWebhookLogs();
      setLogs([]);
      setSelectedLog(null);
    } catch (error) {
      console.error(error);
    }
  };

  const loadLogDetails = async (id: number) => {
    try {
      const log = await api.getWebhookLog(id);
      setSelectedLog(log);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-xl font-semibold">📊 История вебхуков</h2>
        <div className="flex gap-2">
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm transition-all hover:bg-[hsl(var(--accent))]"
          >
            <RefreshCw className="h-4 w-4" />
            Обновить
          </button>
          <button
            onClick={handleClearLogs}
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
              <h3 className="text-sm font-semibold">📋 Список вебхуков</h3>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{logs.length} записей</span>
            </div>
          {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">История пуста</p>
          ) : (
              <div className="max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">Webhook</th>
                      <th className="px-2 py-2">Дата/Время</th>
                      <th className="px-2 py-2">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const matchedRules = log.telegram_results?.filter(r => r.success).map(r => r.ruleName).filter((v, i, a) => v && a.indexOf(v) === i) || [];
                    const displayText = matchedRules.length > 0 
                      ? matchedRules[0] 
                      : log.matched > 0 
                        ? `${log.matched} Webhook` 
                        : 'Нет совпадений';
                    return (
                    <tr
                      key={log.id}
                      onClick={() => loadLogDetails(log.id)}
                      className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                        selectedLog?.id === log.id ? 'bg-[hsl(var(--accent))]' : ''
                      }`}
                    >
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{log.matched > 0 ? '📨' : '📭'}</span>
                            <span className="font-medium text-xs truncate max-w-[150px]" title={matchedRules.join(', ') || displayText}>
                              {displayText}
                              {matchedRules.length > 1 && <span className="text-[hsl(var(--muted-foreground))]"> +{matchedRules.length - 1}</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs">{new Date(log.timestamp).toLocaleString('ru-RU')}</td>
                        <td className="px-2 py-2">
                        <span
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                            log.status === 'matched'
                              ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                              : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                          }`}
                        >
                            {log.matched}/{log.total_rules}
                        </span>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>

        <div className="split-right">
          {selectedLog ? (
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Информация о выполнении</h4>
                <div className="panel">
                  <div className="mb-2">
                    <strong>ID:</strong> <code>{selectedLog.id}</code>
                  </div>
                  <div className="mb-2">
                    <strong>Дата/Время:</strong> {new Date(selectedLog.timestamp).toLocaleString('ru-RU')}
                  </div>
                  <div className="mb-2">
                    <strong>Совпавшие Webhook:</strong> {selectedLog.matched} из {selectedLog.total_rules}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Payload</h4>
                <div className="panel max-h-96 overflow-auto">
                  <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                </div>
              </div>

              {selectedLog.telegram_results && selectedLog.telegram_results.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">
                    Результаты отправки в Telegram
                  </h4>
                  <div className="panel space-y-2">
                    {selectedLog.telegram_results.map((result, idx) => (
                      <div key={idx} className="border-b border-[hsl(var(--border))] pb-2 last:border-0">
                        {result.ruleName && (
                          <div className="mb-1">
                            <strong>Webhook:</strong>{' '}
                            <span className="font-medium">{result.ruleName}</span>
                            {result.ruleId && <code className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">#{result.ruleId}</code>}
                          </div>
                        )}
                        <div>
                          <strong>Chat ID:</strong> <code>{result.chatId}</code>
                        </div>
                        <div>
                          <strong>Статус:</strong>{' '}
                          <span
                            className={`rounded px-2 py-1 text-xs ${
                              result.success
                                ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                                : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                            }`}
                          >
                            {result.success ? '✅ Отправлено' : '❌ Ошибка'}
                          </span>
                        </div>
                        {result.error && (
                          <div className="mt-1">
                            <strong>Ошибка:</strong>
                            <pre className="mt-1 whitespace-pre-wrap rounded bg-[hsl(var(--destructive)_/_0.1)] p-2 text-xs">
                              {JSON.stringify(result.error, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="py-20 text-center text-[hsl(var(--muted-foreground))]">
              Выберите выполнение из списка слева для просмотра деталей
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
