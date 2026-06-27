require("dotenv").config();
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("VEX BOT ONLINE"));
app.listen(process.env.PORT || 10000);

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
    StringSelectMenuBuilder,
    MessageFlags
} = require("discord.js");

const db = require("./database/database");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const SELL_LOG = process.env.SELL_LOG_CHANNEL_ID;

const usedConfirm = new Set();

// ================= MEMORY RESERVE =================
const reserve = new Map(); 
// key: userId -> { product, type, key }

client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= PANEL =================
client.on(Events.InteractionCreate, async (interaction) => {
try {

    // PANEL
    if (interaction.isChatInputCommand() && interaction.commandName === "panel") {
        return interaction.reply({
            embeds: [new EmbedBuilder().setTitle("📦 STOCK PANEL")],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("sell")
                        .setLabel("🔑 เบิกคีย์")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId("addstock")
                        .setLabel("📥 เติมสต็อค")
                        .setStyle(ButtonStyle.Success)
                )
            ]
        });
    }

    // ADD STOCK
    if (interaction.isButton() && interaction.customId === "addstock") {
        const products = await db.getProducts();
        if (!products.length)
            return interaction.reply({ content: "❌ ไม่มีสินค้า", ephemeral: true });

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select")
            .addOptions(products.map(p => ({
                label: p.name,
                value: p.name
            })));

        return interaction.reply({
            content: "📦 เลือกสินค้า",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    // SELL
    if (interaction.isButton() && interaction.customId === "sell") {
        const products = await db.getProducts();
        if (!products.length)
            return interaction.reply({ content: "❌ ไม่มีสินค้า", ephemeral: true });

        const menu = new StringSelectMenuBuilder()
            .setCustomId("sell_select")
            .addOptions(products.map(p => ({
                label: p.name,
                value: p.name
            })));

        return interaction.reply({
            content: "📦 เลือกสินค้า",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    // SELL SELECT
    if (interaction.isStringSelectMenu() && interaction.customId === "sell_select") {
        const product = interaction.values[0];

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`sell_type_${product}`)
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

    // ================= SELL TYPE (RESERVE KEY HERE) =================
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_type_")) {

        const product = interaction.customId.replace("sell_type_", "");
        const type = interaction.values[0];

        const p = await db.getProduct(product);
        if (!p) return interaction.reply({ content: "❌ no product", ephemeral: true });

        const key = await db.claimKey(product); // 🔥 สำคัญ: จองทันที

        if (!key) return interaction.reply({ content: "❌ คีย์หมด", ephemeral: true });

        reserve.set(interaction.user.id, { product, type, key });

        const price = Number(type === "reseller" ? p.resell_price : p.customer_price);
        const cost = Number(p.cost || 0);

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("CONFIRM SELL")
                    .addFields(
                        { name: "Product", value: product },
                        { name: "Type", value: type },
                        { name: "Cost", value: `${cost}` },
                        { name: "Price", value: `${price}` },
                        { name: "Profit", value: `${price - cost}` }
                    )
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("confirm_sell")
                        .setLabel("CONFIRM")
                        .setStyle(ButtonStyle.Success)
                )
            ],
            ephemeral: true
        });
    }

    // ================= CONFIRM =================
    if (interaction.isButton() && interaction.customId === "confirm_sell") {

        if (usedConfirm.has(interaction.user.id))
            return interaction.reply({ content: "❌ กำลังทำรายการ", ephemeral: true });

        const data = reserve.get(interaction.user.id);

        if (!data)
            return interaction.reply({ content: "❌ ไม่มีข้อมูล", ephemeral: true });

        usedConfirm.add(interaction.user.id);

        try {
            const { product, type, key } = data;

            const stock = await db.getStock(product);

            if (SELL_LOG) {
                client.channels.cache.get(SELL_LOG)?.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("SELL LOG")
                            .addFields(
                                { name: "User", value: `<@${interaction.user.id}>` },
                                { name: "Product", value: product },
                                { name: "Key", value: key.key },
                                { name: "Type", value: type },
                                { name: "Stock Left", value: `${stock.count}` }
                            )
                    ]
                });
            }

            reserve.delete(interaction.user.id);

            return interaction.reply({
                content: `🔑 KEY: ${key.key}`,
                ephemeral: true
            });

        } finally {
            usedConfirm.delete(interaction.user.id);
        }
    }

} catch (err) {
    console.log(err);
}
});

client.login(process.env.TOKEN);