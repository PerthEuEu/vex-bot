require("dotenv").config();
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("VEX BOT ONLINE"));

app.listen(process.env.PORT || 10000, () => {
    console.log("🌐 Express running");
});

// ================= DISCORD =================
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const db = require("./database/database");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ================= LOG =================
const SELL_LOG = process.env.SELL_LOG_CHANNEL_ID;
const STOCK_LOG = process.env.STOCK_LOG_CHANNEL_ID;

function sendLog(channelId, embed) {
    if (!channelId) return;
    const ch = client.channels.cache.get(channelId);
    if (!ch) return;
    ch.send({ embeds: [embed] }).catch(() => {});
}

// ================= READY =================
client.once(Events.ClientReady, () => {
    console.log(`✅ ONLINE: ${client.user.tag}`);
});

// ================= NORMALIZE FIX =================
function norm(str) {
    return (str || "").trim();
}

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async (interaction) => {
try {

    // ================= PANEL =================
    if (interaction.isChatInputCommand() && interaction.commandName === "panel") {

        await interaction.deferReply({ ephemeral: true });

        return interaction.editReply({
            embeds: [
                new EmbedBuilder().setTitle("📦 VEX PANEL")
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("stock_open")
                        .setLabel("📥 ADD STOCK")
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId("sell_open")
                        .setLabel("💰 SELL")
                        .setStyle(ButtonStyle.Primary)
                )
            ]
        });
    }

    // ================= STOCK OPEN =================
    if (interaction.isButton() && interaction.customId === "stock_open") {

        const products = await db.getProducts();

        if (!products?.length)
            return interaction.reply({ content: "❌ ไม่มีสินค้า", ephemeral: true });

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select")
            .setPlaceholder("เลือกสินค้า")
            .addOptions(
                products.slice(0, 25).map(p => ({
                    label: p.name,
                    value: norm(p.name) // 🔥 FIX สำคัญ
                }))
            );

        return interaction.reply({
            content: "📦 เลือกสินค้า",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    // ================= STOCK SELECT =================
    if (interaction.isStringSelectMenu() && interaction.customId === "stock_select") {

        const product = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`add_stock_${product}`)
            .setTitle("เติมสต็อค");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("keys")
                    .setLabel("ใส่ keys (ขึ้นบรรทัดใหม่)")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );

        return interaction.showModal(modal);
    }

    // ================= ADD STOCK =================
    if (interaction.isModalSubmit() && interaction.customId.startsWith("add_stock_")) {

        const product = interaction.customId.replace("add_stock_", "");

        const keys = interaction.fields.getTextInputValue("keys")
            .split("\n")
            .map(x => x.trim())
            .filter(Boolean);

        if (!keys.length)
            return interaction.reply({ content: "❌ ไม่มี key", ephemeral: true });

        const inserted = await db.addKeys(product, keys);
        const stock = await db.getStock(product);

        sendLog(STOCK_LOG,
            new EmbedBuilder()
                .setTitle("📥 STOCK IN")
                .addFields(
                    { name: "Product", value: product },
                    { name: "Added", value: String(inserted.length) },
                    { name: "Stock Left", value: String(stock) }
                )
                .setColor("Green")
        );

        return interaction.reply({
            content: `✅ เพิ่ม ${inserted.length} keys`,
            ephemeral: true
        });
    }

    // ================= SELL OPEN =================
    if (interaction.isButton() && interaction.customId === "sell_open") {

        const products = await db.getProducts();

        if (!products?.length)
            return interaction.reply({ content: "❌ ไม่มีสินค้า", ephemeral: true });

        const menu = new StringSelectMenuBuilder()
            .setCustomId("sell_select")
            .setPlaceholder("เลือกสินค้า")
            .addOptions(
                products.slice(0, 25).map(p => ({
                    label: p.name,
                    value: norm(p.name) // 🔥 FIX
                }))
            );

        return interaction.reply({
            content: "📦 เลือกสินค้า",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    // ================= SELL SELECT =================
    if (interaction.isStringSelectMenu() && interaction.customId === "sell_select") {

        const product = interaction.values[0];

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`sell_type_${product}`)
            .setPlaceholder("เลือกประเภท")
            .addOptions([
                { label: "Reseller", value: "reseller" },
                { label: "Customer", value: "customer" }
            ]);

        return interaction.reply({
            content: "💰 เลือกประเภท",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    // ================= SELL TYPE =================
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_type_")) {

        const product = interaction.customId.replace("sell_type_", "");
        const type = interaction.values[0];

        const p = await db.getProduct(product);

        if (!p)
            return interaction.reply({ content: "❌ no product", ephemeral: true });

        // 🔥 CLAIM KEY (REAL FIX)
        const key = await db.claimKey(product);

        if (!key)
            return interaction.reply({ content: "❌ out of stock", ephemeral: true });

        const price = Number(type === "reseller" ? p.resell_price : p.customer_price);
        const cost = Number(p.cost || 0);
        const profit = price - cost;

        sendLog(SELL_LOG,
            new EmbedBuilder()
                .setTitle("🔑 SELL OUT")
                .addFields(
                    { name: "Product", value: product },
                    { name: "Key", value: key.key },
                    { name: "Buyer", value: `<@${interaction.user.id}>` },
                    { name: "Type", value: type },
                    { name: "Price", value: String(price) },
                    { name: "Cost", value: String(cost) },
                    { name: "Profit", value: String(profit) }
                )
                .setColor("Red")
        );

        return interaction.reply({
            content: `🔑 KEY: ${key.key}`,
            ephemeral: true
        });
    }

} catch (err) {
    console.log("ERROR:", err);

    if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: "❌ error", ephemeral: true });
    }
}
});

client.login(process.env.TOKEN);