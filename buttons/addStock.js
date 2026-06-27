const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const db = require("../database/database");

module.exports = async (interaction) => {

    try {

        // ================= SAFE DEFER =================
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
        }

        const products = await db.getProducts();

        if (!Array.isArray(products) || products.length === 0) {
            return interaction.editReply({
                content: "❌ ยังไม่มีสินค้าในระบบ",
                components: []
            });
        }

        // ================= SAFE LIMIT (Discord max 25 options) =================
        const safeProducts = products.slice(0, 25);

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select_product")
            .setPlaceholder("📦 เลือกสินค้าเพื่อเติมสต็อก")
            .addOptions(
                safeProducts.map((p) => ({
                    label: p.name.slice(0, 100),
                    value: p.name
                }))
            );

        return interaction.editReply({
            content: "📥 เลือกสินค้าที่ต้องการเติมสต็อก",
            components: [
                new ActionRowBuilder().addComponents(menu)
            ]
        });

    } catch (err) {

        console.log("❌ addstock error:", err?.message || err);

        try {
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply("❌ โหลดข้อมูลสินค้าไม่สำเร็จ");
            } else {
                return interaction.reply({
                    content: "❌ โหลดข้อมูลสินค้าไม่สำเร็จ",
                    ephemeral: true
                });
            }
        } catch (e) {
            console.log("❌ reply fallback failed:", e?.message || e);
        }
    }
};