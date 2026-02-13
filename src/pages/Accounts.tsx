import { useEffect, useState } from 'react';
import { api, Account } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Plus, X } from 'lucide-react';
import { Breadcrumb } from '../components/Breadcrumb';

export function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const { user } = useAuth();

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const name = newName.trim();
    if (!name) return;
    try {
      await api.createAccount(name);
      setMessage({ text: 'Аккаунт создан', type: 'success' });
      setNewName('');
      setShowCreate(false);
      loadAccounts();
    } catch (err: any) {
      setMessage({ text: err.message || 'Ошибка', type: 'error' });
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
                  { label: 'Аккаунты', active: true }
                ]} 
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="icon-button"
          title="Создать аккаунт"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {showCreate && (
        <div className="p-4 border-b border-[hsl(var(--border))]">
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
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Название</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-48 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                placeholder="Название аккаунта"
              />
            </div>
            <button type="submit" className="rounded bg-[hsl(var(--primary))] px-3 py-2 text-sm text-[hsl(var(--primary-foreground))] hover:opacity-90">
              Создать
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded p-2 hover:bg-[hsl(var(--accent))]">
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">Нет аккаунтов. Создайте первый.</p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => {
              const slug = a.slug || `account_${a.id}`;
              const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/webhook/${slug}`;
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-[hsl(var(--border))] px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">ID: {a.id}</span>
                  </div>
                  <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                    Webhook: <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 break-all">{webhookUrl}</code>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
