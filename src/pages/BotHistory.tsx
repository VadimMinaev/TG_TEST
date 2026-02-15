import { useEffect, useMemo, useState } from 'react';
import { api, Bot, BotRun } from '../lib/api';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Breadcrumb } from '../components/Breadcrumb';

export function BotHistory() {
  const [runs, setRuns] = useState<BotRun[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) || null,
    [runs, selectedRunId]
  );

  const botNames = useMemo(() => {
    const map: Record<number, string> = {};
    bots.forEach((b) => {
      map[b.id] = b.name;
    });
    return map;
  }, [bots]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const [historyData, botsData] = await Promise.all([
        api.getBotHistory(),
        api.getBots(),
      ]);
      setRuns(historyData);
      setBots(botsData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Вы уверены, что хотите очистить всю историю ботов?')) return;

    try {
      await api.clearBotHistory();
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
            <h2 className="text-xl font-semibold">🤖 История ботов</h2>
            <div className="mt-1">
              <Breadcrumb 
                items={[
                  { label: 'Главная', path: '/' },
                  { label: 'Ист. ботов', active: true }
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
                      <th className="px-2 py-2">Бот</th>
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
                            <span className="text-xs">{run.message_type === 'poll' ? '📊' : '💬'}</span>
                            <span
                              className="font-medium text-xs truncate max-w-[150px]"
                              title={botNames[run.bot_id] || `#${run.bot_id}`}
                            >
                              {botNames[run.bot_id] || `#${run.bot_id}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs">
                          {new Date(run.created_at).toLocaleString('ru-RU')}
                        </td>
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
                <div style={{ padding: '16px' }} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                  <div style={{ marginBottom: '12px' }}>
                    <strong>Бот:</strong>{' '}
                    <span className="font-medium">{botNames[selectedRun.bot_id] || '—'}</span>
                    <code
                      style={{ padding: '4px 8px', marginLeft: '8px' }}
                      className="rounded bg-[hsl(var(--muted)_/_0.5)] text-xs"
                    >
                      #{selectedRun.bot_id}
                    </code>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong>Дата/Время:</strong>{' '}
                    {new Date(selectedRun.created_at).toLocaleString('ru-RU')}
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong>Статус:</strong>{' '}
                    <span
                      style={{ padding: '4px 8px' }}
                      className={`rounded text-xs ${
                        selectedRun.status === 'success'
                          ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                          : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                      }`}
                    >
                      {selectedRun.status === 'success' ? '✅ Успех' : '❌ Ошибка'}
                    </span>
                  </div>
                  <div>
                    <strong>Тип сообщения:</strong>{' '}
                    <span
                      style={{ padding: '4px 8px' }}
                      className="rounded bg-[hsl(var(--muted)_/_0.3)] text-xs"
                    >
                      {selectedRun.message_type === 'poll' ? '📊 Голосование' : '💬 Текст'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedRun.error_message && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--destructive))]">Ошибка</h4>
                  <div
                    style={{ padding: '16px' }}
                    className="rounded-lg border border-[hsl(var(--destructive)_/_0.3)] bg-[hsl(var(--destructive)_/_0.05)]"
                  >
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
