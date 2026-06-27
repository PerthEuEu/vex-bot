const Database = require("better-sqlite3");

const db = new Database("vex.db");

// =====================
// PRODUCTS
// =====================
db.prepare(`
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    cost INTEGER DEFAULT 0,
    resell_price INTEGER DEFAULT 0,
    customer_price INTEGER DEFAULT 0
)
`).run();

// =====================
// KEYS
// =====================
db.prepare(`
CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT,
    key TEXT,
    status TEXT DEFAULT 'available'
)
`).run();

// =====================
// PENDING KEYS
// =====================
db.prepare(`
CREATE TABLE IF NOT EXISTS pending_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    product_name TEXT,
    key_id INTEGER,
    key TEXT,
    type TEXT,
    price INTEGER,
    profit INTEGER,
    status TEXT DEFAULT 'pending'
)
`).run();


// =====================
// PRODUCTS
// =====================
function addProduct(name, cost, resell_price, customer_price) {
    if (!name) return;

    const reseller_profit = (resell_price || 0) - (cost || 0);
    const customer_profit = (customer_price || 0) - (cost || 0);

    return db.prepare(`
        INSERT OR IGNORE INTO products
        (name, cost, resell_price, customer_price)
        VALUES (?, ?, ?, ?)
    `).run(name, cost || 0, resell_price || 0, customer_price || 0);
}

function getProduct(name) {
    if (!name) return null;

    return db.prepare(`
        SELECT * FROM products WHERE name=?
    `).get(name);
}

function getProducts() {
    return db.prepare(`
        SELECT * FROM products ORDER BY name
    `).all();
}


// =====================
// KEYS
// =====================
function addKeys(productName, keysArray) {
    if (!productName || !Array.isArray(keysArray)) return;

    const stmt = db.prepare(`
        INSERT INTO keys (product_name, key, status)
        VALUES (?, ?, 'available')
    `);

    const tx = db.transaction((keys) => {
        for (const k of keys) {
            const clean = k.trim();
            if (clean) stmt.run(productName, clean);
        }
    });

    tx(keysArray);
}

function getStock(productName) {
    if (!productName) return { count: 0 };

    return db.prepare(`
        SELECT COUNT(*) as count
        FROM keys
        WHERE product_name = ? AND status = 'available'
    `).get(productName);
}

function getRandomKey(productName) {
    return db.prepare(`
        SELECT * FROM keys
        WHERE product_name = ? AND status = 'available'
        ORDER BY RANDOM()
        LIMIT 1
    `).get(productName);
}

function markUsed(id) {
    if (!id) return;

    return db.prepare(`
        UPDATE keys SET status='used' WHERE id=?
    `).run(id);
}


// =====================
// LOCK SYSTEM
// =====================
function lockKey(data) {
    if (!data?.key_id || !data?.key) return null;

    return db.prepare(`
        INSERT INTO pending_keys
        (user_id, product_name, key_id, key, type, price, profit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        data.user_id,
        data.product_name,
        data.key_id,
        data.key,
        data.type,
        data.price,
        data.profit
    );
}

function confirmKey(id) {
    const item = db.prepare(`
        SELECT * FROM pending_keys WHERE id=?
    `).get(id);

    if (!item) return null;
    if (item.status !== "pending") return item;

    db.prepare(`
        UPDATE keys SET status='used' WHERE id=?
    `).run(item.key_id);

    db.prepare(`
        UPDATE pending_keys SET status='confirmed' WHERE id=?
    `).run(id);

    return item;
}

function cancelKey(id) {
    const item = db.prepare(`
        SELECT * FROM pending_keys WHERE id=?
    `).get(id);

    if (!item) return null;
    if (item.status !== "pending") return item;

    return db.prepare(`
        UPDATE pending_keys SET status='cancelled' WHERE id=?
    `).run(id);
}


// =====================
// EXPORT
// =====================
module.exports = {
    db,
    addProduct,
    addKeys,
    getStock,
    getRandomKey,
    markUsed,
    getProduct,
    getProducts,
    lockKey,
    confirmKey,
    cancelKey
};