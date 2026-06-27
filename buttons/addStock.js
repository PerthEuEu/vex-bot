const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const db = require("../database/database");

async function safeReply(interaction, payload) {
    try {
        if (interaction.deferred) return interaction.editReply(payload);
        if (interaction.replied) return interaction.followUp(payload);
        return interaction.reply(payload);
    } catch (err) {
        console.log("safeReply error:", err?.message || err);
    }
}

module.exports = async (interaction) => {
    try {

        // ================= VALIDATION =================
        if (!interaction || !interaction.isRepliable?.()) {
            return console.log("Invalid interaction");
        }

        // ================= GET CATEGORIES =================
        const categories = await db.getCategories?.();

        if (!categories || !Array.isArray(categories) || categories.length === 0) {
            return safeReply(interaction, {
                content: "❌ ไม่มีหมวดหมู่ในระบบ (getCategories ว่างหรือยังไม่ได้สร้าง)",
                ephemeral: true
            });
        }

        // ================= BUILD MENU =================
        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select_category")
            .setPlaceholder("📂 เลือกหมวดหมู่")
            .addOptions(
                categories.slice(0, 25).map(c => ({
                    label: String(c.name).slice(0, 100), // กันพัง Discord limit
                    value: String(c.name).slice(0, 100)
                }))
            );

        // ================= RESPONSE =================
        return safeReply(interaction, {
            content: "📂 เลือกหมวดหมู่",
            components: [
                new ActionRowBuilder().addComponents(menu)
            ],
            ephemeral: true
        });

    } catch (err) {
        console.log("addStock ERROR:", err);

        return safeReply(interaction, {
            content: "❌ ระบบ addStock error",
            ephemeral: true
        });
    }
};