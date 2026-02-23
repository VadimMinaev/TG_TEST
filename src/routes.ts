import { createBrowserRouter, redirect } from 'react-router';
import { Root } from './pages/Root';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Rules } from './pages/Rules';
import { Testing } from './pages/Testing';
import { Polling } from './pages/Polling';
import { Integrations } from './pages/Integrations';
import { Users } from './pages/Users';
import { Accounts } from './pages/Accounts';
import { Telegram } from './pages/Telegram';

function redirectToTelegram(tab: 'automation' | 'ai-bots' | 'reminders', includeSettings = false) {
  return ({ request }: { request: Request }) => {
    const source = new URL(request.url);
    const params = new URLSearchParams(source.search);
    params.set('tab', tab);
    if (includeSettings) {
      params.set('settings', 'true');
    } else {
      params.delete('settings');
    }
    return redirect(`/telegram?${params.toString()}`);
  };
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { path: 'login', Component: Login },
      {
        path: '',
        Component: Dashboard,
        children: [
          { index: true, Component: Rules },
          { path: 'rules', Component: Rules },
          { path: 'testing', Component: Testing },
          { path: 'operations', loader: () => redirect('/?tab=overview') },
          { path: 'history', loader: () => redirect('/?tab=history') },
          { path: 'queue', loader: () => redirect('/?tab=queue') },
          { path: 'polling', Component: Polling },
          { path: 'polling-history', loader: () => redirect('/?tab=polling-history') },
          { path: 'integrations', Component: Integrations },
          { path: 'integration-history', loader: () => redirect('/?tab=integration-history') },
          { path: 'bots', loader: redirectToTelegram('automation') },
          { path: 'bot-history', loader: () => redirect('/?tab=bot-history') },
          { path: 'accounts', Component: Accounts },
          { path: 'users', Component: Users },
          { path: 'telegram', Component: Telegram },
          { path: 'reminders', loader: redirectToTelegram('reminders') },
          { path: 'reminders/settings', loader: redirectToTelegram('reminders', true) },
          { path: 'ai-bots', loader: redirectToTelegram('ai-bots') },
        ],
      },
    ],
  },
]);
