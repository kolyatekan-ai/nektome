'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('alice@burmalda.app');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push('/app');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-bgDeep">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-lg bg-bgSidebar p-8 shadow-xl"
      >
        <h1 className="mb-2 text-2xl font-bold text-white">
          Welcome back to Burmalda
        </h1>
        <p className="mb-6 text-sm text-textMuted">
          We&apos;re so excited to see you again!
        </p>

        <label className="mb-1 block text-xs font-bold uppercase text-textMuted">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-4 w-full rounded bg-bgDeep px-3 py-2 text-textMain outline-none focus:ring-2 focus:ring-accent"
        />

        <label className="mb-1 block text-xs font-bold uppercase text-textMuted">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-4 w-full rounded bg-bgDeep px-3 py-2 text-textMain outline-none focus:ring-2 focus:ring-accent"
        />

        {error && (
          <p className="mb-3 text-sm text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-accent py-2 font-medium text-white hover:bg-accentHover disabled:opacity-60"
        >
          {loading ? 'Logging in…' : 'Log In'}
        </button>

        <p className="mt-4 text-sm text-textMuted">
          Need an account?{' '}
          <Link href="/register" className="text-accent hover:underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
