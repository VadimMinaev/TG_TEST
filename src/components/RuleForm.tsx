import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { api, Rule } from '../lib/api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { Switch } from './ui/switch';
import { TemplateHelp } from './TemplateHelp';
import { TelegramPreviewWithToggle } from './TelegramPreviewWithToggle';

function InfoTooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpen((prev) => !prev);
            }}
            className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
            aria-label="РџРѕРєР°Р·Р°С‚СЊ РїРѕРґСЃРєР°Р·РєСѓ"
          >
            <Info className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs text-left" onPointerDownOutside={() => setOpen(false)}>
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface RuleFormProps {
  ruleId: number | null;
  onSave: (rule: Partial<Rule>) => Promise<void>;
  onCancel: () => void;
}

export function RuleForm({ ruleId, onSave, onCancel }: RuleFormProps) {
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('payload.category === "incident"');
  const [chatId, setChatId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // РџСЂРёРјРµСЂ payload РґР»СЏ РїСЂРµРґРІР°СЂРёС‚РµР»СЊРЅРѕРіРѕ РїСЂРѕСЃРјРѕС‚СЂР°
  const payloadExample = {
    id: 12345,
    subject: 'РќРѕРІР°СЏ Р·Р°СЏРІРєР° РІ С‚РµС…РїРѕРґРґРµСЂР¶РєСѓ',
    status: 'open',
    category: 'incident',
    priority: 'high',
    impact: 'medium',
    team_name: 'Support Team',
    requested_by: {
      name: 'РРІР°РЅ РџРµС‚СЂРѕРІ',
      account: {
        name: 'Acme Corp'
      }
    },
    note: [
      {
        person: { name: 'РђР»РµРєСЃРµР№ РЎРёРґРѕСЂРѕРІ' },
        text: 'РџСЂРѕРІРµСЂСЏСЋ РїСЂРѕР±Р»РµРјСѓ',
        created_at: '2023-05-15T10:30:00Z'
      }
    ]
  };

  useEffect(() => {
    if (ruleId) {
      loadRule();
    }
  }, [ruleId]);

  const loadRule = async () => {
    if (!ruleId) return;
    try {
      const rule = await api.getRule(ruleId);
      setName(rule.name);
      setCondition(rule.condition);
      setChatId(rule.chatId);
      setBotToken(rule.botToken || '');
      setMessageTemplate(rule.messageTemplate || '');
      setEnabled(rule.enabled);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !condition || !chatId) {
      setError('Р—Р°РїРѕР»РЅРёС‚Рµ РІСЃРµ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ РїРѕР»СЏ');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        name,
        condition,
        chatId,
        botToken: botToken || undefined,
        messageTemplate: messageTemplate || undefined,
        enabled,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid hsl(var(--destructive) / 0.2)', background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="ruleName" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
          РќР°Р·РІР°РЅРёРµ Webhook
          <InfoTooltip>
            РЈРЅРёРєР°Р»СЊРЅРѕРµ РёРјСЏ РґР»СЏ РёРґРµРЅС‚РёС„РёРєР°С†РёРё Webhook РІ СЃРїРёСЃРєРµ. Р РµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РїРѕРЅСЏС‚РЅС‹Рµ РЅР°Р·РІР°РЅРёСЏ, РЅР°РїСЂРёРјРµСЂ: В«РРЅС†РёРґРµРЅС‚С‹ РІ РѕСЃРЅРѕРІРЅРѕР№ С‡Р°С‚В» РёР»Рё В«РЈРІРµРґРѕРјР»РµРЅРёСЏ Рѕ Р·Р°РґР°С‡Р°С…В».
          </InfoTooltip>
        </label>
        <input
          type="text"
          id="ruleName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="РќР°РїСЂРёРјРµСЂ: РћС‚РїСЂР°РІРёС‚СЊ РІ РѕСЃРЅРѕРІРЅРѕР№ С‡Р°С‚"
          required
          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
        />
      </div>

      <div>
        <label htmlFor="condition" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
          РЈСЃР»РѕРІРёРµ (JavaScript РІС‹СЂР°Р¶РµРЅРёРµ)
          <InfoTooltip>
            <div className="space-y-2">
              <p>JavaScript РІС‹СЂР°Р¶РµРЅРёРµ, РєРѕС‚РѕСЂРѕРµ РґРѕР»Р¶РЅРѕ РІРµСЂРЅСѓС‚СЊ <code className="rounded bg-[hsl(var(--muted))] px-1">true</code> РґР»СЏ СЃСЂР°Р±Р°С‚С‹РІР°РЅРёСЏ Webhook.</p>
              <p><strong>Р”РѕСЃС‚СѓРїРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ:</strong></p>
              <ul className="list-inside list-disc">
                <li><code className="rounded bg-[hsl(var(--muted))] px-1">payload</code> вЂ” РґР°РЅРЅС‹Рµ РІРµР±С…СѓРєР°</li>
              </ul>
              <p><strong>РџСЂРёРјРµСЂС‹:</strong></p>
              <ul className="list-inside list-disc">
                <li><code className="rounded bg-[hsl(var(--muted))] px-1">payload.status === "open"</code></li>
                <li><code className="rounded bg-[hsl(var(--muted))] px-1">payload.priority &gt; 3</code></li>
                <li><code className="rounded bg-[hsl(var(--muted))] px-1">payload.category === "incident"</code></li>
              </ul>
            </div>
          </InfoTooltip>
        </label>
        <textarea
          id="condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder='payload.category === "incident"'
          required
          rows={4}
          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
        />
      </div>

      <div>
        <label htmlFor="chatId" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
          ID Telegram С‡Р°С‚Р°
          <InfoTooltip>
            <div className="space-y-2">
              <p>Р§РёСЃР»РѕРІРѕР№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‡Р°С‚Р°/РєР°РЅР°Р»Р° РІ Telegram.</p>
              <p><strong>РљР°Рє РїРѕР»СѓС‡РёС‚СЊ:</strong></p>
              <ul className="list-inside list-disc">
                <li>Р”РѕР±Р°РІСЊС‚Рµ Р±РѕС‚Р° <code className="rounded bg-[hsl(var(--muted))] px-1">@userinfobot</code> РІ С‡Р°С‚</li>
                <li>РР»Рё РїРµСЂРµС€Р»РёС‚Рµ СЃРѕРѕР±С‰РµРЅРёРµ Р±РѕС‚Сѓ <code className="rounded bg-[hsl(var(--muted))] px-1">@getmyid_bot</code></li>
              </ul>
              <p><strong>Р¤РѕСЂРјР°С‚:</strong> РґР»СЏ РіСЂСѓРїРї/РєР°РЅР°Р»РѕРІ ID РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ <code className="rounded bg-[hsl(var(--muted))] px-1">-100</code></p>
            </div>
          </InfoTooltip>
        </label>
        <input
          type="text"
          id="chatId"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="РќР°РїСЂРёРјРµСЂ: -1001234567890"
          required
          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
        />
      </div>

      <div>
        <label htmlFor="botToken" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
          РўРѕРєРµРЅ Telegram Р±РѕС‚Р°
          <InfoTooltip>
            <div className="space-y-2">
              <p>РўРѕРєРµРЅ Р±РѕС‚Р° РґР»СЏ РѕС‚РїСЂР°РІРєРё СЃРѕРѕР±С‰РµРЅРёР№. Р•СЃР»Рё РѕСЃС‚Р°РІРёС‚СЊ РїСѓСЃС‚С‹Рј вЂ” РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РіР»РѕР±Р°Р»СЊРЅС‹Р№ С‚РѕРєРµРЅ РёР· РЅР°СЃС‚СЂРѕРµРє.</p>
              <p><strong>РљР°Рє РїРѕР»СѓС‡РёС‚СЊ:</strong></p>
              <ul className="list-inside list-disc">
                <li>РЎРѕР·РґР°Р№С‚Рµ Р±РѕС‚Р° С‡РµСЂРµР· <code className="rounded bg-[hsl(var(--muted))] px-1">@BotFather</code></li>
                <li>РЎРєРѕРїРёСЂСѓР№С‚Рµ С‚РѕРєРµРЅ РёР· СЃРѕРѕР±С‰РµРЅРёСЏ</li>
              </ul>
              <p>Р¤РѕСЂРјР°С‚: <code className="rounded bg-[hsl(var(--muted))] px-1">123456789:ABC...</code></p>
            </div>
          </InfoTooltip>
        </label>
        <input
          type="password"
          id="botToken"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="РћСЃС‚Р°РІСЊС‚Рµ РїСѓСЃС‚С‹Рј РґР»СЏ РіР»РѕР±Р°Р»СЊРЅРѕРіРѕ С‚РѕРєРµРЅР°"
          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
        />
      </div>

      <div>
        <label htmlFor="messageTemplate" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
          РЁР°Р±Р»РѕРЅ СЃРѕРѕР±С‰РµРЅРёСЏ
          <TemplateHelp context="rule" />
        </label>
        <textarea
          id="messageTemplate"
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          placeholder="РћСЃС‚Р°РІСЊС‚Рµ РїСѓСЃС‚Рѕ РґР»СЏ Р°РІС‚РѕС„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёСЏ"
          rows={4}
          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
        />
      </div>

      <div>
        <TelegramPreviewWithToggle
          message={messageTemplate}
          payload={payloadExample}
          context="rule"
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px' }}>
        <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} aria-label="Включено" />
        <label htmlFor="enabled" style={{ cursor: 'pointer', fontSize: '40px', fontWeight: 700, lineHeight: 1 }}>
          Включено
        </label>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button
          type="submit"
          disabled={loading}
          style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none', opacity: loading ? 0.5 : 1 }}
        >
          {loading ? 'РЎРѕС…СЂР°РЅРµРЅРёРµ...' : 'РЎРѕС…СЂР°РЅРёС‚СЊ Webhook'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}
        >
          РћС‚РјРµРЅР°
        </button>
      </div>
    </form>
  );
}

