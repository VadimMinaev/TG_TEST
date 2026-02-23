import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  Activity,
  Bell,
  Building,
  FlaskConical,
  Info,
  Link as LinkIcon,
  Lock,
  LogOut,
  Moon,
  Plus,
  Repeat2,
  Send,
  Settings,
  Sun,
  Users,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { GlobalSearch } from '../components/GlobalSearch';
import { Operations } from './Operations';
import { api } from '../lib/api';
import { useToast } from '../components/ToastNotification';

export function Dashboard() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const { addToast } = useToast();

  const canEdit = user?.role !== 'auditor';

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [accountTokenModalOpen, setAccountTokenModalOpen] = useState(false);
  const [accountTokenValue, setAccountTokenValue] = useState('');
  const [accountTokenMasked, setAccountTokenMasked] = useState('');
  const [accountTokenIsSet, setAccountTokenIsSet] = useState(false);
  const [accountTokenLoading, setAccountTokenLoading] = useState(false);
  const [accountTokenSaving, setAccountTokenSaving] = useState(false);
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
      location.pathname === '/telegram'
    );
  }, [location.pathname, user?.role]);

  const navItems = useMemo(() => {
    const baseItems = [
      { path: '/', label: 'Главная', icon: <Activity className="h-4 w-4" /> },
      { path: '/rules', label: 'Webhook', icon: <MessageSquare className="h-4 w-4" /> },
      { path: '/polling', label: 'Пуллинг', icon: <Repeat2 className="h-4 w-4" /> },
      { path: '/integrations', label: 'Интеграции', icon: <LinkIcon className="h-4 w-4" /> },
      { path: '/telegram', label: 'Telegram', icon: <Send className="h-4 w-4" /> },
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
    if (!canCreate) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('create', 'true');
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const loadAccountBotToken = async () => {
    try {
      setAccountTokenLoading(true);
      const data = await api.getAccountBotToken();
      setAccountTokenMasked(data.botToken || '');
      setAccountTokenIsSet(Boolean(data.isSet));
      setAccountTokenValue('');
    } catch (error: any) {
      addToast(error.message || 'Не удалось загрузить токен аккаунта', 'error');
    } finally {
      setAccountTokenLoading(false);
    }
  };

  const handleSaveAccountBotToken = async () => {
    try {
      setAccountTokenSaving(true);
      await api.saveAccountBotToken(accountTokenValue.trim());
      addToast(accountTokenValue.trim() ? 'Токен аккаунта сохранен' : 'Токен аккаунта очищен', 'success');
      await loadAccountBotToken();
      setAccountTokenModalOpen(false);
    } catch (error: any) {
      addToast(error.message || 'Не удалось сохранить токен аккаунта', 'error');
    } finally {
      setAccountTokenSaving(false);
    }
  };

  useEffect(() => {
    if (accountTokenModalOpen) {
      loadAccountBotToken();
    }
  }, [accountTokenModalOpen]);

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

            {canEdit && (
              <button
                onClick={() => setAccountTokenModalOpen(true)}
                className="icon-button"
                title="Account Telegram token"
                aria-label="Account Telegram token"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}

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
            {location.pathname === '/' ? <Operations /> : <Outlet />}
          </div>
        </main>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}

      {accountTokenModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '100px',
            zIndex: 9999,
          }}
          onClick={() => setAccountTokenModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'hsl(var(--card))',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '520px',
              border: '1px solid hsl(var(--border))',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold">Telegram token for account</h3>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              Used by default for rules, polling, integrations and bots if local token is empty.
            </p>
            <div className="mb-4 rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted)_/_0.2)] p-3 text-sm">
              {accountTokenLoading ? 'Loading...' : (accountTokenIsSet ? `Current: ${accountTokenMasked}` : 'Not set')}
            </div>
            <label className="mb-2 block text-sm font-medium">New token (empty = clear)</label>
            <input
              style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
              value={accountTokenValue}
              onChange={(e) => setAccountTokenValue(e.target.value)}
              placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
            />
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleSaveAccountBotToken}
                disabled={accountTokenSaving}
                style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: 'none', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, opacity: accountTokenSaving ? 0.7 : 1 }}
              >
                {accountTokenSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setAccountTokenModalOpen(false)}
                style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary))' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

