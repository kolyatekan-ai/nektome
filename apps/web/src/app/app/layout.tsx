'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { useApp } from '@/store/app';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading, hydrate } = useAuth();
  const { loadServers, initSocket } = useApp();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    initSocket();
    loadServers();
  }, [user, loading, router, initSocket, loadServers]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center text-textMuted">
        Loading…
      </div>
    );
  }

  return <div className="flex h-screen overflow-hidden">{children}</div>;
}
