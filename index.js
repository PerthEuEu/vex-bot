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
    try {
        if (!channelId) return;
        const ch = client.channels.cache.get(channelId);
        if (!ch) return;
        ch.send({ embeds: [embed] }).catch(() => {});
    } catch {}
}

// ================= READY =================
client.once(Events.ClientReady, () => {
    console.log(`✅ ONLINE: ${client.user.tag}`);
});

// ================= INTERACTION =================
client.on(Events.InteractionCreate, async (interaction) => {
try {

    // ================= PANEL =================
    if (interaction.isChatInputCommand() && interaction.commandName === "panel") {

        return interaction.reply({
            ephemeral: true,
            embeds: [new EmbedBuilder().setTitle("VEX PANEL")],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("stock_open")
                        .setLabel("ADD STOCK")
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId("sell_open")
                        .setLabel("SELL")
                        .setStyle(ButtonStyle.Primary)
                )
            ]
        });
    }

    // ================= STOCK OPEN =================
    if (interaction.isButton() && interaction.customId === "stock_open") {

        const products = await db.getProducts();
        if (!Array.isArray(products) || products.length === 0)
            return interaction.reply({ content: "NO PRODUCTS", ephemeral: true });

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select")
            .setPlaceholder("SELECT PRODUCT")
            .addOptions(
                products.slice(0, 25).map(p => ({
                    label: String(p.name),
                    value: String(p.id)
                }))
            );

        return interaction.reply({
            content: "SELECT PRODUCT",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    // ================= STOCK SELECT =================
    if (interaction.isStringSelectMenu() && interaction.customId === "stock_select") {

        const productId = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`add_stock_${productId}`)
            .setTitle("ADD STOCK");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("keys")
                    .setLabel("KEYS (NEW LINE)")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );

        return interaction.showModal(modal);
    }

    // ================= ADD STOCK =================
    if (interaction.isModalSubmit() && interaction.customId.startsWith("add_stock_")) {

        const productId = interaction.customId.replace("add_stock_", "");

        const product = await db.getProductById(productId);
        if (!product)
            return interaction.reply({ content: "NOT FOUND", ephemeral: true });

        const keys = interaction.fields.getTextInputValue("keys")
            .split("\n")
            .map(x => x.trim())
            .filter(Boolean);

        const inserted = await db.addKeys(product.name, keys);
        const stock = await db.getStock(product.name);

        sendLog(STOCK_LOG,
            new EmbedBuilder()
                .setTitle("STOCK IN")
                .addFields(
                    { name: "Product", value: product.name },
                    { name: "Added", value: String(inserted.length) },
                    { name: "Stock", value: String(stock) }
                )
        );

        return interaction.reply({
            content: `ADDED ${inserted.length}`,
            ephemeral: true
        });
    }

    // ================= SELL OPEN =================
    if (interaction.isButton() && interaction.customId === "sell_open") {

        const products = await db.getProducts();
        if (!Array.isArray(products))
            return interaction.reply({ content: "NO PRODUCTS", ephemeral: true });

        const menu = new StringSelectMenuBuilder()
            .setCustomId("sell_select")
            .setPlaceholder("SELECT PRODUCT")
            .addOptions(
                products.slice(0, 25).map(p => ({
                    label: String(p.name),
                    value: String(p.id)
                }))
            );

        return interaction.reply({
            content: "SELECT PRODUCT",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    // ================= SELL SELECT =================
    if (interaction.isStringSelectMenu() && interaction.customId === "sell_select") {

        const productId = interaction.values[0];

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`sell_type_${productId}`)
            .setPlaceholder("SELECT TYPE")
            .addOptions([
                { label: "Reseller", value: "reseller" },
                { label: "Customer", value: "customer" }
            ]);

        return interaction.reply({
            content: "SELECT TYPE",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    // ================= CONFIRM PAGE =================
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_type_")) {

        const productId = interaction.customId.split("_")[2];
        const type = interaction.values[0];

        const p = await db.getProductById(productId);
        if (!p) return interaction.reply({ content: "NO PRODUCT", ephemeral: true });

        const stock = await db.getStock(p.name);

        const price = Number(type === "reseller" ? p.resell_price : p.customer_price);
        const profit = price - Number(p.cost || 0);

        const embed = new EmbedBuilder()
            .setTitle("CONFIRM ORDER")
            .addFields(
                { name: "Product", value: p.name },
                { name: "Type", value: type },
                { name: "Profit", value: String(profit) },
                { name: "Stock", value: String(stock) }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_${productId}_${type}_${interaction.user.id}`)
                .setLabel("CONFIRM")
                .setStyle(ButtonStyle.Success)
        );

        return interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    }

    // ================= CONFIRM =================
    if (interaction.isButton() && interaction.customId.startsWith("confirm_")) {

        const [, productId, type, userId] = interaction.customId.split("_");

        const p = await db.getProductById(productId);
        if (!p) return interaction.reply({ content: "NO PRODUCT", ephemeral: true });

        const key = await db.claimKey(p.name);
        if (!key) return interaction.reply({ content: "OUT OF STOCK", ephemeral: true });

        await interaction.update({
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("done")
                        .setLabel("CONFIRMED")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                )
            ]
        });

        await interaction.followUp({
            content: key.key,
            ephemeral: true
        });

        sendLog(SELL_LOG,
            new EmbedBuilder()
                .setTitle("SELL CONFIRMED")
                .addFields(
                    { name: "Product", value: p.name },
                    { name: "Key", value: key.key },
                    { name: "User", value: `<@${userId}>` },
                    { name: "Type", value: type }
                )
        );
    }

} catch (err) {
    console.log("ERROR:", err);

    if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: "ERROR", ephemeral: true });
    }
}
});

client.login(process.env.TOKEN);