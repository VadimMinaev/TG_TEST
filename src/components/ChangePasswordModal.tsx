import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';
import { X } from 'lucide-react';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ text: 'Новые пароли не совпадают', type: 'error' });
      return;
    }

    if (user?.username === 'vadmin') {
      setMessage({
        text: 'Для vadmin смена пароля через интерфейс не поддерживается. Используйте переменные окружения.',
        type: 'error',
      });
      return;
    }

    try {
      await api.changePassword(user!.userId as number, oldPassword, newPassword);
      setMessage({ text: 'Пароль успешно изменен', type: 'success' });
      setTimeout(() => onClose(), 1500);
    } catch (error: any) {
      setMessage({ text: error.message || 'Ошибка смены пароля', type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-[hsl(var(--border)_/_0.7)] bg-[hsl(var(--card)_/_0.95)] shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">🔐 Сменить пароль</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 transition-colors hover:bg-[hsl(var(--accent))]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {message && (
            <div
              className={`mb-4 animate-fade-in rounded border p-3 text-sm ${
                message.type === 'success'
                  ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                  : 'border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="oldPassword" className="mb-2 block text-sm font-medium">
              Текущий пароль
            </label>
            <input
              type="password"
              id="oldPassword"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••"
              required
              className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="newPassword" className="mb-2 block text-sm font-medium">
              Новый пароль
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••"
              required
              className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium">
              Подтвердите новый пароль
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••"
              required
              className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
            >
              Изменить пароль
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded bg-[hsl(var(--secondary))] px-4 py-2 font-semibold text-[hsl(var(--secondary-foreground))] transition-all hover:bg-[hsl(var(--accent))]"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
