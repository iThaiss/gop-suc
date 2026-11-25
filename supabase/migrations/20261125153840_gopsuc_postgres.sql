create schema if not exists gopsuc;
revoke all on schema gopsuc from public, anon, authenticated;
set local search_path = gopsuc, pg_catalog;

create table gopsuc.campaigns (
  slug text primary key, title text not null, description text not null, category text not null,
  location text not null, cover text not null, goal integer not null check(goal>0),
  status text not null check(status in('draft','active','closed')), owner text not null,
  position integer generated always as identity
);
create table gopsuc.needs (
  id integer generated always as identity primary key, slug text not null references campaigns(slug),
  name text not null, unit text not null, target integer not null check(target>0), handoff text not null, topic text not null
);
create table gopsuc.receipts (
  code text primary key, slug text not null references campaigns(slug), kind text not null check(kind in('cash','goods')),
  amount integer not null check(amount>0), status text not null default 'pending' check(status in('pending','confirmed','cancelled')),
  actual integer, needId integer references needs(id), name text, note text,
  created text not null default to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI:SS'),
  sequence bigint generated always as identity
);
create table gopsuc.expenses (
  id integer generated always as identity primary key, slug text not null references campaigns(slug),
  title text not null, amount integer not null check(amount>0), evidence text not null,
  created text not null default to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI:SS')
);
create table gopsuc.updates (
  id integer generated always as identity primary key, slug text not null references campaigns(slug),
  title text not null, body text not null, image text not null default '',
  created text not null default to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI:SS')
);
create table gopsuc.update_photos (
  updateId integer primary key references updates(id) on delete cascade, image bytea not null
);
create table gopsuc.volunteer_shifts (
  id integer generated always as identity primary key, slug text not null references campaigns(slug),
  title text not null, location text not null, startsAt text not null, capacity integer not null check(capacity>0)
);
create table gopsuc.volunteer_bookings (
  code text primary key, shiftId integer not null references volunteer_shifts(id),
  status text not null check(status in('booked','cancelled'))
);
create table gopsuc.sessions (token text primary key, role text not null, until bigint not null);
create table gopsuc.limits (key text primary key, count integer not null, until bigint not null);

create index needs_slug on gopsuc.needs(slug);
create index receipts_campaign on gopsuc.receipts(slug,kind,status,sequence desc);
create index receipts_need on gopsuc.receipts(needId,status);
create index expenses_slug on gopsuc.expenses(slug,id desc);
create index updates_slug on gopsuc.updates(slug,id desc);
create index volunteer_shifts_campaign on gopsuc.volunteer_shifts(slug,startsAt);
create index volunteer_bookings_shift on gopsuc.volunteer_bookings(shiftId,status);
create index sessions_until on gopsuc.sessions(until);
create index limits_until on gopsuc.limits(until);

do $$
begin
  if not exists (select 1 from pg_roles where rolname='gopsuc_runtime') then
    create role gopsuc_runtime nologin;
  end if;
end
$$;

grant usage on schema gopsuc to gopsuc_runtime;
grant select, insert, update on all tables in schema gopsuc to gopsuc_runtime;
grant delete on gopsuc.sessions, gopsuc.limits to gopsuc_runtime;
grant usage on all sequences in schema gopsuc to gopsuc_runtime;
revoke all on all tables in schema gopsuc from public, anon, authenticated;

do $$
declare relation text;
begin
  foreach relation in array array['campaigns','needs','receipts','expenses','updates','update_photos',
    'volunteer_shifts','volunteer_bookings','sessions','limits']
  loop
    execute format('alter table gopsuc.%I enable row level security', relation);
    execute format('create policy server_only on gopsuc.%I for all to gopsuc_runtime using (true) with check (true)', relation);
  end loop;
end
$$;

insert into campaigns(slug,title,description,category,location,cover,goal,status,owner) values
  ('lop-hoc-sau-mua','Góp lại lớp học sau mùa mưa','Cùng sửa phòng học và chuẩn bị đồ dùng để một điểm trường miền núi có thể đón học sinh trở lại. Các khoản chi và mốc bàn giao được cập nhật công khai.','Giáo dục','Quảng Nam','school',60000000,'active','organizer'),
  ('bep-am-cuoi-tuan','Bếp ấm cuối tuần','Hỗ trợ một bếp cộng đồng chuẩn bị các phần ăn cho người đang chăm bệnh nhân. Có thể góp kinh phí hoặc gửi nguyên liệu theo danh sách.','Thực phẩm','Đà Nẵng','meals',25000000,'active','organizer'),
  ('vat-tu-sau-mua','Vật tư cho ngày trở lại','Góp bộ vệ sinh, chăn và chi phí vận chuyển để các gia đình sớm ổn định sinh hoạt.','Cứu trợ','Huế','relief',40000000,'active','organizer');
insert into needs(slug,name,unit,target,handoff,topic) values
  ('lop-hoc-sau-mua','Bộ dụng cụ học tập','bộ',120,'Điểm nhận demo A · Thứ bảy, 08:00–11:00','learning'),
  ('lop-hoc-sau-mua','Bộ vệ sinh lớp học','bộ',30,'Điểm nhận demo A · Thứ bảy, 08:00–11:00','cleaning'),
  ('bep-am-cuoi-tuan','Gạo đóng túi','kg',150,'Điểm nhận demo B · Chủ nhật, 07:00–09:00','food'),
  ('vat-tu-sau-mua','Chăn sạch','chiếc',80,'Điểm nhận demo C · Thứ bảy, 08:00–12:00','blankets');
insert into receipts(code,slug,kind,amount,status,name)
select replace(gen_random_uuid()::text,'-',''), x.slug,'cash',x.amount,'confirmed','Dữ liệu mẫu'
from (values ('lop-hoc-sau-mua',36500000), ('bep-am-cuoi-tuan',12400000), ('vat-tu-sau-mua',27200000)) as x(slug,amount);
insert into receipts(code,slug,kind,amount,status,actual,needId)
select replace(gen_random_uuid()::text,'-',''),slug,'goods',80,'confirmed',80,id
from needs where slug='lop-hoc-sau-mua' and topic='learning';
insert into expenses(slug,title,amount,evidence) values
  ('lop-hoc-sau-mua','Thay cửa và sửa nền hai phòng học',12500000,'Biên bản mô phỏng GS-001: sửa nền và thay cửa cho hai phòng học.');
insert into updates(slug,title,body,image) values
  ('lop-hoc-sau-mua','Đã nhận 80 bộ dụng cụ học tập','Ban tổ chức đã kiểm đếm và đóng gói 80 bộ. Điểm nhận vẫn mở vào sáng thứ bảy theo lịch đăng trên trang.','school');
insert into volunteer_shifts(slug,title,location,startsAt,capacity) values
  ('lop-hoc-sau-mua','Đóng gói đồ dùng học tập','Điểm nhận demo A',
  to_char((now() at time zone 'UTC')::date + interval '7 days 2 hours','YYYY-MM-DD"T"HH24:MI:SS".000Z"'),8);
