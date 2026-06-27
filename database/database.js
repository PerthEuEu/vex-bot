require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// ===================== ENV =====================
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.log("❌ Supabase env missing!");
    process.exit(1);
}

// ===================== CLIENT =====================
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ===================== ERROR =====================
function logError(action, error) {
    if (!error) return;

    console.log(`❌ Supabase Error [${action}]`);
    console.log("Message:", error.message);
    console.log("Code:", error.code || "unknown");
    console.log("Details:", error.details || "none");
}

// ===================== CATEGORY (🔥 FIX ADDED) =====================
async function getCategories() {
    const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

    logError("getCategories", error);
    return Array.isArray(data) ? data : [];
}

// ===================== PRODUCTS =====================
async function addProduct(name, cost = 0, resell_price = 0, customer_price = 0) {

    const { data, error } = await supabase
        .from("products")
        .insert([{ name, cost, resell_price, customer_price }])
        .select()
        .maybeSingle();

    logError("addProduct", error);
    return data || null;
}

async function getProduct(name) {

    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("name", name)
        .maybeSingle();

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

// ===================== BY CATEGORY (🔥 FIX ADDED) =====================
async function getProductsByCategory(category) {

    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("category", category)
        .order("name", { ascending: true });

    logError("getProductsByCategory", error);
    return Array.isArray(data) ? data : [];
}

// ===================== KEYS =====================
async function addKeys(productName, keysArray = []) {

    const rows = keysArray
        .map(k => k?.trim())
        .filter(Boolean)
        .map(k => ({
            product_name: productName,
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

// ===================== STOCK =====================
async function getStock(productName) {

    const { count, error } = await supabase
        .from("keys")
        .select("*", { count: "exact", head: true })
        .eq("product_name", productName)
        .eq("status", "available");

    logError("getStock", error);

    return {
        count: count || 0
    };
}

// ===================== RANDOM KEY =====================
async function getRandomKey(productName) {

    const { data, error } = await supabase
        .from("keys")
        .select("id, key, product_name")
        .eq("product_name", productName)
        .eq("status", "available");

    logError("getRandomKey", error);

    if (!data?.length) return null;

    return data[Math.floor(Math.random() * data.length)];
}

// ===================== MARK USED (SAFE) =====================
async function markKeyUsed(keyId) {

    const { data, error } = await supabase
        .from("keys")
        .update({
            status: "used",
            used_at: new Date().toISOString()
        })
        .eq("id", keyId)
        .eq("status", "available")
        .select()
        .maybeSingle();

    logError("markKeyUsed", error);
    return data || null;
}

// ===================== PENDING SYSTEM =====================
async function lockKey(payload) {

    const { data, error } = await supabase
        .from("pending_keys")
        .insert([{
            user_id: payload.user_id,
            product_name: payload.product_name,
            key_id: payload.key_id,
            key: payload.key,
            type: payload.type,
            price: payload.price,
            profit: payload.profit,
            status: "pending"
        }])
        .select()
        .maybeSingle();

    logError("lockKey", error);
    return data || null;
}

async function confirmKey(id) {

    const { data: item, error } = await supabase
        .from("pending_keys")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    logError("confirmKey", error);

    if (!item || item.status !== "pending") return null;

    await markKeyUsed(item.key_id);

    await supabase
        .from("pending_keys")
        .update({ status: "confirmed" })
        .eq("id", id);

    return item;
}

async function cancelKey(id) {

    const { data: item, error } = await supabase
        .from("pending_keys")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    logError("cancelKey", error);

    if (!item || item.status !== "pending") return null;

    await supabase
        .from("pending_keys")
        .update({ status: "cancelled" })
        .eq("id", id);

    return item;
}

// ===================== EXPORT =====================
module.exports = {
    supabase,

    addProduct,
    getProduct,
    getProducts,

    getCategories,
    getProductsByCategory,

    addKeys,
    getStock,
    getRandomKey,

    lockKey,
    confirmKey,
    cancelKey,
    markKeyUsed
};