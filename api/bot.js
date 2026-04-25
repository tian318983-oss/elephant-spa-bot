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

// 【全新升级】：单图聚合折叠模式，完美解决上百技师刷屏问题
bot.callbackQuery("view_tech", async (ctx) => {
    await trackAction(ctx, "CLICK_TECH_LIST");
    await ctx.answerCallbackQuery();

    const { data: staff, error } = await supabase.from('staff_mapping').select('*').order('rating', { ascending: false });
    
    if (error || !staff || staff.length === 0) {
        return ctx.reply("技师排班获取中，请稍后再试或联系总台。");
    }

    // 1. 准备聚合文字列表
    let captionMsg = "✨ 【今日值班名师阵容】\n点击下方对应按钮，一键直达专属客服预约：\n\n";
    const keyboard = new InlineKeyboard();

    // 2. 循环生成技师列表和整齐的网格按钮
    staff.forEach((item, index) => {
        // 生成星级
        const starStr = '⭐'.repeat(item.rating || 5);
        
        // 拼接到总文本中
        captionMsg += `▪️ ${item.tech_name} ${starStr}\n`;
        
        // 添加到按钮矩阵中（保留一步直达跳转）
        keyboard.url(`💖 预约 [${item.tech_name}]`, item.cs_url);
        
        // 【核心逻辑】：每添加 2 个按钮，强制换行，形成整齐的九宫格排版
        if ((index + 1) % 2 === 0) {
            keyboard.row();
        }
    });

    // 3. 发送一条总领消息（采用一张高端的默认封面图，替代刷屏照片）
    const coverImageUrl = "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop"; 
    
    await ctx.replyWithPhoto(coverImageUrl, { 
        caption: captionMsg, 
        reply_markup: keyboard 
    });
});

// Vercel 接口声明
module.exports = webhookCallback(bot, "https");
