import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  Activity,
  Bell,
  Building2,
  ChevronRight,
  FlaskConical,
  Info,
  KeyRound,
  Link as LinkIcon,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  Repeat2,
  Send,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { GlobalSearch } from '../components/GlobalSearch';
import { Operations } from './Operations';
import { api } from '../lib/api';
import { useToast } from '../components/ToastNotification';
import { AiAssistantProvider } from '../lib/ai-assistant-context';
import { AiAssistantToggle } from '../components/AIAssistantPanel';

interface NavigationItem {
  path: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  end?: boolean;
}

const pageDetails: Record<string, { eyebrow: string; title: string; description: string }> = {
  '/': { eyebrow: 'Рабочее пространство', title: 'Операционный центр', description: 'Состояние интеграций и последние события' },
  '/rules': { eyebrow: 'Маршрутизация', title: 'Webhook', description: 'Правила обработки входящих событий' },
  '/polling': { eyebrow: 'Автоматизация', title: 'Пуллинг', description: 'Периодические запросы и условия запуска' },
  '/integrations': { eyebrow: 'Оркестрация', title: 'Интеграции', description: 'Связи между внешними системами' },
  '/telegram': { eyebrow: 'Каналы', title: 'Telegram', description: 'Боты, AI-сценарии и напоминания' },
  '/testing': { eyebrow: 'Инструменты', title: 'Тестирование', description: 'Проверка условий и отправки сообщений' },
  '/accounts': { eyebrow: 'Администрирование', title: 'Аккаунты', description: 'Изолированные рабочие пространства' },
  '/users': { eyebrow: 'Администрирование', title: 'Пользователи', description: 'Доступы, роли и безопасность' },
};

