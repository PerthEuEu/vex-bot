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

const usedConfirm = new Set(); // 🔥 กันกด confirm รัว

client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= SAFE REPLY =================
async function safeReply(interaction, data) {
    try {
        if (interaction.replied || interaction.deferred) return;
        return await interaction.reply(data);
    } catch {}
}

// ================= MAIN =================
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

        // STOCK SELECT
        if (interaction.isStringSelectMenu() && interaction.customId === "stock_select") {
            const product = interaction.values[0];

            const modal = new ModalBuilder()
                .setCustomId(`add_stock_${product}`)
                .setTitle("เติมสต็อค");

            const keys = new TextInputBuilder()
                .setCustomId("keys")
                .setStyle(TextInputStyle.Paragraph);

            modal.addComponents(new ActionRowBuilder().addComponents(keys));

            return interaction.showModal(modal);
        }

        // ADD STOCK
        if (interaction.isModalSubmit() && interaction.customId.startsWith("add_stock_")) {
            const product = interaction.customId.replace("add_stock_", "");

            const keys = interaction.fields.getTextInputValue("keys")
                .split("\n")
                .filter(Boolean);

            await db.addKeys(product, keys);

            const stock = await db.getStock(product);

            if (STOCK_LOG) {
                client.channels.cache.get(STOCK_LOG)?.send({
                    embeds: [new EmbedBuilder()
                        .setTitle("📥 STOCK ADDED")
                        .addFields(
                            { name: "Product", value: product },
                            { name: "Added", value: `${keys.length}` },
                            { name: "Stock", value: `${stock}` }
                        )
                    ]
                });
            }

            return interaction.reply({ content: "✅ added", flags: MessageFlags.Ephemeral });
        }

        // SELL
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

        // SELL TYPE
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_type_")) {

            const product = interaction.customId.replace("sell_type_", "");
            const type = interaction.values[0];

            const p = await db.getProduct(product);
            const key = await db.getRandomKey(product);
            const stock = await db.getStock(product);

            if (!p || !key) {
                return safeReply(interaction, { content: "❌ out of stock", flags: MessageFlags.Ephemeral });
            }

            const price = Number(type === "reseller" ? p.resell_price : p.customer_price);
            const profit = price - Number(p.cost);

            const id = `confirm_${interaction.user.id}`;

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle("CONFIRM SELL")
                    .addFields(
                        { name: "Product", value: product },
                        { name: "Stock", value: `${stock}` },
                        { name: "Price", value: `${price}` }
                    )],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(id)
                            .setLabel("CONFIRM")
                            .setStyle(ButtonStyle.Success)
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= CONFIRM FIX =================
        if (interaction.isButton() && interaction.customId.startsWith("confirm_")) {

            if (usedConfirm.has(interaction.user.id)) {
                return interaction.reply({
                    content: "❌ already processing",
                    ephemeral: true
                });
            }

            usedConfirm.add(interaction.user.id);

            const product = interaction.message.embeds[0].data.fields[0].value;

            const p = await db.getProduct(product);
            const key = await db.getRandomKey(product);

            if (!p || !key) {
                usedConfirm.delete(interaction.user.id);
                return interaction.reply({ content: "❌ error", ephemeral: true });
            }

            const locked = await db.useKey(key.id);

            if (!locked) {
                usedConfirm.delete(interaction.user.id);
                return interaction.reply({ content: "❌ key already used", ephemeral: true });
            }

            if (SELL_LOG) {
                client.channels.cache.get(SELL_LOG)?.send({
                    embeds: [new EmbedBuilder()
                        .setTitle("SELL LOG")
                        .addFields(
                            { name: "User", value: `<@${interaction.user.id}>` },
                            { name: "Key", value: key.key }
                        )
                    ]
                });
            }

            usedConfirm.delete(interaction.user.id);

            return interaction.reply({
                content: `KEY: ${key.key}`,
                ephemeral: true
            });
        }

    } catch (err) {
        console.log(err);
    }
});

client.login(process.env.TOKEN);