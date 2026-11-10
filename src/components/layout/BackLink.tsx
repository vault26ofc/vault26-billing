import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useT } from '../../i18n';

// "← Back" at the top-left of every screen except Home: plain text with a red
// arrow, no box. It goes to the previous screen; a page opened straight from a
// link has no previous screen in this app, so it goes Home instead.
export const BackLink: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();

  if (location.pathname === '/dashboard') return null;

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/dashboard');
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="group mb-3 -ml-1 inline-flex items-center gap-2 h-10 px-1 text-base font-bold text-v26-ink hover:text-v26-red transition-colors no-print"
    >
      <ArrowLeft size={22} className="text-v26-red transition-transform group-hover:-translate-x-0.5" />
      <span>{t('Back')}</span>
    </button>
  );
};
