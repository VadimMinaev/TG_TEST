import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  Activity,
  Bell,
  Bot,
  Building,
  Clock,
  FlaskConical,
  Info,
  Link as LinkIcon,
  Lock,
  LogOut,
  Mail,
  Moon,
  Plus,
  Repeat2,
  ScrollText,
  Sun,
  Users,
  Zap,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCcw,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { GlobalSearch } from '../components/GlobalSearch';
import { Breadcrumb } from '../components/Breadcrumb';

interface DashboardMetrics {
  totalRules: number;
  activeRules: number;
  polls: number;
  integrations: number;
  queueTotal: number;
  queuePending: number;
}

interface DashboardEventItem {
  id: string;
  title: string;
  details: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
}

interface TrendPoint {
  label: string;
  value: number;
}

const initialMetrics: DashboardMetrics = {
  totalRules: 0,
  activeRules: 0,
  polls: 0,
  integrations: 0,
  queueTotal: 0,
  queuePending: 0,
};

const initialTrend: TrendPoint[] = Array.from({ length: 8 }, (_, index) => ({
  label: `${index + 1}`,
  value: 0,
}));

function Sparkline({
  data,
  ariaLabel,
  stroke,
}: {
  data: TrendPoint[];
  ariaLabel: string;
  stroke: string;
}) {
  const max = Math.max(1, ...data.map((point) => point.value));
  const min = Math.min(...data.map((point) => point.value));
  const range = Math.max(1, max - min);
  const width = 180;
  const height = 44;
  const stepX = width / Math.max(1, data.length - 1);

  const points = data
    .map((point, index) => {
      const normalized = (point.value - min) / range;
      const x = index * stepX;
      const y = height - normalized * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      className="dashboard-sparkline"
      focusable="false"
    >
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Dashboard() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [events, setEvents] = useState<DashboardEventItem[]>([]);
  const [webhookTrend, setWebhookTrend] = useState<TrendPoint[]>(initialTrend);
  const [queueTrend, setQueueTrend] = useState<TrendPoint[]>(initialTrend);

  const versionRef = useRef<HTMLDivElement>(null);
  const appVersion = __APP_VERSION__;

  const buildDateText = useMemo(() => {
    const buildDate = new Date(__BUILD_DATE__);
    if (Number.isNaN(buildDate.getTime())) return __BUILD_DATE__;

    return buildDate.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const canCreate = useMemo(() => {
    if (user?.role === 'auditor') return false;

    return (
      location.pathname === '/' ||
      location.pathname === '/polling' ||
      location.pathname === '/users' ||
      location.pathname === '/integrations' ||
      location.pathname === '/bots'
    );
  }, [location.pathname, user?.role]);

  const navItems = useMemo(() => {
    const baseItems = [
      { path: '/', label: 'Главная', icon: <Activity className="h-4 w-4" /> },
      { path: '/rules', label: 'Webhook', icon: <MessageSquare className="h-4 w-4" /> },
      { path: '/history', label: 'История', icon: <Clock className="h-4 w-4" /> },
      { path: '/queue', label: 'Очередь', icon: <Mail className="h-4 w-4" /> },
      { path: '/polling', label: 'Пуллинг', icon: <Repeat2 className="h-4 w-4" /> },
      { path: '/polling-history', label: 'Ист. пуллинга', icon: <Clock className="h-4 w-4" /> },
      { path: '/integrations', label: 'Интеграции', icon: <LinkIcon className="h-4 w-4" /> },
      { path: '/integration-history', label: 'Ист. интегр.', icon: <ScrollText className="h-4 w-4" /> },
      { path: '/bots', label: 'Боты', icon: <Bot className="h-4 w-4" /> },
      { path: '/bot-history', label: 'Ист. ботов', icon: <ScrollText className="h-4 w-4" /> },
    ];

    if (user?.isVadmin) {
      return [
        ...baseItems,
        { path: '/accounts', label: 'Аккаунты', icon: <Building className="h-4 w-4" /> },
        { path: '/users', label: 'Пользователи', icon: <Users className="h-4 w-4" /> },
      ];
    }

    return [...baseItems, { path: '/users', label: 'Пользователи', icon: <Users className="h-4 w-4" /> }];
  }, [user?.isVadmin]);

  const breadcrumbItems = useMemo(() => {
    const active = navItems.find((item) => item.path === location.pathname);
    if (location.pathname === '/') return [{ label: 'Главная', active: true }];
    return [
      { label: 'Главная', path: '/' },
      { label: active?.label ?? 'Раздел', active: true },
    ];
  }, [location.pathname, navItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionRef.current && !versionRef.current.contains(event.target as Node)) {
        setShowVersionPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadMetrics = async () => {
      try {
        setMetricsLoading(true);
        const { api } = await import('../lib/api');
        const [rules, polls, integrations, queue] = await Promise.all([
          api.getRules(),
          api.getPolls(),
          api.getIntegrations(),
          api.getQueueStatus().catch(() => ({ available: false, total: 0, pending: 0 })),
        ]);

        if (!mounted) return;

        const nextMetrics: DashboardMetrics = {
          totalRules: Array.isArray(rules) ? rules.length : 0,
          activeRules: Array.isArray(rules) ? rules.filter((rule: any) => rule.enabled).length : 0,
          polls: Array.isArray(polls) ? polls.length : 0,
          integrations: Array.isArray(integrations) ? integrations.length : 0,
          queueTotal: queue?.total ?? 0,
          queuePending: queue?.pending ?? 0,
        };

        setMetrics(nextMetrics);
      } catch {
        // Ignore dashboard metric errors to avoid blocking page rendering.
      } finally {
        if (mounted) setMetricsLoading(false);
      }
    };

    loadMetrics();
    const intervalId = setInterval(loadMetrics, 30000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadActivity = async () => {
      try {
        setEventsLoading(true);
        const { api } = await import('../lib/api');
        const [webhookLogs, queueHistory] = await Promise.all([
          api.getWebhookLogs().catch(() => []),
          api.getQueueHistory(1).catch(() => ({ items: [] })),
        ]);

        if (!mounted) return;

        const webhookList = Array.isArray(webhookLogs) ? webhookLogs.slice(0, 8) : [];
        const queueItemsRaw = Array.isArray(queueHistory?.items)
          ? queueHistory.items
          : Array.isArray(queueHistory)
            ? queueHistory
            : [];
        const queueList = queueItemsRaw.slice(0, 8);

        const webhookPoints = webhookList
          .slice()
          .reverse()
          .map((entry: any, index: number) => ({
            label: `${index + 1}`,
            value: Number(entry?.matched ?? 0),
          }));
        const queuePoints = queueList
          .slice()
          .reverse()
          .map((entry: any, index: number) => ({
            label: `${index + 1}`,
            value: Number(entry?.attempt_count ?? entry?.retry_count ?? 0),
          }));

        setWebhookTrend(webhookPoints.length ? webhookPoints : initialTrend);
        setQueueTrend(queuePoints.length ? queuePoints : initialTrend);

        const webhookEvents: DashboardEventItem[] = webhookList.map((entry: any) => ({
          id: `webhook-${entry.id}`,
          title: `Webhook: ${entry.status === 'ok' ? 'успешная обработка' : 'ошибка обработки'}`,
          details: `Совпадений: ${entry.matched ?? 0} из ${entry.total_rules ?? 0}`,
          timestamp: entry.timestamp,
          status: entry.status === 'ok' ? 'success' : 'error',
        }));

        const queueEvents: DashboardEventItem[] = queueList.map((entry: any) => ({
          id: `queue-${entry.id ?? entry.created_at}`,
          title: `Очередь: ${entry.status ?? 'pending'}`,
          details: `Попыток отправки: ${entry.attempt_count ?? entry.retry_count ?? 0}`,
          timestamp: entry.updated_at ?? entry.created_at ?? new Date().toISOString(),
          status: entry.status === 'sent' ? 'success' : entry.status === 'failed' ? 'error' : 'pending',
        }));

        const merged = [...webhookEvents, ...queueEvents]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 6);

        setEvents(merged);
      } catch {
        if (mounted) setEvents([]);
      } finally {
        if (mounted) setEventsLoading(false);
      }
    };

    loadActivity();
    const intervalId = setInterval(loadActivity, 30000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark-theme');
    const isDark = document.documentElement.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  const handleCreate = () => {
    if (canCreate) setSearchParams({ create: 'true' });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Webhook',
      value: metrics.totalRules,
      subtitle: `${metrics.activeRules} активных`,
      icon: <MessageSquare className="h-5 w-5" />,
      tone: 'primary',
    },
    {
      title: 'Интеграции',
      value: metrics.integrations,
      subtitle: 'Обработчики событий',
      icon: <LinkIcon className="h-5 w-5" />,
      tone: 'info',
    },
    {
      title: 'Пуллинги',
      value: metrics.polls,
      subtitle: 'Запланированные проверки',
      icon: <Repeat2 className="h-5 w-5" />,
      tone: 'success',
    },
    {
      title: 'Очередь Telegram',
      value: metrics.queuePending,
      subtitle: `Всего в очереди: ${metrics.queueTotal}`,
      icon: <Mail className="h-5 w-5" />,
      tone: metrics.queuePending > 20 ? 'warn' : 'neutral',
    },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Основная навигация">
        <div className="sidebar-brand">TG</div>

        <nav className="sidebar-nav" aria-label="Разделы панели">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={() => setShowPasswordModal(true)} className="sidebar-item">
            <Lock className="h-4 w-4" />
            <span>Пароль</span>
          </button>
          <button onClick={handleLogout} className="sidebar-item">
            <LogOut className="h-4 w-4" />
            <span>Выход</span>
          </button>
        </div>
      </aside>

      <div className="app-page">
        <header className="topbar">
          <div className="topbar-title">Интеграция VadminLink</div>
          <GlobalSearch />

          <div className="topbar-actions">
            <button
              className={`icon-button ${canCreate ? '' : 'opacity-50 cursor-not-allowed'}`}
              title={canCreate ? 'Создать сущность' : 'На этой странице создание недоступно'}
              onClick={handleCreate}
              disabled={!canCreate}
              aria-label={canCreate ? 'Создать сущность' : 'Создание недоступно'}
            >
              <Plus className="h-4 w-4" />
            </button>

            <button className="icon-button desktop-only-btn" title="Уведомления" aria-label="Уведомления">
              <Bell className="h-4 w-4" />
            </button>

            <NavLink
              to="/testing"
              className={({ isActive }) => `icon-button ${isActive ? 'bg-[hsl(var(--accent))]' : ''}`}
              title="Тестирование"
            >
              <FlaskConical className="h-4 w-4" />
            </NavLink>

            <div ref={versionRef} style={{ position: 'relative' }}>
              <button
                className="icon-button desktop-only-btn"
                title="О приложении"
                onClick={() => setShowVersionPanel((prev) => !prev)}
                aria-label="О приложении"
                aria-expanded={showVersionPanel}
                aria-controls="version-panel"
              >
                <Info className="h-4 w-4" />
              </button>

              {showVersionPanel && (
                <div className="version-panel" id="version-panel" role="dialog" aria-label="Информация о приложении">
                  <div className="version-panel-title">VadminLink</div>
                  <div className="version-panel-row">
                    <span className="version-panel-label">Версия</span>
                    <span className="version-panel-value">{appVersion}</span>
                  </div>
                  <div className="version-panel-row">
                    <span className="version-panel-label">Сборка</span>
                    <span className="version-panel-value">{buildDateText}</span>
                  </div>
                </div>
              )}
            </div>

            <button onClick={toggleTheme} className="icon-button" aria-label="Переключить тему">
              <Sun className="h-4 w-4 dark-theme:hidden" />
              <Moon className="hidden h-4 w-4 dark-theme:block" />
            </button>

            <button onClick={() => setShowPasswordModal(true)} className="icon-button mobile-only-btn" title="Пароль">
              <Lock className="h-4 w-4" />
            </button>
            <button onClick={handleLogout} className="icon-button mobile-only-btn" title="Выход">
              <LogOut className="h-4 w-4" />
            </button>

            <div className="ml-2 text-sm text-[hsl(var(--muted-foreground))] user-info-desktop">{user.username}</div>
          </div>
        </header>

        <main className="content-area" id="main-content">
          <div className="content-inner">
            <Breadcrumb items={breadcrumbItems} />

            {location.pathname === '/' ? (
              <section className="dashboard-home">
                <div className="dashboard-hero">
                  <div>
                    <p className="dashboard-hero-kicker">Панель управления</p>
                    <h1>Оперативный обзор системы</h1>
                    <p className="dashboard-hero-subtitle">
                      Основные показатели webhook, интеграций, пуллинга и очереди Telegram в одном месте.
                    </p>
                  </div>
                  <div className="dashboard-hero-tag">
                    <Activity className="h-4 w-4" />
                    Обновление каждые 30 секунд
                  </div>
                </div>

                <div className="dashboard-stat-grid">
                  {statCards.map((card) => (
                    <article key={card.title} className={`dashboard-stat-card dashboard-tone-${card.tone}`}>
                      <div className="dashboard-stat-head">
                        <span>{card.title}</span>
                        <div className="dashboard-stat-icon">{card.icon}</div>
                      </div>
                      <p className="dashboard-stat-value">
                        {metricsLoading ? (
                          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
                        ) : (
                          card.value
                        )}
                      </p>
                      <p className="dashboard-stat-subtitle">{card.subtitle}</p>
                      {(card.title === 'Webhook' || card.title === 'Очередь Telegram') && (
                        <Sparkline
                          data={card.title === 'Webhook' ? webhookTrend : queueTrend}
                          ariaLabel={card.title === 'Webhook' ? 'Тренд webhook' : 'Тренд очереди Telegram'}
                          stroke={card.title === 'Webhook' ? 'hsl(var(--primary))' : 'hsl(var(--info))'}
                        />
                      )}
                    </article>
                  ))}
                </div>

                <div className="dashboard-grid">
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
                        <span>Задач ожидает отправки</span>
                        <strong>{metrics.queuePending}</strong>
                      </div>
                      <div className="dashboard-status-item">
                        <span>Активных webhook</span>
                        <strong>{metrics.activeRules}</strong>
                      </div>
                    </div>
                  </article>

                  <article className="panel dashboard-block">
                    <div className="dashboard-block-title">Быстрые действия</div>
                    <div className="dashboard-actions-list">
                      <NavLink to="/rules" className="dashboard-action-item">
                        Управление webhook
                        <ArrowRight className="h-4 w-4" />
                      </NavLink>
                      <NavLink to="/integrations" className="dashboard-action-item">
                        Настройка интеграций
                        <ArrowRight className="h-4 w-4" />
                      </NavLink>
                      <NavLink to="/queue" className="dashboard-action-item">
                        Проверка очереди Telegram
                        <ArrowRight className="h-4 w-4" />
                      </NavLink>
                      <NavLink to="/history" className="dashboard-action-item">
                        История событий
                        <ArrowRight className="h-4 w-4" />
                      </NavLink>
                    </div>
                  </article>
                </div>

                <article className="panel dashboard-block">
                  <div className="dashboard-block-title">Последние события</div>
                  {eventsLoading ? (
                    <div className="dashboard-empty">
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                      Загрузка активности...
                    </div>
                  ) : events.length === 0 ? (
                    <div className="dashboard-empty">События пока отсутствуют</div>
                  ) : (
                    <div className="dashboard-events-list" role="list" aria-label="Лента последних событий">
                      {events.map((event) => (
                        <div key={event.id} className="dashboard-event-item" role="listitem">
                          <div className="dashboard-event-title-row">
                            <strong>{event.title}</strong>
                            <span
                              className={`dashboard-badge ${
                                event.status === 'error'
                                  ? 'dashboard-badge-warn'
                                  : event.status === 'pending'
                                    ? 'dashboard-badge-neutral'
                                    : 'dashboard-badge-ok'
                              }`}
                            >
                              {event.status === 'error' ? 'Ошибка' : event.status === 'pending' ? 'В обработке' : 'Успех'}
                            </span>
                          </div>
                          <p>{event.details}</p>
                          <time dateTime={event.timestamp}>
                            {new Date(event.timestamp).toLocaleString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </section>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}
