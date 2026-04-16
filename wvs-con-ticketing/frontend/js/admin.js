/**
 * 管理后台逻辑
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!API.isLoggedIn()) {
    window.location.href = '/';
    return;
  }

  const user = API.getUser();
  if (!user?.is_admin) {
    showToast('需要管理员权限', 'error');
    window.location.href = '/dashboard';
    return;
  }

  loadAdminDashboard();
  loadAdminOrders();
});

// ---- Tab ----
function switchAdminTab(tab, btn) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  document.getElementById('adminOrdersTab').classList.remove('active');
  document.getElementById('adminUsersTab').classList.remove('active');

  if (tab === 'orders') {
    document.getElementById('adminOrdersTab').classList.add('active');
    loadAdminOrders();
  } else {
    document.getElementById('adminUsersTab').classList.add('active');
    loadAdminUsers();
  }
}

// ---- Dashboard ----
async function loadAdminDashboard() {
  try {
    const data = await API.getAdminDashboard();
    const s = data.stats;
    document.getElementById('adminTotalUsers').textContent = s.total_users;
    document.getElementById('adminTotalOrders').textContent = s.total_orders;
    document.getElementById('adminGrabbing').textContent = s.grabbing;
    document.getElementById('adminSuccess').textContent = s.success;
    document.getElementById('adminFailed').textContent = s.failed;
    document.getElementById('adminSoldOut').textContent = s.sold_out;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- 订单列表 ----
async function loadAdminOrders() {
  const container = document.getElementById('adminOrdersList');
  const status = document.getElementById('orderStatusFilter').value;

  try {
    const data = await API.getAdminOrders({ status: status || undefined, per_page: 50 });
    const orders = data.orders || [];

    if (orders.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:var(--text-dim); padding:40px;">暂无订单</p>';
      return;
    }

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid rgba(255,255,255,0.1);">
              <th style="padding:8px;">ID</th>
              <th style="padding:8px;">用户</th>
              <th style="padding:8px;">类型</th>
              <th style="padding:8px;">场次</th>
              <th style="padding:8px;">时间</th>
              <th style="padding:8px;">状态</th>
              <th style="padding:8px;">订单号</th>
              <th style="padding:8px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:8px; font-weight:600;">#${o.id}</td>
                <td style="padding:8px;">用户${o.user_id}</td>
                <td style="padding:8px;">${o.is_presale ? '💎 预售' : '🎫 公售'}</td>
                <td style="padding:8px;">${o.schedule_label}</td>
                <td style="padding:8px; font-size:0.8rem; color:var(--text-dim);">${o.presale_time || o.open_time || '-'}</td>
                <td style="padding:8px;">${statusBadge(o.status)}</td>
                <td style="padding:8px; font-size:0.8rem; color:var(--success);">${o.order_no || '-'}</td>
                <td style="padding:8px;">
                  <select style="padding:4px 8px; border-radius:6px; background:var(--bg-card); border:1px solid rgba(255,255,255,0.1); color:var(--text); font-size:0.8rem;"
                          onchange="changeOrderStatus(${o.id}, this.value)">
                    <option value="">修改状态</option>
                    <option value="pending">待启动</option>
                    <option value="grabbing">抢票中</option>
                    <option value="success">成功</option>
                    <option value="failed">失败</option>
                    <option value="sold_out">售罄</option>
                    <option value="error">异常</option>
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p style="text-align:center; color:var(--text-muted); font-size:0.8rem; margin-top:12px;">
        共 ${data.total} 条 | 第 ${data.page}/${data.pages} 页
      </p>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--error); padding:20px;">加载失败: ${err.message}</p>`;
  }
}

async function changeOrderStatus(id, newStatus) {
  if (!newStatus) return;
  if (!confirm(`将订单 #${id} 状态改为「${newStatus}」？`)) {
    loadAdminOrders();
    return;
  }

  try {
    await API.updateOrderStatus(id, { status: newStatus });
    showToast('状态已更新', 'success');
    loadAdminOrders();
    loadAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- 用户列表 ----
async function loadAdminUsers() {
  const container = document.getElementById('adminUsersList');

  try {
    const data = await API.getAdminUsers({ per_page: 50 });
    const users = data.users || [];

    if (users.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:var(--text-dim); padding:40px;">暂无用户</p>';
      return;
    }

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid rgba(255,255,255,0.1);">
              <th style="padding:8px;">ID</th>
              <th style="padding:8px;">用户名</th>
              <th style="padding:8px;">邮箱</th>
              <th style="padding:8px;">管理员</th>
              <th style="padding:8px;">预售</th>
              <th style="padding:8px;">注册时间</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:8px; font-weight:600;">#${u.id}</td>
                <td style="padding:8px;">${u.username}</td>
                <td style="padding:8px; color:var(--text-dim);">${u.email}</td>
                <td style="padding:8px;">${u.is_admin ? '👑' : '-'}</td>
                <td style="padding:8px;">${u.has_presale ? '💎' : '-'}</td>
                <td style="padding:8px; color:var(--text-dim); font-size:0.8rem;">${formatTime(u.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--error); padding:20px;">加载失败: ${err.message}</p>`;
  }
}

function formatTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
