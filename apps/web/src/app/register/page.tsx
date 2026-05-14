'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, username, displayName || username, password);
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
        <h1 className="mb-6 text-2xl font-bold text-white">
          Create your account
        </h1>

        {[
          { label: 'Email', value: email, set: setEmail, type: 'email' },
          { label: 'Username', value: username, set: setUsername, type: 'text' },
          {
            label: 'Display name',
            value: displayName,
            set: setDisplayName,
            type: 'text',
          },
          {
            label: 'Password',
            value: password,
            set: setPassword,
            type: 'password',
          },
        ].map((f) => (
          <div key={f.label} className="mb-4">
            <label className="mb-1 block text-xs font-bold uppercase text-textMuted">
              {f.label}
            </label>
            <input
              type={f.type}
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              required
              className="w-full rounded bg-bgDeep px-3 py-2 text-textMain outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        ))}

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-accent py-2 font-medium text-white hover:bg-accentHover disabled:opacity-60"
        >
          {loading ? 'Creating…' : 'Continue'}
        </button>

        <p className="mt-4 text-sm text-textMuted">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
