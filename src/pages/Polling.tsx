export function Polling() {
  return (
    <div className="rounded-lg border border-[hsl(var(--border)_/_0.7)] bg-[hsl(var(--card)_/_0.9)] p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold">🔁 Пуллинг</h2>
      <p className="text-[hsl(var(--muted-foreground))]">
        Функция пуллинга позволяет периодически опрашивать внешние API и отправлять уведомления в Telegram
        при выполнении заданных условий.
      </p>
      <p className="mt-4 text-[hsl(var(--muted-foreground))]">
        Эта функция будет доступна в следующей версии приложения.
      </p>
    </div>
  );
}
