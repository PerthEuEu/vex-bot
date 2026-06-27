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
    StringSelectMenuBuilder
} = require("discord.js");

const db = require("./database/database");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ================= CONFIG =================
const SELL_LOG = process.env.SELL_LOG_CHANNEL_ID;

// ================= MEMORY =================
const reserve = new Map();
const lockUser = new Set();

// ================= LOG =================
const log = (msg) => console.log(`[SYSTEM] ${msg}`);

// ================= READY =================
client.once(Events.ClientReady, () => {
    log(`Logged in as ${client.user.tag}`);
});

// ================= MAIN =================
client.on(Events.InteractionCreate, async (interaction) => {
    try {

        // ================= PANEL =================
        if (interaction.isChatInputCommand() && interaction.commandName === "panel") {

            return interaction.reply({
                embeds: [
                    new EmbedBuilder().setTitle("📦 STOCK PANEL")
                ],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("sell")
                            .setLabel("🔑 SELL KEY")
                            .setStyle(ButtonStyle.Primary),

                        new ButtonBuilder()
                            .setCustomId("addstock")
                            .setLabel("📥 ADD STOCK")
                            .setStyle(ButtonStyle.Success)
                    )
                ],
                ephemeral: true
            });
        }

        // ================= ADD STOCK =================
        if (interaction.isButton() && interaction.customId === "addstock") {

            const products = await db.getProducts();
            if (!products?.length) {
                return interaction.reply({ content: "❌ ไม่มีสินค้า", ephemeral: true });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId("sell_select")
                .addOptions(
                    products.slice(0, 25).map(p => ({
                        label: p.name.slice(0, 100),
                        value: p.name
                    }))
                );

            return interaction.reply({
                content: "📦 เลือกสินค้า",
                components: [new ActionRowBuilder().addComponents(menu)],
                ephemeral: true
            });
        }

        // ================= SELL =================
        if (interaction.isButton() && interaction.customId === "sell") {

            const products = await db.getProducts();
            if (!products?.length) {
                return interaction.reply({ content: "❌ ไม่มีสินค้า", ephemeral: true });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId("sell_select")
                .addOptions(
                    products.slice(0, 25).map(p => ({
                        label: p.name.slice(0, 100),
                        value: p.name
                    }))
                );

            return interaction.reply({
                content: "📦 เลือกสินค้า",
                components: [new ActionRowBuilder().addComponents(menu)],
                ephemeral: true
            });
        }

        // ================= SELECT PRODUCT =================
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

        // ================= SELECT TYPE =================
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_type_")) {

            // 🔥 FIX: กัน Unknown interaction
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }

            const product = interaction.customId.replace("sell_type_", "");
            const type = interaction.values[0];

            const p = await db.getProduct(product);
            const stock = await db.getStock(product);

            if (!p) return interaction.editReply("❌ no product");
            if (stock <= 0) return interaction.editReply("❌ คีย์หมด");

            reserve.set(interaction.user.id, { product, type });

            const price = Number(type === "reseller" ? p.resell_price : p.customer_price);
            const cost = Number(p.cost || 0);
            const profit = price - cost;

            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("CONFIRM SELL")
                        .addFields(
                            { name: "Product", value: product },
                            { name: "Type", value: type },
                            { name: "Cost", value: `${cost}` },
                            { name: "Price", value: `${price}` },
                            { name: "Profit", value: `${profit}` },
                            { name: "Stock", value: `${stock}` }
                        )
                ],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("confirm_sell")
                            .setLabel("CONFIRM")
                            .setStyle(ButtonStyle.Success)
                    )
                ]
            });
        }

        // ================= CONFIRM =================
        if (interaction.isButton() && interaction.customId === "confirm_sell") {

            // 🔥 FIX: กัน interaction already ack
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }

            if (lockUser.has(interaction.user.id)) {
                return interaction.editReply("❌ กำลังทำรายการ");
            }

            const data = reserve.get(interaction.user.id);
            if (!data) {
                return interaction.editReply("❌ session หมด");
            }

            lockUser.add(interaction.user.id);

            try {

                const { product, type } = data;

                const key = await db.claimKey(product);
                if (!key) {
                    reserve.delete(interaction.user.id);
                    return interaction.editReply("❌ คีย์หมด");
                }

                const p = await db.getProduct(product);
                const stock = await db.getStock(product);

                const price = Number(type === "reseller" ? p.resell_price : p.customer_price);
                const cost = Number(p.cost || 0);
                const profit = price - cost;

                log(`SELL ${interaction.user.tag} | ${product} | ${type} | profit ${profit}`);

                if (SELL_LOG) {
                    client.channels.cache.get(SELL_LOG)?.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("💰 SELL LOG")
                                .addFields(
                                    { name: "User", value: interaction.user.tag },
                                    { name: "Product", value: product },
                                    { name: "Type", value: type },
                                    { name: "Cost", value: `${cost}` },
                                    { name: "Price", value: `${price}` },
                                    { name: "Profit", value: `${profit}` },
                                    { name: "Key", value: key.key },
                                    { name: "Stock Left", value: `${stock}` }
                                )
                        ]
                    });
                }

                reserve.delete(interaction.user.id);

                return interaction.editReply(`🔑 KEY: ${key.key}`);

            } finally {
                lockUser.delete(interaction.user.id);
            }
        }

    } catch (err) {
        console.log("GLOBAL ERROR:", err);
    }
});

client.login(process.env.TOKEN);