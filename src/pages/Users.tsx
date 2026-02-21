
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Account, User } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Pencil, Plus, Search, Trash2, Upload, UserRound, X } from 'lucide-react';
import { useToast } from '../components/ToastNotification';

type Mode = 'view' | 'create' | 'edit' | 'profile';

type PhotoCropFieldProps = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
};

const PREVIEW_SIZE = 220;

function UserPhotoCropField({ label, value, onChange }: PhotoCropFieldProps) {
  const [source, setSource] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(value);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPreview(value);
    setSource(null);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  }, [value]);

  useEffect(() => {
    if (!source) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = PREVIEW_SIZE;
      canvas.height = PREVIEW_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const baseScale = Math.max(PREVIEW_SIZE / image.width, PREVIEW_SIZE / image.height);
      const drawW = image.width * baseScale * zoom;
      const drawH = image.height * baseScale * zoom;
      const x = (PREVIEW_SIZE - drawW) / 2 + offsetX;
      const y = (PREVIEW_SIZE - drawH) / 2 + offsetY;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
      ctx.drawImage(image, x, y, drawW, drawH);

      const next = canvas.toDataURL('image/jpeg', 0.92);
      setPreview(next);
      onChange(next);
    };
    image.src = source;
  }, [source, zoom, offsetX, offsetY, onChange]);

  const handlePickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSource(String(reader.result || ''));
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setSource(null);
    setPreview(null);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
      <div className="mb-3 text-sm font-medium">{label}</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted)_/_0.35)]">
            {preview ? (
              <img src={preview} alt="Фото пользователя" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[hsl(var(--muted-foreground))]">
                <UserRound className="h-9 w-9" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--input))] px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Выбрать фото
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--input))] px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
              onClick={clearPhoto}
            >
              <X className="h-4 w-4" />
              Удалить
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickFile} />
          <div className="text-xs text-[hsl(var(--muted-foreground))]">Предпросмотр показывает фото так, как оно будет сохранено.</div>
        </div>

        <div className={`space-y-3 ${source ? '' : 'opacity-50'}`}>
          <div>
            <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">Масштаб</label>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} disabled={!source} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">Смещение по X</label>
            <input type="range" min={-120} max={120} step={1} value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} disabled={!source} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">Смещение по Y</label>
            <input type="range" min={-120} max={120} step={1} value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} disabled={!source} className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [newPhotoData, setNewPhotoData] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newAccountId, setNewAccountId] = useState<number | ''>('');
  const [newRole, setNewRole] = useState<'administrator' | 'auditor'>('administrator');

  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhotoData, setEditPhotoData] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editAccountId, setEditAccountId] = useState<number | ''>('');
  const [editRole, setEditRole] = useState<'administrator' | 'auditor'>('administrator');

  const [profileUsername, setProfileUsername] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePhotoData, setProfilePhotoData] = useState<string | null>(user?.photo_data || null);
  const [profilePassword, setProfilePassword] = useState('');
  const [profileOldPassword, setProfileOldPassword] = useState('');

  const isVadmin = user?.isVadmin;
  const canManageUsers = isVadmin || (user?.role === 'administrator' && user?.accountId != null);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.username} ${u.name || ''} ${u.account_name || ''} ${u.role || ''} ${u.id}`.toLowerCase().includes(q));
  }, [users, searchQuery]);

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId) || null, [users, selectedUserId]);

  useEffect(() => {
    if (mode === 'create' && !user?.isVadmin && user?.accountId != null) setNewAccountId(user.accountId);
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

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfilePhotoData(user?.photo_data || null);
  }, [user?.name, user?.photo_data]);

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
      const created = await api.createUser(newUsername.trim(), newPassword, Number(accountId), newRole, newName.trim(), newPhotoData);
      addToast('Пользователь создан', 'success');
      setNewUsername('');
      setNewName('');
      setNewPhotoData(null);
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

  const startEditSelected = () => {
    if (!selectedUser) return;
    setEditUsername(selectedUser.username);
    setEditName(selectedUser.name || '');
    setEditPhotoData(selectedUser.photo_data || null);
    setEditPassword('');
    setEditRole(selectedUser.role === 'auditor' ? 'auditor' : 'administrator');
    setEditAccountId(selectedUser.account_id != null ? selectedUser.account_id : '');
    setMode('edit');
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const payload: { username?: string; password?: string; role?: 'administrator' | 'auditor'; account_id?: number; name?: string; photo_data?: string | null } = {};

    const nextUsername = editUsername.trim();
    if (!nextUsername) {
      addToast('Логин обязателен', 'error');
      return;
    }

    payload.username = nextUsername;
    payload.name = editName.trim();
    payload.photo_data = editPhotoData || null;
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

  const handleUpdateMe = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: { username?: string; password?: string; oldPassword?: string; name?: string; photo_data?: string | null } = {};
    if (profileUsername.trim()) payload.username = profileUsername.trim();
    payload.name = profileName.trim();
    payload.photo_data = profilePhotoData || null;
    if (profilePassword) {
      payload.password = profilePassword;
      payload.oldPassword = profileOldPassword;
    }

    if (!payload.username && payload.name === (user?.name || '') && payload.photo_data === (user?.photo_data || null) && !payload.password) {
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
        <div className="flex flex-col gap-2"><h2 className="text-xl font-semibold">Пользователи</h2></div>
        <div className="flex items-center gap-2">
          <div className="rules-search flex items-center gap-2 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm transition-all focus-within:border-[hsl(var(--ring))] focus-within:ring-2 focus-within:ring-[hsl(var(--ring)_/_0.2)]">
            <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input type="text" placeholder="Поиск пользователя..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-56 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]" />
          </div>
          {!isVadmin && <button onClick={() => setMode('profile')} className={`icon-button ${mode === 'profile' ? 'bg-[hsl(var(--accent))]' : ''}`} title="Мой профиль"><UserRound className="h-4 w-4" /></button>}
          {canManageUsers && <button onClick={() => setMode('create')} className={`icon-button ${mode === 'create' ? 'bg-[hsl(var(--accent))]' : ''}`} title="Создать пользователя"><Plus className="h-4 w-4" /></button>}
          {canManageUsers && selectedUser && mode === 'view' && (isVadmin || selectedUser.id !== user?.userId) && <button onClick={startEditSelected} className="icon-button" title="Редактировать пользователя"><Pencil className="h-4 w-4" /></button>}
          {canManageUsers && selectedUser && selectedUser.id !== user?.userId && mode === 'view' && (
            <>
              <button onClick={() => handleDeleteUser(selectedUser.id)} className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]" title="Удалить пользователя"><Trash2 className="h-4 w-4" /></button>
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
              <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" /></div>
            ) : filteredUsers.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Пользователи не найдены</p>
            ) : (
              <div className="entity-list-scroll scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead><tr className="border-b border-[hsl(var(--border))] text-left text-xs"><th className="px-2 py-2">Пользователь</th><th className="px-2 py-2">Роль</th></tr></thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} onClick={() => { setSelectedUserId(u.id); setMode('view'); }} className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${selectedUserId === u.id && mode === 'view' ? 'bg-[hsl(var(--accent))]' : ''}`}>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 overflow-hidden rounded-full bg-[hsl(var(--muted)_/_0.35)]">
                              {u.photo_data ? <img src={u.photo_data} alt={u.username} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[hsl(var(--muted-foreground))]"><UserRound className="h-4 w-4" /></div>}
                            </div>
                            <div>
                              <div className="font-medium text-xs">{getDisplayName(u)}</div>
                              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">@{u.username} · #{u.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs"><span className={`rounded px-1.5 py-0.5 text-[10px] ${u.role === 'auditor' ? 'bg-[hsl(var(--muted)_/_0.4)] text-[hsl(var(--muted-foreground))]' : 'bg-[hsl(var(--primary)_/_0.15)] text-[hsl(var(--primary))]'}`}>{u.role === 'auditor' ? 'Аудитор' : 'Администратор'}</span></td>
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
                <h3 className="mb-2 text-lg font-semibold">Создать пользователя</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Логин *</label><input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="username" required /></div>
                  <div><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Имя</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Иван Петров" /></div>
                  <div><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Пароль *</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Введите пароль" required /></div>
                  <div><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Роль</label><select value={newRole} onChange={(e) => setNewRole(e.target.value as 'administrator' | 'auditor')}><option value="administrator">Администратор</option><option value="auditor">Аудитор</option></select></div>
                </div>
                {isVadmin && <div><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Аккаунт *</label><select value={newAccountId} onChange={(e) => setNewAccountId(e.target.value ? Number(e.target.value) : '')} required><option value="">— выберите —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
                <UserPhotoCropField label="Фото пользователя" value={newPhotoData} onChange={setNewPhotoData} />
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" style={{ flex: 1, border: 'none', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>Сохранить пользователя</button>
                  <button type="button" onClick={() => setMode('view')} style={{ flex: 1, border: 'none', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}>Отмена</button>
                </div>
              </form>
            ) : mode === 'edit' && canManageUsers && selectedUser ? (
              <form onSubmit={handleEditUser} className="entity-edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 className="mb-2 text-lg font-semibold">Редактировать пользователя</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Логин *</label><input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="username" required /></div>
                  <div><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Имя</label><input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Иван Петров" /></div>
                  <div><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Новый пароль</label><input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Оставьте пустым, чтобы не менять" /></div>
                  <div><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Роль</label><select value={editRole} onChange={(e) => setEditRole(e.target.value as 'administrator' | 'auditor')}><option value="administrator">Администратор</option><option value="auditor">Аудитор</option></select></div>
                </div>
                {isVadmin && <div><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Аккаунт *</label><select value={editAccountId} onChange={(e) => setEditAccountId(e.target.value ? Number(e.target.value) : '')} required><option value="">— выберите —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
                <UserPhotoCropField label="Фото пользователя" value={editPhotoData} onChange={setEditPhotoData} />
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" style={{ flex: 1, border: 'none', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>Сохранить изменения</button>
                  <button type="button" onClick={() => setMode('view')} style={{ flex: 1, border: 'none', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}>Отмена</button>
                </div>
              </form>
            ) : mode === 'profile' && !isVadmin ? (
              <form onSubmit={handleUpdateMe} className="users-form space-y-5">
                <h3 className="text-xl font-semibold">Мой профиль</h3>
                <div className="users-field"><label className="mb-2 block text-sm font-semibold">Имя</label><input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Ваше имя" className="users-input" /></div>
                <div className="users-field"><label className="mb-2 block text-sm font-semibold">Новый логин</label><input type="text" value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} placeholder={user?.username} className="users-input" /></div>
                <UserPhotoCropField label="Фото профиля" value={profilePhotoData} onChange={setProfilePhotoData} />
                <div className="users-field"><label className="mb-2 block text-sm font-semibold">Текущий пароль</label><input type="password" value={profileOldPassword} onChange={(e) => setProfileOldPassword(e.target.value)} className="users-input" /></div>
                <div className="users-field"><label className="mb-2 block text-sm font-semibold">Новый пароль</label><input type="password" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} className="users-input" /></div>
                <div className="mt-2 flex gap-3"><button type="submit" className="users-btn users-btn-primary">Сохранить</button><button type="button" onClick={() => setMode('view')} className="users-btn users-btn-secondary">Отмена</button></div>
              </form>
            ) : selectedUser ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                  <h3 className="mb-3 text-base font-semibold">Карточка пользователя</h3>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted)_/_0.35)]">
                      {selectedUser.photo_data ? <img src={selectedUser.photo_data} alt={selectedUser.username} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[hsl(var(--muted-foreground))]"><UserRound className="h-7 w-7" /></div>}
                    </div>
                    <div><div className="font-medium">{getDisplayName(selectedUser)}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">@{selectedUser.username}</div></div>
                  </div>
                </div>

                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Информация</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-[hsl(var(--muted-foreground))]">ID</span><code className="rounded bg-[hsl(var(--muted)_/_0.3)] px-2 py-1 text-xs">#{selectedUser.id}</code></div>
                    <div className="flex justify-between gap-3"><span className="text-[hsl(var(--muted-foreground))]">Имя</span><span>{selectedUser.name || '—'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-[hsl(var(--muted-foreground))]">Логин</span><span className="font-medium">@{selectedUser.username}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-[hsl(var(--muted-foreground))]">Роль</span><span className={`rounded px-2 py-1 text-xs ${selectedUser.role === 'auditor' ? 'bg-[hsl(var(--muted)_/_0.4)] text-[hsl(var(--muted-foreground))]' : 'bg-[hsl(var(--primary)_/_0.15)] text-[hsl(var(--primary))]'}`}>{selectedUser.role === 'auditor' ? 'Аудитор' : 'Администратор'}</span></div>
                    {selectedUser.account_name && <div className="flex justify-between gap-3"><span className="text-[hsl(var(--muted-foreground))]">Аккаунт</span><span className="font-medium">{selectedUser.account_name}</span></div>}
                    <div className="flex justify-between gap-3"><span className="text-[hsl(var(--muted-foreground))]">Создан</span><span className="text-xs">{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString('ru-RU') : '—'}</span></div>
                  </div>
                </div>
              </div>
            ) : <p className="py-16 text-center text-[hsl(var(--muted-foreground))]">Выберите пользователя слева</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
