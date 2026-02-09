import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, User, Account } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Plus, Trash2, X } from 'lucide-react';

export function Users() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAccountId, setNewAccountId] = useState<number | ''>('');
  const [newRole, setNewRole] = useState<'administrator' | 'auditor'>('administrator');

  // For account admin: when opening create form, set current account
  useEffect(() => {
    if (showCreateForm && !user?.isVadmin && user?.accountId != null) setNewAccountId(user.accountId);
  }, [showCreateForm, user?.isVadmin, user?.accountId]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileUsername, setProfileUsername] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileOldPassword, setProfileOldPassword] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (user?.isVadmin) {
      loadUsers();
      api.getAccounts().then(setAccounts).catch(() => {});
    } else if (user?.accountId != null || user?.userId != null) {
      loadUsers();
    }
  }, [user]);

  useEffect(() => {
    if (searchParams.get('create') === 'true') setShowCreateForm(true);
    if (searchParams.get('profile') === 'true') setShowProfile(true);
    setSearchParams({}, { replace: true });
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
    const accountId = user?.isVadmin ? newAccountId : (user?.accountId ?? null);
    if (accountId === '' || accountId == null) {
      setMessage({ text: 'Выберите аккаунт', type: 'error' });
      return;
    }
    try {
      await api.createUser(newUsername, newPassword, Number(accountId), newRole);
      setMessage({ text: 'Пользователь создан', type: 'success' });
      setNewUsername('');
      setNewPassword('');
      setShowCreateForm(false);
      loadUsers();
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Удалить этого пользователя?')) return;
    try {
      await api.deleteUser(id);
      setMessage({ text: 'Пользователь удален', type: 'success' });
      loadUsers();
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const handleUpdateMe = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const payload: { username?: string; password?: string; oldPassword?: string } = {};
    if (profileUsername.trim()) payload.username = profileUsername.trim();
    if (profilePassword) {
      payload.password = profilePassword;
      payload.oldPassword = profileOldPassword;
    }
    if (Object.keys(payload).length === 0) {
      setMessage({ text: 'Введите новый логин и/или пароль', type: 'error' });
      return;
    }
    try {
      await api.updateMe(payload);
      setMessage({ text: 'Профиль обновлен', type: 'success' });
      setProfileUsername('');
      setProfilePassword('');
      setProfileOldPassword('');
      setShowProfile(false);
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const isVadmin = user?.isVadmin;
  const canManageUsers = isVadmin || (user?.role === 'administrator' && user?.accountId != null);

  return (
    <div className="space-y-4">
      {!isVadmin && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-xl font-semibold">Мой профиль</h2>
            <button
              type="button"
              onClick={() => setShowProfile(!showProfile)}
              className="rounded border border-[hsl(var(--border))] px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
            >
              {showProfile ? 'Скрыть' : 'Изменить логин / пароль'}
            </button>
          </div>
          {showProfile && (
            <div className="p-4 border-t border-[hsl(var(--border))]">
              {message && (
                <div
                  className={`mb-3 rounded border p-2 text-sm ${
                    message.type === 'success'
                      ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                      : 'border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                  }`}
                >
                  {message.text}
                </div>
              )}
              <form onSubmit={handleUpdateMe} className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Новый логин</label>
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    placeholder={user?.username}
                    className="w-full max-w-xs rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Текущий пароль (если меняете пароль)</label>
                  <input
                    type="password"
                    value={profileOldPassword}
                    onChange={(e) => setProfileOldPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full max-w-xs rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Новый пароль</label>
                  <input
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full max-w-xs rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  />
                </div>
                <button type="submit" className="rounded bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] hover:opacity-90">
                  Сохранить
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {showCreateForm && canManageUsers && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-xl font-semibold">Создать пользователя</h2>
            <button onClick={() => setShowCreateForm(false)} className="rounded p-1 hover:bg-[hsl(var(--accent))]">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4 border-t border-[hsl(var(--border))]">
            {message && (
              <div
                className={`mb-3 rounded border p-2 text-sm ${
                  message.type === 'success'
                    ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                    : 'border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                }`}
              >
                {message.text}
              </div>
            )}
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Логин</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="username"
                  required
                  className="w-full max-w-xs rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Пароль</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••"
                  required
                  className="w-full max-w-xs rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                />
              </div>
              {isVadmin && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Аккаунт</label>
                  <select
                    value={newAccountId}
                    onChange={(e) => setNewAccountId(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full max-w-xs rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  >
                    <option value="">— выберите —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Роль</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'administrator' | 'auditor')}
                  className="w-full max-w-xs rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                >
                  <option value="administrator">Администратор</option>
                  <option value="auditor">Аудитор</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="rounded bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] hover:opacity-90">
                  Создать
                </button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="rounded border px-4 py-2 text-sm hover:bg-[hsl(var(--accent))]">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">Пользователи</h2>
          {canManageUsers && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="icon-button"
              title="Создать пользователя"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="p-4">
          {message && !showCreateForm && !showProfile && (
            <div
              className={`mb-3 rounded border p-2 text-sm ${
                message.type === 'success'
                  ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                  : 'border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
              }`}
            >
              {message.text}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {isVadmin && (
                <div className="flex items-center justify-between rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4">
                  <div>
                    <div className="font-semibold">vadmin</div>
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">Системный администратор</div>
                  </div>
                </div>
              )}
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4"
                >
                  <div>
                    <div className="font-semibold">{u.username}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                      {u.account_name && <span>Аккаунт: {u.account_name}</span>}
                      {u.role && <span className="rounded bg-[hsl(var(--primary)_/_0.15)] px-1.5 py-0.5 text-xs">{u.role === 'auditor' ? 'Аудитор' : 'Администратор'}</span>}
                      {u.created_at && <span>{new Date(u.created_at).toLocaleString('ru-RU')}</span>}
                    </div>
                  </div>
                  {canManageUsers && u.id !== user?.userId && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {users.length === 0 && !isVadmin && (
                <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">В вашем аккаунте нет других пользователей</p>
              )}
              {users.length === 0 && isVadmin && (
                <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Нет пользователей в БД</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
