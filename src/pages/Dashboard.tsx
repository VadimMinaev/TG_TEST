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
import { AiAssistantProvider } from '../lib/ai-assistant-context';
import { AiAssistantToggle } from '../components/AIAssistantPanel';

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
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark-theme')
  );
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
      { path: '/', label: 'Главная', icon: <Activity size={18} /> },
      { path: '/rules', label: 'Webhook', icon: <MessageSquare size={18} /> },
      { path: '/polling', label: 'Пуллинг', icon: <Repeat2 size={18} /> },
      { path: '/integrations', label: 'Интеграции', icon: <LinkIcon size={18} /> },
      { path: '/telegram', label: 'Telegram', icon: <Send size={18} /> },
    ];

    if (user?.isVadmin) {
      return [
        ...baseItems,
        { path: '/accounts', label: 'Аккаунты', icon: <Building size={18} /> },
        { path: '/users', label: 'Пользователи', icon: <Users size={18} /> },
      ];
    }

    return [...baseItems, { path: '/users', label: 'Пользователи', icon: <Users size={18} /> }];
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
    const dark = document.documentElement.classList.contains('dark-theme');
    setIsDark(dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
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
    <AiAssistantProvider>
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
              <Lock size={18} />
              <span>Пароль</span>
            </button>
            <button onClick={handleLogout} className="sidebar-item">
              <LogOut size={18} />
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
                <Plus size={16} />
              </button>

              <button className="icon-button desktop-only-btn" title="Уведомления" aria-label="Уведомления">
                <Bell size={16} />
              </button>

              <NavLink
                to="/testing"
                className={({ isActive }) => `icon-button ${isActive ? 'bg-[hsl(var(--accent))]' : ''}`}
                title="Тестирование"
              >
                <FlaskConical size={16} />
              </NavLink>

              <div ref={versionRef} className="relative">
                <button
                  className="icon-button desktop-only-btn"
                  title="О приложении"
                  onClick={() => setShowVersionPanel((prev) => !prev)}
                  aria-label="О приложении"
                  aria-expanded={showVersionPanel}
                  aria-controls="version-panel"
                >
                  <Info size={16} />
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
                {isDark ? <Moon size={16} /> : <Sun size={16} />}
              </button>

              {canEdit && (
                <button
                  onClick={() => setAccountTokenModalOpen(true)}
                  className="icon-button"
                  title="Account Telegram token"
                  aria-label="Account Telegram token"
                >
                  <Settings size={16} />
                </button>
              )}

              <button onClick={() => setShowPasswordModal(true)} className="icon-button mobile-only-btn" title="Пароль">
                <Lock size={16} />
              </button>
              <button onClick={handleLogout} className="icon-button mobile-only-btn" title="Выход">
                <LogOut size={16} />
              </button>

              <div className="ml-2 text-sm text-muted-foreground user-info-desktop">{user.username}</div>
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
            className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 pt-[100px] animate-fade-in"
            onClick={() => setAccountTokenModalOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl animate-fade-in-scale"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 text-lg font-semibold tracking-tight">Telegram token for account</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Used by default for rules, polling, integrations and bots if local token is empty.
              </p>
              <div className="mb-4 rounded-lg border bg-muted/20 p-3 text-sm">
                {accountTokenLoading ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : accountTokenIsSet ? (
                  <span>Current: {accountTokenMasked}</span>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </div>
              <label className="mb-2 block text-sm font-medium">New token (empty = clear)</label>
              <input
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                value={accountTokenValue}
                onChange={(e) => setAccountTokenValue(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
              />
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveAccountBotToken}
                  disabled={accountTokenSaving}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 active:scale-[0.97]"
                >
                  {accountTokenSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setAccountTokenModalOpen(false)}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border bg-secondary px-4 py-2 text-sm font-medium shadow-sm transition-all hover:bg-secondary/80 active:scale-[0.97]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <AiAssistantToggle />
    </AiAssistantProvider>
  );
}
