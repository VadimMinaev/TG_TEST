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

  const formatJsonBlock = (value?: string) => {
    if (!value) return '';
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  };

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

  const responseIsError =
    selectedRun?.action_status != null && selectedRun.action_status >= 400;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'clip' }}>
        {/* Header */}
        <div className="card-header" style={{ padding: '12px 20px' }}>
          <h2 className="text-xl font-semibold">История интеграций</h2>
          <div className="flex items-center gap-2">
            <button onClick={loadHistory} className="icon-button" title="Обновить">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleClearHistory}
              className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/_0.1)]"
              title="Очистить"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Split layout */}
        <div className="split-layout" style={{ flex: 1, minHeight: 0, padding: '20px', gap: '20px', border: 'none', background: 'transparent', borderRadius: 0 }}>
          {/* ── LEFT: список ── */}
          <div className="split-left" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, paddingRight: 0 }}>
          <div
            className="panel"
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {/* Заголовок */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderBottom: '1px solid hsl(var(--border))',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                Список выполнений
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: 'hsl(var(--muted-foreground))',
                  background: 'hsl(var(--muted) / 0.5)',
                  borderRadius: '20px',
                  padding: '2px 8px',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                {runs.length}
              </span>
            </div>

            {/* Список */}
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : runs.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                История пуста
              </p>
            ) : (
              <div className="entity-list-scroll scrollbar-thin" style={{ flex: 1, overflowY: 'auto' }}>
                {runs.map((run) => {
                  const isSuccess = run.status === 'success';
                  const isSkipped = run.status === 'skipped';
                  const isActive = selectedRunId === run.id;
                  return (
                    <div
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 14px',
                        cursor: 'pointer',
                        borderBottom: '1px solid hsl(var(--border))',
                        background: isActive ? 'hsl(var(--accent))' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--accent) / 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                      }}
                    >
                      {/* Точка статуса */}
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: isSuccess
                            ? 'hsl(var(--success))'
                            : isSkipped
                              ? 'hsl(var(--muted-foreground))'
                              : 'hsl(var(--destructive))',
                        }}
                      />
                      {/* Мета */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '11px' }}>
                            {run.trigger_type === 'webhook' ? '📥' : run.trigger_type === 'polling' ? '🔄' : '▶️'}
                          </span>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              color: 'hsl(var(--foreground))',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={integrationNames[run.integration_id] || `#${run.integration_id}`}
                          >
                            {integrationNames[run.integration_id] || `#${run.integration_id}`}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', marginTop: '1px' }}>
                          {new Date(run.created_at).toLocaleString('ru-RU')}
                        </div>
                      </div>
                      {/* Статус */}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          flexShrink: 0,
                          color: isSuccess
                            ? 'hsl(var(--success))'
                            : isSkipped
                              ? 'hsl(var(--muted-foreground))'
                              : 'hsl(var(--destructive))',
                        }}
                      >
                        {isSuccess ? 'Успех' : isSkipped ? 'Пропущено' : 'Ошибка'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: детали ── */}
        <div className="split-right" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {selectedRun ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>

              {/* Мета-карточка */}
              <div className="panel" style={{ padding: '14px 16px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    {integrationNames[selectedRun.integration_id] || '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', marginTop: '2px' }}>
                    #{selectedRun.integration_id}
                  </div>
                </div>
                {/* Чипы */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {/* Статус */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: selectedRun.status === 'success'
                        ? 'hsl(var(--success) / 0.12)'
                        : selectedRun.status === 'skipped'
                          ? 'hsl(var(--muted) / 0.4)'
                          : 'hsl(var(--destructive) / 0.1)',
                      color: selectedRun.status === 'success'
                        ? 'hsl(var(--success))'
                        : selectedRun.status === 'skipped'
                          ? 'hsl(var(--muted-foreground))'
                          : 'hsl(var(--destructive))',
                      border: `1px solid ${selectedRun.status === 'success'
                        ? 'hsl(var(--success) / 0.3)'
                        : selectedRun.status === 'skipped'
                          ? 'hsl(var(--border))'
                          : 'hsl(var(--destructive) / 0.3)'}`,
                    }}
                  >
                    {selectedRun.status === 'success' ? '✓' : selectedRun.status === 'skipped' ? '–' : '✕'}&nbsp;
                    {selectedRun.status === 'success' ? 'Успех' : selectedRun.status === 'skipped' ? 'Пропущено' : 'Ошибка'}
                  </span>
                  {/* Триггер */}
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: 'hsl(var(--muted) / 0.4)',
                      color: 'hsl(var(--muted-foreground))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  >
                    {selectedRun.trigger_type === 'webhook' ? '📥 Webhook' : selectedRun.trigger_type === 'polling' ? '🔄 Polling' : '▶️ Ручной'}
                  </span>
                  {/* Дата */}
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: 'hsl(var(--muted) / 0.4)',
                      color: 'hsl(var(--muted-foreground))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  >
                    {new Date(selectedRun.created_at).toLocaleString('ru-RU')}
                  </span>
                  {/* Telegram */}
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: 'hsl(var(--muted) / 0.4)',
                      color: selectedRun.telegram_sent ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  >
                    {selectedRun.telegram_sent ? '✓ Telegram' : '✕ Telegram'}
                  </span>
                </div>
              </div>

              {/* Данные триггера */}
              {selectedRun.trigger_data && (
                <SectionCard title="Данные триггера" isAlert={false}>
                  <CodeSection label="" value={formatJsonBlock(selectedRun.trigger_data)} />
                </SectionCard>
              )}

              {/* Action запрос */}
              {selectedRun.action_request && (
                <SectionCard title="Action — запрос" isAlert={false}>
                  <CodeSection label="" value={formatJsonBlock(selectedRun.action_request)} />
                </SectionCard>
              )}

              {/* Action ответ */}
              {selectedRun.action_response && (
                <SectionCard
                  title={
                    selectedRun.action_status != null
                      ? `Action — ответ HTTP ${selectedRun.action_status}${responseIsError ? ' (ошибка)' : ''}`
                      : 'Action — ответ'
                  }
                  isAlert={responseIsError}
                >
                  {selectedRun.action_status != null && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
                      <span
                        style={{
                          fontSize: '22px',
                          fontWeight: 500,
                          fontFamily: 'monospace',
                          color: responseIsError ? 'hsl(var(--destructive))' : 'hsl(var(--success))',
                        }}
                      >
                        {selectedRun.action_status}
                      </span>
                      <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                        {responseIsError ? 'Запрос не прошёл' : 'OK'}
                      </span>
                    </div>
                  )}
                  <CodeSection label="" value={formatJsonBlock(selectedRun.action_response)} />
                </SectionCard>
              )}

              {/* Ошибка */}
              {selectedRun.error_message && selectedRun.status !== 'skipped' && (
                <SectionCard title="Сообщение об ошибке" isAlert>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '12px',
                      color: 'hsl(var(--destructive))',
                      margin: 0,
                    }}
                  >
                    {selectedRun.error_message}
                  </pre>
                </SectionCard>
              )}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: 'hsl(var(--muted-foreground))',
                fontSize: '14px',
              }}
            >
              Выберите выполнение из списка слева
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Вспомогательные компоненты ── */

