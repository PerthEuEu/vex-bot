const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ================= NORMALIZE =================
function norm(str) {
    return (str || "").trim().toLowerCase();
}

// ================= PRODUCTS =================
async function getProducts() {
    const { data } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });

    return data || [];
}

async function getProduct(name) {
    const { data } = await supabase
        .from("products")
        .select("*")
        .eq("name", name)
        .maybeSingle();

    return data || null;
}

// ================= ADD KEYS =================
async function addKeys(product_name, keys) {

    const rows = keys.map(k => ({
        product_name: norm(product_name),
        key: k.trim(),
        status: "available"
    }));

    const { error } = await supabase
        .from("keys")
        .insert(rows);

    if (error) console.log("addKeys error:", error);

    return true;
}

// ================= STOCK =================
async function getStock(product_name) {

    const { count, error } = await supabase
        .from("keys")
        .select("*", { count: "exact", head: true })
        .eq("product_name", norm(product_name))
        .eq("status", "available");

    if (error) console.log("stock error:", error);

    return count || 0;
}

// ================= CLAIM KEY (FIXED) =================
async function claimKey(product_name) {

    const name = norm(product_name);

    // 🔥 STEP 1: lock row (limit 1)
    const { data, error } = await supabase
        .from("keys")
        .select("id, key")
        .eq("product_name", name)
        .eq("status", "available")
        .limit(1);

    if (error) {
        console.log("claimKey select error:", error);
        return null;
    }

    if (!data || data.length === 0) return null;

    const key = data[0];

    // 🔥 STEP 2: atomic update
    const { data: updated, error: updateError } = await supabase
        .from("keys")
        .update({
            status: "used",
            used_at: new Date().toISOString()
        })
        .eq("id", key.id)
        .eq("status", "available")
        .select();

    if (updateError) {
        console.log("claimKey update error:", updateError);
        return null;
    }

    if (!updated || updated.length === 0) return null;

    return key;
}

// ================= BACKUP USE =================
async function useKey(id) {
    const { data, error } = await supabase
        .from("keys")
        .update({
            status: "used",
            used_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .maybeSingle();

    if (error) console.log("useKey error:", error);

    return data || null;
}

module.exports = {
    supabase,
    getProducts,
    getProduct,
    addKeys,
    getStock,
    claimKey,
    useKey
};