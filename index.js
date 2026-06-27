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

const log = (m) => console.log(`[VEX] ${m}`);

// ================= READY =================
client.once(Events.ClientReady, () => {
    log(`ONLINE: ${client.user.tag}`);
});

// ================= SAFE LOG =================
function sendLog(channelId, embed) {
    if (!channelId) return;
    const ch = client.channels.cache.get(channelId);
    if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

// ================= MAIN =================
client.on(Events.InteractionCreate, async (interaction) => {
try {

    // ================= PANEL =================
    if (interaction.isChatInputCommand() && interaction.commandName === "panel") {

        return interaction.reply({
            ephemeral: true,
            embeds: [
                new EmbedBuilder().setTitle("📦 VEX STOCK PANEL")
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("stock_open")
                        .setLabel("📥 ADD STOCK")
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId("sell_open")
                        .setLabel("💰 SELL")
                        .setStyle(ButtonStyle.Primary)
                )
            ]
        });
    }

    // ================= STOCK OPEN =================
    if (interaction.isButton() && interaction.customId === "stock_open") {

        const products = await db.getProducts();

        if (!products?.length) {
            return interaction.reply({ content: "❌ ไม่มีสินค้า", ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_select")
            .setPlaceholder("เลือกสินค้า")
            .addOptions(
                products.slice(0, 25).map(p => ({
                    label: p.name,
                    value: p.name
                }))
            );

        return interaction.reply({
            content: "📦 เลือกสินค้า",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }

    // ================= STOCK SELECT =================
    if (interaction.isStringSelectMenu() && interaction.customId === "stock_select") {

        const product = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`add_stock_${product}`)
            .setTitle("เติมสต็อค");

        const input = new TextInputBuilder()
            .setCustomId("keys")
            .setLabel("ใส่ key (ขึ้นบรรทัดใหม่)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
    }

    // ================= ADD STOCK =================
    if (interaction.isModalSubmit() && interaction.customId.startsWith("add_stock_")) {

        const product = interaction.customId.replace("add_stock_", "");

        const keys = interaction.fields.getTextInputValue("keys")
            .split("\n")
            .map(v => v.trim())
            .filter(Boolean);

        if (!keys.length) {
            return interaction.reply({ content: "❌ ไม่มี key", ephemeral: true });
        }

        await db.addKeys(product, keys);

        const stock = await db.getStock(product);

        const embed = new EmbedBuilder()
            .setTitle("📥 STOCK ADDED")
            .addFields(
                { name: "Product", value: product },
                { name: "Amount", value: `${keys.length}` },
                { name: "Stock Left", value: `${stock.count}` }
            )
            .setColor("Green");

        sendLog(STOCK_LOG, embed);

        return interaction.reply({
            content: `✅ เพิ่ม ${keys.length} keys`,
            ephemeral: true
        });
    }

    // ================= SELL OPEN =================
    if (interaction.isButton() && interaction.customId === "sell_open") {

        const products = await db.getProducts();

        if (!products?.length)
            return interaction.reply({ content: "❌ ไม่มีสินค้า", ephemeral: true });

        const menu = new StringSelectMenuBuilder()
            .setCustomId("sell_select")
            .setPlaceholder("เลือกสินค้า")
            .addOptions(
                products.slice(0, 25).map(p => ({
                    label: p.name,
                    value: p.name
                }))
            );

        return interaction.reply({
            content: "📦 เลือกสินค้า",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
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
            ephemeral: true
        });
    }

    // ================= SELL TYPE =================
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_type_")) {

        const product = interaction.customId.replace("sell_type_", "");
        const type = interaction.values[0];

        const p = await db.getProduct(product);
        const key = await db.getRandomKey(product);
        const stock = await db.getStock(product);

        if (!p) return interaction.reply({ content: "❌ no product", ephemeral: true });
        if (!key) return interaction.reply({ content: "❌ out of stock", ephemeral: true });

        const price = type === "reseller" ? p.resell_price : p.customer_price;
        const profit = price - p.cost;

        const confirm = new ActionRowBuilder().addComponents(
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
            components: [confirm],
            ephemeral: true
        });
    }

    // ================= CONFIRM =================
    if (interaction.isButton() && interaction.customId.startsWith("confirm_")) {

        const [, product, type] = interaction.customId.split("_");

        const p = await db.getProduct(product);
        const key = await db.getRandomKey(product);
        const stock = await db.getStock(product);

        if (!key)
            return interaction.reply({ content: "❌ out of stock", ephemeral: true });

        const price = type === "reseller" ? p.resell_price : p.customer_price;
        const profit = price - p.cost;

        // 🔥 FIX: mark used (สำคัญมาก)
        await db.markKeyUsed(key.id);

        const embed = new EmbedBuilder()
            .setTitle("🔑 SELL LOG")
            .addFields(
                { name: "User", value: `<@${interaction.user.id}>` },
                { name: "Product", value: product },
                { name: "Key", value: key.key },
                { name: "Profit", value: `${profit}` },
                { name: "Stock Left", value: `${stock.count - 1}` }
            )
            .setColor("Red");

        sendLog(SELL_LOG, embed);

        return interaction.reply({
            content: `🔑 KEY: ${key.key}`,
            ephemeral: true
        });
    }

} catch (err) {
    console.log("ERROR:", err);
    if (!interaction.replied) {
        return interaction.reply({ content: "❌ error", ephemeral: true });
    }
}
});

client.login(process.env.TOKEN);