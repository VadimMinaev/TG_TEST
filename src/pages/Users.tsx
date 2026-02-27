import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Account, User } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { useToast } from '../components/ToastNotification';

type Mode = 'view' | 'create' | 'edit' | 'profile';

function getDisplayName(user: User | null): string {
  if (!user) return '';
  return user.name && user.name.trim() ? user.name.trim() : user.username;
}

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
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAccountId, setNewAccountId] = useState<number | ''>('');
  const [newRole, setNewRole] = useState<'administrator' | 'auditor'>('administrator');

  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAccountId, setEditAccountId] = useState<number | ''>('');
  const [editRole, setEditRole] = useState<'administrator' | 'auditor'>('administrator');

  const [profileUsername, setProfileUsername] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileOldPassword, setProfileOldPassword] = useState('');

  const isVadmin = user?.isVadmin;
  const canManageUsers = isVadmin || (user?.role === 'administrator' && user?.accountId != null);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.username} ${u.name || ''} ${u.account_name || ''} ${u.role || ''} ${u.id}`.toLowerCase().includes(q));
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
    const selectParam = searchParams.get('select');
    if (selectParam) {
      const id = Number(selectParam);
      if (Number.isInteger(id) && id > 0) {
        setSelectedUserId(id);
        setMode('view');
      }
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, canManageUsers, isVadmin]);

  useEffect(() => {
    setProfileName(user?.name || '');
  }, [user?.name]);

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
    const accountId = user?.isVadmin ? newAccountId : (user?.accountId ?? null);
    if (accountId === '' || accountId == null) {
      addToast('Выберите аккаунт', 'error');
      return;
    }
    try {
      const created = await api.createUser(newUsername.trim(), newPassword, Number(accountId), newRole, newName.trim());
      addToast('Пользователь создан', 'success');
      setNewUsername('');
      setNewName('');
      setNewPassword('');
      setMode('view');
      await loadUsers();
      if (created?.id) setSelectedUserId(created.id);
    } catch (error: any) {
      addToast(error?.message || 'Ошибка создания пользователя', 'error');
    }
  };

  const startEditSelected = () => {
    if (!selectedUser) return;
    setEditUsername(selectedUser.username);
    setEditName(selectedUser.name || '');
    setEditPassword('');
    setEditRole(selectedUser.role === 'auditor' ? 'auditor' : 'administrator');
    setEditAccountId(selectedUser.account_id != null ? selectedUser.account_id : '');
    setMode('edit');
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const payload: {
      username?: string;
      password?: string;
      role?: 'administrator' | 'auditor';
      account_id?: number;
      name?: string;
    } = {};

    const nextUsername = editUsername.trim();
    if (!nextUsername) {
      addToast('Логин обязателен', 'error');
      return;
    }

    payload.username = nextUsername;
    payload.name = editName.trim();
    payload.role = editRole;
    if (editPassword.trim()) payload.password = editPassword.trim();
    if (isVadmin && editAccountId !== '') payload.account_id = Number(editAccountId);

    try {
      await api.updateUser(selectedUser.id, payload);
      addToast('Пользователь обновлен', 'success');
      setMode('view');
      await loadUsers();
      setSelectedUserId(selectedUser.id);
    } catch (error: any) {
      addToast(error?.message || 'Ошибка обновления пользователя', 'error');
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
    const payload: { username?: string; password?: string; oldPassword?: string; name?: string } = {};
    if (profileUsername.trim()) payload.username = profileUsername.trim();
    payload.name = profileName.trim();
    if (profilePassword) {
      payload.password = profilePassword;
      payload.oldPassword = profileOldPassword;
    }

    if (!payload.username && payload.name === (user?.name || '') && !payload.password) {
      addToast('Нет изменений для сохранения', 'error');
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
          <h2 className="text-xl font-semibold">Пользователи</h2>
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
            <button onClick={() => setMode('profile')} className={`icon-button ${mode === 'profile' ? 'bg-[hsl(var(--accent))]' : ''}`} title="Мой профиль">
              <UserRound className="h-4 w-4" />
            </button>
          )}
          {canManageUsers && (
            <button onClick={() => setMode('create')} className={`icon-button ${mode === 'create' ? 'bg-[hsl(var(--accent))]' : ''}`} title="Создать пользователя">
              <Plus className="h-4 w-4" />
            </button>
          )}
          {canManageUsers && selectedUser && mode === 'view' && (isVadmin || selectedUser.id !== user?.userId) && (
            <button onClick={startEditSelected} className="icon-button" title="Редактировать пользователя">
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canManageUsers && selectedUser && selectedUser.id !== user?.userId && mode === 'view' && (
            <>
              <button onClick={() => handleDeleteUser(selectedUser.id)} className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]" title="Удалить пользователя">
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
                      <th className="px-2 py-2">Пользователь</th>
                      <th className="px-2 py-2">Роль</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => { setSelectedUserId(u.id); setMode('view'); }}
                        className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                          selectedUserId === u.id && mode === 'view' ? 'bg-[hsl(var(--accent))]' : ''
                        }`}
                      >
                        <td className="px-2 py-2">
                          <div className="font-medium text-xs">{getDisplayName(u)}</div>
                          <div className="text-[10px] text-[hsl(var(--muted-foreground))]">@{u.username} · #{u.id}</div>
                        </td>
                        <td className="px-2 py-2 text-xs">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                            u.role === 'auditor'
                              ? 'bg-[hsl(var(--muted)_/_0.4)] text-[hsl(var(--muted-foreground))]'
                              : 'bg-[hsl(var(--primary)_/_0.15)] text-[hsl(var(--primary))]'
                          }`}>
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
                    <input style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="username" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Имя</label>
                    <input style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Иван Петров" />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Пароль *</label>
                    <input type="password" style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Введите пароль" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Роль</label>
                    <select style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }} value={newRole} onChange={(e) => setNewRole(e.target.value as 'administrator' | 'auditor')}>
                      <option value="administrator">Администратор</option>
                      <option value="auditor">Аудитор</option>
                    </select>
                  </div>
                </div>
                {isVadmin && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Аккаунт *</label>
                    <select style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }} value={newAccountId} onChange={(e) => setNewAccountId(e.target.value ? Number(e.target.value) : '')} required>
                      <option value="">— выберите —</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}>Сохранить пользователя</button>
                  <button type="button" onClick={() => setMode('view')} style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}>Отмена</button>
                </div>
              </form>
            ) : mode === 'edit' && canManageUsers && selectedUser ? (
              <form onSubmit={handleEditUser} className="entity-edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 className="mb-4 text-lg font-semibold">Редактировать пользователя</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Логин *</label>
                    <input style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }} value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="username" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Имя</label>
                    <input style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Иван Петров" />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Новый пароль</label>
                    <input type="password" style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Оставьте пустым, чтобы не менять" />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Роль</label>
                    <select style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }} value={editRole} onChange={(e) => setEditRole(e.target.value as 'administrator' | 'auditor')}>
                      <option value="administrator">Администратор</option>
                      <option value="auditor">Аудитор</option>
                    </select>
                  </div>
                </div>
                {isVadmin && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Аккаунт *</label>
                    <select style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }} value={editAccountId} onChange={(e) => setEditAccountId(e.target.value ? Number(e.target.value) : '')} required>
                      <option value="">— выберите —</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}>Сохранить изменения</button>
                  <button type="button" onClick={() => setMode('view')} style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}>Отмена</button>
                </div>
              </form>
            ) : mode === 'profile' && !isVadmin ? (
              <form onSubmit={handleUpdateMe} className="users-form space-y-5">
                <h3 className="text-xl font-semibold">Мой профиль</h3>
                <div className="users-field">
                  <label className="mb-2 block text-sm font-semibold">Имя</label>
                  <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Ваше имя" className="users-input" />
                </div>
                <div className="users-field">
                  <label className="mb-2 block text-sm font-semibold">Новый логин</label>
                  <input type="text" value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} placeholder={user?.username} className="users-input" />
                </div>
                <div className="users-field">
                  <label className="mb-2 block text-sm font-semibold">Текущий пароль</label>
                  <input type="password" value={profileOldPassword} onChange={(e) => setProfileOldPassword(e.target.value)} className="users-input" />
                </div>
                <div className="users-field">
                  <label className="mb-2 block text-sm font-semibold">Новый пароль</label>
                  <input type="password" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} className="users-input" />
                </div>
                <div className="mt-2 flex gap-3">
                  <button type="submit" className="users-btn users-btn-primary">Сохранить</button>
                  <button type="button" onClick={() => setMode('view')} className="users-btn users-btn-secondary">Отмена</button>
                </div>
              </form>
            ) : selectedUser ? (
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Информация о пользователе</h4>
                  <div style={{ padding: '16px' }} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                    <div style={{ marginBottom: '12px' }}>
                      <strong>ID:</strong> <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">#{selectedUser.id}</code>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Имя:</strong> {getDisplayName(selectedUser)}
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Логин:</strong> <span style={{ marginLeft: '8px' }}>@{selectedUser.username}</span>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Роль:</strong>{' '}
                      <span style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)] text-xs">
                        {selectedUser.role === 'auditor' ? 'Аудитор' : 'Администратор'}
                      </span>
                    </div>
                    {selectedUser.account_name && (
                      <div style={{ marginBottom: '12px' }}>
                        <strong>Аккаунт:</strong> {selectedUser.account_name}
                      </div>
                    )}
                    <div>
                      <strong>Создан:</strong>{' '}
                      {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString('ru-RU') : '—'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-16 text-center text-[hsl(var(--muted-foreground))]">Выберите пользователя слева</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
