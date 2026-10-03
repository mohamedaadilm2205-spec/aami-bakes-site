-- Keep public menu access limited to active products. Only authenticated owners
-- need the owner helper function to see hidden products.
drop policy if exists "Anyone can view active products" on public.products;

create policy "Anyone can view active products"
  on public.products for select to anon
  using (is_active);

create policy "Customers and owner can view products"
  on public.products for select to authenticated
  using (is_active or (select public.is_bakery_owner()));
