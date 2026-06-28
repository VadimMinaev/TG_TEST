import { useEffect, useState } from 'react';
import { api, Rule } from '../lib/api';

interface RuleDetailsProps {
  ruleId: number;
  canEdit?: boolean;
  onToggleEnabled?: (rule: Rule) => Promise<void>;
  toggling?: boolean;
}

export function RuleDetails({ ruleId }: RuleDetailsProps) {
  const [rule, setRule] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(true);

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
    return <div className="text-center text-[hsl(var(--destructive))]">Webhook не найден</div>;
  }

  return (
    <div className="entity-view">
      <div>
        <h4 className="entity-view-title">Информация о Webhook</h4>
        <div className="entity-view-card">
          <div className="view-field">
            <strong>ID:</strong>{' '}
            <code className="view-code">{rule.id}</code>
          </div>
          <div className="view-field">
            <strong>Название:</strong> {rule.name}
          </div>
          <div className="view-field">
            <strong>Статус:</strong>{' '}
            <span className={`view-badge ${rule.enabled ? 'view-badge-success' : 'view-badge-error'}`}>
              {rule.enabled ? '✅ Включено' : '⏸️ Отключено'}
            </span>
          </div>
          {rule.updated_at && (
            <div className="view-field" style={{ marginBottom: 0 }}>
              <strong>Последнее обновление:</strong>{' '}
              <span className="form-hint" style={{ margin: 0, display: 'inline' }}>
                {new Date(rule.updated_at).toLocaleString('ru-RU')}
              </span>
            </div>
          )}
        </div>
      </div>

      <div>
        <h4 className="entity-view-title">Условие</h4>
        <div className="entity-view-card-muted overflow-x-auto">
          <code className="block whitespace-pre-wrap break-words text-sm">{rule.condition}</code>
        </div>
      </div>

      <div>
        <h4 className="entity-view-title">Настройки отправки</h4>
        <div className="entity-view-card">
          <div className="view-field">
            <strong>ID канала/чата:</strong>{' '}
            <code className="view-code">{rule.chatId}</code>
          </div>
          {rule.botToken && (
            <div className="view-field">
              <strong>Токен бота:</strong>{' '}
              <code className="view-code">{rule.botToken.substring(0, 10)}...</code>
            </div>
          )}
          {rule.messageTemplate ? (
            <div className="view-field" style={{ marginBottom: 0 }}>
              <strong>Шаблон сообщения:</strong>
              <div className="view-code-block">{rule.messageTemplate}</div>
            </div>
          ) : (
            <div className="form-hint" style={{ margin: 0 }}>Используется шаблон по умолчанию</div>
          )}
        </div>
      </div>
    </div>
  );
}
