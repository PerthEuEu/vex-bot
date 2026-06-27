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
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
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

// ================= MAIN =================
client.on(Events.InteractionCreate, async (interaction) => {
    try {

        // ================= PANEL =================
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
                return safeReply(interaction, {
                    content: "❌ ไม่มีสินค้า",
                    flags: MessageFlags.Ephemeral
                });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId("stock_select")
                .addOptions(products.map(p => ({
                    label: p.name,
                    value: p.name
                })));

            return safeReply(interaction, {
                content: "📦 เลือกสินค้า",
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= STOCK SELECT =================
        if (interaction.isStringSelectMenu() && interaction.customId === "stock_select") {

            const product = interaction.values?.[0];
            if (!product) return;

            const modal = new ModalBuilder()
                .setCustomId(`add_stock_${product}`)
                .setTitle("เติมสต็อค");

            const keys = new TextInputBuilder()
                .setCustomId("keys")
                .setLabel("1 บรรทัด = 1 key")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(keys));

            return interaction.showModal(modal);
        }

        // ================= ADD STOCK =================
        if (interaction.isModalSubmit() && interaction.customId.startsWith("add_stock_")) {

            const product = interaction.customId.replace("add_stock_", "");

            const keys = interaction.fields.getTextInputValue("keys")
                .split("\n")
                .map(x => x.trim())
                .filter(Boolean);

            await db.addKeys(product, keys);

            const stock = await db.getStock(product);

            if (STOCK_LOG) {
                client.channels.cache.get(STOCK_LOG)?.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("📥 STOCK ADDED")
                            .addFields(
                                { name: "Product", value: product },
                                { name: "Added", value: `${keys.length}` },
                                { name: "Stock", value: `${stock.count}` }
                            )
                    ]
                });
            }

            return interaction.reply({
                content: "✅ added",
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= SELL =================
        if (interaction.isButton() && interaction.customId === "sell") {

            const products = await db.getProducts();

            const menu = new StringSelectMenuBuilder()
                .setCustomId("sell_select")
                .addOptions(products.map(p => ({
                    label: p.name,
                    value: p.name
                })));

            return interaction.reply({
                content: "📦 เลือกสินค้า",
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= SELL SELECT =================
        if (interaction.isStringSelectMenu() && interaction.customId === "sell_select") {

            const product = interaction.values?.[0];
            if (!product) return;

            const typeMenu = new StringSelectMenuBuilder()
                .setCustomId(`sell_type_${product}`)
                .addOptions([
                    { label: "Reseller", value: "reseller" },
                    { label: "Customer", value: "customer" }
                ]);

            return interaction.reply({
                content: "💰 เลือกประเภท",
                components: [new ActionRowBuilder().addComponents(typeMenu)],
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= SELL TYPE =================
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_type_")) {

            const product = interaction.customId.replace("sell_type_", "");
            const type = interaction.values[0];

            const p = await db.getProduct(product);
            const key = await db.getRandomKey(product);
            const stock = await db.getStock(product);

            if (!p || !key) {
                return interaction.reply({
                    content: "❌ out of stock",
                    ephemeral: true
                });
            }

            const price = Number(type === "reseller" ? p.resell_price : p.customer_price);

            const embed = new EmbedBuilder()
                .setTitle("CONFIRM SELL")
                .addFields(
                    { name: "Product", value: product },
                    { name: "Type", value: type },
                    { name: "Price", value: `${price}` },
                    { name: "Stock", value: `${stock.count}` }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_${product}_${type}`)
                    .setLabel("CONFIRM")
                    .setStyle(ButtonStyle.Success)
            );

            return interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= CONFIRM (FIXED 100%) =================
        if (interaction.isButton() && interaction.customId.startsWith("confirm_")) {

            if (usedConfirm.has(interaction.user.id)) {
                return interaction.reply({
                    content: "❌ กำลังทำรายการอยู่",
                    ephemeral: true
                });
            }

            usedConfirm.add(interaction.user.id);

            try {
                const parts = interaction.customId.split("_");
                const product = parts[1];
                const type = parts[2];

                const p = await db.getProduct(product);
                const key = await db.getRandomKey(product);

                if (!p || !key) {
                    return interaction.reply({ content: "❌ error", ephemeral: true });
                }

                const locked = await db.useKey(key.id);

                if (!locked) {
                    return interaction.reply({ content: "❌ key used", ephemeral: true });
                }

                if (SELL_LOG) {
                    client.channels.cache.get(SELL_LOG)?.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("SELL LOG")
                                .addFields(
                                    { name: "User", value: `<@${interaction.user.id}>` },
                                    { name: "Product", value: product },
                                    { name: "Key", value: key.key },
                                    { name: "Type", value: type }
                                )
                        ]
                    });
                }

                return interaction.reply({
                    content: `KEY: ${key.key}`,
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