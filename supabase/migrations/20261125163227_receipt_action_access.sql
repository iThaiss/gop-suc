-- Existing receipts keep their read-only codes. Never derive write access from a lookup code.
alter table gopsuc.receipts add column action_hash text check (action_hash ~ '^[0-9a-f]{64}$');
alter table gopsuc.volunteer_bookings add column action_hash text check (action_hash ~ '^[0-9a-f]{64}$');
