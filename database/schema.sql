-- Rifqy Part AC Mobil: private records; authenticated API wrappers only.
create schema if not exists rifqy;
revoke all on schema rifqy from public, anon;
grant usage on schema rifqy to authenticated;
alter default privileges in schema rifqy revoke execute on functions from public;
create table rifqy.members(email text primary key check(email=lower(email)), role text not null check(role in ('owner','admin')), active boolean not null default true);
create unique index one_owner on rifqy.members(role) where role='owner';
create table rifqy.products(id text primary key, sku text not null unique, name text not null, brand text not null default '', category text not null, cost numeric(14,0) not null check(cost>=0), retail numeric(14,0) not null check(retail>=0), wholesale numeric(14,0) not null check(wholesale>=0), stock integer not null default 0 check(stock>=0), minimum integer not null default 0 check(minimum>=0), rack text not null default '', fit text not null default '', verified boolean not null default false);
create table rifqy.customers(id text primary key, name text not null, phone text not null default '', type text not null check(type in ('Eceran','Bengkel')), address text not null default '');
create table rifqy.orders(id text primary key, number bigint generated always as identity unique, created_at timestamptz not null default now(), customer text not null, method text not null check(method in ('Tunai','Transfer bank','QRIS')), paid numeric(14,0) not null check(paid>=0), total numeric(14,0) not null check(total>=0), actor uuid not null references auth.users(id));
create table rifqy.order_items(order_id text references rifqy.orders(id), product_id text references rifqy.products(id), name text not null, sku text not null, qty integer not null check(qty>0), price numeric(14,0) not null check(price>=0), cost numeric(14,0) not null check(cost>=0), primary key(order_id,product_id));
create table rifqy.moves(id bigint generated always as identity primary key, created_at timestamptz not null default now(), product_id text not null references rifqy.products(id), product text not null, qty integer not null, reason text not null, actor uuid not null references auth.users(id));
create index order_items_product_idx on rifqy.order_items(product_id);
create index moves_product_idx on rifqy.moves(product_id);
create index orders_actor_idx on rifqy.orders(actor);
create index moves_actor_idx on rifqy.moves(actor);
alter table rifqy.members enable row level security;
alter table rifqy.products enable row level security;
alter table rifqy.customers enable row level security;
alter table rifqy.orders enable row level security;
alter table rifqy.order_items enable row level security;
alter table rifqy.moves enable row level security;
revoke all on all tables in schema rifqy from public,anon,authenticated;
revoke all on all sequences in schema rifqy from public,anon,authenticated;
create function rifqy.actor_role() returns text language sql stable security definer set search_path='' as $$
 select m.role from rifqy.members m join auth.users u on lower(u.email)=m.email where u.id=(select auth.uid()) and u.email_confirmed_at is not null and m.active;
$$;
create function rifqy.state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r text:=rifqy.actor_role(); result jsonb;
begin
 if auth.uid() is null or r is null then raise exception 'Akun belum mendapat akses toko.' using errcode='42501'; end if;
 select jsonb_build_object('version',1,'demo',false,'role',r,'email',(select email from auth.users where id=auth.uid()),
 'products',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',p.id,'sku',p.sku,'name',p.name,'brand',p.brand,'category',p.category,'cost',case when r='owner' then p.cost end,'retail',p.retail,'wholesale',p.wholesale,'stock',p.stock,'min',p.minimum,'rack',p.rack,'fit',p.fit,'verified',p.verified)) order by p.name) from rifqy.products p),'[]'::jsonb),
 'customers',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from rifqy.customers c),'[]'::jsonb),
 'orders',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'date',o.created_at,'customer',o.customer,'method',o.method,'paid',o.paid,'total',o.total,'items',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',i.product_id,'name',i.name,'sku',i.sku,'qty',i.qty,'price',i.price,'cost',case when r='owner' then i.cost end))) from rifqy.order_items i where i.order_id=o.id),'[]'::jsonb)) order by o.created_at) from rifqy.orders o),'[]'::jsonb),
 'moves',coalesce((select jsonb_agg(jsonb_build_object('date',m.created_at,'product',m.product,'qty',m.qty,'reason',m.reason) order by m.id) from rifqy.moves m),'[]'::jsonb),
 'members',case when r='owner' then coalesce((select jsonb_agg(to_jsonb(m) order by email) from rifqy.members m),'[]'::jsonb) else '[]'::jsonb end) into result;
 return result;
