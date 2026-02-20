import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Activity, AlertTriangle, CheckCircle2, Clock, Mail, RefreshCw, ScrollText } from 'lucide-react';
import { api } from '../lib/api';
import { History } from './History';
import { Queue } from './Queue';
import { PollingHistory } from './PollingHistory';
import { IntegrationHistory } from './IntegrationHistory';
import { BotHistory } from './BotHistory';

type OperationsTab =
  | 'overview'
  | 'history'
  | 'queue'
  | 'polling-history'
  | 'integration-history'
  | 'bot-history';

type OperationsEvent = {
  id: string;
  source: string;
  title: string;
  details: string;
  timestamp: string;
  status: 'ok' | 'error' | 'info';
};

type OperationsMetrics = {
  webhookLogs: number;
  queueTotal: number;
  queuePending: number;
  pollRuns: number;
  integrationRuns: number;
  botRuns: number;
};

const TAB_ITEMS: Array<{ key: OperationsTab; label: string }> = [
  { key: 'overview', label: 'Обзор' },
  { key: 'history', label: 'Webhook история' },
  { key: 'queue', label: 'Очередь Telegram' },
  { key: 'polling-history', label: 'История пуллинга' },
  { key: 'integration-history', label: 'История интеграций' },
  { key: 'bot-history', label: 'История ботов' },
];

const INITIAL_METRICS: OperationsMetrics = {
  webhookLogs: 0,
  queueTotal: 0,
  queuePending: 0,
  pollRuns: 0,
  integrationRuns: 0,
  botRuns: 0,
};

function getTabFromSearch(rawTab: string | null): OperationsTab {
  const fallback: OperationsTab = 'overview';
  if (!rawTab) return fallback;
  const normalized = rawTab as OperationsTab;
  return TAB_ITEMS.some((item) => item.key === normalized) ? normalized : fallback;
}

