import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, User } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Plus, Trash2, X } from 'lucide-react';

export function Users() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.username === 'vadmin') {
      loadUsers();
    }
  }, [user]);

  // Проверяем параметр create в URL
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      await api.createUser(newUsername, newPassword);
      setMessage({ text: 'Пользователь успешно создан', type: 'success' });
      setNewUsername('');
      setNewPassword('');
      setShowCreateForm(false);
      loadUsers();
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;

    try {
      await api.deleteUser(id);
      setMessage({ text: 'Пользователь успешно удален', type: 'success' });
      loadUsers();
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  if (user?.username !== 'vadmin') {
    return (
      <div className="card">
        <div className="card-body">
        <p className="text-center text-[hsl(var(--destructive))]">
          У вас нет доступа к этому разделу. Только vadmin может управлять пользователями.
        </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showCreateForm && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-xl font-semibold">👤 Создать нового пользователя</h2>
            <button
              onClick={() => setShowCreateForm(false)}
              className="rounded-full p-1 transition-colors hover:bg-[hsl(var(--accent))]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="card-body">
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

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Логин</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="username"
                  required
                  className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Пароль</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••"
                  required
                  className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
                >
                  Создать пользователя
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 rounded bg-[hsl(var(--secondary))] px-4 py-2 font-semibold text-[hsl(var(--secondary-foreground))] transition-all hover:bg-[hsl(var(--accent))]"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">👥 Пользователи</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-3 py-2 text-sm text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
          >
            <Plus className="h-4 w-4" />
            Создать пользователя
          </button>
        </div>

        <div className="card-body">
          {message && !showCreateForm && (
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
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded border border-[hsl(var(--border)_/_0.8)] bg-[hsl(var(--muted))] p-4">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    👤 vadmin <span className="text-xs text-[hsl(var(--primary))]">(системный пользователь)</span>
                  </div>
                  <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Системный пользователь</div>
                </div>
              </div>

              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded border border-[hsl(var(--border)_/_0.8)] bg-[hsl(var(--muted))] p-4"
                >
                  <div>
                    <div className="font-semibold">👤 {u.username}</div>
                    {u.created_at && (
                      <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                        📅 Создан: {new Date(u.created_at).toLocaleString('ru-RU')}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="flex items-center gap-2 rounded bg-[hsl(var(--destructive))] px-3 py-1 text-sm text-[hsl(var(--destructive-foreground))] transition-all hover:bg-[hsl(var(--destructive)_/_0.9)]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </button>
                </div>
              ))}

              {users.length === 0 && (
                <p className="py-10 text-center text-[hsl(var(--muted-foreground))]">
                  Нет дополнительных пользователей
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
