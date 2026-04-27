const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; 
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method === "POST") {
    const { password, tech_name, cs_url, media_url, action, id, rating, price } = req.body;

    if (!ADMIN_PASSWORD) return res.status(500).send("请在 Vercel 设置 ADMIN_PASSWORD");
    if (password !== ADMIN_PASSWORD) return res.status(403).send("密码错误！");

    if (action === "delete") {
      await supabase.from("staff_mapping").delete().eq("id", id);
      return res.send("技师已下架");
    } else {
      const parsedRating = parseInt(rating) || 5;
      const parsedPrice = parseInt(price) || 0;
      await supabase.from("staff_mapping").insert([{ tech_name, cs_url, media_url, rating: parsedRating, price: parsedPrice }]);
      return res.send("技师上线成功！");
    }
  }

  const { data: staff } = await supabase.from("staff_mapping").select("*").order("id", { ascending: true });

  const html = `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🐘 大象 SPA | 商业管理舱</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
        <style>.glass-card { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); }</style>
    </head>
    <body class="min-h-screen text-gray-800 font-sans p-4 md:p-8 bg-gray-100">
        <header class="max-w-6xl mx-auto mb-8 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-extrabold tracking-tight">🐘 大象 SPA</h1>
                <p class="text-sm text-gray-500 mt-1">智能收银与管理舱 v4.0</p>
            </div>
        </header>

        <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
            <div class="md:col-span-5 space-y-6">
                <div class="glass-card rounded-2xl shadow-xl p-6 border border-gray-100">
                    <h2 class="text-xl font-bold mb-6 flex items-center">➕ 上架新技师</h2>
                    <div class="space-y-4">
                        <input type="password" id="pass" placeholder="管理秘钥" class="w-full px-4 py-2 border rounded-lg">
                        <input type="text" id="name" placeholder="技师称呼 (如：美柚)" class="w-full px-4 py-2 border rounded-lg">
                        
                        <div class="flex gap-4">
                            <div class="w-1/2">
                                <label class="text-xs text-gray-500">星级</label>
                                <select id="rating" class="w-full px-4 py-2 border rounded-lg"><option value="5">⭐⭐⭐⭐⭐</option><option value="4">⭐⭐⭐⭐</option></select>
                            </div>
                            <div class="w-1/2">
                                <label class="text-xs text-gray-500">定金/服务费 (元)</label>
                                <input type="number" id="price" placeholder="如：99" class="w-full px-4 py-2 border rounded-lg text-indigo-600 font-bold">
                            </div>
                        </div>

                        <input type="text" id="cs" placeholder="客服直连链接 (https://t.me/...)" class="w-full px-4 py-2 border rounded-lg">
                        
                        <div class="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50" onclick="document.getElementById('fileUpload').click()">
                            <p class="text-sm text-indigo-600 font-bold" id="fileNameDisplay">点击选择形象照片</p>
                            <input id="fileUpload" type="file" class="sr-only" accept="image/*,video/mp4" onchange="document.getElementById('fileNameDisplay').innerText = '已选: '+this.files[0].name">
                        </div>
                        <button id="submitBtn" onclick="saveStaff()" class="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold">📤 确认上架并开启收款</button>
                    </div>
                </div>
            </div>

            <div class="md:col-span-7">
                <div class="glass-card rounded-2xl shadow-xl p-6 border border-gray-100 min-h-[500px]">
                    <h2 class="text-xl font-bold mb-6">👥 当前服务阵容</h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        ${staff.map(s => `
                            <div class="bg-white border rounded-xl overflow-hidden hover:shadow-lg relative group">
                                <div class="h-40 bg-gray-100 relative">
                                    <img src="${s.media_url}" class="w-full h-full object-cover">
                                    <button onclick="deleteStaff(${s.id})" class="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">下架</button>
                                </div>
                                <div class="p-4">
                                    <h3 class="font-bold flex justify-between">
                                        <span>${s.tech_name}</span>
                                        <span class="text-green-600">￥${s.price || 0}</span>
                                    </h3>
                                    <p class="text-xs text-yellow-500">${'⭐'.repeat(s.rating || 5)}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>

        <script>
            const mySupabase = window.supabase.createClient('${supabaseUrl}', '${supabaseKey}');
            async function saveStaff() {
                const btn = document.getElementById('submitBtn');
                const file = document.getElementById('fileUpload').files[0];
                const password = document.getElementById('pass').value;
                const name = document.getElementById('name').value;
                const cs = document.getElementById('cs').value;
                const rating = document.getElementById('rating').value;
                const price = document.getElementById('price').value;

                if(!password || !name || !cs || !file || !price) return Swal.fire('提示', '请填完所有信息', 'warning');
                btn.disabled = true; btn.innerText = "上传中...";

                try {
                    const fileName = Date.now() + '_' + file.name;
                    await mySupabase.storage.from('avatars').upload(fileName, file);
                    const mediaUrl = '${supabaseUrl}/storage/v1/object/public/avatars/' + fileName;

                    await fetch('/api/admin', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ password, tech_name: name, media_url: mediaUrl, cs_url: cs, rating, price })
                    });
                    location.reload();
                } catch (err) { alert(err.message); btn.disabled = false; }
            }
            async function deleteStaff(id) {
                const password = document.getElementById('pass').value;
                if(!password) return alert('先在左侧输入密码');
                await fetch('/api/admin', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ password, id, action: 'delete' })});
                location.reload();
            }
        </script>
    </body>
    </html>
  `;
  res.send(html);
};
