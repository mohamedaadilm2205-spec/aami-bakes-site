"use client";

import { ChangeEvent, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type Product = { id: string; name: string; description: string; price_per_kg: number; image_url: string | null; is_active: boolean; sort_order: number };
type Item = { product_name: string; quantity_kg: number; price_per_kg: number; line_total: number };
type DraftOrderItem = { productId: string; kg: string };
type PaymentPreference = "upi" | "bank_transfer" | "cash_on_delivery";
type Tab = "overview" | "orders" | "products";
const money = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
type OrderStatus = "new" | "confirmed" | "in_progress" | "completed" | "cancelled";
type Order = { id: string; order_number: number; customer_name: string; customer_phone: string; delivery_address: string; payment_preference: string; customization_request: string; status: OrderStatus; cake_subtotal: number; delivery_charge: number | null; customization_charge: number | null; confirmed_total: number | null; created_at: string; order_items: Item[] };
const stages: OrderStatus[] = ["new", "confirmed", "in_progress", "completed", "cancelled"];
const stageName: Record<OrderStatus, string> = { new: "New", confirmed: "Confirmed", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" };
function explainConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Aami Bakes could not reach its database. This is usually a paused Supabase project or an incorrect project URL in the hosting settings. Check Supabase project status and the hosted app’s NEXT_PUBLIC_SUPABASE_URL. Resetting the admin password will not fix a connection problem.";
  }
  return message || "Could not connect to the bakery database.";
}

