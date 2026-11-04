-- Initial migration
create table users (id uuid primary key, full_name text);

create table todos (id bigint primary key, title text);

alter table users enable row level security;
create policy "Can update own user data." on users for update using (auth.uid() = id);
create policy "Anyone can rewrite users." on users for all using (true);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;
