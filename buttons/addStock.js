const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const db = require("../database/database");

// ================= SAFE REPLY =================
async function safeReply(interaction, data) {
    try {
        if (interaction.deferred) return interaction.editReply(data);
        if (interaction.replied) return interaction.followUp(data);
        return interaction.reply(data);
    } catch (e) {
        console.log("safeReply error:", e?.message || e);
    }
}

module.exports = async (interaction) => {

    try {

        const products = await db.getProducts();

        if (!Array.isArray(products) || products.length === 0) {
            return safeReply(interaction, {
                content: "❌ ยังไม่มีสินค้าในระบบ",
                ephemeral: true
            });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select")
            .setPlaceholder("📦 เลือกสินค้าที่ต้องการเติมสต็อก")
            .addOptions(
                products.slice(0, 25).map(p => ({
                    label: p.name.slice(0, 100),
                    value: p.name
                }))
            );

        return safeReply(interaction, {
            content: "📥 เลือกสินค้าที่ต้องการเติมสต็อก",
            components: [
                new ActionRowBuilder().addComponents(menu)
            ],
            ephemeral: true
        });

    } catch (err) {
        console.log("❌ addstock error:", err?.message || err);

        return safeReply(interaction, {
            content: "❌ โหลดข้อมูลสินค้าไม่สำเร็จ",
            ephemeral: true
        });
    }
};