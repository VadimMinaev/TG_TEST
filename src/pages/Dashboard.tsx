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
  Moon,
  Plus,
  Repeat2,
  Sun,
  Users,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { GlobalSearch } from '../components/GlobalSearch';
import { Breadcrumb } from '../components/Breadcrumb';
import { Operations } from './Operations';

export function Dashboard() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
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
      { path: '/polling', label: 'Пуллинг', icon: <Repeat2 className="h-4 w-4" /> },
      { path: '/integrations', label: 'Интеграции', icon: <LinkIcon className="h-4 w-4" /> },
      { path: '/bots', label: 'Боты', icon: <Bot className="h-4 w-4" /> },
      { path: '/reminders', label: 'Напоминания', icon: <Clock className="h-4 w-4" /> },
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

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Основная навигация">
        <div className="sidebar-brand">
          <img src="/vadminlink-logo.png.jpg" alt="VadminLink" />
        </div>

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

            {location.pathname === '/' ? <Operations /> : <Outlet />}
          </div>
        </main>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}
