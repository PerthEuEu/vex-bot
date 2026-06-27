require("dotenv").config();
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("VEX BOT ONLINE"));
app.listen(process.env.PORT || 10000);

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

// ================= STATE =================
const reserve = new Map();
const lockUser = new Set();

const log = (m) => console.log(`[SYSTEM] ${m}`);

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
            ephemeral: true,
            embeds: [
                new EmbedBuilder().setTitle("📦 STOCK PANEL")
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("sell_open")
                        .setLabel("🔑 SELL")
                        .setStyle(ButtonStyle.Primary),

                    new ButtonBuilder()
                        .setCustomId("stock_open")
                        .setLabel("📥 ADD STOCK")
                        .setStyle(ButtonStyle.Success)
                )
            ]
        });
    }

    // ================= OPEN STOCK =================
    if (interaction.isButton() && interaction.customId === "stock_open") {

        const products = await db.getProducts();

        if (!products?.length) {
            return interaction.reply({ content: "❌ ไม่มีสินค้า", ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select")
            .setPlaceholder("📦 เลือกสินค้า")
            .addOptions(
                products.slice(0, 25).map(p => ({
                    label: p.name.slice(0, 100),
                    value: p.name
                }))
            );

        return interaction.reply({
            ephemeral: true,
            content: "📥 เลือกสินค้าเพื่อเติมสต็อก",
            components: [new ActionRowBuilder().addComponents(menu)]
        });
    }

    // ================= STOCK SELECT =================
    if (interaction.isStringSelectMenu() && interaction.customId === "stock_select") {

        const product = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`stock_modal_${product}`)
            .setTitle(`📥 เติมสต็อก ${product}`);

        const input = new TextInputBuilder()
            .setCustomId("keys")
            .setLabel("ใส่คีย์ (ขึ้นบรรทัดใหม่)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("key1\nkey2\nkey3")
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
    }

    // ================= STOCK SUBMIT =================
    if (interaction.isModalSubmit() && interaction.customId.startsWith("stock_modal_")) {

        const product = interaction.customId.replace("stock_modal_", "");
        const raw = interaction.fields.getTextInputValue("keys");

        const keys = raw.split("\n").map(k => k.trim()).filter(Boolean);

        if (!keys.length) {
            return interaction.reply({ content: "❌ ไม่มี key", ephemeral: true });
        }

        await db.addKeys(product, keys);

        return interaction.reply({
            content: `✅ เติมสต็อกสำเร็จ **${product}** (+${keys.length})`,
            ephemeral: true
        });
    }

    // ================= SELL OPEN =================
    if (interaction.isButton() && interaction.customId === "sell_open") {

        const products = await db.getProducts();

        if (!products?.length) {
            return interaction.reply({ content: "❌ ไม่มีสินค้า", ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId("sell_select")
            .setPlaceholder("📦 เลือกสินค้า")
            .addOptions(
                products.slice(0, 25).map(p => ({
                    label: p.name.slice(0, 100),
                    value: p.name
                }))
            );

        return interaction.reply({
            ephemeral: true,
            content: "📦 เลือกสินค้า",
            components: [new ActionRowBuilder().addComponents(menu)]
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
            ephemeral: true,
            content: "💰 เลือกประเภท",
            components: [new ActionRowBuilder().addComponents(typeMenu)]
        });
    }

    // ================= SELL TYPE =================
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_type_")) {

        const product = interaction.customId.replace("sell_type_", "");
        const type = interaction.values[0];

        const p = await db.getProduct(product);
        const stock = await db.getStock(product);

        if (!p) return interaction.reply({ content: "❌ no product", ephemeral: true });
        if (stock <= 0) return interaction.reply({ content: "❌ หมด stock", ephemeral: true });

        reserve.set(interaction.user.id, { product, type });

        const price = Number(type === "reseller" ? p.resell_price : p.customer_price);

        return interaction.reply({
            ephemeral: true,
            embeds: [
                new EmbedBuilder()
                    .setTitle("CONFIRM SELL")
                    .addFields(
                        { name: "Product", value: product },
                        { name: "Type", value: type },
                        { name: "Price", value: `${price}` },
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

    // ================= CONFIRM SELL =================
    if (interaction.isButton() && interaction.customId === "confirm_sell") {

        if (lockUser.has(interaction.user.id)) {
            return interaction.reply({ content: "❌ busy", ephemeral: true });
        }

        const data = reserve.get(interaction.user.id);
        if (!data) {
            return interaction.reply({ content: "❌ session expired", ephemeral: true });
        }

        lockUser.add(interaction.user.id);

        try {

            const key = await db.claimKey(data.product);

            if (!key) {
                reserve.delete(interaction.user.id);
                return interaction.reply({ content: "❌ out of stock", ephemeral: true });
            }

            reserve.delete(interaction.user.id);

            return interaction.reply({
                content: `🔑 KEY: ${key.key}`,
                ephemeral: true
            });

        } finally {
            lockUser.delete(interaction.user.id);
        }
    }

} catch (err) {
    console.log("GLOBAL ERROR:", err);
}
});

client.login(process.env.TOKEN);