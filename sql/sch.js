-- ============================================================
-- FinTrack — Supabase Schema (run in Supabase SQL Editor)
-- ============================================================

-- 1. PROFILES (one row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  currency text default 'USD',
  created_at timestamptz default now()
);

-- Auto-create profile + capture email on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row execute procedure public.handle_new_user();

-- 2. ACCOUNTS
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash','bank','wallet','upi','credit_card')),
  initial_balance numeric(14,2) default 0,
  created_at timestamptz default now()
);

-- 3. CATEGORIES
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  icon text,
  created_at timestamptz default now()
);

-- 4. TRANSACTIONS
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(14,2) not null,
  type text not null check (type in ('income','expense','transfer')),
  date date not null default current_date,
  note text,
  attachment_url text,
  transfer_peer uuid,
  created_at timestamptz default now()
);
create index if not exists tx_user_date_idx on public.transactions(user_id, date desc);

-- 5. BUDGETS (one per category per month)
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  period_start date not null,
  created_at timestamptz default now(),
  unique (user_id, category_id, period_start)
);

-- 6. SHARED USERS (read-only sharing)
create table if not exists public.shared_users (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  shared_with_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (owner_id, shared_with_id),
  constraint no_self_share check (owner_id <> shared_with_id)
);
-- Foreign keys named so PostgREST can embed profiles:
alter table public.shared_users
  drop constraint if exists shared_users_owner_id_fkey,
  add constraint shared_users_owner_id_fkey foreign key (owner_id) references public.profiles(id) on delete cascade;
alter table public.shared_users
  drop constraint if exists shared_users_shared_with_id_fkey,
  add constraint shared_users_shared_with_id_fkey foreign key (shared_with_id) references public.profiles(id) on delete cascade;

-- 7. NOTIFICATIONS (optional)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- Grants (Data API)
-- ============================================================
grant select, insert, update, delete on
  public.profiles, public.accounts, public.categories,
  public.transactions, public.budgets, public.shared_users,
  public.notifications
to authenticated;

grant all on
  public.profiles, public.accounts, public.categories,
  public.transactions, public.budgets, public.shared_users,
  public.notifications
to service_role;

-- ============================================================
-- Helper: can user X read user Y's data?
-- ============================================================
create or replace function public.can_read(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or exists (select 1 from public.shared_users
                 where owner_id = owner and shared_with_id = auth.uid());
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.accounts      enable row level security;
alter table public.categories    enable row level security;
alter table public.transactions  enable row level security;
alter table public.budgets       enable row level security;
alter table public.shared_users  enable row level security;
alter table public.notifications enable row level security;

-- PROFILES: a user can read their own profile + any profile they share with / who shares with them.
drop policy if exists "profile read" on public.profiles;
create policy "profile read" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (select 1 from public.shared_users s where (s.owner_id=id and s.shared_with_id=auth.uid()) or (s.shared_with_id=id and s.owner_id=auth.uid()))
  );
drop policy if exists "profile self upsert" on public.profiles;
create policy "profile self upsert" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profile self update" on public.profiles;
create policy "profile self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Generic owner-or-shared READ + owner-only WRITE for the rest
do $$ declare t text; begin
  for t in select unnest(array['accounts','categories','transactions','budgets','notifications']) loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select to authenticated using (public.can_read(user_id))', t, t);
    execute format('drop policy if exists "%s insert" on public.%I', t, t);
    execute format('create policy "%s insert" on public.%I for insert to authenticated with check (user_id = auth.uid())', t, t);
    execute format('drop policy if exists "%s update" on public.%I', t, t);
    execute format('create policy "%s update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('drop policy if exists "%s delete" on public.%I', t, t);
    execute format('create policy "%s delete" on public.%I for delete to authenticated using (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- SHARED USERS policies
drop policy if exists "shared read" on public.shared_users;
create policy "shared read" on public.shared_users for select to authenticated
  using (owner_id = auth.uid() or shared_with_id = auth.uid());
drop policy if exists "shared write" on public.shared_users;
create policy "shared write" on public.shared_users for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "shared delete" on public.shared_users;
create policy "shared delete" on public.shared_users for delete to authenticated using (owner_id = auth.uid());

-- ============================================================
-- Storage bucket for receipts
-- ============================================================
insert into storage.buckets (id, name, public) values ('receipts','receipts', false)
on conflict (id) do nothing;

-- Users can manage files only in their own folder (path begins with their user id)
drop policy if exists "receipts read own" on storage.objects;
create policy "receipts read own" on storage.objects for select to authenticated
  using (bucket_id='receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "receipts write own" on storage.objects;
create policy "receipts write own" on storage.objects for insert to authenticated
  with check (bucket_id='receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "receipts delete own" on storage.objects;
create policy "receipts delete own" on storage.objects for delete to authenticated
  using (bucket_id='receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table public.accounts;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.budgets;
