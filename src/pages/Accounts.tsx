import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Account, AccountCloneOptions } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Trash2 } from 'lucide-react';
import { useToast } from '../components/ToastNotification';
import { FormPage, FormPageItem, FormSection, FormField } from '../components/FormPage';

type CloneIncludeState = { rules: boolean; polls: boolean; integrations: boolean; bots: boolean };
const EMPTY_INCLUDE: CloneIncludeState = { rules: false, polls: false, integrations: false, bots: false };

export function Accounts() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const [newName, setNewName] = useState('');
  const [cloneSourceAccountId, setCloneSourceAccountId] = useState<number | ''>('');
  const [cloneInclude, setCloneInclude] = useState<CloneIncludeState>(EMPTY_INCLUDE);

  const selectedAccount = useMemo(() => accounts.find((a) => a.id === selectedAccountId) || null, [accounts, selectedAccountId]);
  const mainAccountId = useMemo(() => {
    if (!accounts.length) return null;
    return accounts.reduce((min, a) => a.id < min ? a.id : min, accounts[0].id);
  }, [accounts]);

  const normalizedNewName = newName.trim().toLowerCase();
  const duplicateNameExists = useMemo(() => !!normalizedNewName && accounts.some((a) => a.name.trim().toLowerCase() === normalizedNewName), [accounts, normalizedNewName]);

  useEffect(() => { if (user?.isVadmin) loadAccounts(); }, [user]);

  useEffect(() => {
    const sp = searchParams.get('select');
    if (!sp) return;
    const id = Number(sp);
    if (Number.isInteger(id) && id > 0) { setCreating(false); setSelectedAccountId(id); }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const d = await api.getAccounts();
      setAccounts(d);
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 860;
      if (!isMobile && d.length && selectedAccountId == null) {
        setSelectedAccountId(d[0].id);
      }
    }
    catch (e: any) { addToast(e?.message || 'Ошибка', 'error'); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { addToast('Введите название', 'error'); return; }
    if (duplicateNameExists) { addToast('Название уже используется', 'error'); return; }

    let cloneOptions: AccountCloneOptions | undefined;
    if (cloneSourceAccountId !== '') {
      const hasAny = Object.values(cloneInclude).some(Boolean);
      if (!hasAny) { addToast('Выберите хотя бы одну сущность', 'error'); return; }
      cloneOptions = { sourceAccountId: Number(cloneSourceAccountId), include: cloneInclude };
    }

    try {
      setSaving(true);
      const c = await api.createAccount(name, cloneOptions);
      const cloned = c?.cloned as { rules?: number; polls?: number; integrations?: number; bots?: number } | undefined;
      const total = cloned ? (cloned.rules || 0) + (cloned.polls || 0) + (cloned.integrations || 0) + (cloned.bots || 0) : 0;
      addToast(total > 0 ? `Создано, скопировано: ${total}` : 'Аккаунт создан', 'success');
      setCreating(false); setNewName(''); setCloneSourceAccountId(''); setCloneInclude(EMPTY_INCLUDE);
      await loadAccounts(); if (c?.id) setSelectedAccountId(c.id);
    } catch (e: any) { addToast(e?.message || 'Ошибка', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selectedAccount) return;
    if (mainAccountId != null && selectedAccount.id === mainAccountId) { addToast('Нельзя удалить главный', 'error'); return; }
    if (!confirm(`Удалить "${selectedAccount.name}"?`)) return;
    try { await api.deleteAccount(selectedAccount.id); addToast('Удален', 'success'); await loadAccounts(); setSelectedAccountId(mainAccountId); }
    catch (e: any) { addToast(e?.message || 'Ошибка', 'error'); }
  };

  if (!user?.isVadmin) {
    return <div className="fp"><div className="fp-panel"><div className="fp-placeholder"><p style={{ color: 'var(--form-danger)' }}>Только vadmin может управлять аккаунтами</p></div></div></div>;
  }

  const items: FormPageItem[] = accounts.map((a) => ({
    id: a.id, name: a.name, subtitle: a.slug || `account_${a.id}`, enabled: true,
  }));

  const accountOptions = accounts.map((a) => ({ value: String(a.id), label: `${a.name} (#${a.id})` }));

  const cloneFields: FormField[] = [
    { type: 'select', label: 'Источник', value: String(cloneSourceAccountId), options: [{ value: '', label: 'Не копировать' }, ...accountOptions], onChange: (v) => setCloneSourceAccountId(v ? Number(v) : '') },
    ...(['rules', 'polls', 'integrations', 'bots'] as const).map((key): FormField => ({
      type: 'checkbox', label: key === 'rules' ? 'Webhook' : key === 'polls' ? 'Пуллинги' : key === 'integrations' ? 'Интеграции' : 'Боты',
      checked: cloneInclude[key], disabled: cloneSourceAccountId === '',
      onChange: (v: boolean) => setCloneInclude((p) => ({ ...p, [key]: v })),
    })),
  ];

  const cloneSection: FormSection = { title: 'Клонирование', fields: cloneFields };

  const editData = creating ? {
    title: 'Создание аккаунта' as string,
    sections: [
      { title: 'Данные', fields: [
        { type: 'input' as const, label: 'Название', value: newName, required: true, placeholder: 'Название аккаунта', onChange: setNewName, error: duplicateNameExists ? 'Название уже используется' : undefined },
      ] },
      cloneSection,
    ],
    onSave: handleCreate, saving,
  } : null;

  const viewData = selectedAccount ? {
    name: selectedAccount.name,
    subtitle: selectedAccount.slug || `account_${selectedAccount.id}`,
    avatar: selectedAccount.name[0],
    actions: (mainAccountId != null && selectedAccount.id !== mainAccountId) ? (
      <button className="fp-btn fp-btn-danger" onClick={handleDelete} title="Удалить"><Trash2 size={14} /></button>
    ) : undefined,
    sections: [
      { title: 'Информация', fields: [
        { type: 'view' as const, label: 'ID', value: `#${selectedAccount.id}` },
        { type: 'view' as const, label: 'Название', value: selectedAccount.name },
        { type: 'view' as const, label: 'Slug', value: selectedAccount.slug || `account_${selectedAccount.id}`, mono: true },
        { type: 'badge' as const, label: 'Тип', value: mainAccountId != null && selectedAccount.id === mainAccountId ? 'Главный' : 'Обычный', active: mainAccountId != null && selectedAccount.id === mainAccountId },
        { type: 'date' as const, label: 'Создан', value: selectedAccount.created_at ? new Date(selectedAccount.created_at).toLocaleString('ru-RU') : '—' },
      ] },
      { title: 'Webhook URL', fields: [
        { type: 'view' as const, label: 'URL', value: `${typeof window !== 'undefined' ? window.location.origin : ''}/webhook/${selectedAccount.slug || `account_${selectedAccount.id}`}`, span2: true, mono: true },
      ] },
    ],
  } : null;

  return (
    <FormPage
      title="Аккаунты"
      items={items}
      selectedId={creating ? null : selectedAccountId}
      onSelect={(id) => { setCreating(false); setSelectedAccountId(id); }}
      onRefresh={loadAccounts}
      onCreate={() => { setCreating(true); setSelectedAccountId(null); setNewName(''); setCloneSourceAccountId(''); setCloneInclude(EMPTY_INCLUDE); }}
      loading={loading}
      canEdit
      view={viewData}
      edit={editData}
      onExitEdit={() => setCreating(false)}
    />
  );
}
