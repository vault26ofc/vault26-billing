import { supabase } from '../lib/supabaseClient';
import { DbPosStaff } from '../types/supabase';
import { tr } from '../i18n';

export async function getCurrentStaff(): Promise<DbPosStaff | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from('pos_staff')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as DbPosStaff | null;
}

// Billing logins are usernames (e.g. ravi). Supabase signs in by email, so a
// username maps to <username>@pos.vault26.co.in; a full email still works.
export const POS_LOGIN_DOMAIN = 'pos.vault26.co.in';
export const loginEmail = (identifier: string) => {
  const id = identifier.trim();
  return id.includes('@') ? id : `${id.toLowerCase()}@${POS_LOGIN_DOMAIN}`;
};

export async function signIn(identifier: string, password: string): Promise<{ staff: DbPosStaff }> {
  const { error: authError } = await supabase.auth.signInWithPassword({ email: loginEmail(identifier), password });
  if (authError) {
    throw new Error(
      authError.message === 'Invalid login credentials' ? tr('Wrong username or password.') : authError.message
    );
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    await supabase.auth.signOut();
    throw new Error(tr('This login is not a Vault 26 billing staff account.'));
  }

  return { staff };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function onAuthChange(callback: (signedIn: boolean) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(!!session);
  });
  return () => data.subscription.unsubscribe();
}
