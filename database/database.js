require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// ================= ENV CHECK =================
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
    return data || [];
}

// ================= KEYS =================
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

// 🔥 FIX: STOCK ต้อง return number
async function getStock(product_name) {
    const { count, error } = await supabase
        .from("keys")
        .select("*", { count: "exact", head: true })
        .eq("product_name", product_name)
        .eq("status", "available");

    logError("getStock", error);
    return count ?? 0;
}

// ================= RANDOM KEY =================
async function getRandomKey(product_name) {
    const { data, error } = await supabase
        .from("keys")
        .select("*")
        .eq("product_name", product_name)
        .eq("status", "available");

    logError("getRandomKey", error);

    if (!Array.isArray(data) || data.length === 0) return null;

    return data[Math.floor(Math.random() * data.length)];
}

// 🔥 FIX: atomic lock (กันกดซ้ำ)
async function useKey(keyId) {
    const { data, error } = await supabase
        .from("keys")
        .update({ status: "used" })
        .eq("id", keyId)
        .eq("status", "available") // กันซ้ำ
        .select()
        .single();

    logError("useKey", error);
    return data || null;
}

module.exports = {
    supabase,
    addProduct,
    getProduct,
    getProducts,
    addKeys,
    getStock,
    getRandomKey,
    useKey
};