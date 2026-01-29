import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError('Неверный логин или пароль');
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--info))]">
      <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border)_/_0.8)] bg-[hsl(var(--card)_/_0.92)] p-8 shadow-2xl backdrop-blur-md transition-all hover:translate-y-[-2px] hover:shadow-xl">
        <h1 className="mb-2 flex items-center justify-center gap-2 text-center text-2xl font-semibold">
          🔐 Вход
        </h1>
        <p className="mb-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          интеграция с TG
        </p>

        {error && (
          <div className="mb-4 animate-fade-in rounded border border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] p-3 text-sm text-[hsl(var(--destructive))]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="mb-2 block text-sm font-medium">
              Логин
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="login"
              required
              className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="mb-2 block text-sm font-medium">
              Пароль
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
              className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