export default function OwnerPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [orderSearch, setOrderSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [charges, setCharges] = useState<Record<string, { delivery: string; customization: string }>>({});
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const [draftCustomization, setDraftCustomization] = useState("");
  const [draftPayment, setDraftPayment] = useState<PaymentPreference>("upi");
  const [draftItems, setDraftItems] = useState<DraftOrderItem[]>([{ productId: "", kg: "1" }]);

  useEffect(() => { void checkSession(); }, []);
  async function checkSession() {
    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      setSignedIn(true); await checkOwnerRole();
    } catch (e) { setError(explainConnectionError(e)); }
  }
  async function checkOwnerRole() {
    const { data: userData, error: userError } = await getSupabaseBrowser().auth.getUser();
    if (userError || !userData.user) { setAuthorized(false); return; }
    const { data, error: roleError } = await getSupabaseBrowser().from("user_roles").select("role").eq("user_id", userData.user.id).maybeSingle();
    if (roleError) { setError(roleError.message); return; }
    if (data?.role !== "owner") { setAuthorized(false); setError("This account does not have the bakery owner role yet. Add its user ID to public.user_roles in Supabase, then sign out and back in."); return; }
    setAuthorized(true); setError(""); await Promise.all([loadOrders(), loadProducts()]);
  }
  async function signIn(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const { error: e } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });
      if (e) throw e;
      setSignedIn(true); await checkOwnerRole();
    } catch (err) { setError(explainConnectionError(err)); }
    finally { setBusy(false); }
  }
  async function signOut() { await getSupabaseBrowser().auth.signOut(); setSignedIn(false); setAuthorized(false); setOrders([]); setProducts([]); }
  async function loadOrders() {
    const { data, error: e } = await getSupabaseBrowser().from("orders").select("*,order_items(product_name,quantity_kg,price_per_kg,line_total)").order("created_at", { ascending: false });
    if (e) { setError(e.message); return; }
    const rows = (data ?? []) as Order[]; setOrders(rows);
    setCharges(Object.fromEntries(rows.map((o) => [o.id, { delivery: o.delivery_charge == null ? "" : String(o.delivery_charge), customization: o.customization_charge == null ? "" : String(o.customization_charge) }])));
  }
  async function loadProducts() {
    const { data, error: e } = await getSupabaseBrowser().from("products").select("id,name,description,price_per_kg,image_url,is_active,sort_order").order("sort_order");
    if (e) setError(e.message); else setProducts((data ?? []) as Product[]);
  }
  async function updateStatus(order: Order, status: OrderStatus) {
    setBusy(true); setError("");
    const { error: e } = await getSupabaseBrowser().from("orders").update({ status }).eq("id", order.id);
    if (e) setError(e.message); else { setNotice(`Order #${order.order_number} moved to ${stageName[status]}.`); await loadOrders(); }
    setBusy(false);
  }
  async function saveCharges(order: Order) {
    const vals = charges[order.id] ?? { delivery: "", customization: "" };
    const delivery = vals.delivery.trim() === "" ? 0 : Number(vals.delivery);
    const customization = vals.customization.trim() === "" ? 0 : Number(vals.customization);
    if (!Number.isFinite(delivery) || !Number.isFinite(customization) || delivery < 0 || customization < 0) { setError("Enter zero or a positive number for each charge."); return; }
    setBusy(true); setError("");
    const { error: e } = await getSupabaseBrowser().from("orders").update({ delivery_charge: delivery, customization_charge: customization, confirmed_total: Number(order.cake_subtotal) + delivery + customization, status: order.status === "new" ? "confirmed" : order.status }).eq("id", order.id);
    if (e) setError(e.message); else { setNotice(`Final charges saved for order #${order.order_number}.`); await loadOrders(); }
    setBusy(false);
  }
  async function addWhatsAppOrder(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const supabase = getSupabaseBrowser();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Please sign in again before recording this enquiry.");
      if (!draftName.trim() || !draftPhone.trim() || !draftAddress.trim()) throw new Error("Enter the customer’s name, phone number, and delivery address.");
      const selected = draftItems.map((line) => {
        const product = products.find((p) => p.id === line.productId);
        const kg = Number(line.kg);
        if (!product || !Number.isFinite(kg) || kg <= 0) throw new Error("Choose a cake and enter a weight above zero for every cake row.");
        return { product, kg };
      });
      const cakeSubtotal = selected.reduce((sum, row) => sum + row.kg * Number(row.product.price_per_kg), 0);
      const { data: order, error: orderError } = await supabase.from("orders").insert({
        customer_id: authData.user.id, customer_name: draftName.trim(), customer_phone: draftPhone.trim(), delivery_address: draftAddress.trim(),
        payment_preference: draftPayment, customization_request: draftCustomization.trim(), cake_subtotal: cakeSubtotal,
      }).select("id,order_number").single();
      if (orderError) throw orderError;
      const { error: itemError } = await supabase.from("order_items").insert(selected.map(({ product, kg }) => ({
        order_id: order.id, product_id: product.id, product_name: product.name, quantity_kg: kg,
        price_per_kg: Number(product.price_per_kg), line_total: kg * Number(product.price_per_kg),
      })));
      if (itemError) throw new Error(`Order #${order.order_number} was recorded, but its cake list did not save. Refresh and check this order, then contact support if it has no cakes. (${itemError.message})`);
      setNotice(`WhatsApp enquiry recorded as order #${order.order_number}. Call the customer to confirm details, then save delivery/customization charges.`);
      setDraftName(""); setDraftPhone(""); setDraftAddress(""); setDraftCustomization(""); setDraftPayment("upi"); setDraftItems([{ productId: "", kg: "1" }]); setShowOrderForm(false);
      await loadOrders();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not record the WhatsApp enquiry."); }
    finally { setBusy(false); }
  }
  async function uploadPhoto(file: File) {
    if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image under 5 MB.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image.");
    const supabase = getSupabaseBrowser();
    const fileName = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error: uploadError } = await supabase.storage.from("cake-photos").upload(fileName, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    return supabase.storage.from("cake-photos").getPublicUrl(fileName).data.publicUrl;
  }
  async function addProduct(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!newName.trim() || !Number.isFinite(Number(newPrice)) || Number(newPrice) < 0) throw new Error("Enter a product name and a valid price per 500 g.");
      let imageUrl: string | null = null;
      if (newPhoto) imageUrl = await uploadPhoto(newPhoto);
      const { error: e } = await getSupabaseBrowser().from("products").insert({ name: newName.trim(), description: newDescription.trim(), price_per_kg: Number(newPrice) * 2, image_url: imageUrl, sort_order: (products.at(-1)?.sort_order ?? 0) + 10 });
      if (e) throw e;
      setNewName(""); setNewDescription(""); setNewPrice(""); setNewPhoto(null); setNotice("Product added to the menu."); await loadProducts();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add product."); }
    finally { setBusy(false); }
  }
  async function saveProduct(product: Product) {
    setBusy(true); setError("");
    const { error: e } = await getSupabaseBrowser().from("products").update({ name: product.name, description: product.description, price_per_kg: Number(product.price_per_kg), is_active: product.is_active }).eq("id", product.id);
    if (e) setError(e.message); else setNotice(`${product.name} saved.`);
    setBusy(false);
  }
  async function changeProductPhoto(product: Product, file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    try { const image_url = await uploadPhoto(file); const { error: e } = await getSupabaseBrowser().from("products").update({ image_url }).eq("id", product.id); if (e) throw e; setNotice(`Photo updated for ${product.name}.`); await loadProducts(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not upload photo."); }
    finally { setBusy(false); }
  }
  const activeOrders = useMemo(() => orders.filter((o) => !["completed", "cancelled"].includes(o.status)), [orders]);
  const displayedOrders = useMemo(() => {
    const scoped = statusFilter === "active" ? activeOrders : orders.filter((o) => o.status === statusFilter);
    const query = orderSearch.trim().toLocaleLowerCase();
    if (!query) return scoped;
    return scoped.filter((o) => [String(o.order_number), o.customer_name, o.customer_phone, o.delivery_address, ...o.order_items.map((item) => item.product_name)].some((value) => value.toLocaleLowerCase().includes(query)));
  }, [activeOrders, orders, orderSearch, statusFilter]);

  if (!signedIn) return <main className="owner-layout"><header className="owner-header"><a className="brand" href="/"><img className="brand-logo" src="/aami-bakes-logo.png" alt="Aami Bakes logo" /><span>aami_bakes</span></a><a href="/">Back to shop</a></header><section className="panel admin-login-card" style={{ margin: "8vh auto" }}><div className="eyebrow">Private admin area</div><h1 className="owner-title">Welcome to your bakery</h1><p className="muted">Sign in to review customer enquiries, manage the cake menu, and keep orders moving.</p>{error && <div className="notice error">{error}</div>}<form onSubmit={signIn}><div className="field"><label htmlFor="owner-email">Admin email</label><input id="owner-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div><div className="field"><label htmlFor="owner-password">Password</label><div className="password-input-wrap"><input id="owner-password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} title={showPassword ? "Hide password" : "Show password"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.3 12s3.3-6.3 9.7-6.3 9.7 6.3 9.7 6.3-3.3 6.3-9.7 6.3S2.3 12 2.3 12Z" /><circle cx="12" cy="12" r="2.8" />{showPassword && <path d="m4 4 16 16" />}</svg><span>{showPassword ? "Hide" : "Show"}</span></button></div></div><button className="button" disabled={busy}>{busy ? "Signing in…" : "Sign in to admin"}</button></form><p className="note">This private workspace is for the authorized Aami Bakes admin account.</p></section></main>;

  if (!authorized) return <main className="owner-layout"><header className="owner-header"><a className="brand" href="/"><img className="brand-logo" src="/aami-bakes-logo.png" alt="Aami Bakes logo" /><span>aami_bakes</span></a><button className="small-button" onClick={signOut}>Sign out</button></header><section className="panel" style={{ margin: "8vh auto" }}>{error ? <div className="notice error">{error}</div> : <div className="loading">Checking owner access…</div>}<p className="note">If the owner role was just added, sign out and sign in again.</p></section></main>;

  return <div className="owner-layout"><header className="owner-header"><div><a className="brand" href="/"><img className="brand-logo" src="/aami-bakes-logo.png" alt="Aami Bakes logo" /><span>aami_bakes</span></a><div style={{ fontSize: 12, opacity: .75, paddingLeft: 68 }}>Admin workspace</div></div><div style={{ display: "flex", gap: 12, alignItems: "center" }}><a href="/">View shop</a><button className="small-button" onClick={signOut}>Sign out</button></div></header><main className="owner-main"><div className="owner-toolbar"><div><div className="eyebrow">Bakery dashboard</div><h1 className="owner-title">Aami Bakes Admin</h1></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="small-button" onClick={() => { setTab("orders"); setShowOrderForm(true); }}>Record WhatsApp enquiry</button><button className="small-button" onClick={() => { void loadOrders(); void loadProducts(); }}>Refresh</button></div></div>
    {error && <div className="notice error">{error}</div>}{notice && <div className="notice success" style={{ marginTop: 12 }}>{notice}</div>}
    <div className="owner-tabs">{(["overview", "orders", "products"] as Tab[]).map((t) => <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t === "products" ? "Products & pricing" : t === "orders" ? "Orders & history" : "Overview"}</button>)}</div>
    {tab === "overview" && <><div className="owner-grid"><div className="stat"><span>Needs attention</span><strong>{orders.filter((o) => o.status === "new").length}</strong><small>New customer enquiries</small></div><div className="stat"><span>In the kitchen</span><strong>{orders.filter((o) => o.status === "in_progress").length}</strong><small>Orders being prepared</small></div><div className="stat"><span>Completed orders</span><strong>{orders.filter((o) => o.status === "completed").length}</strong><small>Saved in order history</small></div></div><section className="admin-guide" aria-label="How to manage an order"><div><span className="guide-number">1</span><div><strong>Review the request</strong><p>Check the cake, weight, date, and customer details.</p></div></div><div><span className="guide-number">2</span><div><strong>Call and confirm</strong><p>Agree on the design, delivery, and final price.</p></div></div><div><span className="guide-number">3</span><div><strong>Prepare and complete</strong><p>Move the order along, then mark it completed.</p></div></div></section><div className="owner-toolbar admin-section-heading"><div><h2>New orders</h2><p>Start with the newest customer requests.</p></div><button className="small-button" onClick={() => setTab("orders")}>See all orders</button></div>{orders.filter((o) => o.status === "new").length ? orders.filter((o) => o.status === "new").map((o) => <OrderCard key={o.id} order={o} charges={charges[o.id]} setCharges={(next) => setCharges((prev) => ({ ...prev, [o.id]: next }))} saveCharges={() => saveCharges(o)} updateStatus={updateStatus} busy={busy} />) : <div className="notice">You’re all caught up. New website enquiries will appear here when customers submit them. You can find completed orders under “Orders & history.”</div>}</>}
    {tab === "orders" && <><div className="owner-toolbar admin-section-heading"><div><h2>Order queue & history</h2><p>Find a customer, check the request, and update its progress.</p></div><div className="admin-order-tools"><input className="small-button admin-search" aria-label="Search orders" placeholder="Search name, phone, cake or order #" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} /><select className="small-button" aria-label="Filter orders by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="active">Active orders</option>{stages.map((s) => <option key={s} value={s}>{stageName[s]}</option>)}</select></div></div>
    {showOrderForm && <form className="notice" onSubmit={addWhatsAppOrder}><div className="owner-toolbar"><strong>Record a phone or in-person enquiry</strong><button className="small-button" type="button" onClick={() => setShowOrderForm(false)}>Close</button></div><p className="muted">Use this for orders received by phone or in person. Website enquiries are saved automatically.</p><div className="formgrid"><div className="field"><label htmlFor="draft-name">Customer name</label><input id="draft-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} required /></div><div className="field"><label htmlFor="draft-phone">Phone number</label><input id="draft-phone" type="tel" value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)} required /></div><div className="field full"><label htmlFor="draft-address">Delivery address</label><textarea id="draft-address" value={draftAddress} onChange={(e) => setDraftAddress(e.target.value)} required /></div>{draftItems.map((line, index) => <div className="field" key={index}><label htmlFor={`draft-cake-${index}`}>Cake {index + 1}</label><select id={`draft-cake-${index}`} value={line.productId} onChange={(e) => setDraftItems((rows) => rows.map((r, i) => i === index ? { ...r, productId: e.target.value } : r))} required><option value="">Choose a cake</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(Number(p.price_per_kg) / 2)}/500 g</option>)}</select><input aria-label={`Cake ${index + 1} weight in kg`} type="number" min="0.5" step="0.5" value={line.kg} onChange={(e) => setDraftItems((rows) => rows.map((r, i) => i === index ? { ...r, kg: e.target.value } : r))} required /></div>)}<div className="field"><button className="small-button" type="button" onClick={() => setDraftItems((rows) => [...rows, { productId: "", kg: "1" }])}>Add another cake</button></div><div className="field"><label htmlFor="draft-payment">Payment preference</label><select id="draft-payment" value={draftPayment} onChange={(e) => setDraftPayment(e.target.value as PaymentPreference)}><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="cash_on_delivery">Cash on delivery</option></select></div><div className="field full"><label htmlFor="draft-custom">Customization notes</label><textarea id="draft-custom" value={draftCustomization} onChange={(e) => setDraftCustomization(e.target.value)} /></div></div><button className="button" disabled={busy}>{busy ? "Saving…" : "Save enquiry to order queue"}</button></form>}
      {displayedOrders.length ? displayedOrders.map((o) => <OrderCard key={o.id} order={o} charges={charges[o.id]} setCharges={(next) => setCharges((prev) => ({ ...prev, [o.id]: next }))} saveCharges={() => saveCharges(o)} updateStatus={updateStatus} busy={busy} />) : <div className="notice">No orders in this view yet. Website enquiries appear here automatically after the database setup is applied.</div>}</>}
    {tab === "products" && <><h2 style={{ fontFamily: "'Cormorant Garamond',serif" }}>Products & pricing</h2><p className="muted">Enter the starting cake-making price customers will see on the menu. Delivery and customization are confirmed separately over WhatsApp.</p><form className="notice" onSubmit={addProduct}><strong>Add a menu item</strong><div className="formgrid"><div className="field"><label htmlFor="p-name">Product name</label><input id="p-name" value={newName} onChange={(e) => setNewName(e.target.value)} required /></div><div className="field"><label htmlFor="p-price">Starting price (₹)</label><input id="p-price" type="number" min="0" step="1" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} required /></div><div className="field"><label htmlFor="p-desc">Description</label><input id="p-desc" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} /></div><div className="field"><label htmlFor="p-photo">Product photo (JPEG/PNG/WebP, max 5 MB)</label><input id="p-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)} /></div></div><button className="button" disabled={busy}>{busy ? "Saving…" : "Add product"}</button></form><div style={{ marginTop: 22 }}>{products.map((p) => <ProductEditor key={p.id} product={p} busy={busy} onChange={(next) => setProducts((rows) => rows.map((x) => x.id === p.id ? next : x))} onSave={() => saveProduct(p)} onPhoto={(file) => changeProductPhoto(p, file)} />)}</div></>}
    </main></div>;
}

