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

// ================= CATEGORY =================
async function getCategories() {
    const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

    logError("getCategories", error);
    return Array.isArray(data) ? data : [];
}

// ================= PRODUCTS =================
async function addProduct(name, category = "default", cost = 0, resell_price = 0, customer_price = 0) {
    const { data, error } = await supabase
        .from("products")
        .insert([{ name, category, cost, resell_price, customer_price }])
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

// ================= FILTER BY CATEGORY =================
async function getProductsByCategory(category) {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("category", category)
        .order("name", { ascending: true });

    logError("getProductsByCategory", error);
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

// ================= 🔥 SAFE ATOMIC CLAIM KEY =================
async function claimKey(product_name) {

    // 1️⃣ select key
    const { data, error } = await supabase
        .from("keys")
        .select("id, key")
        .eq("product_name", product_name)
        .eq("status", "available")
        .limit(1)
        .maybeSingle();

    if (error || !data) {
        logError("claimKey-select", error);
        return null;
    }

    // 2️⃣ atomic lock (กันแย่ง 100%)
    const { data: locked, error: lockErr } = await supabase
        .from("keys")
        .update({
            status: "used",
            used_at: new Date().toISOString()
        })
        .eq("id", data.id)
        .eq("status", "available")
        .select()
        .maybeSingle();

    if (lockErr) {
        logError("claimKey-lock", lockErr);
        return null;
    }

    if (!locked) return null;

    return locked;
}

module.exports = {
    supabase,

    // category
    getCategories,

    // product
    addProduct,
    getProduct,
    getProducts,
    getProductsByCategory,

    // stock
    addKeys,
    getStock,
    claimKey
};