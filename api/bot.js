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

// 图文瀑布流展示 (带星级与一键跳转)
bot.callbackQuery("view_tech", async (ctx) => {
    await trackAction(ctx, "CLICK_TECH_LIST");
    await ctx.answerCallbackQuery();

    const { data: staff, error } = await supabase.from('staff_mapping').select('*').order('rating', { ascending: false });
    
    if (error || !staff) {
        return ctx.reply("技师排班获取中，请稍后再试或联系总台。");
    }

    await ctx.reply("✨ 以下是今日值班名师：");

    // 循环发卡片
    for (const item of staff) {
        // 生成对应数量的星星，如果没有则默认5星
        const starStr = '⭐'.repeat(item.rating || 5);
        
        // 【核心改造】：不再使用内部暗号，直接使用 .url() 一步跳转到客服！
        const keyboard = new InlineKeyboard()
            .url(`💖 立即预约 [${item.tech_name}]`, item.cs_url);

        const captionMsg = `【${item.tech_name}】 ${starStr}\n手法专业，为您扫除一天的疲惫。点击下方获取专属服务👇`;

        if (item.media_url) {
            if(item.media_url.includes('.mp4')) {
                await ctx.replyWithVideo(item.media_url, { caption: captionMsg, reply_markup: keyboard });
            } else {
                await ctx.replyWithPhoto(item.media_url, { caption: captionMsg, reply_markup: keyboard });
            }
        } else {
            await ctx.reply(captionMsg, { reply_markup: keyboard });
        }
    }
});

// Vercel 接口声明
module.exports = webhookCallback(bot, "https");