function OrderCard({ order, charges, setCharges, saveCharges, updateStatus, busy }: { order: Order; charges?: { delivery: string; customization: string }; setCharges: (next: { delivery: string; customization: string }) => void; saveCharges: () => void; updateStatus: (order: Order, status: OrderStatus) => void; busy: boolean }) {
  const c = charges ?? { delivery: "", customization: "" };
  const total = Number(order.cake_subtotal) + (Number(c.delivery) || 0) + (Number(c.customization) || 0);
  return <article className="order-card"><header><span>Order #{order.order_number} · {order.customer_name}</span><span className="status-pill">{stageName[order.status] ?? order.status}</span></header><p>{new Date(order.created_at).toLocaleString("en-IN")} · {order.customer_phone}</p><p><strong>Delivery address:</strong> {order.delivery_address}</p><p><strong>Cakes:</strong> {order.order_items?.map((it) => `${it.product_name} (${it.quantity_kg} kg, ${money(Number(it.line_total))})`).join(" · ") || "Order items unavailable"}</p><p><strong>Cake subtotal:</strong> {money(Number(order.cake_subtotal))} · <strong>Payment preference:</strong> {order.payment_preference.replaceAll("_", " ")}</p>{order.customization_request && <p><strong>Customization:</strong> {order.customization_request}</p>}
    {order.status !== "completed" && order.status !== "cancelled" && <><div className="formgrid"><div className="field"><label>Delivery charge (₹)</label><input type="number" min="0" step="1" value={c.delivery} onChange={(e) => setCharges({ ...c, delivery: e.target.value })} placeholder="Confirm with customer" /></div><div className="field"><label>Customization charge (₹)</label><input type="number" min="0" step="1" value={c.customization} onChange={(e) => setCharges({ ...c, customization: e.target.value })} placeholder="0 if none" /></div></div><p><strong>Proposed final total:</strong> {money(total)} (share and agree on WhatsApp)</p><div className="order-actions"><button disabled={busy} onClick={saveCharges}>Save final charges</button>{order.status === "new" && <button disabled={busy} onClick={() => updateStatus(order, "in_progress")}>Start preparing</button>}{order.status === "confirmed" && <button disabled={busy} onClick={() => updateStatus(order, "in_progress")}>Start preparing</button>}{order.status === "in_progress" && <button disabled={busy} onClick={() => updateStatus(order, "completed")}>Mark completed</button>}{order.status === "new" && <button disabled={busy} onClick={() => updateStatus(order, "cancelled")}>Cancel order</button>}<a className="small-button" href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello ${order.customer_name}, regarding Aami Bakes order #${order.order_number}: `)}`} target="_blank" rel="noreferrer">Message customer</a></div></>}
  </article>;
}

function ProductEditor({ product, busy, onChange, onSave, onPhoto }: { product: Product; busy: boolean; onChange: (next: Product) => void; onSave: () => void; onPhoto: (file?: File) => void }) {
  return <div className="owner-product">{product.image_url ? <img src={product.image_url} alt="" /> : <div className="product-art" style={{ height: 48, fontSize: 24 }}>🍰</div>}<div><input aria-label={`${product.name} name`} value={product.name} onChange={(e) => onChange({ ...product, name: e.target.value })} /><input aria-label={`${product.name} description`} style={{ marginTop: 5 }} value={product.description} onChange={(e) => onChange({ ...product, description: e.target.value })} /></div><div className="owner-price-field"><label>Starting price (₹)</label><input aria-label={`${product.name} starting price`} type="number" min="0" step="1" value={Number(product.price_per_kg) / 2} onChange={(e) => onChange({ ...product, price_per_kg: Number(e.target.value) * 2 })} /></div><label className="small-button">{product.is_active ? "Visible" : "Hidden"}<input type="checkbox" checked={product.is_active} onChange={(e) => onChange({ ...product, is_active: e.target.checked })} /></label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button className="small-button" disabled={busy} onClick={onSave}>Save</button><label className="small-button">Photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e: ChangeEvent<HTMLInputElement>) => onPhoto(e.target.files?.[0])} /></label></div></div>;
}