end $$;
create function rifqy.write(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=rifqy.actor_role(); p rifqy.products; c rifqy.customers; x jsonb; k text; q integer; n integer; v_total numeric:=0; v_paid numeric; v_price numeric; v_order text; v_email text; seen text[]:='{}';
begin
 if auth.uid() is null or r is null then raise exception 'Akun belum mendapat akses toko.' using errcode='42501'; end if;
 if p_action='product' then
  if r<>'owner' then raise exception 'Hanya owner dapat mengubah katalog dan harga.' using errcode='42501'; end if;
  k:=p_data->>'id';
  if k !~ '^[a-zA-Z0-9_-]{1,100}$' or length(trim(p_data->>'sku')) not between 1 and 70 or length(trim(p_data->>'name')) not between 1 and 150 or p_data->>'category' not in ('Kompresor','Kondensor','Evaporator','Blower','Expansion Valve','Refrigeran','Aksesoris') then raise exception 'Data barang tidak valid.'; end if;
  insert into rifqy.products(id,sku,name,brand,category,cost,retail,wholesale,stock,minimum,rack,fit,verified)
  values(k,upper(trim(p_data->>'sku')),trim(p_data->>'name'),coalesce(p_data->>'brand',''),p_data->>'category',(p_data->>'cost')::numeric,(p_data->>'retail')::numeric,(p_data->>'wholesale')::numeric,coalesce((p_data->>'stock')::integer,0),(p_data->>'min')::integer,coalesce(p_data->>'rack',''),coalesce(p_data->>'fit',''),coalesce((p_data->>'verified')::boolean,false))
  on conflict(id) do update set sku=excluded.sku,name=excluded.name,brand=excluded.brand,category=excluded.category,cost=excluded.cost,retail=excluded.retail,wholesale=excluded.wholesale,minimum=excluded.minimum,rack=excluded.rack,fit=excluded.fit,verified=excluded.verified;
 elsif p_action='customer' then
  k:=p_data->>'id';
  if k !~ '^[a-zA-Z0-9_-]{1,100}$' or length(trim(p_data->>'name')) not between 1 and 120 or p_data->>'type' not in ('Eceran','Bengkel') then raise exception 'Data pelanggan tidak valid.'; end if;
  insert into rifqy.customers(id,name,phone,type,address) values(k,trim(p_data->>'name'),coalesce(p_data->>'phone',''),p_data->>'type',coalesce(p_data->>'address','')) on conflict(id) do update set name=excluded.name,phone=excluded.phone,type=excluded.type,address=excluded.address;
 elsif p_action='stock' then
  q:=(p_data->>'qty')::integer;
  if q=0 or abs(q)>1000000 or length(trim(p_data->>'reason')) not between 1 and 200 then raise exception 'Jumlah atau keterangan stok tidak valid.'; end if;
  select * into p from rifqy.products where id=p_data->>'id' for update;
  if not found then raise exception 'Barang tidak ditemukan.'; end if;
  if p.stock+q<0 then raise exception 'Stok tidak mencukupi.'; end if;
  update rifqy.products set stock=stock+q where id=p.id;
  insert into rifqy.moves(product_id,product,qty,reason,actor) values(p.id,p.name,q,trim(p_data->>'reason'),auth.uid());
 elsif p_action='checkout' then
  v_order:=p_data->>'id';
  if v_order is null or v_order !~ '^RP-[a-zA-Z0-9_-]{1,100}$' then raise exception 'Nomor transaksi tidak valid.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_order,0));
  if exists(select 1 from rifqy.orders where id=v_order) then return rifqy.state(); end if;
  if jsonb_typeof(p_data->'items')<>'array' or jsonb_array_length(p_data->'items') not between 1 and 100 then raise exception 'Keranjang tidak valid.'; end if;
  if coalesce(p_data->>'customer_id','')<>'' then select * into c from rifqy.customers where id=p_data->>'customer_id'; if not found then raise exception 'Pelanggan tidak ditemukan.'; end if; end if;
  -- Lock products in a stable order across all checkout requests.
  perform 1 from rifqy.products where id in (select value->>'id' from jsonb_array_elements(p_data->'items')) order by id for update;
  for x in select value from jsonb_array_elements(p_data->'items') loop
   k:=x->>'id';q:=(x->>'qty')::integer;
   if q is null or q<1 or q>1000000 or k=any(seen) then raise exception 'Jumlah barang tidak valid.'; end if;
   seen:=array_append(seen,k);
   select * into p from rifqy.products where id=k;
   if not found then raise exception 'Barang tidak ditemukan.'; end if;
   if p.stock<q then raise exception 'Stok % tidak mencukupi.',p.name; end if;
   v_price:=case when c.type='Bengkel' then p.wholesale else p.retail end;
   v_total:=v_total+v_price*q;
  end loop;
  v_paid:=(p_data->>'paid')::numeric;
  if v_paid is null or v_paid<v_total then raise exception 'Pembayaran belum mencukupi.'; end if;
  if (p_data->>'expected_total')::numeric is distinct from v_total then raise exception 'Harga berubah. Muat ulang data dan periksa total pembayaran.'; end if;
  insert into rifqy.orders(id,customer,method,paid,total,actor) values(v_order,coalesce(c.name,'Pelanggan umum'),p_data->>'method',v_paid,v_total,auth.uid());
  for x in select value from jsonb_array_elements(p_data->'items') loop
   select * into p from rifqy.products where id=x->>'id';q:=(x->>'qty')::integer;v_price:=case when c.type='Bengkel' then p.wholesale else p.retail end;
   insert into rifqy.order_items(order_id,product_id,name,sku,qty,price,cost) values(v_order,p.id,p.name,p.sku,q,v_price,p.cost);
   update rifqy.products set stock=stock-q where id=p.id;
   insert into rifqy.moves(product_id,product,qty,reason,actor) values(p.id,p.name,-q,'Penjualan '||v_order,auth.uid());
  end loop;
 elsif p_action='member' then
  if r<>'owner' then raise exception 'Hanya owner dapat mengatur akun.' using errcode='42501'; end if;
  v_email:=lower(trim(p_data->>'email'));
  if v_email is null or v_email !~ '^[^ @]+@[^ @]+\.[^ @]+$' or length(v_email)>254 then raise exception 'Email tidak valid.'; end if;
  if exists(select 1 from rifqy.members where email=v_email and role='owner') then raise exception 'Akun owner tidak dapat diubah.'; end if;
  insert into rifqy.members(email,role,active) values(v_email,'admin',coalesce((p_data->>'active')::boolean,true)) on conflict(email) do update set active=excluded.active;
 else raise exception 'Operasi tidak dikenal.'; end if;
 return rifqy.state();
end $$;
create function public.rifqy_state() returns jsonb language sql security invoker set search_path='' as $$ select rifqy.state(); $$;
create function public.rifqy_write(p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select rifqy.write(p_action,p_data); $$;
revoke all on function public.rifqy_state(),public.rifqy_write(text,jsonb) from public,anon;
revoke all on all functions in schema rifqy from public,anon;
grant execute on function rifqy.state(),rifqy.write(text,jsonb) to authenticated;
grant execute on function public.rifqy_state(),public.rifqy_write(text,jsonb) to authenticated;
-- Role binding is checked against a confirmed Auth identity, never user_metadata.
-- Jalankan secara privat setelah instalasi, dengan email owner yang sebenarnya:
-- insert into rifqy.members(email,role) values ('owner@example.com','owner');
-- Explicit deny policies document that all access goes through checked RPCs.
create policy deny_direct on rifqy.members for all to authenticated using(false) with check(false);
create policy deny_direct on rifqy.products for all to authenticated using(false) with check(false);
create policy deny_direct on rifqy.customers for all to authenticated using(false) with check(false);
create policy deny_direct on rifqy.orders for all to authenticated using(false) with check(false);
create policy deny_direct on rifqy.order_items for all to authenticated using(false) with check(false);
create policy deny_direct on rifqy.moves for all to authenticated using(false) with check(false);
alter table rifqy.products add constraint finite_prices check(cost<=1000000000000 and retail<=1000000000000 and wholesale<=1000000000000);
alter table rifqy.orders add constraint finite_payment check(paid<=1000000000000 and total<=1000000000000);
