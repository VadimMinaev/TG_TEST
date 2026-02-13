import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, User, Account } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Plus, Search, Trash2, UserRound } from 'lucide-react';
import { Breadcrumb } from '../components/Breadcrumb';

type Mode = 'view' | 'create' | 'profile';

export function Users() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('view');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAccountId, setNewAccountId] = useState<number | ''>('');
  const [newRole, setNewRole] = useState<'administrator' | 'auditor'>('administrator');

  const [profileUsername, setProfileUsername] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileOldPassword, setProfileOldPassword] = useState('');

  const isVadmin = user?.isVadmin;
  const canManageUsers = isVadmin || (user?.role === 'administrator' && user?.accountId != null);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.username} ${u.account_name || ''} ${u.role || ''} ${u.id}`.toLowerCase().includes(q));
  }, [users, searchQuery]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (mode === 'create' && !user?.isVadmin && user?.accountId != null) {
      setNewAccountId(user.accountId);
    }
  }, [mode, user?.isVadmin, user?.accountId]);

  useEffect(() => {
    if (user?.isVadmin) {
      loadUsers();
      api.getAccounts().then(setAccounts).catch(() => {});
    } else if (user?.accountId != null || user?.userId != null) {
      loadUsers();
    }
  }, [user]);

  useEffect(() => {
    if (searchParams.get('create') === 'true' && canManageUsers) setMode('create');
    if (searchParams.get('profile') === 'true' && !isVadmin) setMode('profile');
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, canManageUsers, isVadmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
      if (data.length > 0 && selectedUserId == null) setSelectedUserId(data[0].id);
    } catch (error: any) {
      setMessage({ text: error?.message || 'Ошибка загрузки пользователей', type: 'error' });
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
      const created = await api.createUser(newUsername, newPassword, Number(accountId), newRole);
      setMessage({ text: 'Пользователь создан', type: 'success' });
      setNewUsername('');
      setNewPassword('');
      setMode('view');
      await loadUsers();
      if (created?.id) setSelectedUserId(created.id);
    } catch (error: any) {
      setMessage({ text: error?.message || 'Ошибка создания пользователя', type: 'error' });
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Удалить этого пользователя?')) return;
    try {
      await api.deleteUser(id);
      setMessage({ text: 'Пользователь удален', type: 'success' });
      if (selectedUserId === id) setSelectedUserId(null);
      await loadUsers();
    } catch (error: any) {
      setMessage({ text: error?.message || 'Ошибка удаления пользователя', type: 'error' });
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
      setMode('view');
    } catch (error: any) {
      setMessage({ text: error?.message || 'Ошибка обновления профиля', type: 'error' });
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold">Пользователи</h2>
            <div className="mt-1">
              <Breadcrumb
                items={[
                  { label: 'Главная', path: '/' },
                  { label: 'Пользователи', active: true },
                ]}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rules-search flex items-center gap-2 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm transition-all focus-within:border-[hsl(var(--ring))] focus-within:ring-2 focus-within:ring-[hsl(var(--ring)_/_0.2)]">
            <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Поиск пользователя..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </div>
          {!isVadmin && (
            <button
              onClick={() => setMode('profile')}
              className={`icon-button ${mode === 'profile' ? 'bg-[hsl(var(--accent))]' : ''}`}
              title="Мой профиль"
            >
              <UserRound className="h-4 w-4" />
            </button>
          )}
          {canManageUsers && (
            <button
              onClick={() => setMode('create')}
              className={`icon-button ${mode === 'create' ? 'bg-[hsl(var(--accent))]' : ''}`}
              title="Создать пользователя"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mx-4 mt-4 rounded border p-3 text-sm ${
            message.type === 'success'
              ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
              : 'border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="split-layout p-6">
        <div className="split-left">
          <div className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Список пользователей</h3>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{filteredUsers.length} записей</span>
            </div>
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Пользователи не найдены</p>
            ) : (
              <div className="entity-list-scroll scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">Логин</th>
                      <th className="px-2 py-2">Роль</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setMode('view');
                        }}
                        className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                          selectedUserId === u.id && mode === 'view' ? 'bg-[hsl(var(--accent))]' : ''
                        }`}
                      >
                        <td className="px-2 py-2">
                          <div className="font-medium text-xs">{u.username}</div>
                          <div className="text-[10px] text-[hsl(var(--muted-foreground))]">#{u.id}</div>
                        </td>
                        <td className="px-2 py-2 text-xs">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              u.role === 'auditor'
                                ? 'bg-[hsl(var(--muted)_/_0.4)] text-[hsl(var(--muted-foreground))]'
                                : 'bg-[hsl(var(--primary)_/_0.15)] text-[hsl(var(--primary))]'
                            }`}
                          >
                            {u.role === 'auditor' ? 'Аудитор' : 'Администратор'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          <div className="panel">
            {mode === 'create' && canManageUsers ? (
              <form onSubmit={handleCreateUser} className="space-y-4">
                <h3 className="text-base font-semibold">Создать пользователя</h3>
                <div>
                  <label className="mb-1 block text-sm font-medium">Логин</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="username"
                    required
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Пароль</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  />
                </div>
                {isVadmin && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">Аккаунт</label>
                    <select
                      value={newAccountId}
                      onChange={(e) => setNewAccountId(e.target.value ? Number(e.target.value) : '')}
                      required
                      className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                    >
                      <option value="">— выберите —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium">Роль</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'administrator' | 'auditor')}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  >
                    <option value="administrator">Администратор</option>
                    <option value="auditor">Аудитор</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] hover:opacity-90"
                  >
                    Создать
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('view')}
                    className="rounded border border-[hsl(var(--border))] px-4 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : mode === 'profile' && !isVadmin ? (
              <form onSubmit={handleUpdateMe} className="space-y-4">
                <h3 className="text-base font-semibold">Мой профиль</h3>
                <div>
                  <label className="mb-1 block text-sm font-medium">Новый логин</label>
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    placeholder={user?.username}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Текущий пароль (для смены пароля)</label>
                  <input
                    type="password"
                    value={profileOldPassword}
                    onChange={(e) => setProfileOldPassword(e.target.value)}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Новый пароль</label>
                  <input
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] hover:opacity-90"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('view')}
                    className="rounded border border-[hsl(var(--border))] px-4 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : selectedUser ? (
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Просмотр пользователя</h3>
                <div>
                  <strong>Логин:</strong> <span className="font-medium">{selectedUser.username}</span>
                </div>
                <div>
                  <strong>ID:</strong>{' '}
                  <code className="rounded bg-[hsl(var(--muted)_/_0.5)] px-2 py-1 text-xs">#{selectedUser.id}</code>
                </div>
                <div>
                  <strong>Роль:</strong>{' '}
                  {selectedUser.role === 'auditor' ? 'Аудитор' : 'Администратор'}
                </div>
                {selectedUser.account_name && (
                  <div>
                    <strong>Аккаунт:</strong> {selectedUser.account_name}
                  </div>
                )}
                <div>
                  <strong>Создан:</strong>{' '}
                  {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString('ru-RU') : '—'}
                </div>
                {canManageUsers && selectedUser.id !== user?.userId && (
                  <div className="pt-2">
                    <button
                      onClick={() => handleDeleteUser(selectedUser.id)}
                      className="inline-flex items-center gap-2 rounded border border-[hsl(var(--destructive)_/_0.4)] px-3 py-2 text-sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Удалить пользователя
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-16 text-center text-[hsl(var(--muted-foreground))]">
                Выберите пользователя слева
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
