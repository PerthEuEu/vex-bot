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

    const name = norm(product_name);

    const rows = keys
        .map(k => k.trim())
        .filter(Boolean)
        .map(k => ({
            product_name: name,
            key: k,
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

    if (error) {
        console.log("stock error:", error);
        return 0;
    }

    return count || 0;
}

// ================= CLAIM KEY (FIXED SAFE VERSION) =================
async function claimKey(product_name) {

    const name = norm(product_name);

    // 🔥 STEP 1: ดึง key ตัวเดียว
    const { data, error } = await supabase
        .from("keys")
        .select("id, key")
        .eq("product_name", name)
        .eq("status", "available")
        .limit(1);

    if (error) {
        console.log("claim select error:", error);
        return null;
    }

    if (!data || data.length === 0) return null;

    const key = data[0];

    // 🔥 STEP 2: lock แบบ atomic
    const { data: updated, error: updateError } = await supabase
        .from("keys")
        .update({
            status: "used",
            used_at: new Date().toISOString()
        })
        .eq("id", key.id)
        .eq("status", "available")
        .select("id, key")
        .maybeSingle();

    if (updateError) {
        console.log("claim update error:", updateError);
        return null;
    }

    if (!updated) return null;

    return key;
}

// ================= USE KEY (BACKUP FORCE) =================
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