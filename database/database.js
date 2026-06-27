const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

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
        product_name,
        key: k,
        status: "available"
    }));

    const { data, error } = await supabase
        .from("keys")
        .insert(rows)
        .select();

    if (error) console.log("addKeys error:", error);

    return data || [];
}

// ================= STOCK =================
async function getStock(product_name) {

    const { count } = await supabase
        .from("keys")
        .select("*", { count: "exact", head: true })
        .eq("product_name", product_name)
        .eq("status", "available");

    return { count: count || 0 };
}

// ================= 🔥 ATOMIC KEY CLAIM (FIX DUPLICATE BUG) =================
async function claimKey(product_name) {

    // 🔥 STEP 1: ดึง key ที่ยังว่าง
    const { data: keys, error } = await supabase
        .from("keys")
        .select("id, key")
        .eq("product_name", product_name)
        .eq("status", "available")
        .limit(1);

    if (error) {
        console.log("claimKey error:", error);
        return null;
    }

    if (!keys || keys.length === 0) return null;

    const key = keys[0];

    // 🔥 STEP 2: ล็อก key ทันที (กันซ้ำ)
    const { data: updated, error: updateError } = await supabase
        .from("keys")
        .update({
            status: "used",
            used_at: new Date().toISOString()
        })
        .eq("id", key.id)
        .eq("status", "available") // 🔥 กัน race condition
        .select()
        .maybeSingle();

    if (updateError) {
        console.log("claimKey update error:", updateError);
        return null;
    }

    // ถ้า update ไม่สำเร็จ = มีคนเอาไปแล้ว
    if (!updated) return null;

    return key;
}

// ================= MARK USED (backup) =================
async function useKey(id) {
    const { data } = await supabase
        .from("keys")
        .update({
            status: "used",
            used_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .maybeSingle();

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