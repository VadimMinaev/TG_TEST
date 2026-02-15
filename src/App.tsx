import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './lib/auth-context';
import { ToastProvider } from './components/ToastNotification';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  );
}
