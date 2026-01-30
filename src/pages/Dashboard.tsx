import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router';
import { useAuth } from '../lib/auth-context';
import { Sun, Moon, LogOut, Lock } from 'lucide-react';
import { ChangePasswordModal } from '../components/ChangePasswordModal';

export function Dashboard() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

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
    { path: '/', label: '📋 Правила', icon: null },
    { path: '/testing', label: '🧪 Тестирование', icon: null },
    { path: '/history', label: '⏰ История', icon: null },
    { path: '/queue', label: '📬 Очередь сообщений', icon: null },
    { path: '/polling', label: '🔁 Пуллинг', icon: null },
    { path: '/polling-history', label: '🧾 История пуллинга', icon: null },
  ];

  if (user?.username === 'vadmin') {
    tabs.push({ path: '/users', label: '👥 Пользователи', icon: null });
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1400px] px-6 py-4">
      <header className="mx-auto mb-6 flex w-fit items-center gap-3 rounded-xl border border-[hsl(var(--border)_/_0.8)] bg-[hsl(var(--card)_/_0.85)] px-4 py-3 shadow-md backdrop-blur-sm">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          📱 Интеграция с TG 💲VadminLink
        </h1>
        
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">👤 {user?.username}</span>
          
          <button
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center gap-2 rounded border border-[hsl(var(--border)_/_0.8)] bg-[hsl(var(--secondary)_/_0.9)] px-3 py-2 text-sm transition-all hover:bg-[hsl(var(--accent))]"
          >
            <Lock className="h-4 w-4" />
            Сменить пароль
          </button>

          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--border)_/_0.8)] bg-[hsl(var(--secondary)_/_0.9)] transition-all hover:bg-[hsl(var(--accent))]"
            aria-label="Переключить тему"
          >
            <Sun className="h-5 w-5 dark-theme:hidden" />
            <Moon className="hidden h-5 w-5 dark-theme:block" />
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded border border-[hsl(var(--border)_/_0.8)] bg-[hsl(var(--secondary)_/_0.9)] px-3 py-2 text-sm transition-all hover:bg-[hsl(var(--accent))]"
          >
            <LogOut className="h-4 w-4" />
            Выход
          </button>
        </div>
      </header>

      <div className="flex gap-4">
        <nav className="flex h-fit flex-col gap-1 rounded-xl border border-[hsl(var(--border)_/_0.7)] bg-[hsl(var(--card)_/_0.85)] p-2 shadow-sm backdrop-blur-sm">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[hsl(var(--card))] font-semibold shadow-[inset_3px_0_0_hsl(var(--primary))] border border-[hsl(var(--border)_/_0.8)]'
                    : 'border border-transparent hover:bg-[hsl(var(--accent)_/_0.8)] hover:border-[hsl(var(--border)_/_0.6)]'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}
