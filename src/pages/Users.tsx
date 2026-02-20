import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, User, Account } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Eye, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { useToast } from '../components/ToastNotification';

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
  const { addToast } = useToast();

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
      addToast(error?.message || 'Ошибка загрузки пользователей', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear message is no longer needed with toast system
    const accountId = user?.isVadmin ? newAccountId : (user?.accountId ?? null);
    if (accountId === '' || accountId == null) {
      addToast('Выберите аккаунт', 'error');
      return;
    }
    try {
      const created = await api.createUser(newUsername, newPassword, Number(accountId), newRole);
      addToast('Пользователь создан', 'success');
      setNewUsername('');
      setNewPassword('');
      setMode('view');
      await loadUsers();
      if (created?.id) setSelectedUserId(created.id);
    } catch (error: any) {
      addToast(error?.message || 'Ошибка создания пользователя', 'error');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Удалить этого пользователя?')) return;
    try {
      await api.deleteUser(id);
      addToast('Пользователь удален', 'success');
      if (selectedUserId === id) setSelectedUserId(null);
      await loadUsers();
    } catch (error: any) {
      addToast(error?.message || 'Ошибка удаления пользователя', 'error');
    }
  };

  const handleUpdateMe = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear message is no longer needed with toast system
    const payload: { username?: string; password?: string; oldPassword?: string } = {};
    if (profileUsername.trim()) payload.username = profileUsername.trim();
    if (profilePassword) {
      payload.password = profilePassword;
      payload.oldPassword = profileOldPassword;
    }
    if (Object.keys(payload).length === 0) {
      addToast('Введите новый логин и/или пароль', 'error');
      return;
    }
    try {
      await api.updateMe(payload);
      addToast('Профиль обновлен', 'success');
      setProfileUsername('');
      setProfilePassword('');
      setProfileOldPassword('');
      setMode('view');
    } catch (error: any) {
      addToast(error?.message || 'Ошибка обновления профиля', 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold">Пользователи</h2>
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
          {canManageUsers && selectedUser && selectedUser.id !== user?.userId && mode === 'view' && (
            <>
              <button
                onClick={() => handleDeleteUser(selectedUser.id)}
                className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                title="Удалить пользователя"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />
            </>
          )}
        </div>
      </div>


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
          <div className="panel users-entity-panel">
            {mode === 'create' && canManageUsers ? (
              <form onSubmit={handleCreateUser} className="entity-edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 className="mb-4 text-lg font-semibold">Создать пользователя</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Логин *</label>
                    <input
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="username"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Пароль *</label>
                    <input
                      type="password"
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Введите пароль"
                      required
                    />
                  </div>
                </div>
                {isVadmin && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Аккаунт *</label>
                    <select
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                      value={newAccountId}
                      onChange={(e) => setNewAccountId(e.target.value ? Number(e.target.value) : '')}
                      required
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
                  <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Роль</label>
                  <select
                    style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'administrator' | 'auditor')}
                  >
                    <option value="administrator">Администратор</option>
                    <option value="auditor">Аудитор</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="submit"
                    style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}
                  >
                    Сохранить пользователя
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('view')}
                    style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : mode === 'profile' && !isVadmin ? (
              <form onSubmit={handleUpdateMe} className="users-form space-y-5">
                <h3 className="text-xl font-semibold">Мой профиль</h3>
                <div className="users-field">
                  <label className="mb-2 block text-sm font-semibold">Новый логин</label>
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    placeholder={user?.username}
                    className="users-input"
                  />
                </div>
                <div className="users-field">
                  <label className="mb-2 block text-sm font-semibold">Текущий пароль</label>
                  <input
                    type="password"
                    value={profileOldPassword}
                    onChange={(e) => setProfileOldPassword(e.target.value)}
                    className="users-input"
                  />
                </div>
                <div className="users-field">
                  <label className="mb-2 block text-sm font-semibold">Новый пароль</label>
                  <input
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    className="users-input"
                  />
                </div>
                <div className="mt-2 flex gap-3">
                  <button
                    type="submit"
                    className="users-btn users-btn-primary"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('view')}
                    className="users-btn users-btn-secondary"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : selectedUser ? (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-base font-semibold">Просмотр пользователя</h3>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-[hsl(var(--muted)_/_0.3)] p-2">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">{selectedUser.username}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">ID: #{selectedUser.id}</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                    <div className="mb-2 text-xs font-medium uppercase text-[hsl(var(--muted-foreground))]">Основная информация</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Логин:</span>
                        <span className="font-medium">{selectedUser.username}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">ID:</span>
                        <code className="rounded bg-[hsl(var(--muted)_/_0.3)] px-2 py-1 text-xs">#{selectedUser.id}</code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Роль:</span>
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            selectedUser.role === 'auditor'
                              ? 'bg-[hsl(var(--muted)_/_0.4)] text-[hsl(var(--muted-foreground))]'
                              : 'bg-[hsl(var(--primary)_/_0.15)] text-[hsl(var(--primary))]'
                          }`}
                        >
                          {selectedUser.role === 'auditor' ? 'Аудитор' : 'Администратор'}
                        </span>
                      </div>
                      {selectedUser.account_name && (
                        <div className="flex justify-between">
                          <span className="text-[hsl(var(--muted-foreground))]">Аккаунт:</span>
                          <span className="font-medium">{selectedUser.account_name}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Создан:</span>
                        <span className="text-xs">
                          {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString('ru-RU') : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
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
