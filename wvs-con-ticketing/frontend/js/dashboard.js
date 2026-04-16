/**
 * 控制台逻辑
 */

let currentOrderTab = 'presale';
let refreshTimer = null;

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', () => {
  if (!API.isLoggedIn()) {
    window.location.href = '/';
    return;
  }

  const user = API.getUser();
  if (user?.is_admin) {
    const adminLink = document.getElementById('adminLink');
    if (adminLink) adminLink.style.display = '';
  }

  loadSettings();
  loadOrders();
  loadStats();

  // 自动刷新
  refreshTimer = setInterval(() => {
    loadOrders();
    loadStats();
  }, 10000);
});

// ---- 设置 ----
function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  const btn = document.getElementById('toggleSettingsBtn');
  panel.classList.toggle('hidden');
  btn.textContent = panel.classList.contains('hidden') ? '展开' : '收起';
}

async function loadSettings() {
  try {
    const user = await API.getMe();
    API.setUser(user);
    document.getElementById('settingInterparkId').value = user.interpark_id || '';
    document.getElementById('settingWeverseId').value = user.weverse_id || '';
    document.getElementById('settingHasPresale').checked = !!user.has_presale;
  } catch (err) {
    console.error('加载设置失败:', err);
  }
}

async function saveSettings() {
  try {
    const data = {
      interpark_id: document.getElementById('settingInterparkId').value.trim(),
      weverse_id: document.getElementById('settingWeverseId').value.trim(),
      has_presale: document.getElementById('settingHasPresale').checked,
    };

    const pw = document.getElementById('settingInterparkPw').value;
    if (pw) data.interpark_pw = pw;

    await API.updateProfile(data);
    showToast('设置已保存', 'success');
    document.getElementById('settingInterparkPw').value = '';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- Tab 切换 ----
function switchOrderTab(tab) {
  currentOrderTab = tab;
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');

  const presaleGroup = document.getElementById('presaleTimeGroup');
  if (tab === 'presale') {
    presaleGroup.style.display = '';
  } else {
    presaleGroup.style.display = 'none';
  }
}

// ---- 座位选择器 ----
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.seat-option input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.seat-option').classList.toggle('selected', cb.checked);
    });
  });
});

