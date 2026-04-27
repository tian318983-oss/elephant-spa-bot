const { Bot, InlineKeyboard, webhookCallback } = require("grammy");
const { createClient } = require("@supabase/supabase-js");

const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 获取店里的真实 USDT 钱包地址，如果没有配置则显示提示词
const USDT_WALLET = process.env.USDT_WALLET || "未配置钱包地址，请联系客服";

// 全链路数据埋点引擎
async function trackAction(ctx, actionType) {
    try {
        const { id, username } = ctx.from;
        await supabase.from('user_logs').insert([
            { tg_id: id, username: username || 'unknown', action_type: actionType }
        ]);
    } catch (e) {
        console.error("埋点失败:", e);
    }
}

bot.command("start", async (ctx) => {
    await trackAction(ctx, "START_BOT");
    const keyboard = new InlineKeyboard()
        .text("🐘 浏览技师 & 项目", "view_tech").row()
        .url("📍 门店地图导航", "https://maps.google.com/?q=Vientiane+Elephant+SPA"); 

    await ctx.reply("🐘 欢迎来到大象 SPA！\n\n我们为您提供万象最专业的泰式按摩。请点击下方体验：", { reply_markup: keyboard });
});

bot.callbackQuery("view_tech", async (ctx) => {
    await trackAction(ctx, "CLICK_TECH_LIST");
    await ctx.answerCallbackQuery();

    const { data: staff } = await supabase.from('staff_mapping').select('*').order('rating', { ascending: false });
    if (!staff || staff.length === 0) return ctx.reply("排班获取中，请稍后再试。");

    let captionMsg = "✨ 【今日值班名师阵容】\n点击查看专属资料卡与报价👇\n\n";
    const keyboard = new InlineKeyboard();

    staff.forEach((item, index) => {
        captionMsg += `▪️ ${item.tech_name} ${'⭐'.repeat(item.rating || 5)}\n`;
        keyboard.text(`🔍 查看 [${item.tech_name}]`, `preview_${item.id}`);
        if ((index + 1) % 2 === 0) keyboard.row();
    });

    const coverImageUrl = "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop"; 
    await ctx.replyWithPhoto(coverImageUrl, { caption: captionMsg, reply_markup: keyboard });
});

bot.callbackQuery(/preview_(.+)/, async (ctx) => {
    const techId = ctx.match[1];
    await trackAction(ctx, `PREVIEW_TECH_ID_${techId}`); 
    await ctx.answerCallbackQuery();

    const { data: tech } = await supabase.from('staff_mapping').select('*').eq('id', techId).single();
    if (!tech) return ctx.reply("读取失败。");

    const priceText = tech.price > 0 ? `$${tech.price} USDT` : "免费咨询";
    const captionMsg = `【${tech.tech_name}】 ${'⭐'.repeat(tech.rating || 5)}\n\n💎 预约定金/服务费：${priceText}\n\n档期紧张，您可以选择使用 USDT 支付定金自动锁单，或联系客服人工预约👇`;

    const keyboard = new InlineKeyboard();
    
    // 只要有价格，就展示直连转账按钮
    if (tech.price > 0) {
        keyboard.text(`💎 使用 USDT(TRC20) 支付锁单`, `direct_pay_${tech.id}`).row();
    }
    keyboard.url(`💬 还是想联系人工客服`, tech.cs_url);

    if (tech.media_url) {
        if(tech.media_url.includes('.mp4')) {
            await ctx.replyWithVideo(tech.media_url, { caption: captionMsg, reply_markup: keyboard });
        } else {
            await ctx.replyWithPhoto(tech.media_url, { caption: captionMsg, reply_markup: keyboard });
        }
    } else {
        await ctx.reply(captionMsg, { reply_markup: keyboard });
    }
});

// ==========================================
// 【终极方案】：去中心化 P2P 直连收银台
// ==========================================
bot.callbackQuery(/direct_pay_(.+)/, async (ctx) => {
    const techId = ctx.match[1];
    await trackAction(ctx, `CLICK_DIRECT_PAY_${techId}`); 
    await ctx.answerCallbackQuery();

    const { data: tech } = await supabase.from('staff_mapping').select('*').eq('id', techId).single();
    if (!tech) return;

    // 构建一个极其易读的付款账单，使用 MarkdownV2 方便用户一键复制钱包地址
    const invoiceMsg = `🧾 **大象 SPA 专属锁单凭证**

👤 **预约技师：** ${tech.tech_name}
💰 **应付金额：** \`${tech.price}\` USDT
🌐 **转账网络：** Tron (TRC-20)

🏦 **请将 USDT 转入下方官方收款地址：**
（点击地址即可自动复制）
\`${USDT_WALLET}\`

⚠️ **重要提示：**
转账完成后，请务必点击下方按钮，将**支付成功截图**发送给您的专属客服，客服将为您立刻锁定档期安排时间！`;

    // 引导用户去客服那里核销
    const keyboard = new InlineKeyboard()
        .url("✅ 我已转账，发送截图给客服核销", tech.cs_url).row()
        .url("❓ 不会使用 USDT？联系客服", tech.cs_url);

    await ctx.reply(invoiceMsg, { 
        parse_mode: "Markdown", 
        reply_markup: keyboard 
    });
});

module.exports = webhookCallback(bot, "https");
