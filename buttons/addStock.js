const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const db = require("../database/database");

// ================= SAFE REPLY =================
async function safeReply(interaction, payload) {
    try {
        if (interaction.deferred) return await interaction.editReply(payload);
        if (interaction.replied) return await interaction.followUp(payload);
        return await interaction.reply(payload);
    } catch (err) {
        console.log("safeReply error:", err?.message || err);
    }
}

module.exports = async (interaction) => {
    try {

        // ================= GET PRODUCTS =================
        const products = await db.getProducts();

        if (!Array.isArray(products) || products.length === 0) {
            return safeReply(interaction, {
                content: "❌ ยังไม่มีสินค้าในระบบ",
                ephemeral: true
            });
        }

        // ================= BUILD MENU =================
        const safeProducts = products.slice(0, 25);

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select_product")
            .setPlaceholder("📦 เลือกสินค้าที่ต้องการเติมสต็อก")
            .addOptions(
                safeProducts.map(p => ({
                    label: (p.name || "unknown").slice(0, 100),
                    value: p.name
                }))
            );

        // ================= RESPONSE =================
        return await safeReply(interaction, {
            content: "📥 เลือกสินค้าที่ต้องการเติมสต็อก",
            components: [
                new ActionRowBuilder().addComponents(menu)
            ],
            ephemeral: true
        });

    } catch (err) {
        console.log("❌ addstock error:", err?.message || err);

        return safeReply(interaction, {
            content: "❌ โหลดสินค้าไม่สำเร็จ",
            ephemeral: true
        });
    }
};