function getSelectedSeats() {
  const checkboxes = document.querySelectorAll('.seat-option input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

// ---- 创建订单 ----
async function createOrder(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '创建中...';

  try {
    const perfUrl = document.getElementById('orderPerfUrl').value.trim();
    const scheduleIndex = parseInt(document.getElementById('orderSchedule').value);
    const tabCount = parseInt(document.getElementById('orderTabs').value);
    const openTimeRaw = document.getElementById('orderOpenTime').value;
    const presaleTimeRaw = document.getElementById('orderPresaleTime').value;
    const proxy = document.getElementById('orderProxy').value.trim();
    const seatPrefs = getSelectedSeats();

    // 转换时间格式: datetime-local -> "YYYY-MM-DD HH:MM:SS"
    let openTime = '';
    let presaleTime = '';
    if (openTimeRaw) {
      openTime = openTimeRaw.replace('T', ':00 ').length === 19
        ? openTimeRaw.replace('T', ' ') + ':00'
        : openTimeRaw.replace('T', ' ');
      // 格式: 2026-06-14T20:00 -> 2026-06-14 20:00:00
      openTime = openTimeRaw.replace('T', ' ') + ':00';
    }
    if (presaleTimeRaw) {
      presaleTime = presaleTimeRaw.replace('T', ' ') + ':00';
    }

    if (!perfUrl) throw new Error('请填写演出 URL');
    if (!openTime && !presaleTime) throw new Error('请设置开售时间');

    const data = await API.createOrder({
      perf_url: perfUrl,
      schedule_index: scheduleIndex,
      schedule_label: scheduleIndex === 0 ? 'Day 1' : 'Day 2',
      seat_prefs: seatPrefs,
      tab_count: tabCount,
      open_time: openTime,
      presale_time: presaleTime,
      proxy: proxy,
    });

    showToast('✅ 订单创建成功！', 'success');
    document.getElementById('orderForm').reset();
    // 重置座位选择
    document.querySelectorAll('.seat-option').forEach(opt => {
      const cb = opt.querySelector('input');
      const idx = parseInt(cb.value);
      cb.checked = idx <= 4;
      opt.classList.toggle('selected', cb.checked);
    });

    loadOrders();
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 创建抢票订单';
  }
}

// ---- 订单列表 ----
async function loadOrders() {
  try {
    const data = await API.getOrders({ per_page: 20 });
    renderOrders(data.orders);
  } catch (err) {
    document.getElementById('ordersList').innerHTML =
      `<p style="text-align:center; color:var(--error); padding:40px;">加载失败: ${err.message}</p>`;
  }
}

function renderOrders(orders) {
  const container = document.getElementById('ordersList');

  if (!orders || orders.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--text-dim); padding:40px;">暂无订单，创建你的第一个抢票订单吧 🎫</p>`;
    return;
  }

  container.innerHTML = orders.map(o => `
    <div class="order-item">
      <div class="order-top">
        <span class="order-id">#${o.id} ${o.is_presale ? '💎 预售' : '🎫 公售'}</span>
        <div style="display:flex;align-items:center;gap:12px;">
          ${statusBadge(o.status)}
          <span class="order-time">${formatTime(o.created_at)}</span>
        </div>
      </div>
      <div class="order-details">
        <div class="order-detail">
          <span class="order-detail-label">场次</span>
          <span class="order-detail-value">${o.schedule_label}</span>
        </div>
        <div class="order-detail">
          <span class="order-detail-label">开售时间</span>
          <span class="order-detail-value">${o.presale_time || o.open_time || '未设置'}</span>
        </div>
        <div class="order-detail">
          <span class="order-detail-label">标签页</span>
          <span class="order-detail-value">${o.tab_count} 个</span>
        </div>
        <div class="order-detail">
          <span class="order-detail-label">座位偏好</span>
          <span class="order-detail-value">${(o.seat_prefs || []).map(s => SEAT_LABELS[s] || s).join(' > ')}</span>
        </div>
        ${o.order_no ? `
        <div class="order-detail">
          <span class="order-detail-label">订单号</span>
          <span class="order-detail-value" style="color:var(--success);">${o.order_no}</span>
        </div>` : ''}
      </div>
      <div class="order-actions">
        <button class="btn btn-sm btn-secondary" onclick="viewOrderDetail(${o.id})">📋 详情</button>
        ${o.status === 'pending' || o.status === 'failed' || o.status === 'error' ?
          `<button class="btn btn-sm btn-success" onclick="startOrder(${o.id})">🚀 启动</button>` : ''}
        ${o.status === 'pending' ?
          `<button class="btn btn-sm btn-secondary" onclick="editOrder(${o.id})">✏️ 编辑</button>` : ''}
        ${o.status !== 'grabbing' ?
          `<button class="btn btn-sm btn-danger" onclick="deleteOrder(${o.id})">🗑️ 删除</button>` : ''}
      </div>
    </div>
  `).join('');
}

// ---- 统计 ----
async function loadStats() {
  try {
    const data = await API.getOrders({ per_page: 100 });
    const orders = data.orders || [];

    document.getElementById('statTotal').textContent = orders.length;
    document.getElementById('statPending').textContent = orders.filter(o => ['pending', 'waiting'].includes(o.status)).length;
    document.getElementById('statGrabbing').textContent = orders.filter(o => o.status === 'grabbing').length;
    document.getElementById('statSuccess').textContent = orders.filter(o => o.status === 'success').length;
  } catch (err) {
    console.error('加载统计失败:', err);
  }
}

// ---- 操作 ----
async function startOrder(id) {
  if (!confirm('确定启动抢票？')) return;
  try {
    const data = await API.startGrabber(id);
    showToast(data.message || '已启动', 'success');
    loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteOrder(id) {
  if (!confirm('确定删除此订单？')) return;
  try {
    await API.deleteOrder(id);
    showToast('已删除', 'success');
    loadOrders();
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewOrderDetail(id) {
  try {
    const order = await API.getOrder(id);
    const content = document.getElementById('orderDetailContent');

    content.innerHTML = `
      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3>订单 #${order.id}</h3>
          ${statusBadge(order.status)}
        </div>
        <div class="order-details">
          <div class="order-detail"><span class="order-detail-label">演出 URL</span><span class="order-detail-value" style="word-break:break-all;font-size:0.8rem;">${order.perf_url}</span></div>
          <div class="order-detail"><span class="order-detail-label">场次</span><span class="order-detail-value">${order.schedule_label}</span></div>
          <div class="order-detail"><span class="order-detail-label">预售时间</span><span class="order-detail-value">${order.presale_time || '无'}</span></div>
          <div class="order-detail"><span class="order-detail-label">开售时间</span><span class="order-detail-value">${order.open_time || '无'}</span></div>
          <div class="order-detail"><span class="order-detail-label">标签页</span><span class="order-detail-value">${order.tab_count}</span></div>
          <div class="order-detail"><span class="order-detail-label">创建时间</span><span class="order-detail-value">${formatTime(order.created_at)}</span></div>
          ${order.order_no ? `<div class="order-detail"><span class="order-detail-label">订单号</span><span class="order-detail-value" style="color:var(--success);">${order.order_no}</span></div>` : ''}
        </div>
      </div>

      <div>
        <h4 style="margin-bottom:12px;">📜 运行日志</h4>
        <div class="log-panel" id="logPanel">
          ${(order.logs || []).map(l => `
            <div class="log-entry level-${l.level.toLowerCase()}">
              <span class="log-time">${formatLogTime(l.created_at)}</span>
              <span class="log-msg">${l.message}</span>
            </div>
          `).join('') || '<p style="color:var(--text-dim);">暂无日志</p>'}
        </div>
      </div>
    `;

    openModal('orderDetailModal');

    // 滚动到底部
    const logPanel = document.getElementById('logPanel');
    if (logPanel) logPanel.scrollTop = logPanel.scrollHeight;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editOrder(id) {
  // 简化编辑：直接用 prompt
  try {
    const order = await API.getOrder(id);
    const newUrl = prompt('演出 URL:', order.perf_url);
    if (newUrl === null) return;

    await API.updateOrder(id, { perf_url: newUrl });
    showToast('更新成功', 'success');
    loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- 工具函数 ----
function formatTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatLogTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// 页面离开时清理定时器
window.addEventListener('beforeunload', () => {
  if (refreshTimer) clearInterval(refreshTimer);
});
