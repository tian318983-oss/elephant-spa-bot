const { Bot, InlineKeyboard, webhookCallback } = require("grammy");
const { createClient } = require("@supabase/supabase-js");

const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 埋点记录函数
async function trackAction(ctx, actionType) {
    try {
        const { id, username } = ctx.from;
        await supabase.from('user_logs').insert([
            { tg_id: id, username: username || 'unknown', action_type: actionType }
        ]);
    } catch (e) {
        console.error("数据记录失败:", e);
    }
}

// /start 指令
bot.command("start", async (ctx) => {
    await trackAction(ctx, "START_BOT");
    const keyboard = new InlineKeyboard()
        .text("🐘 浏览技师 & 项目", "view_tech").row()
        .url("📍 门店地图导航", "https://maps.google.com/?q=Vientiane+Elephant+SPA"); 

    await ctx.reply("🐘 欢迎来到大象 SPA (Elephant SPA)！\n\n我们为您提供万象最专业的泰式按摩与身心放松服务。请点击下方按钮开始体验：", {
        reply_markup: keyboard
    });
});

// 动态获取技师并展示
bot.callbackQuery("view_tech", async (ctx) => {
    await trackAction(ctx, "CLICK_TECH_LIST");
    
    const { data: staff, error } = await supabase.from('staff_mapping').select('*');
    
    if (error || !staff) {
    console.log("Supabase Error:", error);
    return ctx.reply(`【系统诊断报告】\n抓到错误了！原因：${error ? error.message : "数据空"} \nURL状态：${!!process.env.SUPABASE_URL}`);
}

    const keyboard = new InlineKeyboard();
    staff.forEach(item => {
        keyboard.url(`预约 [${item.tech_name}]`, item.cs_url).row();
    });

    await ctx.reply("✨ 以下是今日值班名师，点击即可直接咨询预约：", {
        reply_markup: keyboard
    });
    await ctx.answerCallbackQuery();
});

// 【核心修改点】：删除 bot.start()，替换为 Vercel 专用的 Webhook 导出
module.exports = webhookCallback(bot, "http");
