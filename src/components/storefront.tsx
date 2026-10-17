"use client";

import { FormEvent, useEffect, useMemo, useState, type MouseEvent } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { business, cakePhotos } from "@/lib/business";

type Product = { id: string; name: string; description: string; price_per_kg: number; image_url: string | null; is_active: boolean; sort_order: number };
type CartLine = { product: Product; kg: number };
type Payment = "upi" | "bank_transfer" | "cash_on_delivery";

const money = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function openDirectWhatsApp(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  const fallback = new URL(e.currentTarget.href);
  const text = fallback.searchParams.get("text") ?? "";
  const params = `phone=${business.whatsapp}${text ? `&text=${encodeURIComponent(text)}` : ""}`;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const url = mobile ? `whatsapp://send?${params}` : `https://web.whatsapp.com/send?${params}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function Home() {
  const [view, setView] = useState<"home" | "menu">("home");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [whatsAppUrl, setWhatsAppUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [customization, setCustomization] = useState("");
  const [payment, setPayment] = useState<Payment>("upi");
  const totalKg = useMemo(() => cart.reduce((sum, row) => sum + row.kg, 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((sum, row) => sum + row.kg * Number(row.product.price_per_kg), 0), [cart]);

  useEffect(() => {
    try {
      getSupabaseBrowser().from("products").select("id,name,description,price_per_kg,image_url,is_active,sort_order").eq("is_active", true).order("sort_order").then(({ data, error: e }) => {
        if (e) setError(e.message); else setProducts((data ?? []) as Product[]);
        setLoading(false);
      });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect to the menu."); setLoading(false); }
  }, []);

  function add(product: Product) {
    setCart((rows) => {
      const found = rows.find((r) => r.product.id === product.id);
      return found ? rows.map((r) => r.product.id === product.id ? { ...r, kg: r.kg + 0.5 } : r) : [...rows, { product, kg: 0.5 }];
    });
    setSent(false);
  }
  function change(id: string, delta: number) {
    setCart((rows) => rows.map((r) => r.product.id === id ? { ...r, kg: r.kg + delta } : r).filter((r) => r.kg >= 0.5));
    setSent(false);
  }
  function openCart() { setError(""); setSent(false); setCartOpen(true); }
  async function sendToWhatsApp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!cart.length) { setError("Add at least one cake to your basket first."); return; }
    if (!consent) { setError("Please agree to share your details with Aami Bakes so we can respond to your enquiry."); return; }
    setSubmitting(true);
    const whatsAppTab = window.open("about:blank", "_blank");
    if (whatsAppTab) whatsAppTab.opener = null;
    try {
    const { data: newOrderNumber, error: saveError } = await getSupabaseBrowser().rpc("submit_whatsapp_enquiry", {
      p_order_id: crypto.randomUUID(),
      p_customer_name: name.trim(),
      p_customer_phone: phone.trim(),
      p_delivery_address: address.trim(),
      p_payment_preference: payment,
      p_customization_request: customization.trim(),
      p_items: cart.map(({ product, kg }) => ({ product_id: product.id, quantity_kg: kg })),
    });
    if (saveError) throw saveError;
    const items = cart.map(({ product, kg }) => `• ${product.name} — ${kg} kg: ${money(kg * Number(product.price_per_kg))}`).join("\n");
    const message = [
      `Hello Aami Bakes! I would like to enquire about order #${newOrderNumber}:`, "", items, "",
      `Estimated cake subtotal: ${money(subtotal)} (base cake prices only)`,
      "Delivery charge: to be confirmed", `Customization: ${customization.trim() || "None requested"}`,
      `Preferred payment: ${payment.replaceAll("_", " ")}`, "", `Name: ${name.trim()}`,
      `Phone: ${phone.trim()}`, `Delivery address: ${address.trim()}`, "",
      "Please call/message me to confirm availability, delivery/customization charges, and the final total.",
    ].join("\n");
    const encodedMessage = encodeURIComponent(message);
    const mobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const appUrl = `whatsapp://send?phone=${business.whatsapp}&text=${encodedMessage}`;
    const clickToChatUrl = `https://wa.me/${business.whatsapp}?text=${encodedMessage}`;
    const directWebChatUrl = `https://web.whatsapp.com/send?phone=${business.whatsapp}&text=${encodedMessage}`;
    const destination = mobileDevice ? appUrl : directWebChatUrl;
    setWhatsAppUrl(clickToChatUrl);
    setOrderNumber(newOrderNumber);
    if (whatsAppTab) whatsAppTab.location.href = destination;
    setSent(true);
    } catch (err) {
      if (whatsAppTab) whatsAppTab.close();
      setError(err instanceof Error ? err.message : "Could not save your enquiry. Please try again.");
    } finally { setSubmitting(false); }
  }

  return <>
    <div className="topbar">FRESHLY BAKED IN ALUR · MADE WITH LOVE · CUSTOM CAKES FOR YOUR SPECIAL MOMENTS</div>
    <nav className="nav nav-centered"><a className="brand" href="#top" aria-label="Aami Bakes home" onClick={() => { setView("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><img className="brand-logo" src="/aami-bakes-logo.png" alt="Aami Bakes logo" /><span className="brand-name">aami<span>_</span>bakes</span></a><div className="navlinks"><button className={view === "home" ? "nav-active" : ""} aria-current={view === "home" ? "page" : undefined} onClick={() => { setView("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Home</button><button className={view === "menu" ? "nav-active" : ""} aria-current={view === "menu" ? "page" : undefined} onClick={() => { setView("menu"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Menu</button><button onClick={() => { setView("home"); window.setTimeout(() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" }), 0); }}>About & contact</button><button onClick={openCart}>Basket ({cart.length})</button><a className="admin-link" href="/owner">Admin login</a></div></nav>
    <main id="top">
      {view === "home" && <><section className="hero"><div className="hero-card"><div className="hero-copy"><div className="eyebrow">Home baked · made to order</div><h1>A little sweetness for your big moments.</h1><p>Thoughtful flavours, handmade cakes, and a personal touch from our family bakery in Alur.</p><button className="button" onClick={() => { setView("menu"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Explore the menu</button><a className="hero-whatsapp" href={`https://wa.me/${business.whatsapp}`} onClick={openDirectWhatsApp} target="_blank" rel="noreferrer">Chat with Aami Bakes ↗</a></div><div className="hero-image-wrap"><img src={cakePhotos[0]} alt="Colourful celebration cake inspiration" /><div className="hero-sticker"><span>Made with</span><strong>love ♡</strong></div></div></div><div className="hero-note"><span>✦ Baked fresh to order</span><span>✦ Custom designs welcome</span><span>✦ Starting prices shown per 500 g</span></div></section>
      <section className="order-timing" aria-label="Ordering information"><div className="timing-copy"><strong>Freshly prepared for you</strong><span>Please place your order 2–3 days in advance for the best availability.</span></div><a href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent("Hello Aami Bakes, I have an urgent cake enquiry. Please let me know if you are available.")}`} onClick={openDirectWhatsApp} target="_blank" rel="noreferrer"><BrandIcon kind="whatsapp" /> Need it sooner? WhatsApp us directly</a></section>
      </>}
      {view === "menu" && <section className="menu-page-heading"><div className="eyebrow">Aami Bakes · Freshly made to order</div><h1>Our Cake Menu</h1><p>Choose a cake to enquire about. We’ll confirm delivery and custom design charges with you on WhatsApp.</p><span>For the best availability, please order 2–3 days ahead.</span></section>}
      {view === "menu" && <section className="order-timing" aria-label="Ordering information"><div className="timing-copy"><strong>Freshly prepared for you</strong><span>Please place your order 2–3 days in advance for the best availability.</span></div><a href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent("Hello Aami Bakes, I have an urgent cake enquiry. Please let me know if you are available.")}`} onClick={openDirectWhatsApp} target="_blank" rel="noreferrer"><BrandIcon kind="whatsapp" /> Need it sooner? WhatsApp us directly</a></section>}
      {view === "menu" && <section className="section menu-section" id="menu"><div className="section-head"><div><div className="eyebrow">Baked with care</div><h2>Choose a cake to enquire about</h2></div><p>Starting prices per 500 g · customization quoted separately</p></div>
        {error && !cartOpen && <div className="notice error">{error}</div>}
        {loading ? <div className="loading">Loading the fresh-baked menu…</div> : products.length ? <div className="grid">{products.map((p, index) => <article className="product" key={p.id}><div className="product-art"><img src={p.image_url || cakePhotos[index % cakePhotos.length]} alt={p.image_url ? p.name : `Cake inspiration for ${p.name}; the finished cake may look different`} loading="lazy" />{!p.image_url && <span className="photo-caption">Cake inspiration</span>}</div><div className="product-body"><h3>{p.name}</h3><p className="desc">{p.description || "Made fresh to order"}</p><div className="price-row"><div className="price"><small>Starting from</small><br />{money(Number(p.price_per_kg) / 2)} <small>/ 500 g</small></div><button className="add" aria-label={`Add ${p.name} starting at 500 grams`} onClick={() => add(p)}>+</button></div></div></article>)}</div> : <div className="notice">The menu will appear here when the Supabase connection is configured.</div>}
        <p className="fineprint">Displayed prices are basic cake-making charges for 500 g. Delivery and requested customization are not included; Aami Bakes will confirm those charges on WhatsApp before the order is accepted.</p>
      </section>}
      {view === "home" && <><section className="inspiration"><div className="section-head"><div><div className="eyebrow">A little cake inspiration</div><h2>Made for your moments</h2></div><p>Photos are examples; your cake is made to order.</p></div><div className="inspiration-grid">{cakePhotos.slice(1).map((photo, index) => { const caption = ["Anniversary chocolate cake", "Chocolate brownie cup", "Custom birthday cake"][index]; return <figure key={photo}><img src={photo} alt={caption} loading="lazy" /><figcaption>{caption}</figcaption></figure>; })}</div></section>
      <section className="bakers-note" aria-labelledby="bakers-note-title"><div className="bakers-note-copy"><div className="eyebrow">A little note from our kitchen</div><h2 id="bakers-note-title">From the Baker’s Desk</h2><p className="bakers-note-english">Every cake begins with someone’s special moment in mind. I prepare each one with love and care, paying attention to the flavour, the softness, and the little finishing touches. Whether it is for a birthday, a family gathering, or a day you simply want to make sweeter, I hope it brings a little joy to your table. Thank you for letting me be part of your celebration.</p><div className="bakers-note-divider"><span>✦</span><span>ஒரு இனிய குறிப்பு</span><span>✦</span></div><p className="bakers-note-tamil" lang="ta">ஒவ்வொரு கேக்கும் ஒருவரின் மகிழ்ச்சியான தருணத்தை நினைத்தே தயாரிக்கப்படுகிறது. சுவை, மென்மை, அலங்காரம் என ஒவ்வொன்றிலும் அன்பும் அக்கறையும் சேர்த்து புதிதாகச் செய்கிறேன். பிறந்தநாள், குடும்ப விழா அல்லது உங்கள் நாளை இனிமையாக்கும் சிறிய கொண்டாட்டம்—எதுவாக இருந்தாலும், எங்கள் கேக் உங்கள் மகிழ்ச்சியில் ஒரு சிறிய பங்காக இருக்கட்டும். உங்கள் கொண்டாட்டத்தில் எங்களை இணைத்ததற்கு மனமார்ந்த நன்றி.</p><span className="bakers-note-signoff">With love, <strong>Your Aami Bakes baker</strong></span></div><div className="bakers-note-art"><img src="/bakers-desk.svg" alt="A faceless illustrated woman baker in an apron and chef hat, holding a cake" loading="lazy" /></div></section>
      <section className="reviews-section" id="reviews"><div className="review-mark" aria-hidden="true">G</div><div><div className="eyebrow">Customer reviews</div><h2>Kind words, straight from Google</h2><p>See all of Aami Bakes’ latest reviews on Google Maps, or share your experience after your order.</p></div><a className="review-button" href={business.mapsUrl} target="_blank" rel="noreferrer">Read all Google reviews ↗</a></section>
      <section className="about-contact" id="about"><div className="about-copy"><div className="eyebrow">The heart behind the bakes</div><h2>About Aami Bakes</h2><p>Aami Bakes is a home bakery in Alur, creating fresh cakes and brownies for birthdays, family gatherings, and the little moments worth celebrating. Every cake is made to order with care. Have a design in mind? Send us your idea and we’ll discuss the finishing touches and final price with you.</p><div className="about-badges"><span>Made fresh</span><span>Personal designs</span><span>Family bakery</span></div></div><div className="contact-card" id="contact"><div className="eyebrow">Come say hello</div><h3>Find & contact us</h3><div className="contact-row"><span className="contact-icon"><BrandIcon kind="location" /></span><div><strong>Visit Aami Bakes</strong><p>{business.address}</p><a href={business.mapsUrl} target="_blank" rel="noreferrer">Open location in Google Maps ↗</a></div></div><div className="contact-row"><span className="contact-icon"><BrandIcon kind="phone" /></span><div><strong>Call us</strong><p><a href={`tel:+91${business.phone}`}>+91 {business.phone}</a></p></div></div><div className="contact-row"><span className="contact-icon whatsapp-icon"><BrandIcon kind="whatsapp" /></span><div><strong>WhatsApp</strong><p><a href={`https://wa.me/${business.whatsapp}`} onClick={openDirectWhatsApp} target="_blank" rel="noreferrer">+91 {business.phone} · Chat with us ↗</a></p></div></div><div className="contact-row"><span className="contact-icon instagram-icon"><BrandIcon kind="instagram" /></span><div><strong>Instagram</strong><p><a href={business.instagram} target="_blank" rel="noreferrer">@aami_bakes_ ↗</a></p></div></div><div className="license-note"><span className="license-seal"><BrandIcon kind="shield" /></span><span>FSSAI license number</span><strong>{business.fssai}</strong></div></div></section></>}
    </main>
      <footer className="footer"><img className="footer-logo" src="/aami-bakes-logo.png" alt="Aami Bakes home bakery logo" /><a className="footer-brand" href="#top">aami_bakes</a><span>Home baked in Alur · Made with love</span><span>© 2026 Aami Bakes. All rights reserved.</span><a href={`https://wa.me/${business.whatsapp}`} onClick={openDirectWhatsApp} target="_blank" rel="noreferrer">WhatsApp us ↗</a></footer>

    {cart.length > 0 && !cartOpen && <div className="floating-cart"><div><strong>{cart.length} {cart.length === 1 ? "cake" : "cakes"} · {money(subtotal)}</strong><span>In your basket · estimated subtotal</span></div><button className="button" onClick={openCart}>Review basket</button></div>}

    {cartOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCartOpen(false); }}><section className="panel" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="panel-head"><h2 id="dialog-title">Your basket</h2><button className="close" onClick={() => setCartOpen(false)} aria-label="Close">×</button></div>
      {error && <div className="notice error">{error}</div>}
      {cart.length ? <>
        {cart.map((r) => <div className="cartline" key={r.product.id}><span>{r.product.name} · {money(Number(r.product.price_per_kg) / 2)}/500 g</span><div className="qty"><button aria-label={`Remove 500 grams of ${r.product.name}`} onClick={() => change(r.product.id, -0.5)}>−</button><span>{r.kg} kg</span><button aria-label={`Add 500 grams of ${r.product.name}`} onClick={() => change(r.product.id, 0.5)}>+</button><strong>{money(r.kg * Number(r.product.price_per_kg))}</strong></div></div>)}
        <div className="totals"><div className="totalrow"><span>Total cake weight</span><strong>{totalKg} kg</strong></div><div className="totalrow final"><span>Estimated cake subtotal</span><strong>{money(subtotal)}</strong></div></div>
        <div className="notice">This is an enquiry, not a confirmed booking. Delivery and customization charges are agreed directly with your mother on WhatsApp.</div>
        <form onSubmit={sendToWhatsApp}>
          <div className="formgrid"><div className="field"><label htmlFor="name">Your name</label><input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></div><div className="field"><label htmlFor="phone">Phone number</label><input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+91 98765 43210" required /></div><div className="field full"><label htmlFor="address">Delivery address</label><textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" required /></div><div className="field"><label htmlFor="payment">Preferred payment method</label><select id="payment" value={payment} onChange={(e) => setPayment(e.target.value as Payment)}><option value="upi">UPI (details confirmed on WhatsApp)</option><option value="bank_transfer">Bank transfer (details confirmed on WhatsApp)</option><option value="cash_on_delivery">Cash on delivery</option></select></div><div className="field"><label htmlFor="custom">Customization request (optional)</label><input id="custom" value={customization} onChange={(e) => setCustomization(e.target.value)} placeholder="Message, colour, design…" /></div></div>
          <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required /> I agree to share my contact and order details with Aami Bakes so they can respond to this enquiry.</label>
          <button className="button" type="submit" disabled={submitting}>{submitting ? "Saving your enquiry…" : "Save enquiry & continue to WhatsApp"}</button>
        </form>
        {sent && <div className="notice success" style={{ marginTop: 12 }}>Enquiry #{orderNumber} is saved in the Admin order queue. WhatsApp should open with this order ready in the chat; tap Send there. Aami Bakes will call to verify the details and confirm delivery/customization charges.{whatsAppUrl && <a href={whatsAppUrl} onClick={openDirectWhatsApp} target="_blank" rel="noreferrer"> If WhatsApp did not open, open the chat here ↗</a>}</div>}
        <p className="note">Your name, phone number, address, cake choices, and estimate are saved for the bakery admin and included in the WhatsApp message. WhatsApp requires you to tap Send. If your device asks which app to use, choose WhatsApp. The displayed estimate excludes delivery and customization.</p>
      </> : <div className="empty"><p>Your basket is empty.</p><button className="button secondary" onClick={() => setCartOpen(false)}>Browse the menu</button></div>}
    </section></div>}
  </>;
}

function BrandIcon({ kind }: { kind: "whatsapp" | "instagram" | "shield" | "phone" | "location" }) {
  if (kind === "whatsapp") return <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 .9A15 15 0 0 0 3.08 23.52L1.1 31l7.7-1.94A15 15 0 1 0 16 .9Zm0 27.3a12.2 12.2 0 0 1-6.2-1.7l-.44-.26-4.57 1.15 1.22-4.45-.29-.46A12.25 12.25 0 1 1 16 28.2Zm6.72-9.17c-.37-.18-2.2-1.09-2.54-1.22-.34-.12-.59-.18-.84.19-.25.36-.96 1.21-1.18 1.46-.22.24-.44.27-.81.09-.37-.18-1.56-.58-2.97-1.84-1.1-.98-1.85-2.2-2.07-2.57-.22-.37-.02-.57.16-.75.16-.16.37-.44.55-.65.18-.22.24-.37.37-.62.12-.24.06-.46-.03-.64-.1-.18-.84-2.02-1.15-2.77-.3-.72-.6-.62-.84-.63h-.72c-.25 0-.65.1-.99.47-.34.36-1.3 1.27-1.3 3.1 0 1.84 1.33 3.6 1.52 3.85.18.25 2.62 4 6.35 5.6.89.38 1.58.61 2.12.78.89.28 1.7.24 2.34.15.71-.11 2.2-.9 2.51-1.77.31-.87.31-1.62.22-1.77-.09-.15-.34-.24-.71-.42Z"/></svg>;
  if (kind === "instagram") return <svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="instagram-gradient" x1="0" x2="1" y1="1" y2="0"><stop stopColor="#f9ce34"/><stop offset=".48" stopColor="#ee2a7b"/><stop offset="1" stopColor="#6228d7"/></linearGradient></defs><rect x="2.1" y="2.1" width="19.8" height="19.8" rx="5.7" fill="none" stroke="url(#instagram-gradient)" strokeWidth="2.2"/><circle cx="12" cy="12" r="4.35" fill="none" stroke="url(#instagram-gradient)" strokeWidth="2.2"/><circle cx="18.1" cy="5.9" r="1.3" fill="#dc3a82"/></svg>;
  if (kind === "shield") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2 20 5v5.8c0 5.1-3.4 9-8 11-4.6-2-8-5.9-8-11V5l8-2.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="m8.3 11.9 2.4 2.4 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (kind === "phone") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.1 3.2 9 7.7 7.2 9.1a15.3 15.3 0 0 0 7.7 7.7l1.4-1.8 4.5 1.9v3c0 .8-.7 1.5-1.5 1.5C10 21.4 2.6 14 2.6 4.7c0-.8.7-1.5 1.5-1.5h3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 10c0 5.3-7.5 11.5-7.5 11.5S4.5 15.3 4.5 10a7.5 7.5 0 1 1 15 0Z" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>;
}
