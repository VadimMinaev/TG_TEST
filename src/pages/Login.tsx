import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, Shield, Send, Zap } from 'lucide-react';
import { StarWarsCrawl } from '../components/StarWarsCrawl';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="login-page">
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-bg-orb login-bg-orb-3" />
      <div className="login-grid-overlay" />

      <StarWarsCrawl />

      <div className="login-container animate-fade-in-up">
        <div className="login-header">
          <div className="login-logo">
            <Send className="login-logo-icon" />
          </div>
          <h1 className="login-title">
            <span className="login-title-text">Vadmin</span>
            <span className="login-title-highlight">Link</span>
          </h1>
          <p className="login-subtitle">Integration Platform</p>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <Shield className="login-card-icon" />
            <span>Авторизация</span>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <span aria-hidden="true">⚠️</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="username" className="login-label">
                Логин
              </label>
              <div className="login-input-wrapper">
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Введите логин"
                  required
                  className="login-input"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="password" className="login-label">
                Пароль
              </label>
              <div className="login-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  required
                  className="login-input login-input-password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="login-submit"
            >
              {isLoading ? (
                <span className="login-spinner" />
              ) : (
                <>
                  <Zap size={18} />
                  Войти
                </>
              )}
            </button>
          </form>
        </div>

        <div className="login-footer">
          <span>© 2026 VadminLink</span>
          <span className="login-footer-dot" aria-hidden="true">•</span>
          <span>Secure Access</span>
        </div>
      </div>
    </div>
  );
}
