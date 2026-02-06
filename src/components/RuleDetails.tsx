import { useEffect, useState } from 'react';
import { api, Rule } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Pencil, Trash2, Copy, Plus } from 'lucide-react';

interface RuleDetailsProps {
  ruleId: number;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onCreateNew: () => void;
}

export function RuleDetails({ ruleId, onEdit, onDelete, onDuplicate, onCreateNew }: RuleDetailsProps) {
  const [rule, setRule] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadRule();
  }, [ruleId]);

  const loadRule = async () => {
    try {
      setLoading(true);
      const data = await api.getRule(ruleId);
      setRule(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  if (!rule) {
    return <div className="text-center text-[hsl(var(--destructive))]">Правило не найдено</div>;
  }

  const canEdit =
    user?.username === 'vadmin' ||
    (rule.authorId && typeof rule.authorId === 'number' && rule.authorId === user?.userId) ||
    (rule.authorId === 'vadmin' && user?.username === 'vadmin');

  return (
    <div>
      {/* Компактный тулбар с иконками */}
      <div className="mb-4 flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)_/_0.3)] p-1">
        {canEdit && (
          <>
            <button
              onClick={() => onEdit(rule.id)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all hover:bg-[hsl(var(--accent))]"
              title="Редактировать"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Редактировать</span>
            </button>
            <button
              onClick={() => onDuplicate(rule.id)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all hover:bg-[hsl(var(--accent))]"
              title="Дублировать"
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Дублировать</span>
            </button>
          </>
        )}
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all hover:bg-[hsl(var(--accent))]"
          title="Создать новое"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Создать</span>
        </button>
        {canEdit && (
          <>
            <div className="mx-1 h-4 w-px bg-[hsl(var(--border))]" />
            <button
              onClick={() => onDelete(rule.id)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-[hsl(var(--destructive))] transition-all hover:bg-[hsl(var(--destructive)_/_0.1)]"
              title="Удалить"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Удалить</span>
            </button>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Информация о правиле</h4>
          <div style={{ padding: '16px' }} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <div style={{ marginBottom: '12px' }}>
              <strong>ID:</strong> <code>{rule.id}</code>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <strong>Название:</strong> {rule.name}
            </div>
            <div style={{ marginBottom: '12px' }}>
              <strong>Статус:</strong>{' '}
              <span
                style={{ padding: '4px 8px' }}
                className={`rounded text-xs ${
                  rule.enabled
                    ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                    : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                }`}
              >
                {rule.enabled ? '✅ Включено' : '⏸️ Отключено'}
              </span>
            </div>
            {rule.updated_at && (
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                <strong>Последнее обновление:</strong> {new Date(rule.updated_at).toLocaleString('ru-RU')}
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Условие</h4>
          <div style={{ padding: '16px' }} className="overflow-x-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)_/_0.3)]">
            <code className="block whitespace-pre-wrap break-words text-sm">{rule.condition}</code>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Настройки отправки</h4>
          <div style={{ padding: '16px' }} className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <div>
              <strong>ID канала/чата:</strong>{' '}
              <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{rule.chatId}</code>
            </div>
            {rule.botToken && (
              <div>
                <strong>Токен бота:</strong>{' '}
                <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{rule.botToken.substring(0, 10)}...</code>
              </div>
            )}
            {rule.messageTemplate ? (
              <div>
                <strong>Шаблон сообщения:</strong>
                <div style={{ padding: '16px', marginTop: '8px' }} className="whitespace-pre-wrap rounded-lg bg-[hsl(var(--muted)_/_0.3)] text-sm">
                  {rule.messageTemplate}
                </div>
              </div>
            ) : (
              <div className="text-[hsl(var(--muted-foreground))]">Используется шаблон по умолчанию</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
