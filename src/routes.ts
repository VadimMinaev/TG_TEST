import { createBrowserRouter, redirect } from 'react-router';
import { Root } from './pages/Root';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Operations } from './pages/Operations';
import { Rules } from './pages/Rules';
import { Testing } from './pages/Testing';
import { Polling } from './pages/Polling';
import { Integrations } from './pages/Integrations';
import { Users } from './pages/Users';
import { Bots } from './pages/Bots';
import { Accounts } from './pages/Accounts';
import { Reminders } from './pages/Reminders';
import { ReminderSettingsPage } from './pages/ReminderSettings';

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
          { path: 'operations', Component: Operations },
          { path: 'history', loader: () => redirect('/operations?tab=history') },
          { path: 'queue', loader: () => redirect('/operations?tab=queue') },
          { path: 'polling', Component: Polling },
          { path: 'polling-history', loader: () => redirect('/operations?tab=polling-history') },
          { path: 'integrations', Component: Integrations },
          { path: 'integration-history', loader: () => redirect('/operations?tab=integration-history') },
          { path: 'bots', Component: Bots },
          { path: 'bot-history', loader: () => redirect('/operations?tab=bot-history') },
          { path: 'accounts', Component: Accounts },
          { path: 'users', Component: Users },
          { path: 'reminders', Component: Reminders },
          { path: 'reminders/settings', Component: ReminderSettingsPage },
        ],
      },
    ],
  },
]);
