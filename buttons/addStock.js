const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const db = require("../database/database");

module.exports = async (interaction) => {

    try {

        // 🔥 FIX 1: กัน timeout
        await interaction.deferReply({ ephemeral: true });

        const products = await db.getProducts();

        if (!Array.isArray(products) || products.length === 0) {
            return interaction.editReply("❌ ยังไม่มีสินค้าในระบบ");
        }

        const safeProducts = products.slice(0, 24);

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select_product")
            .setPlaceholder("📦 เลือกหมวดสต็อก")
            .addOptions([
                ...safeProducts.map((p, i) => ({
                    label: p.name.slice(0, 100),
                    value: `product_${i}_${p.name}` // 🔥 FIX unique value
                })),
                {
                    label: "➕ เพิ่มสินค้าใหม่",
                    value: "new_product"
                }
            ]);

        return interaction.editReply({
            content: "📥 เลือกหมวดหมู่สินค้าที่ต้องการเติมสต็อก",
            components: [
                new ActionRowBuilder().addComponents(menu)
            ]
        });

    } catch (err) {

        console.log("❌ addstock error:", err);

        try {
            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply({
                    content: "❌ โหลดข้อมูลสินค้าไม่สำเร็จ",
                    ephemeral: true
                });
            } else {
                return interaction.editReply("❌ โหลดข้อมูลสินค้าไม่สำเร็จ");
            }
        } catch (e) {
            console.log("❌ reply failed:", e);
        }
    }
};