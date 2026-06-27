const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const db = require("../database/database");

// ================= SAFE REPLY =================
async function safeReply(interaction, payload) {
    try {
        if (!interaction?.isRepliable?.()) return;

        if (interaction.deferred) return interaction.editReply(payload);
        if (interaction.replied) return interaction.followUp(payload);

        return interaction.reply(payload);

    } catch (err) {
        console.log("safeReply error:", err?.message || err);
    }
}

module.exports = async (interaction) => {
    try {

        if (!interaction) return;

        // ================= GET CATEGORIES =================
        const categories = await db.getCategories();

        if (!Array.isArray(categories)) {
            return safeReply(interaction, {
                content: "❌ DB ERROR: getCategories failed",
                ephemeral: true
            });
        }

        if (categories.length === 0) {
            return safeReply(interaction, {
                content: "❌ ไม่มีหมวดหมู่ในระบบ",
                ephemeral: true
            });
        }

        // ================= BUILD MENU =================
        const options = categories
            .slice(0, 25)
            .map(c => {

                const id = c.id !== undefined && c.id !== null
                    ? String(c.id)
                    : String(c.name);

                const name = c.name || "UNKNOWN";

                return {
                    label: String(name).slice(0, 100),
                    value: id.slice(0, 100)
                };
            });

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select_category")
            .setPlaceholder("📂 เลือกหมวดหมู่")
            .addOptions(options);

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