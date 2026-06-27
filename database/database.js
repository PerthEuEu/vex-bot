require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.log("❌ Supabase env missing!");
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ================= ERROR =================
function logError(action, error) {
    if (!error) return;
    console.log(`❌ Supabase Error [${action}]`);
    console.log(error.message || error);
}

// ================= PRODUCTS =================
async function addProduct(name, cost = 0, resell_price = 0, customer_price = 0) {
    const { data, error } = await supabase
        .from("products")
        .insert([{ name, cost, resell_price, customer_price }])
        .select()
        .single();

    logError("addProduct", error);
    return data || null;
}

async function getProduct(name) {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("name", name)
        .single();

    logError("getProduct", error);
    return data || null;
}

async function getProducts() {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });

    logError("getProducts", error);
    return Array.isArray(data) ? data : [];
}

// ================= ADD KEYS =================
async function addKeys(product_name, keysArray = []) {

    const rows = keysArray
        .map(k => k?.trim())
        .filter(Boolean)
        .map(k => ({
            product_name,
            key: k,
            status: "available"
        }));

    if (!rows.length) return [];

    const { data, error } = await supabase
        .from("keys")
        .insert(rows)
        .select();

    logError("addKeys", error);
    return data || [];
}

// ================= STOCK =================
async function getStock(product_name) {

    const { count, error } = await supabase
        .from("keys")
        .select("*", { count: "exact", head: true })
        .eq("product_name", product_name)
        .eq("status", "available");

    logError("getStock", error);

    return Number(count || 0);
}

// ================= 🔥 FIXED ATOMIC CLAIM KEY (REAL SAFE) =================
async function claimKey(product_name) {

    // 🔥 STEP 1: get 1 key
    const { data, error } = await supabase
        .from("keys")
        .select("id, key, product_name")
        .eq("product_name", product_name)
        .eq("status", "available")
        .limit(1)
        .maybeSingle();

    if (error || !data) {
        logError("claimKey-select", error);
        return null;
    }

    // 🔥 STEP 2: atomic lock (IMPORTANT FIX)
    const { data: locked, error: lockErr } = await supabase
        .from("keys")
        .update({
            status: "used",
            used_at: new Date().toISOString()
        })
        .eq("id", data.id)
        .eq("status", "available") // กันคนแย่ง
        .select()
        .maybeSingle();

    if (lockErr) {
        logError("claimKey-lock", lockErr);
        return null;
    }

    // ❌ ถ้าโดนแย่ง = null
    if (!locked) return null;

    return locked;
}

module.exports = {
    supabase,
    addProduct,
    getProduct,
    getProducts,
    addKeys,
    getStock,
    claimKey
};