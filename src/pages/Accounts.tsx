import { useEffect, useMemo, useState } from 'react';
import { api, Account, AccountCloneOptions } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Plus, RefreshCw, Search } from 'lucide-react';
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
              <div className="max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin">
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
              <form onSubmit={handleCreate} className="space-y-4">
                <h3 className="text-base font-semibold">Создать аккаунт</h3>
                <div>
                  <label className="mb-1 block text-sm font-medium">Название</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Название аккаунта"
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div className="rounded border border-[hsl(var(--border))] p-3">
                  <div className="mb-2 text-sm font-medium">Наполнение нового аккаунта</div>
                  <div className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
                    Можно выбрать источник и скопировать нужные сущности сразу при создании.
                  </div>
                  <label className="mb-1 block text-sm">Источник</label>
                  <select
                    value={cloneSourceAccountId}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : '';
                      setCloneSourceAccountId(value);
                    }}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  >
                    <option value="">Не копировать сущности</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (#{a.id})
                      </option>
                    ))}
                  </select>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {[
                      { key: 'rules', label: 'Webhook' },
                      { key: 'polls', label: 'Пуллинги' },
                      { key: 'integrations', label: 'Интеграции' },
                      { key: 'bots', label: 'Боты' },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className={`flex items-center gap-2 rounded border px-2 py-1.5 text-sm ${
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
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
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
                    onClick={handleCancelCreate}
                    className="rounded border border-[hsl(var(--border))] px-4 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : selectedAccount ? (
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Просмотр аккаунта</h3>
                <div>
                  <strong>Название:</strong> <span className="font-medium">{selectedAccount.name}</span>
                </div>
                <div>
                  <strong>ID:</strong>{' '}
                  <code className="rounded bg-[hsl(var(--muted)_/_0.5)] px-2 py-1 text-xs">#{selectedAccount.id}</code>
                </div>
                <div>
                  <strong>Slug:</strong>{' '}
                  <code className="rounded bg-[hsl(var(--muted)_/_0.5)] px-2 py-1 text-xs">
                    {selectedAccount.slug || `account_${selectedAccount.id}`}
                  </code>
                </div>
                <div>
                  <strong>Webhook:</strong>
                  <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    <code className="break-all rounded bg-[hsl(var(--muted)_/_0.5)] px-2 py-1">
                      {`${typeof window !== 'undefined' ? window.location.origin : ''}/webhook/${
                        selectedAccount.slug || `account_${selectedAccount.id}`
                      }`}
                    </code>
                  </div>
                </div>
                <div>
                  <strong>Создан:</strong>{' '}
                  {selectedAccount.created_at ? new Date(selectedAccount.created_at).toLocaleString('ru-RU') : '—'}
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
