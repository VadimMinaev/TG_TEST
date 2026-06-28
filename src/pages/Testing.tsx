import { useState } from 'react';
import { api } from '../lib/api';

export function Testing() {
  const [testCondition, setTestCondition] = useState('payload.category === "incident"');
  const [testPayload, setTestPayload] = useState(`{
  "team_id": 40,
  "category": "incident",
  "impact": "medium",
  "subject": "Тестовая заявка"
}`);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testBotToken, setTestBotToken] = useState('');
  const [testChatId, setTestChatId] = useState('');
  const [testMessage, setTestMessage] = useState('Тестовое сообщение из webhook интеграции');
  const [telegramResult, setTelegramResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestCondition = () => {
    try {
      const payload = JSON.parse(testPayload);
      const fn = new Function('payload', `return ${testCondition}`);
      const result = fn(payload);
      setTestResult({
        success: true,
        message: `Результат: ${result ? 'TRUE ✅' : 'FALSE ❌'}`,
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Ошибка: ${error.message}`,
      });
    }
  };

  const handleTestTelegram = async () => {
    try {
      const result = await api.testSend(testChatId, testMessage, testBotToken || undefined);
      if (result.success) {
        setTelegramResult({
          success: true,
          message: `✅ Отправлено! Сообщение доставлено в чат ${testChatId}`,
        });
      } else {
        setTelegramResult({
          success: false,
          message: `❌ Ошибка: ${result.error?.description || result.error || 'Unknown error'}`,
        });
      }
    } catch (error: any) {
      setTelegramResult({
        success: false,
        message: `❌ Ошибка: ${error.message}`,
      });
    }
  };

  const handleSaveToken = async () => {
    try {
      await api.saveBotToken(testBotToken);
      setTelegramResult({
        success: true,
        message: '✅ Токен сохранен!',
      });
    } catch (error: any) {
      setTelegramResult({
        success: false,
        message: `❌ Ошибка: ${error.message}`,
      });
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold">🧪 Тестирование</h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
        {/* Левая колонка - Тестирование условий */}
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div style={{ padding: '16px', borderBottom: '1px solid hsl(var(--border))' }}>
            <h3 className="font-semibold">🔍 Тестирование условий</h3>
          </div>
          <div style={{ padding: '16px' }} className="space-y-4">
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>
                Условие (JavaScript)
              </label>
              <input
                type="text"
                value={testCondition}
                onChange={(e) => setTestCondition(e.target.value)}
                placeholder='payload.category === "incident"'
                style={{ padding: '10px 12px', width: '100%', borderRadius: '6px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>
                Тестовый payload (JSON)
              </label>
              <textarea
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                rows={6}
                style={{ padding: '10px 12px', width: '100%', borderRadius: '6px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' }}
              />
            </div>

            <button
              onClick={handleTestCondition}
              style={{ padding: '10px 16px', borderRadius: '6px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 500, cursor: 'pointer', border: 'none', fontSize: '13px' }}
            >
              🚀 Протестировать
            </button>

            {testResult && (
              <div
                style={{ padding: '12px', borderRadius: '6px', fontSize: '13px' }}
                className={`${
                  testResult.success
                    ? 'border border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                    : 'border border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка - Тест Telegram */}
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div style={{ padding: '16px', borderBottom: '1px solid hsl(var(--border))' }}>
            <h3 className="font-semibold">📤 Тест отправки в Telegram</h3>
          </div>
          <div style={{ padding: '16px' }} className="space-y-4">
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>
                Токен бота
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={testBotToken}
                  onChange={(e) => setTestBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjkl..."
                  style={{ padding: '10px 12px', flex: 1, borderRadius: '6px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontSize: '13px' }}
                />
                <button
                  onClick={handleSaveToken}
                  style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary))', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
                  title="Сохранить как токен аккаунта"
                >
                  💾
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>
                ID чата
              </label>
              <input
                type="text"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
                placeholder="-1001234567890"
                style={{ padding: '10px 12px', width: '100%', borderRadius: '6px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>
                Тестовое сообщение
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={3}
                style={{ padding: '10px 12px', width: '100%', borderRadius: '6px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontSize: '13px', resize: 'vertical' }}
              />
            </div>

            <button
              onClick={handleTestTelegram}
              style={{ padding: '10px 16px', borderRadius: '6px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 500, cursor: 'pointer', border: 'none', fontSize: '13px' }}
            >
              📨 Отправить
            </button>

            {telegramResult && (
              <div
                style={{ padding: '12px', borderRadius: '6px', fontSize: '13px' }}
                className={`${
                  telegramResult.success
                    ? 'border border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                    : 'border border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                }`}
              >
                {telegramResult.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
