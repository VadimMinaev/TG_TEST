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
        message: '✅ Токен сохранен! Глобальный токен бота успешно сохранен.',
      });
    } catch (error: any) {
      setTelegramResult({
        success: false,
        message: `❌ Ошибка: ${error.message}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Тестирование условий */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">🧪 Тестирование условий</h2>
        </div>
        <div className="p-6">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                Условие (JavaScript выражение)
              </label>
              <input
                type="text"
                value={testCondition}
                onChange={(e) => setTestCondition(e.target.value)}
                placeholder='payload.category === "incident"'
                style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                Тестовый payload (JSON)
              </label>
              <textarea
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                rows={8}
                style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
              />
            </div>

            <div>
              <button
                onClick={handleTestCondition}
                style={{ padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}
              >
                🚀 Протестировать условие
              </button>
            </div>

            {testResult && (
              <div
                style={{ padding: '16px', borderRadius: '8px' }}
                className={`${
                  testResult.success
                    ? 'border border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                    : 'border border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                }`}
              >
                <strong>{testResult.message}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Тест отправки в Telegram */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">📤 Тест отправки в Telegram</h2>
        </div>
        <div className="p-6">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                Токен бота
              </label>
              <input
                type="password"
                value={testBotToken}
                onChange={(e) => setTestBotToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
              />
              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={handleSaveToken}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary))', cursor: 'pointer', fontSize: '14px' }}
                >
                  💾 Сохранить как глобальный токен
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                ID чата
              </label>
              <input
                type="text"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
                placeholder="-1001234567890"
                style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                Тестовое сообщение
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={4}
                style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontSize: '14px', resize: 'vertical' }}
              />
            </div>

            <div>
              <button
                onClick={handleTestTelegram}
                style={{ padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}
              >
                📨 Отправить тестовое сообщение
              </button>
            </div>

            {telegramResult && (
              <div
                style={{ padding: '16px', borderRadius: '8px' }}
                className={`${
                  telegramResult.success
                    ? 'border border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                    : 'border border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                }`}
              >
                <strong>{telegramResult.message}</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
