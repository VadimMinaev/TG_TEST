import { useEffect, useState, useMemo } from 'react';
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
} from 'lucide-react';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { GlobalSearch } from '../components/GlobalSearch';

export function Dashboard() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Определяем, можно ли создавать на текущей странице
  const canCreate = useMemo(() => {
    return location.pathname === '/' || location.pathname === '/polling' || location.pathname === '/users';
  }, [location.pathname]);

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
    { path: '/', label: 'Правила', icon: <ListChecks /> },
    { path: '/testing', label: 'Тесты', icon: <FlaskConical /> },
    { path: '/history', label: 'История', icon: <Clock /> },
    { path: '/queue', label: 'Очередь', icon: <Mail /> },
    { path: '/polling', label: 'Пуллинг', icon: <Repeat /> },
    { path: '/polling-history', label: 'Ист. пуллинга', icon: <History /> },
  ];

  if (user?.username === 'vadmin') {
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
            📱 Интеграция с TG 💲VadminLink
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
            <button className="icon-button" title="Уведомления">
              <Bell className="h-4 w-4" />
            </button>
            <button className="icon-button" title="Настройки">
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="icon-button"
              aria-label="Переключить тему"
            >
              <Sun className="h-4 w-4 dark-theme:hidden" />
              <Moon className="hidden h-4 w-4 dark-theme:block" />
            </button>
            <div className="ml-2 text-sm text-[hsl(var(--muted-foreground))]">
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
