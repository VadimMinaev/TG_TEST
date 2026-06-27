import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Account, User } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Pencil, Trash2 } from 'lucide-react';
import { useToast } from '../components/ToastNotification';
import { FormPage, FormPageItem } from '../components/FormPage';

type Mode = 'view' | 'create' | 'edit' | 'profile';

function getDisplayName(u: User | null): string {
  if (!u) return '';
  return u.name && u.name.trim() ? u.name.trim() : u.username;
}

export function Users() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('view');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
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

  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileOldPassword, setProfileOldPassword] = useState('');

  const isVadmin = user?.isVadmin;
  const canManageUsers = isVadmin || (user?.role === 'administrator' && user?.accountId != null);

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId) || null, [users, selectedUserId]);

  useEffect(() => {
    if (user?.isVadmin) { loadUsers(); api.getAccounts().then(setAccounts).catch(() => {}); }
    else if (user?.accountId != null || user?.userId != null) loadUsers();
  }, [user]);

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfileUsername(user?.username || '');
  }, [user?.name, user?.username]);

  useEffect(() => {
    if (searchParams.get('create') === 'true' && canManageUsers) setMode('create');
    if (searchParams.get('profile') === 'true' && !isVadmin) setMode('profile');
    const sp = searchParams.get('select');
    if (sp) { const id = Number(sp); if (Number.isInteger(id) && id > 0) { setSelectedUserId(id); setMode('view'); } }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, canManageUsers, isVadmin]);

  const loadUsers = async () => {
    try { setLoading(true); const d = await api.getUsers(); setUsers(d); if (d.length && selectedUserId == null) setSelectedUserId(d[0].id); }
    catch (e: any) { addToast(e?.message || 'Ошибка загрузки', 'error'); }
    finally { setLoading(false); }
  };

  const items: FormPageItem[] = users.map((u) => ({
    id: u.id, name: getDisplayName(u), subtitle: `@${u.username} · ${u.role === 'auditor' ? 'Аудитор' : 'Админ'}`,
    avatar: getDisplayName(u)[0], enabled: true,
  }));

  const handleCreate = async () => {
    const accountId = user?.isVadmin ? newAccountId : (user?.accountId ?? null);
    if (accountId === '' || accountId == null) { addToast('Выберите аккаунт', 'error'); return; }
    try {
      setSaving(true);
      const c = await api.createUser(newUsername.trim(), newPassword, Number(accountId), newRole, newName.trim());
      addToast('Пользователь создан', 'success');
      setNewUsername(''); setNewName(''); setNewPassword(''); setMode('view');
      await loadUsers(); if (c?.id) setSelectedUserId(c.id);
    } catch (e: any) { addToast(e?.message || 'Ошибка', 'error'); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    if (!editUsername.trim()) { addToast('Логин обязателен', 'error'); return; }
    const payload: any = { username: editUsername.trim(), name: editName.trim(), role: editRole };
    if (editPassword.trim()) payload.password = editPassword.trim();
    if (isVadmin && editAccountId !== '') payload.account_id = Number(editAccountId);
    try {
      setSaving(true);
      await api.updateUser(selectedUser.id, payload);
      addToast('Пользователь обновлен', 'success');
      setMode('view'); await loadUsers();
    } catch (e: any) { addToast(e?.message || 'Ошибка', 'error'); }
    finally { setSaving(false); }
  };

  const handleProfile = async () => {
    const payload: any = {};
    if (profileUsername.trim()) payload.username = profileUsername.trim();
    payload.name = profileName.trim();
    if (profilePassword) { payload.password = profilePassword; payload.oldPassword = profileOldPassword; }
    if (!payload.username && payload.name === (user?.name || '') && !payload.password) { addToast('Нет изменений', 'error'); return; }
    try {
      setSaving(true);
      await api.updateMe(payload);
      addToast('Профиль обновлен', 'success');
      setProfilePassword(''); setProfileOldPassword(''); setMode('view');
    } catch (e: any) { addToast(e?.message || 'Ошибка', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить пользователя?')) return;
    try { await api.deleteUser(id); addToast('Удален', 'success'); if (selectedUserId === id) setSelectedUserId(null); await loadUsers(); }
    catch (e: any) { addToast(e?.message || 'Ошибка', 'error'); }
  };

  const startEdit = () => {
    if (!selectedUser) return;
    setEditUsername(selectedUser.username); setEditName(selectedUser.name || '');
    setEditPassword(''); setEditRole(selectedUser.role === 'auditor' ? 'auditor' : 'administrator');
    setEditAccountId(selectedUser.account_id != null ? selectedUser.account_id : '');
    setMode('edit');
  };

  const accountOptions = accounts.map((a) => ({ value: String(a.id), label: a.name }));
  const roleOptions = [{ value: 'administrator', label: 'Администратор' }, { value: 'auditor', label: 'Аудитор' }];

  let editData: any = null;
  let viewData: any = null;

  if (mode === 'create' && canManageUsers) {
    const fields: any[] = [
      { type: 'input', label: 'Логин', value: newUsername, required: true, placeholder: 'username', onChange: setNewUsername },
      { type: 'input', label: 'Имя', value: newName, placeholder: 'Иван Петров', onChange: setNewName },
      { type: 'password', label: 'Пароль', value: newPassword, required: true, placeholder: 'Введите пароль', onChange: setNewPassword },
      { type: 'select', label: 'Роль', value: newRole, options: roleOptions, onChange: (v: string) => setNewRole(v as any) },
    ];
    if (isVadmin) fields.push({ type: 'select', label: 'Аккаунт', value: String(newAccountId), options: [{ value: '', label: '— выберите —' }, ...accountOptions], onChange: (v: string) => setNewAccountId(v ? Number(v) : '') });
    editData = { title: 'Создание пользователя', sections: [{ title: 'Данные', fields }], onSave: handleCreate, saving };
  } else if (mode === 'edit' && canManageUsers && selectedUser) {
    const fields: any[] = [
      { type: 'input', label: 'Логин', value: editUsername, required: true, placeholder: 'username', onChange: setEditUsername },
      { type: 'input', label: 'Имя', value: editName, placeholder: 'Иван Петров', onChange: setEditName },
      { type: 'password', label: 'Новый пароль', value: editPassword, placeholder: 'Оставьте пустым', onChange: setEditPassword },
      { type: 'select', label: 'Роль', value: editRole, options: roleOptions, onChange: (v: string) => setEditRole(v as any) },
    ];
    if (isVadmin) fields.push({ type: 'select', label: 'Аккаунт', value: String(editAccountId), options: [{ value: '', label: '— выберите —' }, ...accountOptions], onChange: (v: string) => setEditAccountId(v ? Number(v) : '') });
    editData = { title: 'Редактирование', sections: [{ title: 'Данные', fields }], onSave: handleEdit, saving };
  } else if (mode === 'profile' && !isVadmin) {
    editData = {
      title: 'Мой профиль', sections: [{ title: 'Данные', fields: [
        { type: 'input', label: 'Имя', value: profileName, placeholder: 'Ваше имя', onChange: setProfileName },
        { type: 'input', label: 'Новый логин', value: profileUsername, placeholder: user?.username, onChange: setProfileUsername },
        { type: 'password', label: 'Текущий пароль', value: profileOldPassword, onChange: setProfileOldPassword },
        { type: 'password', label: 'Новый пароль', value: profilePassword, onChange: setProfilePassword },
      ] }], onSave: handleProfile, saving,
    };
  } else if (selectedUser) {
    viewData = {
      name: getDisplayName(selectedUser), subtitle: `@${selectedUser.username}`,
      avatar: getDisplayName(selectedUser)[0],
      actions: (
        <>
          {canManageUsers && (isVadmin || selectedUser.id !== user?.userId) && (
            <button className="fp-btn fp-btn-ghost" onClick={startEdit} title="Редактировать"><Pencil size={14} /></button>
          )}
          {canManageUsers && selectedUser.id !== user?.userId && (
            <button className="fp-btn fp-btn-danger" onClick={() => handleDelete(selectedUser.id)} title="Удалить"><Trash2 size={14} /></button>
          )}
        </>
      ),
      sections: [
        { title: 'Информация', fields: [
          { type: 'view', label: 'ID', value: `#${selectedUser.id}` },
          { type: 'view', label: 'Имя', value: getDisplayName(selectedUser) },
          { type: 'view', label: 'Логин', value: `@${selectedUser.username}`, mono: true },
          { type: 'badge', label: 'Роль', value: selectedUser.role === 'auditor' ? 'Аудитор' : 'Администратор', active: selectedUser.role !== 'auditor' },
          ...(selectedUser.account_name ? [{ type: 'view' as const, label: 'Аккаунт', value: selectedUser.account_name }] : []),
          { type: 'date', label: 'Создан', value: selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString('ru-RU') : '—' },
        ] },
      ],
    };
  }

  return (
    <FormPage
      title="Пользователи"
      items={items}
      selectedId={mode === 'view' || mode === 'edit' ? selectedUserId : null}
      onSelect={(id) => { setSelectedUserId(id); setMode('view'); }}
      onRefresh={loadUsers}
      onCreate={canManageUsers ? () => { setSelectedUserId(null); setMode('create'); } : undefined}
      loading={loading}
      canEdit={canManageUsers}
      view={viewData}
      edit={editData}
      onExitEdit={() => setMode('view')}
    />
  );
}
