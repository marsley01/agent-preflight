-- For databases created from an older schema.sql: anonymous inserts could set any user_id,
-- planting rows in other users' history. Restrict them to unowned rows or the caller's own id.
-- Safe to run more than once.

alter policy "Anyone can insert scan reports"
  on public.scan_reports
  with check ( user_id is null or user_id = (select auth.uid()) );

alter policy "Anyone can insert scan history"
  on public.scan_history
  with check ( user_id is null or user_id = (select auth.uid()) );
