require("dotenv").config();
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("VEX BOT ONLINE"));
app.listen(process.env.PORT || 10000, () => {
    console.log("🌐 Express running");
});

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
const STOCK_LOG = process.env.STOCK_LOG_CHANNEL_ID;

const usedConfirm = new Set();

// ================= READY =================
client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= SAFE =================
async function safeReply(interaction, data) {
    try {
        if (interaction.replied || interaction.deferred) return;
        return await interaction.reply(data);
    } catch {}
}

// ================= PANEL =================
client.on(Events.InteractionCreate, async (interaction) => {
    try {

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

        // ================= ADD STOCK =================
        if (interaction.isButton() && interaction.customId === "addstock") {

            const products = await db.getProducts();
            if (!products.length) {
                return interaction.reply({
                    content: "❌ ไม่มีสินค้า",
                    ephemeral: true
                });
            }

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

        // ================= SELL =================
        if (interaction.isButton() && interaction.customId === "sell") {

            const products = await db.getProducts();
            if (!products.length) {
                return interaction.reply({ content: "❌ ไม่มีสินค้า", ephemeral: true });
            }

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

        // ================= SELL SELECT =================
        if (interaction.isStringSelectMenu() && interaction.customId === "sell_select") {

            const product = interaction.values[0];

            const typeMenu = new StringSelectMenuBuilder()
                .setCustomId(`sell_type_${product}`)
                .addOptions([
                    { label: "Reseller", value: "reseller" },
                    { label: "Customer", value: "customer" }
                ]);

            return interaction.reply({
                content: "💰 เลือกประเภท",
                components: [new ActionRowBuilder().addComponents(typeMenu)],
                ephemeral: true
            });
        }

        // ================= SELL TYPE (FIX STOCK + PREVIEW) =================
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_type_")) {

            const product = interaction.customId.replace("sell_type_", "");
            const type = interaction.values[0];

            const p = await db.getProduct(product);
            const stock = await db.getStock(product);

            const key = await db.getRandomKey(product);

            if (!p) {
                return interaction.reply({ content: "❌ no product", ephemeral: true });
            }

            if (!key) {
                return interaction.reply({ content: "❌ คีย์หมด", ephemeral: true });
            }

            const price = Number(type === "reseller" ? p.resell_price : p.customer_price);
            const cost = Number(p.cost || 0);
            const profit = price - cost;

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("CONFIRM SELL")
                        .addFields(
                            { name: "Product", value: product },
                            { name: "Type", value: type },
                            { name: "Cost", value: `${cost}` },
                            { name: "Price", value: `${price}` },
                            { name: "Profit", value: `${profit}` },
                            { name: "Stock", value: `${stock.count}` }
                        )
                ],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`confirm_${product}_${type}`)
                            .setLabel("CONFIRM")
                            .setStyle(ButtonStyle.Success)
                    )
                ],
                ephemeral: true
            });
        }

        // ================= CONFIRM (FIX KEY LOCK FIRST) =================
        if (interaction.isButton() && interaction.customId.startsWith("confirm_")) {

            if (usedConfirm.has(interaction.user.id)) {
                return interaction.reply({ content: "❌ กำลังทำรายการ", ephemeral: true });
            }

            usedConfirm.add(interaction.user.id);

            try {
                const [, product, type] = interaction.customId.split("_");

                const p = await db.getProduct(product);

                if (!p) {
                    return interaction.reply({ content: "❌ no product", ephemeral: true });
                }

                // 🔥 LOCK KEY FIRST (กันโดนใช้ซ้ำ)
                const key = await db.getRandomKey(product);
                if (!key) {
                    return interaction.reply({ content: "❌ คีย์หมด", ephemeral: true });
                }

                const locked = await db.useKey(key.id);

                if (!locked) {
                    return interaction.reply({ content: "❌ คีย์ถูกใช้แล้ว", ephemeral: true });
                }

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

                return interaction.reply({
                    content: `🔑 KEY: ${key.key}`,
                    ephemeral: true
                });

            } finally {
                usedConfirm.delete(interaction.user.id);
            }
        }

    } catch (err) {
        console.log("GLOBAL ERROR:", err);
    }
});

client.login(process.env.TOKEN);