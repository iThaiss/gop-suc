create table gopsuc.request_replays (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  reference text not null check (length(reference) between 1 and 32)
);
alter table gopsuc.request_replays enable row level security;
revoke all on gopsuc.request_replays from public, anon, authenticated;
grant select, insert on gopsuc.request_replays to gopsuc_runtime;
create policy server_only on gopsuc.request_replays for all to gopsuc_runtime using (true) with check (true);
