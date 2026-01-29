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
      <div className="mb-4 flex flex-wrap gap-2">
        {canEdit && (
          <>
            <button
              onClick={() => onDuplicate(rule.id)}
              className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-1 text-sm transition-all hover:bg-[hsl(var(--accent))]"
            >
              <Copy className="h-4 w-4" />
              Дублировать
            </button>
            <button
              onClick={() => onEdit(rule.id)}
              className="flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-3 py-1 text-sm text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
            >
              <Pencil className="h-4 w-4" />
              Редактировать
            </button>
          </>
        )}
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-3 py-1 text-sm text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
        >
          <Plus className="h-4 w-4" />
          Создать новое правило
        </button>
        {canEdit && (
          <button
            onClick={() => onDelete(rule.id)}
            className="flex items-center gap-2 rounded bg-[hsl(var(--destructive))] px-3 py-1 text-sm text-[hsl(var(--destructive-foreground))] transition-all hover:bg-[hsl(var(--destructive)_/_0.9)]"
          >
            <Trash2 className="h-4 w-4" />
            Удалить
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Информация о правиле</h4>
          <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <div className="mb-3">
              <strong>ID:</strong> <code>{rule.id}</code>
            </div>
            <div className="mb-3">
              <strong>Название:</strong> {rule.name}
            </div>
            <div className="mb-3">
              <strong>Статус:</strong>{' '}
              <span
                className={`rounded px-2 py-1 text-xs ${
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
          <div className="overflow-x-auto rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <code className="whitespace-pre-wrap break-words text-sm">{rule.condition}</code>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Настройки отправки</h4>
          <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <div className="mb-3">
              <strong>ID канала/чата:</strong> <code>{rule.chatId}</code>
            </div>
            {rule.botToken && (
              <div className="mb-3">
                <strong>Токен бота:</strong> <code>{rule.botToken.substring(0, 10)}...</code>
              </div>
            )}
            {rule.messageTemplate ? (
              <div>
                <strong>Шаблон сообщения:</strong>
                <div className="mt-2 whitespace-pre-wrap rounded bg-[hsl(var(--muted)_/_0.3)] p-3 text-sm">
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
