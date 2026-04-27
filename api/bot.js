const { Bot, InlineKeyboard, webhookCallback } = require("grammy");
const { createClient } = require("@supabase/supabase-js");

// 初始化机器人与数据库
const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 提取支付秘钥 
const PAYMENT_TOKEN = process.env.PAYMENT_TOKEN;

// 【全链路数据埋点引擎】
async function trackAction(ctx, actionType) {
    try {
        const { id, username } = ctx.from;
        await supabase.from('user_logs').insert([
            { tg_id: id, username: username || 'unknown', action_type: actionType }
        ]);
        console.log(`[埋点成功] 用户动作: ${actionType}`);
    } catch (e) {
        console.error("埋点失败:", e);
    }
}

// 1. 开始指令
bot.command("start", async (ctx) => {
    await trackAction(ctx, "START_BOT");
    const keyboard = new InlineKeyboard()
        .text("🐘 浏览技师 & 项目", "view_tech").row()
        .url("📍 门店地图导航", "https://maps.google.com/?q=Vientiane+Elephant+SPA"); 

    await ctx.reply("🐘 欢迎来到大象 SPA！\n\n我们为您提供万象最专业的泰式按摩。请点击下方体验：", { reply_markup: keyboard });
});

// 2. 总览聚合模式 (防止上百技师刷屏的九宫格)
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
        // 核心排版：每 2 个按钮换一行
        if ((index + 1) % 2 === 0) keyboard.row();
    });

    const coverImageUrl = "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop"; 
    await ctx.replyWithPhoto(coverImageUrl, { caption: captionMsg, reply_markup: keyboard });
});

// 3. 专属资料卡弹出 (相亲卡片 + 支付按钮判定)
bot.callbackQuery(/preview_(.+)/, async (ctx) => {
    const techId = ctx.match[1];
    await trackAction(ctx, `PREVIEW_TECH_ID_${techId}`); // 漏斗第一层：看了资料
    await ctx.answerCallbackQuery();

    const { data: tech } = await supabase.from('staff_mapping').select('*').eq('id', techId).single();
    if (!tech) return ctx.reply("读取资料失败，请重试。");

    const priceText = tech.price > 0 ? `￥${tech.price}` : "免费咨询";
    const captionMsg = `【${tech.tech_name}】 ${'⭐'.repeat(tech.rating || 5)}\n\n💎 预约定金/服务费：${priceText}\n\n档期紧张，您可以选择立刻支付定金锁单，或先联系客服咨询详情👇`;

    // 黄金双轨转化策略：支付 or 咨询
    const keyboard = new InlineKeyboard();
    
    // 【核心修复点】：如果有 Token 且后台设置的价格大于 0，才显示支付按钮！
    if (PAYMENT_TOKEN && tech.price > 0) {
        keyboard.text(`💳 支付锁单 (￥${tech.price})`, `pay_${tech.id}`).row();
    }
    keyboard.url(`💬 还是想先联系客服`, tech.cs_url);

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

// 4. 发起支付账单 (拉起原生 Wallet 面板)
bot.callbackQuery(/pay_(.+)/, async (ctx) => {
    const techId = ctx.match[1];
    await trackAction(ctx, `CLICK_PAY_TECH_ID_${techId}`); // 漏斗第二层：点击了支付按钮
    await ctx.answerCallbackQuery("正在为您生成加密支付账单...");

    const { data: tech } = await supabase.from('staff_mapping').select('*').eq('id', techId).single();
    if (!tech) return;

    // Telegram Payment API 规定：金额必须是最小单位（比如人民币的“分”），所以价格要乘以 100
    const amountInCents = tech.price * 100;

    await ctx.replyWithInvoice(
        `🐘 预约 [${tech.tech_name}]`,               
        `支付此定金以锁定 ${tech.tech_name} 的专属档期。线下门店出示支付凭证即可。`, 
        `booking_payload_${tech.id}_${ctx.from.id}`, 
        PAYMENT_TOKEN,                               
        "CNY",                                       
        [{ label: "定金/服务费", amount: amountInCents }], 
        { photo_url: tech.media_url }                
    );
});

// 5. 支付前置校验 (Telegram 官方强制要求)
bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
});

// 6. 支付成功回调 (闭环终点：成交与收据)
bot.on("message:successful_payment", async (ctx) => {
    const paymentInfo = ctx.message.successful_payment;
    const payloadParts = paymentInfo.invoice_payload.split('_');
    const techId = payloadParts[2];

    await trackAction(ctx, `PAY_SUCCESS_TECH_ID_${techId}_AMT_${paymentInfo.total_amount/100}`); // 漏斗第三层：支付成功！

    // 去数据库抓取对应客服链接，给客户发收据
    const { data: tech } = await supabase.from('staff_mapping').select('cs_url').eq('id', techId).single();
    const csUrl = tech?.cs_url || "https://t.me/elephantspa_2026";
    
    const keyboard = new InlineKeyboard().url("向客服出示凭证预约时间", csUrl);
    
    await ctx.reply(`🎉 支付成功！您已成功支付 ￥${paymentInfo.total_amount / 100}。\n\n请点击下方按钮，将此界面截图发给前台安排具体时间：`, {
        reply_markup: keyboard
    });
});

module.exports = webhookCallback(bot, "https");
