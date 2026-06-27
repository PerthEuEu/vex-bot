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
    console.log("🔥 BOT READY");
});

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

        // ================= ADD STOCK BUTTON =================
        if (interaction.isButton() && interaction.customId === "addstock") {

            const products = await db.getProducts();

            if (!products?.length) {
                return interaction.reply({
                    content: "❌ ไม่มีสินค้า",
                    flags: MessageFlags.Ephemeral
                });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId("stock_select_product")
                .setPlaceholder("เลือกสินค้า")
                .addOptions([
                    ...products.slice(0, 24).map(p => ({
                        label: p.name.slice(0, 100),
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

        // ================= STOCK SELECT =================
        if (interaction.isStringSelectMenu() &&
            interaction.customId === "stock_select_product") {

            const value = interaction.values[0];

            // ➕ ADD PRODUCT
            if (value === "new_product") {

                const modal = new ModalBuilder()
                    .setCustomId("add_product_modal")
                    .setTitle("เพิ่มสินค้า");

                const name = new TextInputBuilder()
                    .setCustomId("name")
                    .setLabel("ชื่อสินค้า")
                    .setStyle(TextInputStyle.Short);

                const cost = new TextInputBuilder()
                    .setCustomId("cost")
                    .setLabel("ทุน")
                    .setStyle(TextInputStyle.Short);

                const reseller = new TextInputBuilder()
                    .setCustomId("reseller")
                    .setLabel("ราคาขายส่ง")
                    .setStyle(TextInputStyle.Short);

                const customer = new TextInputBuilder()
                    .setCustomId("customer")
                    .setLabel("ราคาลูกค้า")
                    .setStyle(TextInputStyle.Short);

                const modalForm = new ModalBuilder()
                    .setCustomId("add_product_modal")
                    .setTitle("เพิ่มสินค้า")
                    .addComponents(
                        new ActionRowBuilder().addComponents(name),
                        new ActionRowBuilder().addComponents(cost),
                        new ActionRowBuilder().addComponents(reseller),
                        new ActionRowBuilder().addComponents(customer)
                    );

                return interaction.showModal(modalForm);
            }

            // ================= ADD STOCK MODAL =================
            const modal = new ModalBuilder()
                .setCustomId(`add_stock_modal_${value}`)
                .setTitle("เติมสต็อค");

            const keys = new TextInputBuilder()
                .setCustomId("keys")
                .setLabel("1 บรรทัด = 1 key")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(keys);
            modal.addComponents(row);

            return interaction.showModal(modal);
        }

        // ================= ADD STOCK =================
        if (interaction.isModalSubmit() &&
            interaction.customId.startsWith("add_stock_modal_")) {

            const product = interaction.customId.replace("add_stock_modal_", "");

            let keys = interaction.fields.getTextInputValue("keys")
                .split("\n")
                .map(k => k.trim())
                .filter(Boolean);

            await db.addKeys(product, [...new Set(keys)]);

            return interaction.reply({
                content: `✅ เพิ่ม ${keys.length} keys`,
                flags: MessageFlags.Ephemeral
            });
        }

        // ================= ADD PRODUCT =================
        if (interaction.isModalSubmit() &&
            interaction.customId === "add_product_modal") {

            const name = interaction.fields.getTextInputValue("name");
            const cost = Number(interaction.fields.getTextInputValue("cost"));
            const reseller = Number(interaction.fields.getTextInputValue("reseller"));
            const customer = Number(interaction.fields.getTextInputValue("customer"));

            await db.addProduct(name, cost, reseller, customer);

            return interaction.reply({
                content: `✅ เพิ่มสินค้า ${name}`,
                flags: MessageFlags.Ephemeral
            });
        }

    } catch (err) {
        console.log("ERROR:", err);

        if (!interaction.replied) {
            return interaction.reply({
                content: "❌ bot error",
                flags: MessageFlags.Ephemeral
            });
        }
    }
});

client.login(process.env.TOKEN);