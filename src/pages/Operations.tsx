import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AlertTriangle, Bot, CheckCircle2, Link as LinkIcon, MessageSquare, RefreshCw, Repeat2 } from 'lucide-react';
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
  totalRules: number;
  activeRules: number;
  polls: number;
  activePolls: number;
  integrations: number;
  activeIntegrations: number;
  bots: number;
  activeBots: number;
  queueTotal: number;
  queuePending: number;
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
  totalRules: 0,
  activeRules: 0,
  polls: 0,
  activePolls: 0,
  integrations: 0,
  activeIntegrations: 0,
  bots: 0,
  activeBots: 0,
  queueTotal: 0,
  queuePending: 0,
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
      const [rules, polls, integrations, bots, webhookLogs, queueStatus, pollHistory, integrationHistory, botHistory] = await Promise.all([
        api.getRules().catch(() => []),
        api.getPolls().catch(() => []),
        api.getIntegrations().catch(() => []),
        api.getBots().catch(() => []),
        api.getWebhookLogs().catch(() => []),
        api.getQueueStatus().catch(() => ({ total: 0, pending: 0 })),
        api.getPollHistory().catch(() => []),
        api.getIntegrationHistory().catch(() => []),
        api.getBotHistory().catch(() => []),
      ]);

      const rulesList = Array.isArray(rules) ? rules : [];
      const pollsList = Array.isArray(polls) ? polls : [];
      const integrationsList = Array.isArray(integrations) ? integrations : [];
      const botsList = Array.isArray(bots) ? bots : [];
      const webhookLogsList = Array.isArray(webhookLogs) ? webhookLogs : [];
      const pollRuns = Array.isArray(pollHistory) ? pollHistory : [];
      const integrationRuns = Array.isArray(integrationHistory) ? integrationHistory : [];
      const botRuns = Array.isArray(botHistory) ? botHistory : [];

      setMetrics({
        totalRules: rulesList.length,
        activeRules: rulesList.filter((rule: any) => rule?.enabled).length,
        polls: pollsList.length,
        activePolls: pollsList.filter((poll: any) => poll?.enabled).length,
        integrations: integrationsList.length,
        activeIntegrations: integrationsList.filter((integration: any) => integration?.enabled).length,
        bots: botsList.length,
        activeBots: botsList.filter((bot: any) => bot?.enabled).length,
        queueTotal: Number(queueStatus?.total ?? 0),
        queuePending: Number(queueStatus?.pending ?? 0),
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
            <span>Webhook</span>
            <div className="dashboard-stat-icon">
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
          <p className="dashboard-stat-value">{loading ? '...' : metrics.totalRules}</p>
          <p className="dashboard-stat-subtitle">{metrics.activeRules} активных</p>
        </article>

        <article className="dashboard-stat-card dashboard-tone-info">
          <div className="dashboard-stat-head">
            <span>Интеграции</span>
            <div className="dashboard-stat-icon">
              <LinkIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="dashboard-stat-value">{loading ? '...' : metrics.integrations}</p>
          <p className="dashboard-stat-subtitle">{metrics.activeIntegrations} активных</p>
        </article>

        <article className="dashboard-stat-card dashboard-tone-success">
          <div className="dashboard-stat-head">
            <span>Пуллинги</span>
            <div className="dashboard-stat-icon">
              <Repeat2 className="h-5 w-5" />
            </div>
          </div>
          <p className="dashboard-stat-value">{loading ? '...' : metrics.polls}</p>
          <p className="dashboard-stat-subtitle">{metrics.activePolls} выполняются</p>
        </article>

        <article className="dashboard-stat-card dashboard-tone-info">
          <div className="dashboard-stat-head">
            <span>Боты</span>
            <div className="dashboard-stat-icon">
              <Bot className="h-5 w-5" />
            </div>
          </div>
          <p className="dashboard-stat-value">{loading ? '...' : metrics.bots}</p>
          <p className="dashboard-stat-subtitle">{metrics.activeBots} активных</p>
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
            <strong>{metrics.activeRules}</strong>
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
    <div className="operations-page">
      <div className="card operations-tabs-card">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Операции</h2>
          </div>
        </div>
        <div className="card-body">
          <div className="operations-tabbar">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTab(tab.key)}
                className={`operations-tab-btn ${activeTab === tab.key ? 'operations-tab-btn-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="operations-content">{renderContent()}</div>
    </div>
  );
}
