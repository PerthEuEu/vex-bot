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
    TextInputStyle,
    MessageFlags
} = require("discord.js");

const db = require("./database/database");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ================= ENV =================
const SELL_LOG = process.env.SELL_LOG_CHANNEL_ID;
const STOCK_LOG = process.env.STOCK_LOG_CHANNEL_ID;

// ================= READY =================
client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= SAFE REPLY =================
async function safeReply(interaction, data) {
    try {
        if (interaction.replied || interaction.deferred) return;
        await interaction.reply(data);
    } catch (e) {}
}

// ================= MAIN =================
client.on(Events.InteractionCreate, async (interaction) => {
    try {

        // ================= PANEL =================
        if (interaction.isChatInputCommand() && interaction.commandName === "panel") {

            const embed = new EmbedBuilder()
                .setTitle("📦 STOCK PANEL")
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
            if (!products.length) return safeReply(interaction, { content: "❌ no product", flags: MessageFlags.Ephemeral });

            const menu = new StringSelectMenuBuilder()
                .setCustomId("stock_select")
                .setPlaceholder("เลือกสินค้า")
                .addOptions(
                    products.map(p => ({
                        label: p.name,
                        value: p.name
                    }))
                );

            return safeReply(interaction, {
                content: "📦 เลือกสินค้า",
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= STOCK SELECT =================
        if (interaction.isStringSelectMenu() && interaction.customId === "stock_select") {

            const product = interaction.values[0];

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

        // ================= ADD STOCK SUBMIT =================
        if (interaction.isModalSubmit() && interaction.customId.startsWith("add_stock_")) {

            const product = interaction.customId.replace("add_stock_", "");

            let keys = interaction.fields.getTextInputValue("keys")
                .split("\n")
                .map(x => x.trim())
                .filter(Boolean);

            await db.addKeys(product, keys);

            const stock = await db.getStock(product);

            const log = new EmbedBuilder()
                .setTitle("📥 STOCK ADDED")
                .addFields(
                    { name: "Product", value: product },
                    { name: "Added", value: `${keys.length}` },
                    { name: "Stock", value: `${stock.count}` }
                )
                .setColor("Green");

            if (STOCK_LOG) client.channels.cache.get(STOCK_LOG)?.send({ embeds: [log] });

            return interaction.reply({ content: `✅ added ${keys.length}`, flags: MessageFlags.Ephemeral });
        }

        // ================= SELL =================
        if (interaction.isButton() && interaction.customId === "sell") {

            const products = await db.getProducts();

            const menu = new StringSelectMenuBuilder()
                .setCustomId("sell_select")
                .setPlaceholder("เลือกสินค้า")
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

            if (!p) return safeReply(interaction, { content: "no product", flags: MessageFlags.Ephemeral });
            if (!key) return safeReply(interaction, { content: "out of stock", flags: MessageFlags.Ephemeral });

            const cost = Number(p.cost);
            const price = Number(type === "reseller" ? p.resell_price : p.customer_price);
            const profit = price - cost;

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

        // ================= CONFIRM =================
        if (interaction.isButton() && interaction.customId.startsWith("confirm_")) {

            const [, product, type] = interaction.customId.split("_");

            const p = await db.getProduct(product);
            const key = await db.getRandomKey(product);

            if (!p || !key) return safeReply(interaction, { content: "error", flags: MessageFlags.Ephemeral });

            const cost = Number(p.cost);
            const price = Number(type === "reseller" ? p.resell_price : p.customer_price);
            const profit = price - cost;

            await db.useKey(key.id);

            const stock = await db.getStock(product);

            const log = new EmbedBuilder()
                .setTitle("SELL LOG")
                .addFields(
                    { name: "User", value: `<@${interaction.user.id}>` },
                    { name: "Product", value: product },
                    { name: "Key", value: key.key },
                    { name: "Type", value: type },
                    { name: "Profit", value: `${profit}` },
                    { name: "Stock Left", value: `${stock.count}` }
                )
                .setColor("Red");

            if (SELL_LOG) client.channels.cache.get(SELL_LOG)?.send({ embeds: [log] });

            return interaction.reply({
                content: `KEY: ${key.key}`,
                flags: MessageFlags.Ephemeral
            });
        }

    } catch (err) {
        console.log(err);
    }
});

client.login(process.env.TOKEN);