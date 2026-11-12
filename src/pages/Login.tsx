import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { store } from '../services/store';
import { signIn } from '../api/auth';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useT } from '../i18n';
import { LanguageSwitch } from '../components/common/LanguageSwitch';
import { MadeBy } from '../components/common/MadeBy';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const t = useT();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { staff } = await signIn(username, password);
      store.addToast(t('Welcome'), staff.display_name, 'success');
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not sign in.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-v26-page flex flex-col text-v26-ink">
      <header className="bg-v26-paper border-t-4 border-t-v26-red border-b border-v26-line h-16 px-4 sm:px-8 flex items-center justify-between">
        <span className="font-display text-2xl">Vault 26</span>
        <LanguageSwitch />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="card w-full max-w-md p-6 sm:p-8">
          <h1 className="font-display text-3xl sm:text-4xl">{t('Shop billing')}</h1>
          <p className="text-base text-v26-muted mt-2">{t('Sign in with your username and password.')}</p>

          <form onSubmit={handleSubmit} className="space-y-5 mt-6">
            {error && (
              <div role="alert" className="text-base text-status-red border border-status-redBorder bg-status-redBg px-3 py-2.5">
                {error}
              </div>
            )}

            <Input
              label={t('Username')}
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />

            <Input
              label={t('Password')}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
              icon={loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
              iconPosition="right"
            >
              {loading ? t('Signing in…') : t('Sign in')}
            </Button>
          </form>
        </div>
      </main>
      <MadeBy />
    </div>
  );
};
