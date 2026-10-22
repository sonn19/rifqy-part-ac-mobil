-- Public API deliberately returns retail catalog fields only.
create or replace function rifqy.catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'sku',p.sku,'name',p.name,'brand',p.brand,'category',p.category,'retail',p.retail,'available',p.stock>0,'fit',case when p.verified then p.fit else '' end) order by p.name),'[]'::jsonb) from rifqy.products p;
$$;
revoke all on function rifqy.catalog() from public;
grant usage on schema rifqy to anon;
grant execute on function rifqy.catalog() to anon,authenticated;
create or replace function public.rifqy_catalog() returns jsonb language sql stable security invoker set search_path='' as $$ select rifqy.catalog(); $$;
revoke all on function public.rifqy_catalog() from public;
grant execute on function public.rifqy_catalog() to anon,authenticated;