function SectionCard({
  title,
  isAlert,
  children,
}: {
  title: string;
  isAlert: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="panel"
      style={{
        padding: 0,
        overflow: 'hidden',
        border: isAlert
          ? '1px solid hsl(var(--destructive) / 0.35)'
          : '1px solid hsl(var(--border))',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          padding: '7px 14px',
          borderBottom: isAlert
            ? '1px solid hsl(var(--destructive) / 0.25)'
            : '1px solid hsl(var(--border))',
          background: isAlert
            ? 'hsl(var(--destructive) / 0.07)'
            : 'hsl(var(--muted) / 0.3)',
          color: isAlert ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))',
        }}
      >
        {title}
      </div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  );
}

function CodeSection({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: label ? '10px' : 0 }}>
      {label && (
        <div
          style={{
            fontSize: '11px',
            color: 'hsl(var(--muted-foreground))',
            marginBottom: '4px',
            fontWeight: 500,
          }}
        >
          {label}
        </div>
      )}
      <pre
        style={{
          background: 'hsl(var(--muted) / 0.4)',
          border: '1px solid hsl(var(--border))',
          borderRadius: '6px',
          padding: '8px 10px',
          fontSize: '12px',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '240px',
          overflowY: 'auto',
          color: 'hsl(var(--foreground))',
          margin: 0,
        }}
      >
        {value}
      </pre>
    </div>
  );
}
