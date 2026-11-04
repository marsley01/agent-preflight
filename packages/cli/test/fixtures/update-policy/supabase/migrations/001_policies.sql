create table public.profiles (id uuid primary key, owner uuid);
alter table public.profiles enable row level security;

-- Safe: no WITH CHECK, so Postgres re-applies USING to the new row.
create policy "update own (implicit check)" on public.profiles
  for update using (auth.uid() = owner);

-- Safe: WITH CHECK matches USING.
create policy "update own (explicit check)" on public.profiles
  for update using (auth.uid() = owner) with check (auth.uid() = owner);

-- Unsafe: WITH CHECK (true) is looser than USING, so owners can hand rows to anyone.
create policy "update own, rewrite anything" on public.profiles
  for update using (auth.uid() = owner) with check (true);
