import { useEffect, useState, useMemo, useRef } from 'react';
import { Outlet, useNavigate, Link, useLocation, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth-context';
import {
  Sun,
  Moon,
  LogOut,
  Lock,
  Plus,
  Bell,
  Settings,
  ListChecks,
  FlaskConical,
  Clock,
  Mail,
  Repeat,
  History,
  Users,
  Link2,
  ScrollText,
  Bot,
  Info,
  Building2,
} from 'lucide-react';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { GlobalSearch } from '../components/GlobalSearch';

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '–';
const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '–';

export function Dashboard() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const versionRef = useRef<HTMLDivElement>(null);

  // Аудитор может только просматривать; для остальных — кнопка создания на страницах сущностей
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
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Close version panel on outside click
  useEffect(() => {
    if (!showVersionPanel) return;
    const handler = (e: MouseEvent) => {
      if (versionRef.current && !versionRef.current.contains(e.target as Node)) {
        setShowVersionPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showVersionPanel]);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark-theme');
    const isDark = document.documentElement.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  const tabs = [
    { path: '/', label: 'Webhook', icon: <ListChecks /> },
    { path: '/history', label: 'История', icon: <Clock /> },
    { path: '/queue', label: 'Очередь в Telegram', icon: <Mail /> },
    { path: '/polling', label: 'Пуллинг', icon: <Repeat /> },
    { path: '/polling-history', label: 'Ист. пуллинга', icon: <History /> },
    { path: '/integrations', label: 'Интегратор', icon: <Link2 /> },
    { path: '/integration-history', label: 'Ист. интегр.', icon: <ScrollText /> },
    { path: '/bots', label: 'Боты', icon: <Bot /> },
    { path: '/bot-history', label: 'Ист. ботов', icon: <ScrollText /> },
  ];

  if (user?.isVadmin) {
    tabs.push({ path: '/accounts', label: 'Аккаунты', icon: <Building2 /> });
    tabs.push({ path: '/users', label: 'Пользователи', icon: <Users /> });
  } else {
    tabs.push({ path: '/users', label: 'Пользователи', icon: <Users /> });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">TG</div>
        <nav className="sidebar-nav">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="sidebar-item"
          >
            <Lock />
            <span>Пароль</span>
          </button>
          <button onClick={handleLogout} className="sidebar-item">
            <LogOut />
            <span>Выход</span>
          </button>
        </div>
      </aside>

      <div className="app-page">
        <header className="topbar">
          <div className="topbar-title">
            📱 Интеграция💲VadminLink
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
            <Link
              to="/testing"
              className={`icon-button ${location.pathname === '/testing' ? 'bg-[hsl(var(--accent))]' : ''}`}
              title="Тестирование"
            >
              <FlaskConical className="h-4 w-4" />
            </Link>
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
                    <span className="version-panel-value">{appVersion}</span>
                  </div>
                  <div className="version-panel-row">
                    <span className="version-panel-label">Сборка</span>
                    <span className="version-panel-value">
                      {buildDate !== '–'
                        ? new Date(buildDate).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '–'}
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
