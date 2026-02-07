import { createBrowserRouter } from 'react-router';
import { Root } from './pages/Root';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Rules } from './pages/Rules';
import { Testing } from './pages/Testing';
import { History } from './pages/History';
import { Queue } from './pages/Queue';
import { Polling } from './pages/Polling';
import { PollingHistory } from './pages/PollingHistory';
import { Integrations } from './pages/Integrations';
import { IntegrationHistory } from './pages/IntegrationHistory';
import { Users } from './pages/Users';
import { Bots } from './pages/Bots';
import { BotHistory } from './pages/BotHistory';
import { Accounts } from './pages/Accounts';

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
          { path: 'testing', Component: Testing },
          { path: 'history', Component: History },
          { path: 'queue', Component: Queue },
          { path: 'polling', Component: Polling },
          { path: 'polling-history', Component: PollingHistory },
          { path: 'integrations', Component: Integrations },
          { path: 'integration-history', Component: IntegrationHistory },
          { path: 'bots', Component: Bots },
          { path: 'bot-history', Component: BotHistory },
          { path: 'accounts', Component: Accounts },
          { path: 'users', Component: Users },
        ],
      },
    ],
  },
]);
