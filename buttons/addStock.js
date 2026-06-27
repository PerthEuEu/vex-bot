const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    MessageFlags
} = require("discord.js");

const db = require("../database/database");

module.exports = async (interaction) => {

    const products = db.getProducts(); // 🔥 ต้องดึงใหม่ทุกครั้ง

    const menu = new StringSelectMenuBuilder()
        .setCustomId("stock_select_product")
        .setPlaceholder("📦 เลือกหมวดสต็อก")
        .addOptions([
            ...products.map(p => ({
                label: p.name,
                value: p.name
            })),
            {
                label: "➕ เพิ่มสินค้าใหม่",
                value: "new_product"
            }
        ]);

    return interaction.reply({
        content: "📥 เลือกหมวดหมู่สินค้าที่ต้องการเติมสต็อก",
        components: [new ActionRowBuilder().addComponents(menu)],
        flags: MessageFlags.Ephemeral
    });
};