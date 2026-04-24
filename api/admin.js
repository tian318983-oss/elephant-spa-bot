const { createClient } = require("@supabase/supabase-js");

// 从 Vercel 环境变量中读取秘钥和密码（彻底脱离硬编码）
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; 
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // 1. 处理后端存储逻辑
  if (req.method === "POST") {
    const { password, tech_name, cs_url, media_url, action, id } = req.body;

    if (!ADMIN_PASSWORD) {
        return res.status(500).send("系统未配置管理员密码，请在 Vercel 中设置 ADMIN_PASSWORD");
    }

    if (password !== ADMIN_PASSWORD) {
      return res.status(403).send("密码错误，无权操作！");
    }

    if (action === "delete") {
      await supabase.from("staff_mapping").delete().eq("id", id);
      return res.send("技师已成功移除");
    } else {
      await supabase.from("staff_mapping").insert([{ tech_name, cs_url, media_url }]);
      return res.send("技师上线成功！");
    }
  }

  // 2. 获取当前技师数据
  const { data: staff } = await supabase.from("staff_mapping").select("*").order("id", { ascending: true });

  // 3. 返回 SaaS 级美化前端页面
  const html = `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🐘 大象 SPA | 高级管理舱</title>
        <!-- 引入高级 UI 框架 Tailwind CSS -->
        <script src="https://cdn.tailwindcss.com"></script>
        <!-- 引入美观的弹窗插件 SweetAlert2 -->
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        <!-- 引入 Supabase 上传引擎 -->
        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
        <style>
            body { background-color: #f3f4f6; }
            .glass-card { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); }
        </style>
    </head>
    <body class="min-h-screen text-gray-800 font-sans p-4 md:p-8">
        
        <!-- 顶部导航 -->
        <header class="max-w-6xl mx-auto mb-8 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">🐘 大象 SPA</h1>
                <p class="text-sm text-gray-500 mt-1">智能私域管理舱 v2.0</p>
            </div>
            <div class="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold shadow-sm">
                系统运行正常
            </div>
        </header>

        <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
            
            <!-- 左侧：新增面板 -->
            <div class="md:col-span-5 space-y-6">
                <div class="glass-card rounded-2xl shadow-xl p-6 border border-gray-100">
                    <h2 class="text-xl font-bold mb-6 flex items-center text-gray-800">
                        <svg class="w-6 h-6 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        上架新技师
                    </h2>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">管理秘钥</label>
                            <input type="password" id="pass" placeholder="输入 Vercel 配置的密码" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">技师称呼</label>
                            <input type="text" id="name" placeholder="如：首席泰式-阿金" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">客服直连链接</label>
                            <input type="text" id="cs" placeholder="如：https://t.me/kefu_01" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">形象照片/短视频 (推荐10MB内)</label>
                            <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-indigo-500 transition-colors bg-gray-50 cursor-pointer" onclick="document.getElementById('fileUpload').click()">
                                <div class="space-y-1 text-center">
                                    <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                    <div class="flex text-sm text-gray-600 justify-center">
                                        <span class="relative cursor-pointer bg-transparent rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                            <span>点击选择文件</span>
                                            <input id="fileUpload" name="fileUpload" type="file" class="sr-only" accept="image/*,video/mp4" onchange="updateFileName(this)">
                                        </span>
                                    </div>
                                    <p class="text-xs text-gray-500" id="fileNameDisplay">支持 PNG, JPG, GIF 或 MP4</p>
                                </div>
                            </div>
                        </div>

                        <button id="submitBtn" onclick="saveStaff()" class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all mt-4">
                            📤 确认上架
                        </button>
                    </div>
                </div>
            </div>

            <!-- 右侧：当前阵容 -->
            <div class="md:col-span-7">
                <div class="glass-card rounded-2xl shadow-xl p-6 border border-gray-100 min-h-[500px]">
                    <h2 class="text-xl font-bold mb-6 flex items-center text-gray-800">
                        <svg class="w-6 h-6 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        当前服务阵容
                    </h2>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        ${staff.map(s => `
                            <div class="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow relative group">
                                <div class="h-40 w-full bg-gray-100 overflow-hidden relative">
                                    ${s.media_url?.includes('.mp4') ? 
                                      `<video src="${s.media_url}" class="w-full h-full object-cover" autoplay loop muted></video>` : 
                                      `<img src="${s.media_url || 'https://via.placeholder.com/400x300?text=无图片'}" class="w-full h-full object-cover">`
                                    }
                                    <div class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onclick="deleteStaff(${s.id})" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg transform transition-transform hover:scale-105">
                                            下架技师
                                        </button>
                                    </div>
                                </div>
                                <div class="p-4">
                                    <h3 class="font-bold text-gray-900 truncate">${s.tech_name}</h3>
                                    <a href="${s.cs_url}" target="_blank" class="text-xs text-indigo-500 hover:text-indigo-700 truncate block mt-1">查看客服链接 ↗</a>
                                </div>
                            </div>
                        `).join('') || '<div class="col-span-full text-center py-12 text-gray-400">目前暂无技师，请在左侧添加</div>'}
                    </div>
                </div>
            </div>
        </div>

        <script>
            const supabase = supabase.createClient('${supabaseUrl}', '${supabaseKey}');

            function updateFileName(input) {
                const display = document.getElementById('fileNameDisplay');
                if (input.files && input.files[0]) {
                    display.innerText = '已选择: ' + input.files[0].name;
                    display.classList.add('text-indigo-600', 'font-semibold');
                }
            }

            async function saveStaff() {
                const btn = document.getElementById('submitBtn');
                const file = document.getElementById('fileUpload').files[0];
                const password = document.getElementById('pass').value;
                const name = document.getElementById('name').value;
                const cs = document.getElementById('cs').value;

                if(!password || !name || !cs || !file) {
                    return Swal.fire('信息不完整', '密码、名字、客服和照片缺一不可！', 'warning');
                }

                btn.innerHTML = '<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 云端上传中...';
                btn.disabled = true;

                try {
                    const fileExt = file.name.split('.').pop();
                    const fileName = Date.now() + '_' + Math.random().toString(36).substring(7) + '.' + fileExt;
                    
                    const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
                    if (uploadError) throw new Error(uploadError.message);
                    
                    const mediaUrl = '${supabaseUrl}/storage/v1/object/public/avatars/' + fileName;

                    const res = await fetch('/api/admin', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ password, tech_name: name, media_url: mediaUrl, cs_url: cs })
                    });
                    
                    if(res.status !== 200) throw new Error(await res.text());

                    await Swal.fire('太棒了！', await res.text(), 'success');
                    location.reload();
                } catch (err) {
                    Swal.fire('发生错误', err.message, 'error');
                    btn.innerHTML = '📤 确认上架';
                    btn.disabled = false;
                }
            }

            async function deleteStaff(id) {
                const result = await Swal.fire({
                    title: '危险操作',
                    text: "确定要下架这位技师吗？操作不可逆！",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#9ca3af',
                    confirmButtonText: '是的，下架',
                    cancelButtonText: '取消'
                });

                if (result.isConfirmed) {
                    const password = document.getElementById('pass').value;
                    if(!password) return Swal.fire('提示', '请在左侧输入管理密码后再点击删除', 'info');

                    try {
                        const res = await fetch('/api/admin', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ password, id, action: 'delete' })
                        });
                        
                        if(res.status !== 200) throw new Error(await res.text());
                        
                        await Swal.fire('已清除', await res.text(), 'success');
                        location.reload();
                    } catch (err) {
                        Swal.fire('删除失败', err.message, 'error');
                    }
                }
            }
        </script>
    </body>
    </html>
  `;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
};