export function Operations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<OperationsMetrics>(INITIAL_METRICS);
  const [events, setEvents] = useState<OperationsEvent[]>([]);

  const activeTab = useMemo(() => getTabFromSearch(searchParams.get('tab')), [searchParams]);

  useEffect(() => {
    if (!searchParams.get('tab')) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'overview');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [webhookLogs, queueStatus, pollHistory, integrationHistory, botHistory] = await Promise.all([
        api.getWebhookLogs().catch(() => []),
        api.getQueueStatus().catch(() => ({ total: 0, pending: 0 })),
        api.getPollHistory().catch(() => []),
        api.getIntegrationHistory().catch(() => []),
        api.getBotHistory().catch(() => []),
      ]);

      const webhookLogsList = Array.isArray(webhookLogs) ? webhookLogs : [];
      const pollRuns = Array.isArray(pollHistory) ? pollHistory : [];
      const integrationRuns = Array.isArray(integrationHistory) ? integrationHistory : [];
      const botRuns = Array.isArray(botHistory) ? botHistory : [];

      setMetrics({
        webhookLogs: webhookLogsList.length,
        queueTotal: Number(queueStatus?.total ?? 0),
        queuePending: Number(queueStatus?.pending ?? 0),
        pollRuns: pollRuns.length,
        integrationRuns: integrationRuns.length,
        botRuns: botRuns.length,
      });

      const recentEvents: OperationsEvent[] = [
        ...webhookLogsList.slice(0, 5).map((entry: any) => ({
          id: `webhook-${entry.id}`,
          source: 'Webhook',
          title: entry.status === 'ok' ? 'Webhook обработан' : 'Webhook с ошибкой',
          details: `Совпадений: ${entry.matched ?? 0}/${entry.total_rules ?? 0}`,
          timestamp: entry.timestamp,
          status: entry.status === 'ok' ? 'ok' : 'error',
        })),
        ...pollRuns.slice(0, 5).map((entry: any) => ({
          id: `poll-${entry.id}`,
          source: 'Пуллинг',
          title: `Статус: ${entry.status ?? 'unknown'}`,
          details: entry.request_url || entry.response_snippet || 'Запуск задачи',
          timestamp: entry.created_at,
          status: entry.status === 'success' ? 'ok' : entry.status === 'error' ? 'error' : 'info',
        })),
        ...integrationRuns.slice(0, 5).map((entry: any) => ({
          id: `integration-${entry.id}`,
          source: 'Интеграция',
          title: `Статус: ${entry.status ?? 'unknown'}`,
          details: entry.error_message || `Триггер: ${entry.trigger_type ?? 'n/a'}`,
          timestamp: entry.created_at,
          status: entry.status === 'success' ? 'ok' : entry.status === 'error' ? 'error' : 'info',
        })),
        ...botRuns.slice(0, 5).map((entry: any) => ({
          id: `bot-${entry.id}`,
          source: 'Бот',
          title: `Статус: ${entry.status ?? 'unknown'}`,
          details: entry.error_message || `Тип: ${entry.message_type ?? 'n/a'}`,
          timestamp: entry.created_at,
          status: entry.status === 'success' ? 'ok' : entry.status === 'error' ? 'error' : 'info',
        })),
      ]
        .filter((event) => event.timestamp)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 12);

      setEvents(recentEvents);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      await loadOverview();
    };

    run();
    const intervalId = setInterval(run, 30000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [loadOverview]);

  const setTab = (tab: OperationsTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  const queueState = useMemo(() => {
    if (metrics.queuePending > 20) {
      return { text: 'Высокая нагрузка', tone: 'warn' as const };
    }
    if (metrics.queuePending > 0) {
      return { text: 'Есть ожидание', tone: 'ok' as const };
    }
    return { text: 'Стабильно', tone: 'ok' as const };
  }, [metrics.queuePending]);

  const renderOverview = () => (
    <section className="dashboard-home">
      <div className="dashboard-hero">
        <div>
          <p className="dashboard-hero-kicker">Операционный центр</p>
          <h1>Сводка по логам и очередям</h1>
          <p className="dashboard-hero-subtitle">
            Единая точка для webhook, очереди Telegram, истории пуллинга, интеграций и ботов.
          </p>
        </div>
        <button type="button" className="icon-button" onClick={loadOverview} title="Обновить обзор">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="dashboard-stat-grid">
        <article className="dashboard-stat-card dashboard-tone-primary">
          <div className="dashboard-stat-head">
            <span>Webhook логи</span>
            <div className="dashboard-stat-icon">
              <ScrollText className="h-5 w-5" />
            </div>
          </div>
          <p className="dashboard-stat-value">{loading ? '...' : metrics.webhookLogs}</p>
        </article>

        <article className="dashboard-stat-card dashboard-tone-info">
          <div className="dashboard-stat-head">
            <span>Очередь Telegram</span>
            <div className="dashboard-stat-icon">
              <Mail className="h-5 w-5" />
            </div>
          </div>
          <p className="dashboard-stat-value">{loading ? '...' : metrics.queueTotal}</p>
          <p className="dashboard-stat-subtitle">Ожидает: {metrics.queuePending}</p>
        </article>

        <article className="dashboard-stat-card dashboard-tone-success">
          <div className="dashboard-stat-head">
            <span>Пуллинг / Интеграции</span>
            <div className="dashboard-stat-icon">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <p className="dashboard-stat-value">{loading ? '...' : metrics.pollRuns + metrics.integrationRuns}</p>
          <p className="dashboard-stat-subtitle">Пуллинг: {metrics.pollRuns}, Интеграции: {metrics.integrationRuns}</p>
        </article>

        <article className="dashboard-stat-card dashboard-tone-neutral">
          <div className="dashboard-stat-head">
            <span>История ботов</span>
            <div className="dashboard-stat-icon">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="dashboard-stat-value">{loading ? '...' : metrics.botRuns}</p>
        </article>
      </div>

      <article className="panel dashboard-block">
        <div className="dashboard-block-title">Состояние системы</div>
        <div className="dashboard-status-list">
          <div className="dashboard-status-item">
            <span>Очередь сообщений</span>
            <span className={`dashboard-badge ${queueState.tone === 'warn' ? 'dashboard-badge-warn' : 'dashboard-badge-ok'}`}>
              {queueState.tone === 'warn' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {queueState.text}
            </span>
          </div>
          <div className="dashboard-status-item">
            <span>Ожидают отправки</span>
            <strong>{metrics.queuePending}</strong>
          </div>
          <div className="dashboard-status-item">
            <span>Webhook записей</span>
            <strong>{metrics.webhookLogs}</strong>
          </div>
        </div>
      </article>

      <article className="panel dashboard-block">
        <div className="dashboard-block-title">Последние события</div>
        {loading ? (
          <div className="dashboard-empty">Загрузка...</div>
        ) : events.length === 0 ? (
          <div className="dashboard-empty">Событий пока нет</div>
        ) : (
          <div className="dashboard-events-list">
            {events.map((event) => (
              <div key={event.id} className={`dashboard-event-item ${event.status === 'error' ? 'dashboard-event-error' : ''}`}>
                <div className="dashboard-event-title-row">
                  <strong>{event.source}</strong>
                  <span className={`dashboard-badge ${event.status === 'error' ? 'dashboard-badge-error' : event.status === 'ok' ? 'dashboard-badge-success' : 'dashboard-badge-info'}`}>
                    {event.status.toUpperCase()}
                  </span>
                </div>
                <p>{event.title}</p>
                <p>{event.details}</p>
                <time>{new Date(event.timestamp).toLocaleString('ru-RU')}</time>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );

  const renderContent = () => {
    if (activeTab === 'overview') return renderOverview();
    if (activeTab === 'history') return <History />;
    if (activeTab === 'queue') return <Queue />;
    if (activeTab === 'polling-history') return <PollingHistory />;
    if (activeTab === 'integration-history') return <IntegrationHistory />;
    return <BotHistory />;
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Операции</h2>
          </div>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap gap-2">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTab(tab.key)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  activeTab === tab.key
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)_/_0.15)] text-[hsl(var(--foreground))]'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {renderContent()}
    </div>
  );
}
