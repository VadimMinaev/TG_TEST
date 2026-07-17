import { createBrowserRouter, redirect } from 'react-router';
import { Root } from './pages/Root';

function redirectToTelegram(tab: 'automation' | 'ai-bots' | 'reminders', includeSettings = false) {
  return ({ request }: { request: Request }) => {
    const source = new URL(request.url);
    const params = new URLSearchParams(source.search);
    params.set('tab', tab);
    if (includeSettings) params.set('settings', 'true');
    else params.delete('settings');
    return redirect(`/telegram?${params.toString()}`);
  };
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { path: 'login', lazy: async () => ({ Component: (await import('./pages/Login')).Login }) },
      {
        path: '',
        lazy: async () => ({ Component: (await import('./pages/Dashboard')).Dashboard }),
        children: [
          { index: true, lazy: async () => ({ Component: (await import('./pages/Rules')).Rules }) },
          { path: 'rules', lazy: async () => ({ Component: (await import('./pages/Rules')).Rules }) },
          { path: 'testing', lazy: async () => ({ Component: (await import('./pages/Testing')).Testing }) },
          { path: 'operations', loader: () => redirect('/?tab=overview') },
          { path: 'history', loader: () => redirect('/?tab=history') },
          { path: 'queue', loader: () => redirect('/?tab=queue') },
          { path: 'polling', lazy: async () => ({ Component: (await import('./pages/Polling')).Polling }) },
          { path: 'polling-history', loader: () => redirect('/?tab=polling-history') },
          { path: 'integrations', lazy: async () => ({ Component: (await import('./pages/Integrations')).Integrations }) },
          { path: 'integration-history', loader: () => redirect('/?tab=integration-history') },
          { path: 'bots', loader: redirectToTelegram('automation') },
          { path: 'bot-history', loader: () => redirect('/?tab=bot-history') },
          { path: 'accounts', lazy: async () => ({ Component: (await import('./pages/Accounts')).Accounts }) },
          { path: 'users', lazy: async () => ({ Component: (await import('./pages/Users')).Users }) },
          { path: 'telegram', lazy: async () => ({ Component: (await import('./pages/Telegram')).Telegram }) },
          { path: 'reminders', loader: redirectToTelegram('reminders') },
          { path: 'reminders/settings', loader: redirectToTelegram('reminders', true) },
          { path: 'ai-bots', loader: redirectToTelegram('ai-bots') },
        ],
      },
    ],
  },
]);
