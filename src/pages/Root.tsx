import { Outlet } from 'react-router';
import { useEffect } from 'react';

export function Root() {
  useEffect(() => {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark-theme');
    }
  }, []);

  return <Outlet />;
}
