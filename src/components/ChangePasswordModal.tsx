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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="text-xl font-semibold">Сменить пароль</h2>
          <button
            onClick={onClose}
            className="icon-button"
            style={{ width: '32px', height: '32px', border: 'none' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {message && (
            <div
              className={`mb-4 animate-fade-in rounded border p-3 text-sm ${
                message.type === 'success'
                  ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.12)] text-[hsl(var(--success))]'
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
              className="input-field"
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
              className="input-field"
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
              className="input-field"
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1">
              Изменить пароль
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
