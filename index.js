const express = require("express");
const app = express();

app.get("/", (req, res) => {
    res.send("VEX BOT ONLINE");
});

app.listen(3000);
require("dotenv").config();

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
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= STOCK MENU =================
function buildStockMenu() {
    const products = db.getProducts() || [];

    return new StringSelectMenuBuilder()
        .setCustomId("stock_select_product")
        .setPlaceholder("📦 เลือกหมวดสต็อก")
        .addOptions([
            ...products.map(p => ({
                label: p.name,
                value: p.name
            })),
            {
                label: "➕ เพิ่มสินค้าใหม่",
                value: "new_product"
            }
        ]);
}

// ================= LOG CHANNELS =================
function sendSellLog(embed) {
    const ch = client.channels.cache.get(process.env.SELL_LOG_CHANNEL_ID);
    if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

function sendStockLog(embed) {
    const ch = client.channels.cache.get(process.env.STOCK_LOG_CHANNEL_ID);
    if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

// ================= MAIN =================
client.on(Events.InteractionCreate, async (interaction) => {

    try {

        // ================= PANEL =================
        if (interaction.isChatInputCommand() && interaction.commandName === "panel") {

            const embed = new EmbedBuilder()
                .setTitle("📦 VEX STOCK PANEL")
                .setDescription("เลือกการทำงาน")
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

            return interaction.reply({
                embeds: [embed],
                components: [row]
            });
        }

        // ================= BUTTONS =================
        if (interaction.isButton()) {

            if (interaction.customId === "addstock") {
                return interaction.reply({
                    content: "📦 เลือกสินค้าเพื่อเติมสต็อก",
                    components: [new ActionRowBuilder().addComponents(buildStockMenu())],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (interaction.customId === "sell") {

                const products = db.getProducts() || [];

                const menu = new StringSelectMenuBuilder()
                    .setCustomId("sell_select_product")
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

            // ================= CONFIRM SELL (WITH LOG) =================
            if (interaction.customId.startsWith("confirm_")) {
                const id = interaction.customId.split("_")[1];
                const data = db.confirmKey(id);

                if (data) {
                    const stockLeft = db.getStock(data.product_name)?.count || 0;

                    const log = new EmbedBuilder()
                        .setTitle("📤 SELL LOG")
                        .setColor("Red")
                        .addFields(
                            { name: "User", value: `<@${data.user_id}>`, inline: true },
                            { name: "Product", value: data.product_name, inline: true },
                            { name: "Type", value: data.type, inline: true },
                            { name: "Key", value: data.key, inline: false },
                            { name: "Price", value: `${data.price}`, inline: true },
                            { name: "Profit", value: `${data.profit}`, inline: true },
                            { name: "Stock Left", value: `${stockLeft}`, inline: true }
                        )
                        .setTimestamp();

                    sendSellLog(log);
                }

                return interaction.update({
                    content: `✅ ขายสำเร็จ\n🔑 ${data?.key || "unknown"}`,
                    components: []
                });
            }

            if (interaction.customId.startsWith("cancel_")) {
                const id = interaction.customId.split("_")[1];
                db.cancelKey(id);

                return interaction.update({
                    content: "❌ ยกเลิกแล้ว",
                    components: []
                });
            }

            if (interaction.customId.startsWith("copy_")) {
                const id = interaction.customId.split("_")[1];
                const data = db.db.prepare("SELECT * FROM pending_keys WHERE id=?").get(id);

                return interaction.reply({
                    content: `📋 KEY: ${data?.key || "not found"}`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ================= STOCK SELECT =================
        if (interaction.isStringSelectMenu() &&
            interaction.customId === "stock_select_product") {

            const value = interaction.values[0];

            if (value === "new_product") {

                const modal = new ModalBuilder()
                    .setCustomId("add_product_modal")
                    .setTitle("📦 เพิ่มสินค้าใหม่");

                const name = new TextInputBuilder().setCustomId("name").setLabel("ชื่อสินค้า").setStyle(TextInputStyle.Short);
                const cost = new TextInputBuilder().setCustomId("cost").setLabel("ทุน").setStyle(TextInputStyle.Short);
                const reseller = new TextInputBuilder().setCustomId("reseller").setLabel("ราคา Reseller").setStyle(TextInputStyle.Short);
                const customer = new TextInputBuilder().setCustomId("customer").setLabel("ราคาลูกค้า").setStyle(TextInputStyle.Short);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(name),
                    new ActionRowBuilder().addComponents(cost),
                    new ActionRowBuilder().addComponents(reseller),
                    new ActionRowBuilder().addComponents(customer)
                );

                return interaction.showModal(modal);
            }

            const modal = new ModalBuilder()
                .setCustomId(`add_stock_modal_${value}`)
                .setTitle(`📦 เติมสต็อก: ${value}`);

            const keys = new TextInputBuilder()
                .setCustomId("keys")
                .setLabel("1 บรรทัด = 1 key")
                .setStyle(TextInputStyle.Paragraph);

            modal.addComponents(new ActionRowBuilder().addComponents(keys));

            return interaction.showModal(modal);
        }

        // ================= ADD STOCK (WITH LOG) =================
        if (interaction.isModalSubmit() &&
            interaction.customId.startsWith("add_stock_modal_")) {

            const product = interaction.customId.replace("add_stock_modal_", "");

            let keys = interaction.fields.getTextInputValue("keys")
                .split("\n")
                .map(k => k.trim())
                .filter(Boolean);

            keys = [...new Set(keys)];

            const existing = db.db.prepare(
                "SELECT key FROM keys WHERE product_name=?"
            ).all(product).map(x => x.key);

            const existingSet = new Set(existing);

            const filtered = keys.filter(k => !existingSet.has(k));
            const removed = keys.length - filtered.length;

            if (!filtered.length) {
                return interaction.reply({
                    content: "❌ คีย์ซ้ำทั้งหมดในระบบ",
                    ephemeral: true
                });
            }

            db.addKeys(product, filtered);

            const stock = db.getStock(product)?.count || 0;

            // ===== STOCK LOG =====
            const log = new EmbedBuilder()
                .setTitle("📥 STOCK LOG")
                .setColor("Green")
                .addFields(
                    { name: "User", value: `<@${interaction.user.id}>`, inline: true },
                    { name: "Product", value: product, inline: true },
                    { name: "Added", value: `${filtered.length}`, inline: true },
                    { name: "Removed Duplicate", value: `${removed}`, inline: true },
                    { name: "Stock Now", value: `${stock}`, inline: true }
                )
                .setTimestamp();

            sendStockLog(log);

            return interaction.reply({
                content:
`✅ เติมสต็อกสำเร็จ

📦 ${product}
🔑 เพิ่ม: ${filtered.length}
⚠️ ตัดซ้ำ: ${removed}
📊 คงเหลือ: ${stock}`,
                ephemeral: true
            });
        }

        // ================= ADD PRODUCT =================
        if (interaction.isModalSubmit() &&
            interaction.customId === "add_product_modal") {

            const name = interaction.fields.getTextInputValue("name");
            const cost = Number(interaction.fields.getTextInputValue("cost"));
            const reseller = Number(interaction.fields.getTextInputValue("reseller"));
            const customer = Number(interaction.fields.getTextInputValue("customer"));

            const resellerProfit = reseller - cost;
            const customerProfit = customer - cost;

            db.addProduct(name, cost, reseller, customer);

            return interaction.reply({
                content:
`✅ เพิ่มสินค้าแล้ว

📦 ${name}
💰 ทุน: ${cost}
🤝 Reseller: ${reseller} (กำไร: ${resellerProfit})
🛒 Customer: ${customer} (กำไร: ${customerProfit})`,
                ephemeral: true
            });
        }

        // ================= SELL FLOW =================
        if (interaction.isStringSelectMenu() &&
            interaction.customId === "sell_select_product") {

            const product = interaction.values[0];

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`sell_type_${product}`)
                .setPlaceholder("ขายให้ใคร?")
                .addOptions([
                    { label: "Reseller", value: "reseller" },
                    { label: "Customer", value: "customer" }
                ]);

            return interaction.update({
                content: `📦 ${product}`,
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }

        if (interaction.isStringSelectMenu() &&
            interaction.customId.startsWith("sell_type_")) {

            const product = interaction.customId.replace("sell_type_", "");
            const type = interaction.values[0];

            const key = db.getRandomKey(product);
            const info = db.getProduct(product);

            if (!key || !info) {
                return interaction.update({
                    content: "❌ ไม่มีข้อมูล / คีย์หมด",
                    components: []
                });
            }

            const price = type === "reseller"
                ? info.resell_price
                : info.customer_price;

            const profit = price - info.cost;

            const locked = db.lockKey({
                user_id: interaction.user.id,
                product_name: product,
                key_id: key.id,
                key: key.key,
                type,
                price,
                profit
            });

            const embed = new EmbedBuilder()
                .setTitle("📦 ยืนยันการขาย")
                .setDescription(
`สินค้า: ${product}
คีย์: ${key.key}
ขายให้: ${type}
ราคา: ${price}
กำไร: ${profit}`
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_${locked.lastInsertRowid}`)
                    .setStyle(ButtonStyle.Success)
                    .setLabel("ยืนยัน"),

                new ButtonBuilder()
                    .setCustomId(`cancel_${locked.lastInsertRowid}`)
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("ยกเลิก"),

                new ButtonBuilder()
                    .setCustomId(`copy_${locked.lastInsertRowid}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel("Copy")
            );

            return interaction.update({
                embeds: [embed],
                components: [row]
            });
        }

    } catch (err) {
        console.log("ERROR:", err);

        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({
                content: "❌ bot error",
                ephemeral: true
            });
        }
    }
});

client.login(process.env.TOKEN);