export function Dashboard() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const { addToast } = useToast();

  const canEdit = user?.role !== 'auditor';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [accountTokenModalOpen, setAccountTokenModalOpen] = useState(false);
  const [accountTokenValue, setAccountTokenValue] = useState('');
  const [accountTokenMasked, setAccountTokenMasked] = useState('');
  const [accountTokenIsSet, setAccountTokenIsSet] = useState(false);
  const [accountTokenLoading, setAccountTokenLoading] = useState(false);
  const [accountTokenSaving, setAccountTokenSaving] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark-theme'));
  const versionRef = useRef<HTMLDivElement>(null);
  const appVersion = __APP_VERSION__;

  const buildDateText = useMemo(() => {
    const buildDate = new Date(__BUILD_DATE__);
    if (Number.isNaN(buildDate.getTime())) return __BUILD_DATE__;
    return buildDate.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }, []);

  const canCreate = canEdit && ['/rules', '/polling', '/integrations', '/telegram', '/users'].includes(location.pathname);
  const currentPage = pageDetails[location.pathname] || pageDetails['/'];

  const navItems = useMemo<NavigationItem[]>(() => {
    const items: NavigationItem[] = [
      { path: '/', label: 'Главная', description: 'Обзор системы', icon: <Activity size={19} />, end: true },
      { path: '/rules', label: 'Webhook', description: 'Входящие события', icon: <MessageSquare size={19} /> },
      { path: '/polling', label: 'Пуллинг', description: 'Периодические задачи', icon: <Repeat2 size={19} /> },
      { path: '/integrations', label: 'Интеграции', description: 'Связи сервисов', icon: <LinkIcon size={19} /> },
      { path: '/telegram', label: 'Telegram', description: 'Боты и сообщения', icon: <Send size={19} /> },
    ];
    if (user?.isVadmin) {
      items.push({ path: '/accounts', label: 'Аккаунты', description: 'Рабочие пространства', icon: <Building2 size={19} /> });
    }
    items.push({ path: '/users', label: 'Пользователи', description: 'Роли и доступы', icon: <Users size={19} /> });
    return items;
  }, [user?.isVadmin]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (versionRef.current && !versionRef.current.contains(event.target as Node)) setShowVersionPanel(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setShowVersionPanel(false);
        setAccountTokenModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('nav-open', mobileMenuOpen);
    return () => document.body.classList.remove('nav-open');
  }, [mobileMenuOpen]);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark-theme');
    const dark = document.documentElement.classList.contains('dark-theme');
    setIsDark(dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  };

  const handleCreate = () => {
    if (!canCreate) return;
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
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
      addToast(accountTokenValue.trim() ? 'Токен аккаунта сохранён' : 'Токен аккаунта очищен', 'success');
      await loadAccountBotToken();
      setAccountTokenModalOpen(false);
    } catch (error: any) {
      addToast(error.message || 'Не удалось сохранить токен аккаунта', 'error');
    } finally {
      setAccountTokenSaving(false);
    }
  };

  useEffect(() => {
    if (accountTokenModalOpen) loadAccountBotToken();
  }, [accountTokenModalOpen]);

  useEffect(() => {
    if (!isLoading && !user) navigate('/login', { replace: true });
  }, [isLoading, navigate, user]);

  if (isLoading || !user) {
    return (
      <div className="app-loading" role="status" aria-label="Загрузка приложения">
        <div className="app-loading-mark"><Send size={22} /></div>
        <div className="app-loading-bar"><span /></div>
      </div>
    );
  }

  return (
    <AiAssistantProvider>
      <div className="app-shell app-shell-v2">
        <button
          type="button"
          className={`mobile-nav-backdrop ${mobileMenuOpen ? 'is-visible' : ''}`}
          aria-label="Закрыть меню"
          onClick={() => setMobileMenuOpen(false)}
        />

        <aside className={`sidebar sidebar-v2 ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Основная навигация">
          <div className="sidebar-brand-v2">
            <div className="brand-mark"><img src="/vadminlink-logo.png.jpg" alt="" /></div>
            <div className="brand-copy"><strong>VadminLink</strong><span>Integration hub</span></div>
            <button type="button" className="sidebar-close" onClick={() => setMobileMenuOpen(false)} aria-label="Закрыть меню"><X size={20} /></button>
          </div>

          <div className="sidebar-section-label">Рабочее пространство</div>
          <nav className="sidebar-nav sidebar-nav-v2" aria-label="Разделы панели">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `sidebar-item sidebar-item-v2 ${isActive ? 'sidebar-item-active' : ''}`}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                <span className="sidebar-item-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                <ChevronRight className="sidebar-item-chevron" size={16} />
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-account">
            <div className="sidebar-avatar">{(user.name || user.username).slice(0, 1).toUpperCase()}</div>
            <div className="sidebar-account-copy">
              <strong>{user.name || user.username}</strong>
              <span>{user.role === 'auditor' ? 'Аудитор' : user.isVadmin ? 'Vadmin' : 'Администратор'}</span>
            </div>
            {canEdit && <button type="button" className="sidebar-account-action" onClick={() => setAccountTokenModalOpen(true)} aria-label="Telegram-токен аккаунта"><KeyRound size={17} /></button>}
            <button type="button" className="sidebar-account-action" onClick={() => setShowPasswordModal(true)} aria-label="Сменить пароль"><Lock size={17} /></button>
            <button type="button" className="sidebar-account-action" onClick={handleLogout} aria-label="Выйти"><LogOut size={17} /></button>
          </div>
        </aside>

        <div className="app-page app-page-v2">
          <header className="topbar topbar-v2">
            <button type="button" className="mobile-menu-trigger" onClick={() => setMobileMenuOpen(true)} aria-label="Открыть меню" aria-expanded={mobileMenuOpen}><Menu size={20} /></button>
            <div className="topbar-context">
              <span>{currentPage.eyebrow}</span>
              <strong>{currentPage.title}</strong>
            </div>
            <GlobalSearch />
            <div className="topbar-actions">
              {canCreate && (
                <button className="create-button" title="Создать" onClick={handleCreate} aria-label="Создать">
                  <Plus size={17} /><span>Создать</span>
                </button>
              )}
              <button className="icon-button" onClick={() => navigate('/?tab=history')} title="Последние события" aria-label="Последние события"><Bell size={17} /></button>
              <NavLink to="/testing" className={({ isActive }) => `icon-button ${isActive ? 'is-active' : ''}`} title="Тестирование" aria-label="Тестирование"><FlaskConical size={17} /></NavLink>
              <div ref={versionRef} className="version-anchor">
                <button className="icon-button desktop-only-btn" title="О приложении" onClick={() => setShowVersionPanel((value) => !value)} aria-label="О приложении" aria-expanded={showVersionPanel} aria-controls="version-panel"><Info size={17} /></button>
                {showVersionPanel && (
                  <div className="version-panel" id="version-panel" role="dialog" aria-label="Информация о приложении">
                    <div className="version-panel-title"><span className="brand-dot" />VadminLink</div>
                    <div className="version-panel-row"><span className="version-panel-label">Версия</span><span className="version-panel-value">{appVersion}</span></div>
                    <div className="version-panel-row"><span className="version-panel-label">Сборка</span><span className="version-panel-value">{buildDateText}</span></div>
                  </div>
                )}
              </div>
              <button onClick={toggleTheme} className="icon-button theme-toggle" aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}>{isDark ? <Sun size={17} /> : <Moon size={17} />}</button>
              {canEdit && <button onClick={() => setAccountTokenModalOpen(true)} className="icon-button desktop-only-btn" title="Telegram-токен аккаунта" aria-label="Telegram-токен аккаунта"><KeyRound size={17} /></button>}
            </div>
          </header>

          <main className="content-area content-area-v2" id="main-content">
            <div className="content-inner">{location.pathname === '/' ? <Operations /> : <Outlet />}</div>
          </main>
        </div>

        {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}

        {accountTokenModalOpen && (
          <div className="modal-overlay" onClick={() => setAccountTokenModalOpen(false)}>
            <div className="modal-content token-modal" role="dialog" aria-modal="true" aria-labelledby="token-modal-title" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div><span className="modal-eyebrow">Telegram</span><h3 id="token-modal-title">Токен аккаунта</h3></div>
                <button onClick={() => setAccountTokenModalOpen(false)} className="icon-button" aria-label="Закрыть"><X size={16} /></button>
              </div>
              <div className="modal-body">
                <p className="modal-description">Используется по умолчанию в правилах, пуллинге, интеграциях и ботах, если локальный токен не указан.</p>
                <div className="token-current">
                  <span>Текущий токен</span>
                  {accountTokenLoading ? <strong>Загрузка…</strong> : accountTokenIsSet ? <code>{accountTokenMasked}</code> : <strong>Не задан</strong>}
                </div>
                <label className="form-label-simple" htmlFor="account-token">Новый токен</label>
                <input id="account-token" className="input-field input-field-mono" value={accountTokenValue} onChange={(event) => setAccountTokenValue(event.target.value)} placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ" autoComplete="off" />
                <p className="form-hint">Оставьте поле пустым, чтобы удалить сохранённый токен.</p>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setAccountTokenModalOpen(false)} className="btn-secondary">Отмена</button>
                <button type="button" onClick={handleSaveAccountBotToken} disabled={accountTokenSaving} className="btn-primary">{accountTokenSaving ? 'Сохранение…' : 'Сохранить'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <AiAssistantToggle />
    </AiAssistantProvider>
  );
}
