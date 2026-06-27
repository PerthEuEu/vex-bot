const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ================= NORMALIZE (ใช้เฉพาะ key ไม่ใช่ product_name) =================
function norm(str) {
    return (str || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

// ================= PRODUCTS =================

async function getProducts() {
    const { data, error } = await supabase
        .from("products")
        .select("*");

    if (error) console.log("getProducts ERROR:", error.message);
    return data || [];
}

async function getProductById(id) {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", String(id))
        .maybeSingle();

    if (error) console.log("getProductById ERROR:", error.message);
    return data || null;
}

async function getProductByName(name) {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("name", name)
        .maybeSingle();

    if (error) console.log("getProductByName ERROR:", error.message);
    return data || null;
}

// ================= KEYS =================

// ➕ ADD KEYS (FULL DUPLICATE PROTECTION)
async function addKeys(product_name, keys) {

    const clean = norm(product_name);

    const safeKeys = (keys || [])
        .map(k => String(k).trim())
        .filter(Boolean);

    if (safeKeys.length === 0) return [];

    // 🔥 ดึง key ที่มีอยู่แล้ว
    const { data: existing } = await supabase
        .from("keys")
        .select("key")
        .eq("product_name", clean);

    const existingSet = new Set((existing || []).map(x => x.key));

    // 🔥 กันซ้ำใน request + DB
    const unique = [...new Set(safeKeys)]
        .filter(k => !existingSet.has(k));

    if (unique.length === 0) return [];

    const rows = unique.map(k => ({
        product_name: clean,
        key: k,
        status: "available",
        used_at: null
    }));

    const { data, error } = await supabase
        .from("keys")
        .insert(rows)
        .select();

    if (error) {
        console.log("addKeys ERROR:", error.message);
        return [];
    }

    return data || [];
}

// ================= STOCK =================

async function getStock(product_name) {

    const clean = norm(product_name);

    const { count, error } = await supabase
        .from("keys")
        .select("*", { count: "exact", head: true })
        .eq("product_name", clean)
        .eq("status", "available");

    if (error) console.log("getStock ERROR:", error.message);

    return count || 0;
}

// ================= CLAIM KEY (SAFE VERSION v2) =================
// 🔥 ใช้ "delete + return" แทน update (กัน race ดีที่สุดใน Supabase)

async function claimKey(product_name) {

    const clean = norm(product_name);

    // 1. lock-ish: ดึงตัวแรก
    const { data, error } = await supabase
        .from("keys")
        .select("id, key")
        .eq("product_name", clean)
        .eq("status", "available")
        .order("id", { ascending: true })
        .limit(1);

    if (error) {
        console.log("claimKey SELECT ERROR:", error.message);
        return null;
    }

    if (!data || data.length === 0) return null;

    const key = data[0];

    // 2. mark used (atomic-ish)
    const { data: updated, error: upErr } = await supabase
        .from("keys")
        .update({
            status: "used",
            used_at: new Date().toISOString()
        })
        .eq("id", key.id)
        .eq("status", "available")
        .select("id");

    if (upErr) {
        console.log("claimKey UPDATE ERROR:", upErr.message);
        return null;
    }

    if (!updated || updated.length === 0) return null;

    return key;
}

// ================= EXPORT =================
module.exports = {
    supabase,

    getProducts,
    getProductById,
    getProductByName,

    addKeys,
    getStock,
    claimKey
};