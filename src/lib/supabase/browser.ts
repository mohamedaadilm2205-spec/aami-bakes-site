import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type RowTable<Row, Insert = Partial<Row>, Update = Partial<Row>, Relations = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relations;
};
type ProductRow = { id: string; name: string; description: string; price_per_kg: number; image_url: string | null; is_active: boolean; sort_order: number; created_at: string; updated_at: string };
type OrderRow = { id: string; order_number: number; customer_id: string | null; customer_name: string; customer_phone: string; delivery_address: string; payment_preference: "upi" | "cash_on_delivery" | "bank_transfer"; customization_request: string; status: "new" | "confirmed" | "in_progress" | "completed" | "cancelled"; cake_subtotal: number; delivery_charge: number | null; customization_charge: number | null; confirmed_total: number | null; created_at: string; updated_at: string };
type OrderItemRow = { id: string; order_id: string; product_id: string | null; product_name: string; quantity_kg: number; price_per_kg: number; line_total: number };
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Database = {
  public: {
    Tables: {
      products: RowTable<ProductRow, Pick<ProductRow, "name" | "description" | "price_per_kg"> & Partial<Omit<ProductRow, "name" | "description" | "price_per_kg">>>;
      orders: RowTable<OrderRow, Pick<OrderRow, "customer_name" | "customer_phone" | "delivery_address" | "payment_preference" | "cake_subtotal"> & Partial<Omit<OrderRow, "customer_name" | "customer_phone" | "delivery_address" | "payment_preference" | "cake_subtotal">>>;
      order_items: RowTable<OrderItemRow, Pick<OrderItemRow, "order_id" | "product_name" | "quantity_kg" | "price_per_kg" | "line_total"> & Partial<Omit<OrderItemRow, "order_id" | "product_name" | "quantity_kg" | "price_per_kg" | "line_total">>, Partial<OrderItemRow>, [{ foreignKeyName: "order_items_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }] >;
      user_roles: RowTable<{ user_id: string; role: "owner"; created_at: string }, { user_id: string; role: "owner"; created_at?: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      is_bakery_owner: { Args: Record<string, never>; Returns: boolean };
      submit_whatsapp_enquiry: { Args: { p_order_id: string; p_customer_name: string; p_customer_phone: string; p_delivery_address: string; p_payment_preference: string; p_customization_request: string; p_items: Json }; Returns: number };
    };
    Enums: { order_status: "new" | "confirmed" | "in_progress" | "completed" | "cancelled" };
    CompositeTypes: Record<string, never>;
  };
};

let browserClient: SupabaseClient<Database> | undefined;

export function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Add your Supabase project URL and publishable key to .env.local, then restart the site.");
  browserClient ??= createClient<Database>(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return browserClient;
}
