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
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const db = require("./database/database");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ================= LOG CHANNEL =================
const SELL_LOG = process.env.SELL_LOG_CHANNEL_ID;
const STOCK_LOG = process.env.STOCK_LOG_CHANNEL_ID;

// ================= READY =================
client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log("🔥 BOT READY");
});

// ================= MAIN =================
client.on(Events.InteractionCreate, async (interaction) => {
    try {

        // ================= PANEL =================
        if (interaction.isChatInputCommand() && interaction.commandName === "panel") {

            const embed = new EmbedBuilder()
                .setTitle("📦 VEX STOCK PANEL")
                .setColor("Blue");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("sell")
                    .setLabel("🔑 เบิกคีย์")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId("addstock")
                    .setLabel("📥 เติมสต็อค")
                    .setStyle(ButtonStyle.Success)
            );

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // ================= ADD STOCK =================
        if (interaction.isButton() && interaction.customId === "addstock") {

            const products = await db.getProducts();

            if (!products?.length) {
                return interaction.reply({
                    content: "❌ ไม่มีสินค้า",
                    flags: MessageFlags.Ephemeral
                });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId("stock_select")
                .setPlaceholder("เลือกสินค้า")
                .addOptions([
                    ...products.slice(0, 24).map(p => ({
                        label: p.name,
                        value: p.name
                    })),
                    {
                        label: "➕ เพิ่มสินค้าใหม่",
                        value: "new_product"
                    }
                ]);

            return interaction.reply({
                content: "📦 เลือกสินค้า",
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= SELECT STOCK =================
        if (interaction.isStringSelectMenu() && interaction.customId === "stock_select") {

            const product = interaction.values[0];

            if (product === "new_product") {

                const modal = new ModalBuilder()
                    .setCustomId("add_product")
                    .setTitle("เพิ่มสินค้า");

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId("name").setLabel("ชื่อ").setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId("cost").setLabel("ทุน").setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId("reseller").setLabel("Reseller").setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId("customer").setLabel("Customer").setStyle(TextInputStyle.Short).setRequired(true)
                    )
                );

                return interaction.showModal(modal);
            }

            const modal = new ModalBuilder()
                .setCustomId(`add_stock_${product}`)
                .setTitle("เติมสต็อค");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("keys")
                        .setLabel("1 บรรทัด = 1 key")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
            );

            return interaction.showModal(modal);
        }

        // ================= ADD STOCK SUBMIT =================
        if (interaction.isModalSubmit() && interaction.customId.startsWith("add_stock_")) {

            const product = interaction.customId.replace("add_stock_", "");

            let keys = interaction.fields.getTextInputValue("keys")
                .split("\n")
                .map(v => v.trim())
                .filter(Boolean);

            const added = await db.addKeys(product, keys);
            const stock = await db.getStock(product);

            const log = new EmbedBuilder()
                .setTitle("📥 STOCK ADDED")
                .addFields(
                    { name: "Product", value: product },
                    { name: "Amount", value: `${keys.length}` },
                    { name: "Stock Left", value: `${stock.count}` }
                )
                .setColor("Green");

            if (STOCK_LOG) client.channels.cache.get(STOCK_LOG)?.send({ embeds: [log] });

            return interaction.reply({
                content: `✅ เพิ่ม ${keys.length} keys`,
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= SELL =================
        if (interaction.isButton() && interaction.customId === "sell") {

            const products = await db.getProducts();

            const menu = new StringSelectMenuBuilder()
                .setCustomId("sell_select")
                .setPlaceholder("เลือกสินค้า")
                .addOptions(products.slice(0, 24).map(p => ({
                    label: p.name,
                    value: p.name
                })));

            return interaction.reply({
                content: "📦 เลือกสินค้า",
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= SELL PRODUCT =================
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

            if (!key) {
                return interaction.reply({
                    content: "❌ Out of stock",
                    flags: MessageFlags.Ephemeral
                });
            }

            const price = type === "reseller" ? p.reseller_price : p.customer_price;
            const profit = price - p.cost;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_${product}_${type}`)
                    .setLabel("CONFIRM SELL")
                    .setStyle(ButtonStyle.Success)
            );

            const embed = new EmbedBuilder()
                .setTitle("CONFIRM SELL")
                .addFields(
                    { name: "Product", value: product },
                    { name: "Type", value: type },
                    { name: "Price", value: `${price}` },
                    { name: "Profit", value: `${profit}` },
                    { name: "Stock", value: `${stock.count}` }
                )
                .setColor("Blue");

            return interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= CONFIRM SELL =================
        if (interaction.isButton() && interaction.customId.startsWith("confirm_")) {

            const [, product, type] = interaction.customId.split("_");

            const p = await db.getProduct(product);
            const key = await db.getRandomKey(product);
            const stock = await db.getStock(product);

            if (!key) {
                return interaction.reply({
                    content: "❌ Out of stock",
                    flags: MessageFlags.Ephemeral
                });
            }

            const price = type === "reseller" ? p.reseller_price : p.customer_price;
            const profit = price - p.cost;

            // 🔥 IMPORTANT: mark key used
            await db.useKey(key.id);

            const log = new EmbedBuilder()
                .setTitle("🔑 SELL LOG")
                .addFields(
                    { name: "User", value: `<@${interaction.user.id}>` },
                    { name: "Product", value: product },
                    { name: "Key", value: key.key },
                    { name: "Type", value: type },
                    { name: "Profit", value: `${profit}` },
                    { name: "Stock Left", value: `${stock.count - 1}` }
                )
                .setColor("Red");

            if (SELL_LOG) client.channels.cache.get(SELL_LOG)?.send({ embeds: [log] });

            return interaction.reply({
                content: `🔑 KEY: ${key.key}`,
                flags: MessageFlags.Ephemeral
            });
        }

    } catch (err) {
        console.log("ERROR:", err);

        if (!interaction.replied) {
            return interaction.reply({
                content: "❌ error",
                flags: MessageFlags.Ephemeral
            });
        }
    }
});

client.login(process.env.TOKEN);