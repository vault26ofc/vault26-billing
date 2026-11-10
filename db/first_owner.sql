-- db/first_owner.sql
-- Run ONCE, after 0001 and 0002, to give the shop owner the first billing login.
-- After this, the owner adds every other staff login from the billing app
-- (Settings & staff -> Add staff). Nobody types an email anywhere.
--
-- Step 1 - Supabase dashboard -> Authentication -> Users -> "Add user":
--   Email:    <username>@pos.vault26.co.in      (e.g. owner@pos.vault26.co.in)
--   Password: the owner's password
--   Tick "Auto Confirm User".
--   The owner then signs in to the billing app with just: owner / <password>
--
-- Step 2 - replace the two values below and run this in the SQL editor.

do $$
declare
  v_login text := 'owner@pos.vault26.co.in';   -- the email from step 1
  v_name  text := 'Owner';                     -- name shown in the app
  v_user  uuid;
begin
  select id into v_user from auth.users where email = v_login;
  if v_user is null then
    raise exception 'No login % - create it in Authentication -> Users first', v_login;
  end if;

  -- 'admin' = owner can also open the Vault 26 website admin, and can add staff.
  insert into public.user_roles (user_id, role) values (v_user, 'admin')
  on conflict (user_id, role) do nothing;

  insert into public.pos_staff (user_id, display_name, role, permissions, is_active)
  values (
    v_user, v_name, 'OWNER',
    array['DASHBOARD','BILLING','BILLS','TAGS','AUDIT','MONTHLY_BILLS','PRODUCTS','CUSTOMERS','SETTINGS'],
    true
  )
  on conflict (user_id) do update
    set role = 'OWNER', is_active = true, display_name = excluded.display_name, permissions = excluded.permissions;
end $$;
