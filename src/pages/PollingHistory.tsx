import { useEffect, useMemo, useState } from 'react';
import { api, Poll } from '../lib/api';
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

  const responseIsError =
    selectedRun?.response_status != null &&
    selectedRun.response_status >= 400;

  return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'clip' }}>
        {/* Header */}
        <div className="card-header" style={{ padding: '12px 20px' }}>
          <h2 className="text-xl font-semibold">История пуллинга</h2>
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
          {/* ── LEFT: список запусков ── */}
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
            {/* Заголовок списка */}
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
                Список запусков
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
                            : 'hsl(var(--destructive))',
                        }}
                      />
                      {/* Мета */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'hsl(var(--foreground))',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={pollNames[run.poll_id] || `#${run.poll_id}`}
                        >
                          {pollNames[run.poll_id] || `#${run.poll_id}`}
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
                          color: isSuccess ? 'hsl(var(--success))' : 'hsl(var(--destructive))',
                        }}
                      >
                        {isSuccess ? 'Успех' : 'Ошибка'}
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
              <div
                className="panel"
                style={{ padding: '14px 16px' }}
              >
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    {pollNames[selectedRun.poll_id] || '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', marginTop: '2px' }}>
                    #{selectedRun.poll_id}
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
                        : 'hsl(var(--destructive) / 0.1)',
                      color: selectedRun.status === 'success'
                        ? 'hsl(var(--success))'
                        : 'hsl(var(--destructive))',
                      border: `1px solid ${selectedRun.status === 'success'
                        ? 'hsl(var(--success) / 0.3)'
                        : 'hsl(var(--destructive) / 0.3)'}`,
                    }}
                  >
                    {selectedRun.status === 'success' ? '✓' : '✕'}&nbsp;
                    {selectedRun.status === 'success' ? 'Успех' : 'Ошибка'}
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
                  {/* Совпадение */}
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: 'hsl(var(--muted) / 0.4)',
                      color: selectedRun.matched ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  >
                    {selectedRun.matched ? '✓ Совпадение' : '✕ Нет совпадения'}
                  </span>
                  {/* Telegram */}
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: 'hsl(var(--muted) / 0.4)',
                      color: selectedRun.sent ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  >
                    {selectedRun.sent ? '✓ Telegram' : '✕ Telegram'}
                  </span>
                </div>
              </div>

              {/* Данные триггера */}
              {selectedRun.request_method || selectedRun.request_url || selectedRun.request_headers || selectedRun.request_body ? (
                <SectionCard title="Запрос" isAlert={false}>
                  {(selectedRun.request_method || selectedRun.request_url) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      {selectedRun.request_method && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'hsl(var(--info) / 0.12)',
                            color: 'hsl(var(--info))',
                            border: '1px solid hsl(var(--info) / 0.3)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {selectedRun.request_method}
                        </span>
                      )}
                      {selectedRun.request_url && (
                        <code
                          style={{
                            fontSize: '12px',
                            color: 'hsl(var(--muted-foreground))',
                            wordBreak: 'break-all',
                          }}
                        >
                          {selectedRun.request_url}
                        </code>
                      )}
                    </div>
                  )}
                  {selectedRun.request_headers && (
                    <CodeSection label="Headers" value={formatJsonBlock(selectedRun.request_headers)} />
                  )}
                  {selectedRun.request_body && (
                    <CodeSection label="Body" value={formatJsonBlock(selectedRun.request_body)} />
                  )}
                </SectionCard>
              ) : null}

              {/* Ответ */}
              {(selectedRun.response_status != null || selectedRun.response_headers || selectedRun.response_snippet) && (
                <SectionCard
                  title={
                    selectedRun.response_status != null
                      ? `Ответ — HTTP ${selectedRun.response_status}${responseIsError ? ' (ошибка)' : ''}`
                      : 'Ответ'
                  }
                  isAlert={responseIsError}
                >
                  {selectedRun.response_status != null && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
                      <span
                        style={{
                          fontSize: '22px',
                          fontWeight: 500,
                          fontFamily: 'monospace',
                          color: responseIsError ? 'hsl(var(--destructive))' : 'hsl(var(--success))',
                        }}
                      >
                        {selectedRun.response_status}
                      </span>
                      <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                        {responseIsError ? 'Запрос не прошёл' : 'OK'}
                      </span>
                    </div>
                  )}
                  {selectedRun.response_headers && (
                    <CodeSection label="Headers" value={formatJsonBlock(selectedRun.response_headers)} />
                  )}
                  {selectedRun.response_snippet && (
                    <CodeSection label="Body (фрагмент)" value={formatJsonBlock(selectedRun.response_snippet)} />
                  )}
                </SectionCard>
              )}

              {/* Сообщение об ошибке */}
              {selectedRun.error_message && (
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
              Выберите запуск из списка слева
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
  return (
    <div style={{ marginBottom: '10px' }}>
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
