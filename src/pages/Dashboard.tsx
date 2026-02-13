import { useEffect, useState, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth-context';
import {
  Sun,
  Moon,
  LogOut,
  Lock,
  Plus,
  Bell,
  FlaskConical,
  Info,
  User,
  Settings,
  MessageSquare,
  Repeat2,
  Clock,
  Mail,
  History,
  Link,
  ScrollText,
  Bot,
  Building,
  Users,
  Activity,
  BarChart3,
  TrendingUp,
  MessageCircle,
  Zap
} from 'lucide-react';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { GlobalSearch } from '../components/GlobalSearch';
import { Breadcrumb } from '../components/Breadcrumb';

export function Dashboard() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const versionRef = useRef<HTMLDivElement>(null);

  const canCreate = useMemo(() => {
    if (user?.role === 'auditor') return false;
    return location.pathname === '/' || location.pathname === '/polling' || location.pathname === '/users' || location.pathname === '/integrations' || location.pathname === '/bots';
  }, [location.pathname, user?.role]);

  const handleCreate = () => {
    if (canCreate) {
      setSearchParams({ create: 'true' });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionRef.current && !versionRef.current.contains(event.target as Node)) {
        setShowVersionPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark-theme');
    const isDark = document.documentElement.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  const tabs = [
    { path: '/', label: 'Главная', icon: <Activity className="h-4 w-4" /> },
    { path: '/rules', label: 'Webhook', icon: <MessageSquare className="h-4 w-4" /> },
    { path: '/history', label: 'История', icon: <Clock className="h-4 w-4" /> },
    { path: '/queue', label: 'Очередь в Telegram', icon: <Mail className="h-4 w-4" /> },
    { path: '/polling', label: 'Пуллинг', icon: <Repeat2 className="h-4 w-4" /> },
    { path: '/polling-history', label: 'Ист. пуллинга', icon: <History className="h-4 w-4" /> },
    { path: '/integrations', label: 'Интегратор', icon: <Link className="h-4 w-4" /> },
    { path: '/integration-history', label: 'Ист. интегр.', icon: <ScrollText className="h-4 w-4" /> },
    { path: '/bots', label: 'Боты', icon: <Bot className="h-4 w-4" /> },
    { path: '/bot-history', label: 'Ист. ботов', icon: <ScrollText className="h-4 w-4" /> },
  ];

  if (user?.isVadmin) {
    tabs.push({ path: '/accounts', label: 'Аккаунты', icon: <Building className="h-4 w-4" /> });
    tabs.push({ path: '/users', label: 'Пользователи', icon: <Users className="h-4 w-4" /> });
  } else {
    tabs.push({ path: '/users', label: 'Пользователи', icon: <Users className="h-4 w-4" /> });
  }

  // Если мы на главной странице, показываем дашборд
  if (location.pathname === '/') {
    return (
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">TG</div>
          <nav className="sidebar-nav">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              return (
                <a
                  key={tab.path}
                  href={tab.path}
                  className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </a>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="sidebar-item"
            >
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
            <div className="topbar-title">
              📱 Интеграция 💲VadminLink
            </div>

            <GlobalSearch />

            <div className="topbar-actions">
              <button
                className={`icon-button ${canCreate ? '' : 'opacity-50 cursor-not-allowed'}`}
                title={canCreate ? 'Создать' : 'На этой странице нельзя создавать'}
                onClick={handleCreate}
                disabled={!canCreate}
              >
                <Plus className="h-4 w-4" />
              </button>
              <button className="icon-button desktop-only-btn" title="Уведомления">
                <Bell className="h-4 w-4" />
              </button>
              <a
                href="/testing"
                className={`icon-button ${location.pathname === '/testing' ? 'bg-[hsl(var(--accent))]' : ''}`}
                title="Тестирование"
              >
                <FlaskConical className="h-4 w-4" />
              </a>
              <div ref={versionRef} style={{ position: 'relative' }}>
                <button
                  className="icon-button desktop-only-btn"
                  title="О приложении"
                  onClick={() => setShowVersionPanel((v) => !v)}
                >
                  <Info className="h-4 w-4" />
                </button>
                {showVersionPanel && (
                  <div className="version-panel">
                    <div className="version-panel-title">VadminLink</div>
                    <div className="version-panel-row">
                      <span className="version-panel-label">Версия</span>
                      <span className="version-panel-value">1.0.295</span>
                    </div>
                    <div className="version-panel-row">
                      <span className="version-panel-label">Сборка</span>
                      <span className="version-panel-value">
                        {new Date().toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={toggleTheme}
                className="icon-button"
                aria-label="Переключить тему"
              >
                <Sun className="h-4 w-4 dark-theme:hidden" />
                <Moon className="hidden h-4 w-4 dark-theme:block" />
              </button>
              {/* Mobile-only: Password and Logout buttons */}
              <button
                onClick={() => setShowPasswordModal(true)}
                className="icon-button mobile-only-btn"
                title="Изменить пароль"
              >
                <Lock className="h-4 w-4" />
              </button>
              <button
                onClick={handleLogout}
                className="icon-button mobile-only-btn"
                title="Выход"
              >
                <LogOut className="h-4 w-4" />
              </button>
              <div className="ml-2 text-sm text-[hsl(var(--muted-foreground))] user-info-desktop">
                👤 {user?.username}
              </div>
            </div>
          </header>

          <main className="content-area">
            <div className="content-inner">
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold">Панель управления</h1>
                    <p className="text-[hsl(var(--muted-foreground))]">Обзор системы интеграции с Telegram</p>
                  </div>
                </div>
              </div>

              {/* Stats Overview - временно пустой блок до реализации статистики */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="panel p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">Всего Webhook</p>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                    <div className="p-3 rounded-full bg-[hsl(var(--primary)_/_0.1)]">
                      <MessageSquare className="h-6 w-6 text-[hsl(var(--primary))]" />
                    </div>
                  </div>
                </div>
                
                <div className="panel p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">Активные Webhook</p>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                    <div className="p-3 rounded-full bg-[hsl(var(--success)_/_0.1)]">
                      <Zap className="h-6 w-6 text-[hsl(var(--success))]" />
                    </div>
                  </div>
                </div>
                
                <div className="panel p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">Пуллинги</p>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                    <div className="p-3 rounded-full bg-[hsl(var(--info)_/_0.1)]">
                      <Repeat2 className="h-6 w-6 text-[hsl(var(--info))]" />
                    </div>
                  </div>
                </div>
                
                <div className="panel p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">Интеграции</p>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                    <div className="p-3 rounded-full bg-[hsl(var(--accent)_/_0.1)]">
                      <Link className="h-6 w-6 text-[hsl(var(--accent))]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Section - временно пустой блок до реализации графиков */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="panel p-6">
                  <h3 className="text-lg font-semibold mb-4">Активность Webhook</h3>
                  <div className="h-64 flex items-center justify-center text-[hsl(var(--muted-foreground))]">
                    График активности
                  </div>
                </div>
                
                <div className="panel p-6">
                  <h3 className="text-lg font-semibold mb-4">Статусы интеграций</h3>
                  <div className="h-64 flex items-center justify-center text-[hsl(var(--muted-foreground))]">
                    Диаграмма статусов
                  </div>
                </div>
              </div>

              {/* Recent Activity - временно пустой блок до реализации истории */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="panel p-6">
                    <h3 className="text-lg font-semibold mb-4">Последние события</h3>
                    <div className="text-center py-10 text-[hsl(var(--muted-foreground))]">
                      Нет недавних событий
                    </div>
                  </div>
                </div>
                <div>
                  <div className="panel p-6">
                    <h3 className="text-lg font-semibold mb-4">Состояние системы</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Очередь сообщений</span>
                        <span className="font-medium">Норма</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Сообщений в очереди</span>
                        <span className="font-medium">0</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Состояние API</span>
                        <span className="font-medium text-[hsl(var(--success))]">✅ OK</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>

        {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      </div>
    );
  }

  // Стандартный вид для других страниц
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">TG</div>
        <nav className="sidebar-nav">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <a
                key={tab.path}
                href={tab.path}
                className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="sidebar-item"
          >
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
          <div className="topbar-title">
            📱 Интеграция 💲VadminLink
          </div>

          <GlobalSearch />

          <div className="topbar-actions">
            <button
              className={`icon-button ${canCreate ? '' : 'opacity-50 cursor-not-allowed'}`}
              title={canCreate ? 'Создать' : 'На этой странице нельзя создавать'}
              onClick={handleCreate}
              disabled={!canCreate}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button className="icon-button desktop-only-btn" title="Уведомления">
              <Bell className="h-4 w-4" />
            </button>
            <a
              href="/testing"
              className={`icon-button ${location.pathname === '/testing' ? 'bg-[hsl(var(--accent))]' : ''}`}
              title="Тестирование"
            >
              <FlaskConical className="h-4 w-4" />
            </a>
            <div ref={versionRef} style={{ position: 'relative' }}>
              <button
                className="icon-button desktop-only-btn"
                title="О приложении"
                onClick={() => setShowVersionPanel((v) => !v)}
              >
                <Info className="h-4 w-4" />
              </button>
              {showVersionPanel && (
                <div className="version-panel">
                  <div className="version-panel-title">VadminLink</div>
                  <div className="version-panel-row">
                    <span className="version-panel-label">Версия</span>
                    <span className="version-panel-value">1.0.295</span>
                  </div>
                  <div className="version-panel-row">
                    <span className="version-panel-label">Сборка</span>
                    <span className="version-panel-value">
                      {new Date().toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={toggleTheme}
              className="icon-button"
              aria-label="Переключить тему"
            >
              <Sun className="h-4 w-4 dark-theme:hidden" />
              <Moon className="hidden h-4 w-4 dark-theme:block" />
            </button>
            {/* Mobile-only: Password and Logout buttons */}
            <button
              onClick={() => setShowPasswordModal(true)}
              className="icon-button mobile-only-btn"
              title="Изменить пароль"
            >
              <Lock className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              className="icon-button mobile-only-btn"
              title="Выход"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <div className="ml-2 text-sm text-[hsl(var(--muted-foreground))] user-info-desktop">
              👤 {user?.username}
            </div>
          </div>
        </header>

        <main className="content-area">
          <div className="content-inner">
            <Outlet />
          </div>
        </main>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}