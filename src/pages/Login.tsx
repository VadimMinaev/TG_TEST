import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Activity, CheckCircle2, Eye, EyeOff, LockKeyhole, Send } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError('Неверный логин или пароль');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-page login-page-v2">
      <section className="login-story" aria-label="О платформе">
        <div className="login-story-glow" />
        <div className="login-brand"><span className="login-brand-mark"><Send size={22} /></span><span>Vadmin<strong>Link</strong></span></div>
        <div className="login-story-content">
          <span className="login-story-kicker"><Activity size={15} /> Integration control center</span>
          <h1>Все интеграции.<br />Один рабочий контур.</h1>
          <p>Управляйте webhook-событиями, задачами, Telegram-ботами и внешними сервисами из единого интерфейса.</p>
          <ul>
            <li><CheckCircle2 size={17} /> Изолированные аккаунты и роли доступа</li>
            <li><CheckCircle2 size={17} /> Единая история операций и ошибок</li>
            <li><CheckCircle2 size={17} /> Автоматизация без потери контроля</li>
          </ul>
        </div>
        <div className="login-story-footer"><span>VadminLink</span><span>© 2026</span></div>
      </section>

      <section className="login-access">
        <div className="login-card login-card-v2">
          <div className="login-card-header-v2">
            <div className="login-security-icon"><LockKeyhole size={21} /></div>
            <div><span>Защищённый доступ</span><h2>Вход в систему</h2></div>
          </div>
          <p className="login-card-copy">Используйте данные вашей учётной записи VadminLink.</p>

          {error && <div className="login-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="username" className="login-label">Логин</label>
              <input type="text" id="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Введите логин" required className="login-input" autoComplete="username" autoFocus />
            </div>
            <div className="login-field">
              <label htmlFor="password" className="login-label">Пароль</label>
              <div className="login-input-wrapper">
                <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Введите пароль" required className="login-input login-input-password" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="login-password-toggle" aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="login-submit">
              {isLoading ? <><span className="login-spinner" /> Проверяем…</> : <>Войти <span aria-hidden="true">→</span></>}
            </button>
          </form>
          <div className="login-help">Доступ предоставляется администратором вашей организации.</div>
        </div>
      </section>
    </main>
  );
}
