-- Public customers may submit a validated enquiry via this one function.
-- They cannot read orders; only the authorized owner can see the queue/history.
alter table public.orders alter column customer_id drop not null;

create or replace function public.submit_whatsapp_enquiry(
  p_order_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_payment_preference text,
  p_customization_request text,
  p_items jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing bigint;
  v_order_number bigint;
  v_subtotal numeric(10,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity numeric(6,2);
begin
  if p_order_id is null
    or length(trim(coalesce(p_customer_name, ''))) not between 1 and 120
    or length(trim(coalesce(p_customer_phone, ''))) not between 7 and 25
    or length(regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g')) not between 10 and 15
    or length(trim(coalesce(p_delivery_address, ''))) not between 5 and 600
    or p_payment_preference not in ('upi', 'cash_on_delivery', 'bank_transfer')
    or length(coalesce(p_customization_request, '')) > 1000
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 10
  then
    raise exception 'Please check the enquiry details and try again.' using errcode = '22023';
  end if;

  select o.order_number into v_existing from public.orders o where o.id = p_order_id;
  if v_existing is not null then return v_existing; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'product_id') or not (v_item ? 'quantity_kg') then
      raise exception 'Invalid cake selection.' using errcode = '22023';
    end if;
    v_quantity := (v_item->>'quantity_kg')::numeric;
    if v_quantity <= 0 or v_quantity > 20 or mod(v_quantity * 2, 1) <> 0 then
      raise exception 'Cake quantities must be in half-kilogram steps up to 20 kg.' using errcode = '22023';
    end if;
    select * into v_product from public.products p
      where p.id = (v_item->>'product_id')::uuid and p.is_active;
    if not found then raise exception 'A selected cake is no longer available.' using errcode = '22023'; end if;
    v_subtotal := v_subtotal + (v_product.price_per_kg * v_quantity);
  end loop;

  insert into public.orders (id, customer_id, customer_name, customer_phone, delivery_address, payment_preference, customization_request, cake_subtotal)
  values (p_order_id, null, trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address), p_payment_preference, trim(coalesce(p_customization_request, '')), v_subtotal)
  returning order_number into v_order_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity_kg')::numeric;
    select * into v_product from public.products p where p.id = (v_item->>'product_id')::uuid and p.is_active;
    insert into public.order_items (order_id, product_id, product_name, quantity_kg, price_per_kg, line_total)
    values (p_order_id, v_product.id, v_product.name, v_quantity, v_product.price_per_kg, v_quantity * v_product.price_per_kg);
  end loop;
  return v_order_number;
end;
$$;

revoke all on function public.submit_whatsapp_enquiry(uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.submit_whatsapp_enquiry(uuid, text, text, text, text, text, jsonb) to anon, authenticated;

-- Remove prior OTP/customer direct-insert policies if this database had them.
-- The public form can create rows only through the function above.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('orders', 'order_items')
      and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.%I', v_policy.policyname, v_policy.tablename);
  end loop;
end;
$$;

-- Keep direct order creation limited to the signed-in bakery owner (admin form).
create policy "Owner can add WhatsApp enquiries"
  on public.orders for insert to authenticated
  with check ((select public.is_bakery_owner()) and customer_id = (select auth.uid()) and status = 'new');
drop policy if exists "Owner can add items to new orders" on public.order_items;
create policy "Owner can add items to new orders"
  on public.order_items for insert to authenticated
  with check (
    (select public.is_bakery_owner())
    and exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()) and o.status = 'new')
  );
