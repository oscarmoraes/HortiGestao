-- ============================================================================
-- HORTIGESTÃO — SUPERMERCADO SUMMER (UNIDADE FONSECA)
-- Esquema Seguro Postgres / Supabase (Zero Acesso Não Autenticado / Zero Segredos)
-- ============================================================================
-- Diretrizes de Segurança Aplicadas:
-- 1. Nenhuma senha, chave de API ou credencial é armazenada em tabelas de dados.
--    Toda autenticação ocorre exclusivamente via Supabase Auth (schema 'auth').
-- 2. Nenhuma permissão para usuários não autenticados ('anon' / 'public'):
--    - REVOKE ALL de 'anon' e 'public' em todas as tabelas do HortiGestão.
--    - GRANT restrito exclusivamente à role 'authenticated'.
--    - ROW LEVEL SECURITY (RLS) ATIVADO e FORÇADO (FORCE ROW LEVEL SECURITY).
--    - Políticas RESTRICTIVE bloqueando 'anon' + Políticas PERMISSIVE exigindo
--      '(select auth.uid()) is not null'.
-- ============================================================================

-- 1. Catálogo e Saldo de Produtos FLV
create table if not exists public.flv_products (
  id uuid primary key default gen_random_uuid(),
  plu_code text,
  name text not null check (char_length(trim(name)) > 0),
  emoji text not null default '🥬',
  category text not null check (category in ('frutas', 'verduras', 'legumes', 'raizes', 'temperos', 'folhagens')),
  unit text not null default 'kg' check (unit in ('kg', 'un', 'cx', 'maco')),
  current_stock numeric(12,3) not null default 0 check (current_stock >= 0),
  min_stock numeric(12,3) not null default 10 check (min_stock >= 0),
  cost_price numeric(10,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(10,2) not null default 0 check (sale_price >= 0),
  shelf_life_days integer not null default 5 check (shelf_life_days >= 0),
  lot_code text,
  status text not null default 'ok' check (status in ('ok', 'warning', 'critical')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_flv_products_category on public.flv_products(category);
create index if not exists idx_flv_products_created_by on public.flv_products(created_by);

-- 2. Histórico de Movimentações, Pesagens com Tara Variável e Baixas de Perda
create table if not exists public.flv_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.flv_products(id) on delete cascade,
  movement_type text not null check (movement_type in ('RECEBIMENTO', 'DESCARTE', 'AJUSTE_CONTAGEM', 'SAIDA_VENDA')),
  gross_weight numeric(12,3) not null default 0 check (gross_weight >= 0),
  packs_count integer not null default 0 check (packs_count >= 0),
  tare_per_pack numeric(10,3) not null default 0 check (tare_per_pack >= 0),
  total_tare numeric(12,3) not null default 0 check (total_tare >= 0),
  net_quantity numeric(12,3) not null check (net_quantity >= 0),
  stock_after numeric(12,3) not null default 0,
  batch_details jsonb not null default '[]'::jsonb,
  waste_reason text,
  destination text,
  unit_cost_at_time numeric(10,2) not null default 0,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_flv_movements_product_id on public.flv_movements(product_id);
create index if not exists idx_flv_movements_created_by on public.flv_movements(created_by);
create index if not exists idx_flv_movements_created_at on public.flv_movements(created_at desc);

-- 3. Cabeçalho de Listas de Pedido / Reposição
create table if not exists public.flv_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null,
  store_unit text not null default 'Summer Fonseca',
  target_supplier text not null default 'CEASA / Fornecedor FLV',
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO', 'APROVADO', 'RECEBIDO')),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_flv_orders_created_by on public.flv_orders(created_by);
create index if not exists idx_flv_orders_created_at on public.flv_orders(created_at desc);

-- 4. Itens da Lista de Pedido
create table if not exists public.flv_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.flv_orders(id) on delete cascade,
  product_id uuid not null references public.flv_products(id) on delete cascade,
  requested_qty numeric(10,2) not null check (requested_qty > 0),
  pack_label text not null default 'cx',
  received_net_qty numeric(12,3) not null default 0,
  is_received boolean not null default false,
  notes text
);

create index if not exists idx_flv_order_items_order_id on public.flv_order_items(order_id);
create index if not exists idx_flv_order_items_product_id on public.flv_order_items(product_id);

-- ============================================================================
-- BLOQUEIO TOTAL DE USUÁRIOS NÃO AUTENTICADOS (REVOKE + FORCE RLS)
-- ============================================================================

-- Remove qualquer permissão herdada de 'anon' e 'public'
revoke all on table public.flv_products from anon, public;
revoke all on table public.flv_movements from anon, public;
revoke all on table public.flv_orders from anon, public;
revoke all on table public.flv_order_items from anon, public;

-- Concede acesso somente a usuários autenticados via Supabase Auth
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.flv_products to authenticated;
grant select, insert, update, delete on table public.flv_movements to authenticated;
grant select, insert, update, delete on table public.flv_orders to authenticated;
grant select, insert, update, delete on table public.flv_order_items to authenticated;

-- Habilita e força Row Level Security em todas as tabelas
alter table public.flv_products enable row level security;
alter table public.flv_products force row level security;

alter table public.flv_movements enable row level security;
alter table public.flv_movements force row level security;

alter table public.flv_orders enable row level security;
alter table public.flv_orders force row level security;

alter table public.flv_order_items enable row level security;
alter table public.flv_order_items force row level security;

-- Remove políticas antigas caso existam
drop policy if exists "Acesso piloto flv_products" on public.flv_products;
drop policy if exists "Acesso piloto flv_movements" on public.flv_movements;
drop policy if exists "Acesso piloto flv_orders" on public.flv_orders;
drop policy if exists "Acesso piloto flv_order_items" on public.flv_order_items;
drop policy if exists "deny_anon_flv_products" on public.flv_products;
drop policy if exists "deny_anon_flv_movements" on public.flv_movements;
drop policy if exists "deny_anon_flv_orders" on public.flv_orders;
drop policy if exists "deny_anon_flv_order_items" on public.flv_order_items;
drop policy if exists "auth_only_flv_products" on public.flv_products;
drop policy if exists "auth_only_flv_movements" on public.flv_movements;
drop policy if exists "auth_only_flv_orders" on public.flv_orders;
drop policy if exists "auth_only_flv_order_items" on public.flv_order_items;

-- Políticas RESTRICTIVE negando explicitamente qualquer tentativa de 'anon'
create policy "deny_anon_flv_products"
  on public.flv_products
  as restrictive
  for all
  to anon
  using (false)
  with check (false);

create policy "deny_anon_flv_movements"
  on public.flv_movements
  as restrictive
  for all
  to anon
  using (false)
  with check (false);

create policy "deny_anon_flv_orders"
  on public.flv_orders
  as restrictive
  for all
  to anon
  using (false)
  with check (false);

create policy "deny_anon_flv_order_items"
  on public.flv_order_items
  as restrictive
  for all
  to anon
  using (false)
  with check (false);

-- Políticas PERMISSIVE exclusivas para usuários autenticados com JWT válido
create policy "auth_only_flv_products"
  on public.flv_products
  for all
  to authenticated
  using ((select auth.uid()) is not null and (select auth.role()) = 'authenticated')
  with check ((select auth.uid()) is not null and (select auth.role()) = 'authenticated');

create policy "auth_only_flv_movements"
  on public.flv_movements
  for all
  to authenticated
  using ((select auth.uid()) is not null and (select auth.role()) = 'authenticated')
  with check ((select auth.uid()) is not null and (select auth.role()) = 'authenticated');

create policy "auth_only_flv_orders"
  on public.flv_orders
  for all
  to authenticated
  using ((select auth.uid()) is not null and (select auth.role()) = 'authenticated')
  with check ((select auth.uid()) is not null and (select auth.role()) = 'authenticated');

create policy "auth_only_flv_order_items"
  on public.flv_order_items
  for all
  to authenticated
  using ((select auth.uid()) is not null and (select auth.role()) = 'authenticated')
  with check ((select auth.uid()) is not null and (select auth.role()) = 'authenticated');
