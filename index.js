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

const log = (m) => console.log(`[VEX] ${m}`);

// ================= READY =================
client.once(Events.ClientReady, () => {
    log(`ONLINE: ${client.user.tag}`);
});

// ================= SAFE =================
async function safeReply(i, data) {
    try {
        if (i.deferred) return i.editReply(data);
        if (i.replied) return i.followUp(data);
        return i.reply(data);
    } catch (e) {
        console.log("reply error:", e?.message || e);
    }
}

// ================= MAIN =================
client.on(Events.InteractionCreate, async (i) => {
try {

    // ================= PANEL =================
    if (i.isChatInputCommand() && i.commandName === "panel") {

        return i.reply({
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

    // ================= STOCK OPEN (CATEGORY) =================
    if (i.isButton() && i.customId === "stock_open") {

        const categories = await db.getCategories();

        if (!categories?.length) {
            return i.reply({ content: "❌ ไม่มีหมวดหมู่", ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_category")
            .setPlaceholder("📂 เลือกหมวดหมู่")
            .addOptions(
                categories.map(c => ({
                    label: c.name,
                    value: c.name
                }))
            );

        return i.reply({
            ephemeral: true,
            content: "📂 เลือกหมวดหมู่",
            components: [new ActionRowBuilder().addComponents(menu)]
        });
    }

    // ================= CATEGORY -> PRODUCT =================
    if (i.isStringSelectMenu() && i.customId === "stock_category") {

        const category = i.values[0];

        const products = await db.getProductsByCategory(category);

        if (!products?.length) {
            return i.reply({ content: "❌ ไม่มีสินค้าในหมวดนี้", ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId("stock_product")
            .setPlaceholder("📦 เลือกสินค้า")
            .addOptions(
                products.map(p => ({
                    label: p.name,
                    value: p.name
                }))
            );

        return i.reply({
            ephemeral: true,
            content: `📂 ${category}`,
            components: [new ActionRowBuilder().addComponents(menu)]
        });
    }

    // ================= PRODUCT -> MODAL =================
    if (i.isStringSelectMenu() && i.customId === "stock_product") {

        const product = i.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`stock_modal_${product}`)
            .setTitle(`📥 เติมสต็อก ${product}`);

        const input = new TextInputBuilder()
            .setCustomId("keys")
            .setLabel("ใส่คีย์ (ขึ้นบรรทัดใหม่)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(input)
        );

        return i.showModal(modal);
    }

    // ================= ADD STOCK SAVE =================
    if (i.isModalSubmit() && i.customId.startsWith("stock_modal_")) {

        const product = i.customId.replace("stock_modal_", "");
        const raw = i.fields.getTextInputValue("keys");

        const keys = raw.split("\n").map(k => k.trim()).filter(Boolean);

        if (!keys.length) {
            return i.reply({ content: "❌ ไม่มี key", ephemeral: true });
        }

        await db.addKeys(product, keys);

        log(`STOCK +${keys.length} | ${product} | ${i.user.tag}`);

        return i.reply({
            content: `✅ เติมสต็อก **${product}** +${keys.length}`,
            ephemeral: true
        });
    }

    // ================= SELL OPEN =================
    if (i.isButton() && i.customId === "sell_open") {

        const products = await db.getProducts();

        const menu = new StringSelectMenuBuilder()
            .setCustomId("sell_select")
            .setPlaceholder("📦 เลือกสินค้า")
            .addOptions(
                products.slice(0, 25).map(p => ({
                    label: p.name,
                    value: p.name
                }))
            );

        return i.reply({
            ephemeral: true,
            content: "📦 เลือกสินค้า",
            components: [new ActionRowBuilder().addComponents(menu)]
        });
    }

    // ================= SELL SELECT =================
    if (i.isStringSelectMenu() && i.customId === "sell_select") {

        const product = i.values[0];

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`sell_type_${product}`)
            .addOptions([
                { label: "Reseller", value: "reseller" },
                { label: "Customer", value: "customer" }
            ]);

        return i.reply({
            ephemeral: true,
            content: "💰 เลือกประเภท",
            components: [new ActionRowBuilder().addComponents(menu)]
        });
    }

    // ================= SELL TYPE =================
    if (i.isStringSelectMenu() && i.customId.startsWith("sell_type_")) {

        const product = i.customId.replace("sell_type_", "");
        const type = i.values[0];

        const p = await db.getProduct(product);
        const stock = await db.getStock(product);

        if (!p) return i.reply({ content: "❌ no product", ephemeral: true });
        if (stock <= 0) return i.reply({ content: "❌ out of stock", ephemeral: true });

        const price = Number(type === "reseller" ? p.resell_price : p.customer_price);
        const cost = Number(p.cost || 0);
        const profit = price - cost;

        reserve.set(i.user.id, { product, type, price, cost, profit });

        return i.reply({
            ephemeral: true,
            embeds: [
                new EmbedBuilder()
                    .setTitle("CONFIRM SELL")
                    .addFields(
                        { name: "Product", value: product },
                        { name: "Type", value: type },
                        { name: "Price", value: String(price) },
                        { name: "Cost", value: String(cost) },
                        { name: "Profit", value: String(profit) },
                        { name: "Stock", value: String(stock) }
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
    if (i.isButton() && i.customId === "confirm_sell") {

        if (lockUser.has(i.user.id)) {
            return i.reply({ content: "❌ busy", ephemeral: true });
        }

        const data = reserve.get(i.user.id);
        if (!data) {
            return i.reply({ content: "❌ session expired", ephemeral: true });
        }

        lockUser.add(i.user.id);

        try {

            const key = await db.claimKey(data.product);

            if (!key) {
                reserve.delete(i.user.id);
                return i.reply({ content: "❌ out of stock", ephemeral: true });
            }

            const stock = await db.getStock(data.product);

            log(`SELL | ${i.user.tag} | ${data.product} | ${data.type} | P:${data.profit}`);

            reserve.delete(i.user.id);

            return i.reply({
                ephemeral: true,
                content:
                    `🔑 KEY: ${key.key}\n` +
                    `💰 PROFIT: ${data.profit}\n` +
                    `📦 STOCK LEFT: ${stock}`
            });

        } finally {
            lockUser.delete(i.user.id);
        }
    }

} catch (err) {
    console.log("GLOBAL ERROR:", err);
}
});

client.login(process.env.TOKEN);