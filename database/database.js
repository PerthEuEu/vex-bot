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

const SELL_LOG = process.env.SELL_LOG_CHANNEL_ID;
const STOCK_LOG = process.env.STOCK_LOG_CHANNEL_ID;

function sendLog(id, embed) {
    const ch = client.channels.cache.get(id);
    if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

client.once(Events.ClientReady, () => {
    console.log("✅ BOT READY");
});

// ================= MAIN =================
client.on(Events.InteractionCreate, async (interaction) => {
try {

    // ================= STOCK OPEN =================
    if (interaction.isButton() && interaction.customId === "stock_open") {

        const products = await db.getProducts();

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select")
            .setPlaceholder("เลือกสินค้า")
            .addOptions(products.slice(0, 25).map(p => ({
                label: p.name,
                value: p.name
            })));

        return interaction.reply({
            content: "📦 เลือกสินค้า",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    // ================= ADD STOCK =================
    if (interaction.isStringSelectMenu() && interaction.customId === "stock_select") {

        const product = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`add_stock_${product}`)
            .setTitle("เติมสต็อค");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("keys")
                    .setLabel("keys")
                    .setStyle(TextInputStyle.Paragraph)
            )
        );

        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("add_stock_")) {

        const product = interaction.customId.replace("add_stock_", "");

        const keys = interaction.fields.getTextInputValue("keys")
            .split("\n")
            .map(x => x.trim())
            .filter(Boolean);

        await db.addKeys(product, keys);

        const stock = await db.getStock(product);

        sendLog(STOCK_LOG,
            new EmbedBuilder()
                .setTitle("STOCK ADDED")
                .addFields(
                    { name: "Product", value: product },
                    { name: "Amount", value: String(keys.length) },
                    { name: "Stock", value: String(stock) }
                )
        );

        return interaction.reply({
            content: `✅ added ${keys.length}`,
            ephemeral: true
        });
    }

    // ================= SELL =================
    if (interaction.isButton() && interaction.customId === "sell_open") {

        const products = await db.getProducts();

        const menu = new StringSelectMenuBuilder()
            .setCustomId("sell_select")
            .setPlaceholder("เลือกสินค้า")
            .addOptions(products.slice(0, 25).map(p => ({
                label: p.name,
                value: p.name
            })));

        return interaction.reply({
            content: "SELL",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "sell_select") {

        const product = interaction.values[0];

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`sell_type_${product}`)
            .addOptions([
                { label: "Reseller", value: "reseller" },
                { label: "Customer", value: "customer" }
            ]);

        return interaction.reply({
            content: "เลือก type",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    // ================= SELL TYPE =================
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_type_")) {

        const product = interaction.customId.replace("sell_type_", "");
        const type = interaction.values[0];

        const key = await db.claimKey(product);
        const p = await db.getProduct(product);

        if (!key) {
            return interaction.reply({
                content: "❌ OUT OF STOCK",
                ephemeral: true
            });
        }

        const price = type === "reseller" ? p.resell_price : p.customer_price;

        await db.useKey(key.id);

        sendLog(SELL_LOG,
            new EmbedBuilder()
                .setTitle("SELL LOG")
                .addFields(
                    { name: "Product", value: product },
                    { name: "Key", value: key.key }
                )
        );

        return interaction.reply({
            content: `KEY: ${key.key}`,
            ephemeral: true
        });
    }

} catch (e) {
    console.log(e);
    if (!interaction.replied) {
        return interaction.reply({ content: "error", ephemeral: true });
    }
}
});

client.login(process.env.TOKEN);