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

        const categories = await db.getCategories?.();

        if (!Array.isArray(categories) || categories.length === 0) {
            return safeReply(interaction, {
                content: "❌ ไม่มีหมวดหมู่ในระบบ",
                ephemeral: true
            });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select_category")
            .setPlaceholder("📂 เลือกหมวดหมู่")
            .addOptions(
                categories.slice(0, 25).map(c => ({
                    label: c.name,
                    value: c.name
                }))
            );

        return safeReply(interaction, {
            content: "📂 เลือกหมวดหมู่",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });

    } catch (err) {
        console.log("addstock error:", err);
        return safeReply(interaction, {
            content: "❌ error",
            ephemeral: true
        });
    }
};