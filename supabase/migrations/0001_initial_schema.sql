-- Aami Bakes starter schema for Supabase (Postgres).
-- Customers send enquiries over WhatsApp; the bakery owner records and manages orders.

create extension if not exists pgcrypto;

create type public.order_status as enum (
  'new', 'confirmed', 'in_progress', 'completed', 'cancelled'
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;
create policy "Users can read their own role"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_bakery_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'owner'
  );
$$;
revoke all on function public.is_bakery_owner() from public, anon;
grant execute on function public.is_bakery_owner() to authenticated;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price_per_kg numeric(10,2) not null check (price_per_kg >= 0),
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
create policy "Anyone can view active products"
  on public.products for select to anon
  using (is_active);
create policy "Customers and owner can view products"
  on public.products for select to authenticated
  using (is_active or (select public.is_bakery_owner()));
create policy "Owner can add products"
  on public.products for insert to authenticated
  with check ((select public.is_bakery_owner()));
create policy "Owner can change products"
  on public.products for update to authenticated
  using ((select public.is_bakery_owner()))
  with check ((select public.is_bakery_owner()));
create policy "Owner can remove products"
  on public.products for delete to authenticated
  using ((select public.is_bakery_owner()));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_id uuid default auth.uid() references auth.users(id),
  customer_name text not null,
  customer_phone text not null,
  delivery_address text not null,
  payment_preference text not null check (payment_preference in ('upi', 'cash_on_delivery', 'bank_transfer')),
  customization_request text not null default '',
  status public.order_status not null default 'new',
  cake_subtotal numeric(10,2) not null check (cake_subtotal >= 0),
  delivery_charge numeric(10,2) check (delivery_charge is null or delivery_charge >= 0),
  customization_charge numeric(10,2) check (customization_charge is null or customization_charge >= 0),
  confirmed_total numeric(10,2) check (confirmed_total is null or confirmed_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_created_idx on public.orders (customer_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at asc);
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select, insert on public.orders to authenticated;
grant update on public.orders to authenticated;
create policy "Customers can read their orders; owner can read all"
  on public.orders for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_bakery_owner()));
create policy "Owner can add WhatsApp enquiries"
  on public.orders for insert to authenticated
  with check (
    (select public.is_bakery_owner())
    and
    customer_id = (select auth.uid())
    and status = 'new'
  );
create policy "Owner can manage orders"
  on public.orders for update to authenticated
  using ((select public.is_bakery_owner()))
  with check ((select public.is_bakery_owner()));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity_kg numeric(6,2) not null check (quantity_kg > 0),
  price_per_kg numeric(10,2) not null check (price_per_kg >= 0),
  line_total numeric(10,2) not null check (line_total >= 0)
);

alter table public.order_items enable row level security;
revoke all on public.order_items from anon, authenticated;
grant select, insert on public.order_items to authenticated;
create policy "Customers can read their items; owner can read all"
  on public.order_items for select to authenticated
  using (
    (select public.is_bakery_owner())
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = (select auth.uid())
    )
  );
create policy "Owner can add items to new orders"
  on public.order_items for insert to authenticated
  with check (
    (select public.is_bakery_owner())
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = (select auth.uid()) and o.status = 'new'
    )
  );

-- Create a public-read bucket named `cake-photos` in Supabase Storage before the first
-- photo upload. Public visitors can display cake images; only the owner can upload,
-- replace, or delete them.
create policy "Anyone can view cake photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'cake-photos');
create policy "Owner can upload cake photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'cake-photos' and (select public.is_bakery_owner()));
create policy "Owner can replace cake photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'cake-photos' and (select public.is_bakery_owner()))
  with check (bucket_id = 'cake-photos' and (select public.is_bakery_owner()));
create policy "Owner can delete cake photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'cake-photos' and (select public.is_bakery_owner()));

-- Initial menu: prices are the supplied base prices for 1 kg.
insert into public.products (name, description, price_per_kg, sort_order) values
  ('Black Forest', 'Forest, cherry, chocolate', 750, 10),
  ('White Forest', 'Cream, chocolate flakes', 700, 20),
  ('Black Currant', 'Berries, rich cream', 800, 30),
  ('Blueberry', 'Fresh blueberries, layer', 900, 40),
  ('Strawberry', 'Sweet strawberries, glaze', 800, 50),
  ('Tender Coconut', 'Coconut flakes, soft', 1250, 60),
  ('Kulfi', 'Kesar, pista, traditional', 1200, 70),
  ('Rasamalai', 'Saffron, nuts, fusion', 1200, 80),
  ('Choco Truffle', 'Dark chocolate, ganache', 1000, 90),
  ('Butterscotch', 'Caramel, crunch, butter', 1100, 100),
  ('Pineapple', 'Tangy pineapple, fresh', 800, 110),
  ('Pista Truffle', 'Pistachio, white chocolate', 1400, 120),
  ('Nutty Bubble', 'Hazelnuts, chocolate', 1100, 130),
  ('Spanish Delight', 'Spanish flavours, cream', 1200, 140),
  ('Nutella with Ferrero', 'Nutella, Ferrero Rocher', 1600, 150),
  ('Pistachio Kunafa Cake', 'Pistachio, Kunafa layers', 1600, 160),
  ('Rich Choco Truffle', 'Deep chocolate, intense', 1350, 170),
  ('Premium Choco Truffle', 'Decadent chocolate, luxury', 2500, 180),
  ('Fresh Mango Cake', 'Seasonal mangoes, fresh', 1200, 190),
  ('Fruit Custard Cake', 'Custard, mixed fruits', 1250, 200),
  ('Lotus Biscoff', 'Biscoff spread, cookie crumb', 1600, 210),
  ('Fresh Fruit Cake', 'Variety of fresh fruits', 1300, 220),
  ('Muttaimittai', 'Local flavour, unique', 950, 230),
  ('Brownie', 'Fudgy chocolate brownie', 950, 240);
