import { useEffect, useMemo, useState } from 'react';
import { api, Account, AccountCloneOptions } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Breadcrumb } from '../components/Breadcrumb';

type CloneIncludeState = {
  rules: boolean;
  polls: boolean;
  integrations: boolean;
  bots: boolean;
};

const EMPTY_INCLUDE: CloneIncludeState = {
  rules: false,
  polls: false,
  integrations: false,
  bots: false,
};

export function Accounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [cloneSourceAccountId, setCloneSourceAccountId] = useState<number | ''>('');
  const [cloneInclude, setCloneInclude] = useState<CloneIncludeState>(EMPTY_INCLUDE);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );
  const mainAccountId = useMemo(() => {
    if (accounts.length === 0) return null;
    return accounts.reduce((minId, account) => (account.id < minId ? account.id : minId), accounts[0].id);
  }, [accounts]);
  const normalizedNewName = newName.trim().toLowerCase();
  const duplicateNameExists = useMemo(
    () => !!normalizedNewName && accounts.some((a) => a.name.trim().toLowerCase() === normalizedNewName),
    [accounts, normalizedNewName]
  );

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => {
      const slug = a.slug || `account_${a.id}`;
      return `${a.name} ${slug} ${a.id}`.toLowerCase().includes(q);
    });
  }, [accounts, searchQuery]);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  useEffect(() => {
    if (user?.isVadmin) loadAccounts();
  }, [user]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await api.getAccounts();
      setAccounts(data);
      if (data.length > 0 && selectedAccountId == null) {
        setSelectedAccountId(data[0].id);
      }
    } catch (error: any) {
      setMessage({ text: error?.message || 'Ошибка загрузки аккаунтов', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setNewName('');
    setCloneSourceAccountId('');
    setCloneInclude(EMPTY_INCLUDE);
  };

  const handleStartCreate = () => {
    setCreating(true);
    setSelectedAccountId(null);
    setMessage(null);
  };

  const handleCancelCreate = () => {
    setCreating(false);
    resetCreateForm();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const name = newName.trim();
    if (!name) {
      setMessage({ text: 'Введите название аккаунта', type: 'error' });
      return;
    }

    if (duplicateNameExists) {
      setMessage({ text: 'Такое название уже используется', type: 'error' });
      return;
    }

    let cloneOptions: AccountCloneOptions | undefined;
    if (cloneSourceAccountId !== '') {
      const hasAny = Object.values(cloneInclude).some(Boolean);
      if (hasAny) {
        cloneOptions = {
          sourceAccountId: Number(cloneSourceAccountId),
          include: cloneInclude,
        };
      } else {
        setMessage({ text: 'Выберите хотя бы одну сущность для копирования', type: 'error' });
        return;
      }
    }

    try {
      const created = await api.createAccount(name, cloneOptions);
      const cloned = created?.cloned as
        | { rules?: number; polls?: number; integrations?: number; bots?: number }
        | undefined;
      const copiedTotal = cloned
        ? (cloned.rules || 0) + (cloned.polls || 0) + (cloned.integrations || 0) + (cloned.bots || 0)
        : 0;
      setMessage({
        text: copiedTotal > 0 ? `Аккаунт создан, скопировано сущностей: ${copiedTotal}` : 'Аккаунт создан',
        type: 'success',
      });
      setCreating(false);
      resetCreateForm();
      await loadAccounts();
      if (created?.id) setSelectedAccountId(created.id);
    } catch (error: any) {
      setMessage({ text: error?.message || 'Ошибка создания аккаунта', type: 'error' });
    }
  };

  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
    if (mainAccountId != null && selectedAccount.id === mainAccountId) {
      setMessage({ text: 'Нельзя удалить главный аккаунт', type: 'error' });
      return;
    }
    if (!confirm(`Удалить аккаунт "${selectedAccount.name}"? Данные будут перенесены в главный аккаунт.`)) return;

    try {
      await api.deleteAccount(selectedAccount.id);
      setMessage({ text: 'Аккаунт удален', type: 'success' });
      await loadAccounts();
      setSelectedAccountId(mainAccountId);
    } catch (error: any) {
      setMessage({ text: error?.message || 'Ошибка удаления аккаунта', type: 'error' });
    }
  };

  if (!user?.isVadmin) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-center text-[hsl(var(--destructive))]">
            Только администратор (vadmin) может управлять аккаунтами.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold">Аккаунты</h2>
            <div className="mt-1">
              <Breadcrumb
                items={[
                  { label: 'Главная', path: '/' },
                  { label: 'Аккаунты', active: true },
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
              placeholder="Поиск аккаунта..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </div>
          <button onClick={loadAccounts} className="icon-button" title="Обновить">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={handleStartCreate} className="icon-button" title="Создать аккаунт">
            <Plus className="h-4 w-4" />
          </button>
          {selectedAccount && mainAccountId != null && selectedAccount.id !== mainAccountId && (
            <>
              <button
                onClick={handleDeleteAccount}
                className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                title="Удалить аккаунт"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />
            </>
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
              <h3 className="text-sm font-semibold">Список аккаунтов</h3>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{filteredAccounts.length} записей</span>
            </div>
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : filteredAccounts.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Аккаунты не найдены</p>
            ) : (
              <div className="entity-list-scroll scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">Название</th>
                      <th className="px-2 py-2">Slug</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((account) => {
                      const slug = account.slug || `account_${account.id}`;
                      return (
                        <tr
                          key={account.id}
                          onClick={() => {
                            setCreating(false);
                            setSelectedAccountId(account.id);
                          }}
                          className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                            selectedAccountId === account.id && !creating ? 'bg-[hsl(var(--accent))]' : ''
                          }`}
                        >
                          <td className="px-2 py-2">
                            <div className="font-medium text-xs">{account.name}</div>
                            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">#{account.id}</div>
                          </td>
                          <td className="px-2 py-2 text-xs">{slug}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          <div className="panel">
            {creating ? (
              <form onSubmit={handleCreate} className="users-form space-y-5">
                <h3 className="text-xl font-semibold">Создать аккаунт</h3>
                <div className="users-field">
                  <label className="mb-2 block text-sm font-semibold">Название *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Название аккаунта"
                    className="users-input"
                    required
                  />
                  {duplicateNameExists && (
                    <p className="mt-1 text-xs text-[hsl(var(--destructive))]">Такое название уже используется</p>
                  )}
                </div>

                <div className="users-field">
                  <label className="mb-2 block text-sm font-semibold">Наполнение нового аккаунта</label>
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                    <div className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
                      Можно выбрать источник и скопировать нужные сущности сразу при создании.
                    </div>
                    <label className="mb-2 block text-sm font-medium">Источник</label>
                    <select
                      value={cloneSourceAccountId}
                      onChange={(e) => {
                        const value = e.target.value ? Number(e.target.value) : '';
                        setCloneSourceAccountId(value);
                      }}
                      className="users-input mb-3"
                    >
                      <option value="">Не копировать сущности</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (#{a.id})
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {[
                        { key: 'rules', label: 'Webhook' },
                        { key: 'polls', label: 'Пуллинги' },
                        { key: 'integrations', label: 'Интеграции' },
                        { key: 'bots', label: 'Боты' },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className={`flex items-center gap-2 rounded border border-[hsl(var(--input))] px-3 py-2 text-sm ${
                            cloneSourceAccountId === '' ? 'opacity-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={cloneInclude[item.key as keyof CloneIncludeState]}
                            onChange={(e) =>
                              setCloneInclude((prev) => ({
                                ...prev,
                                [item.key]: e.target.checked,
                              }))
                            }
                            disabled={cloneSourceAccountId === ''}
                            className="mr-2"
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="users-preview-block">
                  <div className="mb-3 flex items-center justify-between">
                    <strong className="text-base">Предварительный просмотр</strong>
                    <span className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                      </svg>
                      Аккаунт
                    </span>
                  </div>
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                    <div className="text-base font-semibold">{newName || 'Новый аккаунт'}</div>
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                      {cloneSourceAccountId ? 'С копированием сущностей' : 'Без копирования сущностей'}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={duplicateNameExists}
                    className="users-btn users-btn-primary"
                  >
                    Создать аккаунт
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelCreate}
                    className="users-btn users-btn-secondary"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : selectedAccount ? (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-base font-semibold">Просмотр аккаунта</h3>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-[hsl(var(--muted)_/_0.3)] p-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                        <rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">{selectedAccount.name}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">ID: #{selectedAccount.id}</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                    <div className="mb-2 text-xs font-medium uppercase text-[hsl(var(--muted-foreground))]">Основная информация</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Название:</span>
                        <span className="font-medium">{selectedAccount.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">ID:</span>
                        <code className="rounded bg-[hsl(var(--muted)_/_0.3)] px-2 py-1 text-xs">#{selectedAccount.id}</code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Slug:</span>
                        <code className="rounded bg-[hsl(var(--muted)_/_0.3)] px-2 py-1 text-xs">
                          {selectedAccount.slug || `account_${selectedAccount.id}`}
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Тип:</span>
                        <span className="font-medium">
                          {mainAccountId != null && selectedAccount.id === mainAccountId ? 'Главный' : 'Обычный'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Создан:</span>
                        <span className="text-xs">
                          {selectedAccount.created_at ? new Date(selectedAccount.created_at).toLocaleString('ru-RU') : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                    <div className="mb-2 text-xs font-medium uppercase text-[hsl(var(--muted-foreground))]">Webhook URL</div>
                    <div className="text-sm">
                      <code className="break-all rounded bg-[hsl(var(--muted)_/_0.3)] px-2 py-1 text-xs">
                        {`${typeof window !== 'undefined' ? window.location.origin : ''}/webhook/${
                          selectedAccount.slug || `account_${selectedAccount.id}`
                        }`}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-16 text-center text-[hsl(var(--muted-foreground))]">
                Выберите аккаунт слева или нажмите «Создать»
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
