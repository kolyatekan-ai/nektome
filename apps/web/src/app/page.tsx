'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, hydrate } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (loading) return;
    if (user) router.replace('/app');
    else router.replace('/login');
  }, [user, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center text-textMuted">
      Loading…
    </div>
  );
}
