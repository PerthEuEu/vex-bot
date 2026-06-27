const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ================= NORMALIZE (สำคัญมาก) =================
function norm(str) {
    return (str || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

// ================= PRODUCTS =================
async function getProducts() {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });

    if (error) console.log("getProducts error:", error);

    return data || [];
}

async function getProduct(name) {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("name", name)
        .maybeSingle();

    if (error) console.log("getProduct error:", error);

    return data || null;
}

// ================= ADD KEYS =================
async function addKeys(product_name, keys) {

    const cleanName = norm(product_name);

    const rows = keys.map(k => ({
        product_name: cleanName,
        key: k.trim(),
        status: "available"
    }));

    const { error } = await supabase
        .from("keys")
        .insert(rows);

    if (error) console.log("addKeys error:", error);

    return rows;
}

// ================= STOCK =================
async function getStock(product_name) {

    const cleanName = norm(product_name);

    const { count, error } = await supabase
        .from("keys")
        .select("*", { count: "exact", head: true })
        .eq("product_name", cleanName)
        .eq("status", "available");

    if (error) console.log("stock error:", error);

    return count || 0;
}

// ================= CLAIM KEY (FIXED 100%) =================
async function claimKey(product_name) {

    const cleanName = norm(product_name);

    // ดึง key ที่ยังว่าง
    const { data, error } = await supabase
        .from("keys")
        .select("id, key")
        .eq("product_name", cleanName)
        .eq("status", "available")
        .limit(1);

    if (error) {
        console.log("claim select error:", error);
        return null;
    }

    if (!data || data.length === 0) return null;

    const key = data[0];

    // ล็อกทันที
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
        console.log("claim update error:", updateError);
        return null;
    }

    if (!updated || updated.length === 0) return null;

    return key;
}

// ================= USE KEY =================
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