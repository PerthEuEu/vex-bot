const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const db = require("../database/database");

module.exports = async (interaction) => {

    try {

        const products = await db.getProducts();

        // =====================
        // กัน DB ว่าง
        // =====================
        if (!Array.isArray(products) || products.length === 0) {
            return interaction.reply({
                content: "❌ ยังไม่มีสินค้าในระบบ",
                ephemeral: true
            });
        }

        // =====================
        // Discord limit = 25 options
        // ต้องเผื่อ 1 slot สำหรับ "เพิ่มสินค้า"
        // =====================
        const safeProducts = products.slice(0, 24);

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select_product")
            .setPlaceholder("📦 เลือกหมวดสต็อก")
            .addOptions([
                ...safeProducts.map(p => ({
                    label: p.name.length > 100 ? p.name.slice(0, 100) : p.name,
                    value: p.name.slice(0, 100)
                })),
                {
                    label: "➕ เพิ่มสินค้าใหม่",
                    value: "new_product"
                }
            ]);

        return interaction.reply({
            content: "📥 เลือกหมวดหมู่สินค้าที่ต้องการเติมสต็อก",
            components: [
                new ActionRowBuilder().addComponents(menu)
            ],
            ephemeral: true
        });

    } catch (err) {

        console.log("❌ addstock error:", err);

        try {
            if (!interaction.replied) {
                return interaction.reply({
                    content: "❌ โหลดข้อมูลสินค้าไม่สำเร็จ",
                    ephemeral: true
                });
            }
        } catch (e) {
            console.log("❌ reply failed:", e);
        }
    }
};