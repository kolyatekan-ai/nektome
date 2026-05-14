'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-bgDeep">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-accent/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-accentDark/10 blur-[120px]" />

      <form
        onSubmit={onSubmit}
        className="glass titanium-border relative z-10 w-full max-w-md rounded-2xl p-8"
      >
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-grad text-2xl font-bold text-bgDeep shadow-glow">
            B
          </div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back to{' '}
            <span className="bg-accent-grad bg-clip-text text-transparent">
              Burmalda
            </span>
          </h1>
          <p className="mt-1 text-sm text-textMuted">
            We&apos;re so excited to see you again!
          </p>
        </div>

        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-textSoft">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          className="mb-4 w-full rounded-lg border border-border bg-bgInput px-3.5 py-2.5 text-textMain shadow-inner-shine outline-none transition-colors focus:border-accent/50"
        />

        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-textSoft">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-5 w-full rounded-lg border border-border bg-bgInput px-3.5 py-2.5 text-textMain shadow-inner-shine outline-none transition-colors focus:border-accent/50"
        />

        {error && (
          <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent-grad py-2.5 font-semibold text-bgDeep shadow-glow-sm transition-all hover:shadow-glow disabled:opacity-60"
        >
          {loading ? 'Logging in…' : 'Log In'}
        </button>

        <p className="mt-5 text-center text-sm text-textMuted">
          Need an account?{' '}
          <Link
            href="/register"
            className="text-accent transition-colors hover:text-accentHi"
          >
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
