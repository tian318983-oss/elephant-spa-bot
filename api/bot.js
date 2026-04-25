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

// 【第一级：总览聚合模式】
bot.callbackQuery("view_tech", async (ctx) => {
    await trackAction(ctx, "CLICK_TECH_LIST");
    await ctx.answerCallbackQuery();

    const { data: staff, error } = await supabase.from('staff_mapping').select('*').order('rating', { ascending: false });
    
    if (error || !staff || staff.length === 0) {
        return ctx.reply("技师排班获取中，请稍后再试或联系总台。");
    }

    let captionMsg = "✨ 【今日值班名师阵容】\n点击下方对应技师，查看专属资料卡👇\n\n";
    const keyboard = new InlineKeyboard();

    // 循环生成九宫格按钮（改为内部指令：预览资料）
    staff.forEach((item, index) => {
        const starStr = '⭐'.repeat(item.rating || 5);
        captionMsg += `▪️ ${item.tech_name} ${starStr}\n`;
        
        // 【核心修改】：不直接跳转，而是发送一个带着技师 ID 的暗号进行预览
        keyboard.text(`🔍 查看 [${item.tech_name}]`, `preview_${item.id}`);
        
        if ((index + 1) % 2 === 0) {
            keyboard.row();
        }
    });

    const coverImageUrl = "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop"; 
    
    await ctx.replyWithPhoto(coverImageUrl, { 
        caption: captionMsg, 
        reply_markup: keyboard 
    });
});

// 【第二级：专属资料卡弹出模式】
bot.callbackQuery(/preview_(.+)/, async (ctx) => {
    const techId = ctx.match[1];
    
    // 【附赠惊喜】：重新加回精确意向追踪，现在你知道谁看了谁的照片了！
    await trackAction(ctx, `PREVIEW_TECH_ID_${techId}`);
    
    // 消除转圈圈加载状态
    await ctx.answerCallbackQuery();

    // 从数据库单独拉取这位被点击技师的详细信息
    const { data: tech, error } = await supabase.from('staff_mapping').select('*').eq('id', techId).single();

    if (error || !tech) {
        return ctx.reply("资料卡生成失败，请重试或直接联系客服。");
    }

    const starStr = '⭐'.repeat(tech.rating || 5);
    const captionMsg = `【${tech.tech_name}】 ${starStr}\n\n手法专业，为您扫除一天的疲惫。名师档期紧张，请点击下方按钮立刻联系专属客服安排时间👇`;

    // 专属的一键跳转按钮
    const keyboard = new InlineKeyboard()
        .url(`💬 确认预约 [${tech.tech_name}]`, tech.cs_url);

    // 发送带有照片/视频的专属名片
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

// Vercel 接口声明
module.exports = webhookCallback(bot, "https");
