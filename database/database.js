const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ================= NORMALIZE =================
function norm(str) {
    return (str || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
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
        .eq("name", name.trim())
        .maybeSingle();

    if (error) console.log("getProduct error:", error);

    return data || null;
}

// ================= ADD KEYS =================
async function addKeys(product_name, keys) {

    const product = norm(product_name);

    const rows = keys.map(k => ({
        product_name: product,
        keys: k.trim(),        // ✅ ต้องใช้ "keys" ตาม DB
        status: "available",
        used_at: null
    }));

    const { data, error } = await supabase
        .from("keys")
        .insert(rows)
        .select();

    if (error) {
        console.log("addKeys error:", error);
        return [];
    }

    return data || [];
}

// ================= STOCK =================
async function getStock(product_name) {

    const name = norm(product_name);

    const { count, error } = await supabase
        .from("keys")
        .select("*", { count: "exact", head: true })
        .eq("product_name", name)
        .eq("status", "available");

    if (error) console.log("getStock error:", error);

    return count || 0;
}

// ================= CLAIM KEY (ANTI DUPLICATE 100%) =================
async function claimKey(product_name) {

    const name = norm(product_name);

    // 1) หา key ที่ยังว่าง
    const { data, error } = await supabase
        .from("keys")
        .select("id, keys")
        .eq("product_name", name)
        .eq("status", "available")
        .limit(1);

    if (error) {
        console.log("claimKey select error:", error);
        return null;
    }

    if (!data || data.length === 0) return null;

    const key = data[0];

    // 2) ล็อก key ทันที (กันซ้ำ)
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

// ================= USE KEY (backup) =================
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