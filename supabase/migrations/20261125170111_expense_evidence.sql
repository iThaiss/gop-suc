create table gopsuc.expense_photos (
  expense_id integer primary key references gopsuc.expenses(id) on delete cascade,
  image bytea not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  is_public integer not null default 1 check (is_public in (0,1))
);
alter table gopsuc.expense_photos enable row level security;
revoke all on gopsuc.expense_photos from public, anon, authenticated;
grant select, insert on gopsuc.expense_photos to gopsuc_runtime;
grant update (is_public) on gopsuc.expense_photos to gopsuc_runtime;
create policy server_only on gopsuc.expense_photos for all to gopsuc_runtime using (true) with check (true);
