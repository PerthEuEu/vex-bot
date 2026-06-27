const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ================= CLEAN =================
function norm(str) {
    return (str || "").trim();
}

// ================= PRODUCTS =================
async function getProducts() {
    const { data, error } = await supabase
        .from("products")
        .select("*");

    if (error) console.log(error);
    return data || [];
}

async function getProduct(name) {
    const clean = norm(name);

    const { data } = await supabase
        .from("products")
        .select("*")
        .eq("name", clean)
        .maybeSingle();

    return data || null;
}

// ================= ADD KEYS =================
async function addKeys(product_name, keys) {

    const clean = norm(product_name);

    const rows = keys.map(k => ({
        product_name: clean,
        key: k.trim(),
        status: "available"
    }));

    const { error } = await supabase
        .from("keys")
        .insert(rows);

    if (error) {
        console.log("ADD ERROR:", error);
        return [];
    }

    return rows;
}

// ================= STOCK =================
async function getStock(product_name) {

    const clean = norm(product_name);

    const { count, error } = await supabase
        .from("keys")
        .select("*", { count: "exact", head: true })
        .eq("product_name", clean)
        .eq("status", "available");

    if (error) console.log(error);

    return count || 0;
}

// ================= CLAIM KEY (FIXED REAL ATOMIC) =================
async function claimKey(product_name) {

    const clean = norm(product_name);

    // 🔥 STEP 1: lock 1 key
    const { data, error } = await supabase
        .from("keys")
        .select("id, key")
        .eq("product_name", clean)
        .eq("status", "available")
        .limit(1);

    if (error || !data?.length) return null;

    const key = data[0];

    // 🔥 STEP 2: update with condition
    const { data: updated, error: upErr } = await supabase
        .from("keys")
        .update({ status: "used", used_at: new Date().toISOString() })
        .eq("id", key.id)
        .eq("status", "available")
        .select();

    if (upErr || !updated?.length) return null;

    return key;
}

module.exports = {
    supabase,
    getProducts,
    getProduct,
    addKeys,
    getStock,
    claimKey
};