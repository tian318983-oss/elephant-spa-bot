const { Bot, InlineKeyboard, webhookCallback } = require("grammy");
const { createClient } = require("@supabase/supabase-js");

const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 埋点追踪核心引擎
async function trackAction(ctx, actionType) {
    try {
        const { id, username } = ctx.from;
        await supabase.from('user_logs').insert([
            { tg_id: id, username: username || 'unknown', action_type: actionType }
        ]);
        console.log(`[成功记录] 用户 ${username || id} 执行动作: ${actionType}`);
    } catch (e) {
        console.error("记录失败:", e);
    }
}

// 指令：/start
bot.command("start", async (ctx) => {
    await trackAction(ctx, "START_BOT");
    const keyboard = new InlineKeyboard()
        .text("🐘 浏览技师 & 项目", "view_tech").row()
        .url("📍 门店地图导航", "https://maps.google.com/?q=Vientiane+Elephant+SPA"); 

    await ctx.reply("🐘 欢迎来到大象 SPA (Elephant SPA)！\n\n我们为您提供万象最专业的泰式按摩与身心放松服务。请点击下方按钮开始体验：", {
        reply_markup: keyboard
    });
});

// 【核心改造 1】发送图文瀑布流
bot.callbackQuery("view_tech", async (ctx) => {
    await trackAction(ctx, "CLICK_TECH_LIST");
    
    // 消除按钮上的转圈圈加载动画
    await ctx.answerCallbackQuery();

    const { data: staff, error } = await supabase.from('staff_mapping').select('*');
    
    if (error || !staff) {
        return ctx.reply("技师排班获取中，请稍后再试或联系总台。");
    }

    await ctx.reply("✨ 以下是今日值班名师：");

    // 循环给每个技师发一张专属图文卡片
    for (const item of staff) {
        // 注意：这里不再是 url 跳转，而是内部暗号 book_tech_ + 技师ID
        const keyboard = new InlineKeyboard()
            .text(`💖 立即预约 [${item.tech_name}]`, `book_tech_${item.id}`);

        // 如果有图片就发图片，没有图片就发纯文字
        if (item.media_url) {
            await ctx.replyWithPhoto(item.media_url, {
                caption: `【${item.tech_name}】\n手法专业，为您扫除一天的疲惫。点击下方获取专属服务👇`,
                reply_markup: keyboard
            });
        } else {
            await ctx.reply(`【${item.tech_name}】\n点击下方获取专属服务👇`, {
                reply_markup: keyboard
            });
        }
    }
});

// 【核心改造 2】精准捕获“预约意向”并分发客服链接
bot.callbackQuery(/book_tech_(.+)/, async (ctx) => {
    const techId = ctx.match[1]; // 提取出用户点击了几号技师
    
    // 1. 【极具价值的静默追踪】记录该用户对这个技师产生了明确意向！
    await trackAction(ctx, `INTENT_BOOK_TECH_ID_${techId}`);
    
    // 2. 去数据库查这个技师对应的真实客服链接
    const { data: techData } = await supabase
        .from('staff_mapping')
        .select('tech_name, cs_url')
        .eq('id', techId)
        .single();

    if (techData) {
        // 3. 将客服链接发给用户
        const keyboard = new InlineKeyboard().url("💬 点击此处跳转专属客服", techData.cs_url);
        await ctx.reply(`您选择了【${techData.tech_name}】🐘\n\n我们的前台已准备好为您安排档期，请点击下方按钮确认预约时间：`, {
            reply_markup: keyboard
        });
    }

    await ctx.answerCallbackQuery();
});

// Vercel 接口声明
module.exports = webhookCallback(bot, "https");
