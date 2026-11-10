import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { isSupabaseConfigured } from './lib/supabaseClient';

const root = createRoot(document.getElementById('root')!);

if (!isSupabaseConfigured) {
  root.render(
    <div style={{ fontFamily: 'Lato, system-ui, sans-serif', padding: 32, maxWidth: 560 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Vault 26 Billing is not set up yet</h1>
      <p style={{ fontSize: 16, lineHeight: 1.6 }}>
        Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (the same values
        vault26.co.in uses) in <code>.env</code> or in the hosting settings, then rebuild.
      </p>
    </div>
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
