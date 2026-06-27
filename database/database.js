require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// =====================
// ENV CHECK (ต้องหยุดถ้าพัง)
// =====================
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.log("❌ Supabase env missing!");
    process.exit(1);
}

// =====================
// SUPABASE CLIENT
// =====================
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// =====================
// ERROR LOGGER
// =====================
function logError(action, error) {
    if (!error) return;

    console.log(`❌ Supabase Error [${action}]`);
    console.log("Message:", error.message);
    console.log("Code:", error.code || "unknown");
    console.log("Details:", error.details || "none");
}

// =====================
// PRODUCTS
// =====================
async function addProduct(name, cost = 0, resell_price = 0, customer_price = 0) {

    if (!name) return null;

    const { data, error } = await supabase
        .from("products")
        .insert([{
            name,
            cost,
            resell_price,
            customer_price
        }])
        .select()
        .single();

    logError("addProduct", error);

    return data || null;
}

async function getProduct(name) {

    if (!name) return null;

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

// =====================
// KEYS
// =====================
async function addKeys(productName, keysArray = []) {

    if (!productName || !Array.isArray(keysArray)) return null;

    const rows = keysArray
        .map(k => k?.trim())
        .filter(Boolean)
        .map(k => ({
            product_name: productName,
            key: k,
            status: "available"
        }));

    if (rows.length === 0) return null;

    const { data, error } = await supabase
        .from("keys")
        .insert(rows)
        .select();

    logError("addKeys", error);

    return data || [];
}

async function getStock(productName) {

    const { count, error } = await supabase
        .from("keys")
        .select("*", { count: "exact", head: true })
        .eq("product_name", productName)
        .eq("status", "available");

    logError("getStock", error);

    return { count: count || 0 };
}

async function getRandomKey(productName) {

    const { data, error } = await supabase
        .from("keys")
        .select("*")
        .eq("product_name", productName)
        .eq("status", "available");

    logError("getRandomKey", error);

    if (!Array.isArray(data) || data.length === 0) return null;

    return data[Math.floor(Math.random() * data.length)];
}

// =====================
// LOCK SYSTEM
// =====================
async function lockKey(payload) {

    if (!payload?.key_id) return null;

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
        .single();

    logError("lockKey", error);

    return data || null;
}

async function confirmKey(id) {

    const { data: item, error } = await supabase
        .from("pending_keys")
        .select("*")
        .eq("id", id)
        .single();

    logError("confirmKey/select", error);

    if (!item || item.status !== "pending") return item;

    await supabase
        .from("keys")
        .update({ status: "used" })
        .eq("id", item.key_id);

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
        .single();

    logError("cancelKey/select", error);

    if (!item || item.status !== "pending") return item;

    await supabase
        .from("pending_keys")
        .update({ status: "cancelled" })
        .eq("id", id);

    return item;
}

// =====================
// EXPORT
// =====================
module.exports = {
    supabase,

    addProduct,
    getProduct,
    getProducts,

    addKeys,
    getStock,
    getRandomKey,

    lockKey,
    confirmKey,
    cancelKey
};