const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ADMIN_PASSWORD = "你的管理密码"; // 👉 请在这里设置你的后台管理密码

module.exports = async (req, res) => {
  // 1. 处理保存数据的请求 (POST)
  if (req.method === "POST") {
    const { password, tech_name, cs_url, media_url, action, id } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(403).send("密码错误，无权操作");
    }

    if (action === "delete") {
      await supabase.from("staff_mapping").delete().eq("id", id);
      return res.send("删除成功！");
    } else {
      await supabase.from("staff_mapping").insert([{ tech_name, cs_url, media_url }]);
      return res.send("添加成功！");
    }
  }

  // 2. 获取当前技师列表
  const { data: staff } = await supabase.from("staff_mapping").select("*").order("id", { ascending: true });

  // 3. 返回管理页面 (HTML)
  const html = `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>大象 SPA 技师管理后台</title>
        <style>
            body { font-family: sans-serif; padding: 20px; background: #f4f7f6; color: #333; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 600px; margin: auto; }
            input, button { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
            button { background: #007bff; color: white; border: none; cursor: pointer; font-weight: bold; }
            .staff-item { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding: 10px 0; }
            .del-btn { background: #ff4d4d; width: auto; padding: 5px 10px; margin: 0; font-size: 12px; }
            img { width: 50px; height: 50px; border-radius: 4px; object-fit: cover; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>🐘 大象 SPA 技师管理</h2>
            
            <div id="list">
                <h4>当前在职技师</h4>
                ${staff.map(s => `
                    <div class="staff-item">
                        <img src="${s.media_url || ''}" alt="">
                        <span>${s.tech_name}</span>
                        <button class="del-btn" onclick="deleteStaff(${s.id})">删除</button>
                    </div>
                `).join('')}
            </div>

            <hr>
            <h4>新增技师</h4>
            <input type="password" id="pass" placeholder="管理密码">
            <input type="text" id="name" placeholder="技师名字">
            <input type="text" id="media" placeholder="照片链接 (URL)">
            <input type="text" id="cs" placeholder="客服链接 (Telegram/WhatsApp)">
            <button onclick="saveStaff()">确认添加</button>
        </div>

        <script>
            async function saveStaff() {
                const res = await fetch('/api/admin', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        password: document.getElementById('pass').value,
                        tech_name: document.getElementById('name').value,
                        media_url: document.getElementById('media').value,
                        cs_url: document.getElementById('cs').value
                    })
                });
                alert(await res.text());
                location.reload();
            }

            async function deleteStaff(id) {
                if(!confirm('确定要删除吗？')) return;
                const res = await fetch('/api/admin', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        password: document.getElementById('pass').value,
                        id: id,
                        action: 'delete'
                    })
                });
                alert(await res.text());
                location.reload();
            }
        </script>
    </body>
    </html>
  `;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
};
