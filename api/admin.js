const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; 
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // 【核心修复 A】：加入大厂级 BI 数据中台的反缓存指令，保证每次 F5 刷新都是绝对的实时数据！
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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
  
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: logs } = await supabase.from("user_logs").select("*").gte("created_at", thirtyDaysAgo).order("created_at", { ascending: true });

  const html = `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🐘 大象 SPA | 商业智能数据舱</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
        <!-- 引入 Chart.js 及 数据标签直显插件 -->
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
        <style>
            body { background-color: #f3f4f6; display: flex; min-height: 100vh; }
            .sidebar { width: 250px; background-color: #1e293b; color: white; display: flex; flex-direction: column; }
            .main-content { flex-grow: 1; padding: 2rem; overflow-y: auto; height: 100vh;}
            .menu-item { padding: 1rem 1.5rem; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 0.5rem; }
            .menu-item:hover, .menu-item.active { background-color: #334155; border-left: 4px solid #3b82f6; }
            .glass-card { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); padding: 1.5rem; }
            .page-section { display: none; animation: fadeIn 0.4s; }
            .page-section.active { display: block; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            
            /* 为图表提供绝对安全的物理隔离舱，防止渲染卡死 */
            .chart-container { position: relative; height: 320px; width: 100%; }
        </style>
    </head>
    <body>
        
        <div class="sidebar">
            <div class="p-6 font-extrabold text-2xl tracking-wider border-b border-gray-700">
                🐘 大象 SPA<br><span class="text-xs text-blue-400 font-normal">SaaS 数据中台 v7.1</span>
            </div>
            <div class="flex-grow py-4">
                <div class="menu-item active" onclick="switchTab('analytics', this)">📊 商业数据看板</div>
                <div class="menu-item" onclick="switchTab('list', this)">👥 当值技师阵列</div>
                <div class="menu-item" onclick="switchTab('add', this)">➕ 上架新技师</div>
            </div>
            <div class="p-4 text-xs text-gray-500 border-t border-gray-700 text-center">
                System Online | Web3 Mode
            </div>
        </div>

        <div class="main-content">
            
            <div id="analytics" class="page-section active">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">商业数据看板</h2>
                    <span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold shadow-sm">实时埋点已接入</span>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div class="glass-card">
                        <h3 class="text-lg font-bold mb-4 text-gray-700">📈 近期流量趋势图 (访问人次)</h3>
                        <div class="chart-container">
                            <canvas id="trafficChart"></canvas>
                        </div>
                    </div>
                    <div class="glass-card">
                        <h3 class="text-lg font-bold mb-4 text-gray-700">🔥 技师名片被点击热度</h3>
                        <div class="chart-container">
                            <canvas id="techPopularityChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <div id="list" class="page-section">
                <h2 class="text-2xl font-bold text-gray-800 mb-6">当前当值阵容</h2>
                <div class="glass-card">
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        ${staff.map(s => `
                            <div class="bg-white border rounded-xl overflow-hidden hover:shadow-xl transition-all relative group">
                                <div class="h-48 bg-gray-100 relative">
                                    <img src="${s.media_url}" class="w-full h-full object-cover">
                                    <button onclick="deleteStaff(${s.id})" class="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">下架</button>
                                </div>
                                <div class="p-4">
                                    <h3 class="font-bold flex justify-between items-center">
                                        <span class="truncate pr-2">${s.tech_name}</span>
                                        <span class="text-blue-600 font-black whitespace-nowrap">$${s.price || 0}</span>
                                    </h3>
                                    <p class="text-xs text-yellow-500 mt-1">${'⭐'.repeat(s.rating || 5)}</p>
                                    <a href="${s.cs_url}" target="_blank" class="text-xs text-gray-400 hover:text-blue-600 block mt-2">核销客服链接 ↗</a>
                                </div>
                            </div>
                        `).join('') || '<div class="col-span-full text-center py-12 text-gray-400">目前暂无技师，请去添加</div>'}
                    </div>
                </div>
            </div>

            <div id="add" class="page-section">
                <h2 class="text-2xl font-bold text-gray-800 mb-6">新增与上架</h2>
                <div class="glass-card max-w-2xl mx-auto">
                    <div class="space-y-5">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">管理员口令</label>
                            <input type="password" id="pass" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">技师称呼</label>
                            <input type="text" id="name" placeholder="如：美柚" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div class="flex gap-4">
                            <div class="w-1/2">
                                <label class="block text-sm font-bold text-gray-700 mb-1">星级</label>
                                <select id="rating" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"><option value="5">⭐⭐⭐⭐⭐</option><option value="4">⭐⭐⭐⭐</option><option value="3">⭐⭐⭐</option></select>
                            </div>
                            <div class="w-1/2">
                                <label class="block text-sm font-bold text-blue-600 mb-1">定金/服务费 (USDT)</label>
                                <input type="number" id="price" placeholder="如：15" class="w-full px-4 py-2 border border-blue-300 rounded-lg text-blue-700 font-bold focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">专属客服对接链接</label>
                            <input type="text" id="cs" placeholder="https://t.me/..." class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">形象照片</label>
                            <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors" onclick="document.getElementById('fileUpload').click()">
                                <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                                <p class="text-sm text-blue-600 font-bold mt-2" id="fileNameDisplay">点击浏览文件</p>
                                <input id="fileUpload" type="file" class="sr-only" accept="image/*,video/mp4" onchange="document.getElementById('fileNameDisplay').innerText = '已选: '+this.files[0].name">
                            </div>
                        </div>
                        <button id="submitBtn" onclick="saveStaff()" class="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-lg transition-colors shadow-lg">📤 确认上架并开启 USDT 收单</button>
                    </div>
                </div>
            </div>
            
        </div>

        <script>
            function switchTab(tabId, element) {
                document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');
                element.classList.add('active');
            }

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
                btn.disabled = true; btn.innerText = "数据加密上传中...";

                try {
                    const fileName = Date.now() + '_' + file.name;
                    await mySupabase.storage.from('avatars').upload(fileName, file);
                    const mediaUrl = '${supabaseUrl}/storage/v1/object/public/avatars/' + fileName;

                    await fetch('/api/admin', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ password, tech_name: name, media_url: mediaUrl, cs_url: cs, rating, price })
                    });
                    
                    await Swal.fire('成功', '技师已上线！', 'success');
                    location.reload();
                } catch (err) { Swal.fire('错误', err.message, 'error'); btn.disabled = false; btn.innerText = "确认上架并开启 USDT 收单"; }
            }

            async function deleteStaff(id) {
                const password = document.getElementById('pass').value;
                if(!password) return Swal.fire('拦截', '请先在左侧输入管理秘钥', 'error');
                if(!confirm('危险：确定要下架此技师吗？')) return;
                
                await fetch('/api/admin', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ password, id, action: 'delete' })});
                location.reload();
            }

            // === 注册全局数据直显插件 ===
            Chart.register(ChartDataLabels);

            const rawLogs = ${JSON.stringify(logs || [])};
            const staffList = ${JSON.stringify(staff || [])};

            // 1. 处理曲线图数据
            const dailyData = {};
            
            // 【核心修复 B】：防白屏兜底机制。即使数据库因为 RLS 锁定导致目前是 0 条数据，
            // 也会强行画出“今天”的坐标轴，让老板看着舒服。
            const todayStr = new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
            dailyData[todayStr] = { start: 0, view: 0 };

            rawLogs.forEach(log => {
                const date = new Date(log.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
                if(!dailyData[date]) dailyData[date] = { start: 0, view: 0 };
                
                if(log.action_type === 'START_BOT') dailyData[date].start++;
                if(log.action_type === 'CLICK_TECH_LIST') dailyData[date].view++;
            });

            const labelsLine = Object.keys(dailyData);
            const dataStart = labelsLine.map(date => dailyData[date].start);
            const dataView = labelsLine.map(date => dailyData[date].view);

            new Chart(document.getElementById('trafficChart'), {
                type: 'line',
                data: {
                    labels: labelsLine,
                    datasets: [
                        { 
                            label: '机器人启动人次', 
                            data: dataStart, 
                            borderColor: '#94a3b8', 
                            tension: 0.4, 
                            pointBackgroundColor: '#94a3b8',
                            datalabels: { color: '#94a3b8', align: 'top', font: {weight: 'bold'} } 
                        },
                        { 
                            label: '点开技师列表数', 
                            data: dataView, 
                            borderColor: '#3b82f6', 
                            tension: 0.4, 
                            fill: true, 
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            pointBackgroundColor: '#3b82f6',
                            datalabels: { color: '#3b82f6', align: 'bottom', font: {weight: 'bold'} } 
                        }
                    ]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                        datalabels: {
                            // 只有当数字大于0时才显示标签，保证图表清爽
                            formatter: function(value) { return value > 0 ? value : ''; }
                        }
                    },
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            ticks: { precision: 0 },
                            // 【防白屏】：强制 Y 轴最小也要有个 5 的高度，显得图表有空间感
                            suggestedMax: 5 
                        } 
                    }
                }
            });

            // 2. 处理柱状图数据
            const techClicks = {};
            rawLogs.forEach(log => {
                if(log.action_type && log.action_type.startsWith('PREVIEW_TECH_ID_')) {
                    const techId = log.action_type.split('_').pop();
                    techClicks[techId] = (techClicks[techId] || 0) + 1;
                }
            });

            const labelsBar = [];
            const dataBar = [];
            staffList.forEach(s => {
                labelsBar.push(s.tech_name);
                dataBar.push(techClicks[s.id] || 0);
            });

            new Chart(document.getElementById('techPopularityChart'), {
                type: 'bar',
                data: {
                    labels: labelsBar,
                    datasets: [{
                        label: '名片被点击次数',
                        data: dataBar,
                        backgroundColor: '#60a5fa',
                        borderRadius: 6,
                        datalabels: { color: '#ffffff', align: 'center', font: {weight: 'bold', size: 14} } 
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                        datalabels: {
                            formatter: function(value) { return value > 0 ? value : ''; }
                        }
                    },
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            ticks: { precision: 0 },
                            suggestedMax: 5 
                        } 
                    }
                }
            });
        </script>
    </body>
    </html>
  `;
  res.send(html);
};
