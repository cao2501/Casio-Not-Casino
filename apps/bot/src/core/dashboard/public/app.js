// --------------------------------------------------
// Kini Bot Dashboard - Frontend Javascript Logic
// --------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Tab Navigation Setup
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  const sections = document.querySelectorAll('.dashboard-section');
  const pageTitle = document.getElementById('pageTitle');

  const titles = {
    overview: 'Tổng Quan Hệ Thống',
    settings: 'Luật Chơi & Tỉ Lệ',
    leaderboard: 'Bảng Xếp Hạng Người Chơi',
    permissions: 'Quyền Hạn Lệnh'
  };

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      
      // Update active menu class
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Show selected section, hide others
      sections.forEach(sec => {
        if (sec.id === `section-${tabName}`) {
          sec.classList.remove('hidden');
        } else {
          sec.classList.add('hidden');
        }
      });

      // Update Page Title
      pageTitle.textContent = titles[tabName] || 'Dashboard';

      // Load specific data on tab change
      if (tabName === 'settings') {
        loadSettings();
      } else if (tabName === 'leaderboard') {
        loadLeaderboard();
      } else if (tabName === 'permissions') {
        loadPermissionsTab();
      }
    });
  });

  // Logout Button
  const btnLogout = document.getElementById('btnLogout');
  btnLogout.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/';
      }
    } catch (err) {
      showToast('Lỗi khi đăng xuất', 'error');
    }
  });

  // Uptime Formatter Helper
  function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor((seconds % (3600*24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    
    return parts.join(' ');
  }

  // Socket.io Setup for Real-time Stats
  const socket = io();
  const botStatusBadge = document.getElementById('botStatusBadge');
  const botStatusText = document.getElementById('botStatusText');

  socket.on('connect', () => {
    botStatusBadge.className = 'bot-badge-status';
    botStatusText.textContent = 'BOT ONLINE';
  });

  socket.on('disconnect', () => {
    botStatusBadge.className = 'bot-badge-status maintenance';
    botStatusText.textContent = 'MẤT KẾT NỐI';
  });

  socket.on('bot_stats', (stats) => {
    document.getElementById('stat-guilds').textContent = stats.guildsCount.toLocaleString();
    document.getElementById('stat-users').textContent = stats.usersCount.toLocaleString();
    document.getElementById('stat-uptime').textContent = formatUptime(stats.uptime);
    document.getElementById('stat-ram-used').textContent = `${stats.memory.heapUsed} MB`;
    document.getElementById('stat-ram-total').textContent = `${stats.memory.heapTotal} MB`;
    
    // Toggle maintenance state in UI
    const maintenanceToggle = document.getElementById('maintenanceToggle');
    if (maintenanceToggle && !window.isUpdatingMaintenance) {
      maintenanceToggle.checked = stats.maintenanceMode;
    }
  });

  // Load Status initially (mainly for non-socket statistics)
  async function loadInitialStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        document.getElementById('stat-commands').textContent = data.commandsCount;
        document.getElementById('stat-guilds').textContent = data.guildsCount;
        document.getElementById('stat-users').textContent = data.usersCount;
        document.getElementById('stat-uptime').textContent = formatUptime(data.uptime);
        document.getElementById('stat-ram-used').textContent = `${data.memory.heapUsed} MB`;
        document.getElementById('stat-ram-total').textContent = `${data.memory.heapTotal} MB`;
        
        const maintenanceToggle = document.getElementById('maintenanceToggle');
        if (maintenanceToggle) {
          maintenanceToggle.checked = data.maintenanceMode;
        }
      }
    } catch {}
  }
  loadInitialStatus();

  // Maintenance Toggle Event Handler
  window.isUpdatingMaintenance = false;
  const maintenanceToggle = document.getElementById('maintenanceToggle');
  maintenanceToggle.addEventListener('change', async (e) => {
    window.isUpdatingMaintenance = true;
    maintenanceToggle.disabled = true;
    try {
      const res = await fetch('/api/status/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: e.target.checked })
      });
      if (res.ok) {
        const status = e.target.checked ? 'ĐÃ BẬT chế độ bảo trì' : 'ĐÃ TẮT chế độ bảo trì';
        showToast(status, 'success');
      } else {
        e.target.checked = !e.target.checked; // Revert
        showToast('Không thể cập nhật trạng thái bảo trì', 'error');
      }
    } catch {
      e.target.checked = !e.target.checked;
      showToast('Lỗi kết nối máy chủ', 'error');
    } finally {
      window.isUpdatingMaintenance = false;
      maintenanceToggle.disabled = false;
    }
  });

  // Slider Interactive UI Real-time display
  const setupSlider = (sliderId, valueId, warningId) => {
    const slider = document.getElementById(sliderId);
    const valueDisp = document.getElementById(valueId);
    const warning = document.getElementById(warningId);

    const updateSliderUI = (val) => {
      valueDisp.textContent = `${val}%`;
      if (val > 70) {
        warning.classList.remove('hidden');
      } else {
        warning.classList.add('hidden');
      }
    };

    slider.addEventListener('input', (e) => {
      updateSliderUI(e.target.value);
    });

    return updateSliderUI;
  };

  const updateBjSliderUI = setupSlider('bj-winrate', 'bj-winrate-val', 'bj-warning');
  const updatePokerSliderUI = setupSlider('poker-winrate', 'poker-winrate-val', 'poker-warning');

  // Load Settings
  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        
        // Blackjack
        document.getElementById('bj-minbet').value = data.blackjack.minBet;
        document.getElementById('bj-maxbet').value = data.blackjack.maxBet;
        document.getElementById('bj-timeout').value = data.blackjack.timeoutSeconds;
        document.getElementById('bj-winrate').value = Math.round(data.blackjack.botWinRate * 100);
        updateBjSliderUI(Math.round(data.blackjack.botWinRate * 100));

        // Poker
        document.getElementById('poker-minbet').value = data.poker.minBet;
        document.getElementById('poker-maxbet').value = data.poker.maxBet;
        document.getElementById('poker-timeout').value = data.poker.timeoutSeconds;
        document.getElementById('poker-winrate').value = Math.round(data.poker.botWinRate * 100);
        updatePokerSliderUI(Math.round(data.poker.botWinRate * 100));
      } else {
        showToast('Không thể tải cấu hình', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ', 'error');
    }
  }

  // Save Settings Form
  const settingsForm = document.getElementById('settingsForm');
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const bjMin = parseInt(document.getElementById('bj-minbet').value);
    const bjMax = parseInt(document.getElementById('bj-maxbet').value);
    const pokerMin = parseInt(document.getElementById('poker-minbet').value);
    const pokerMax = parseInt(document.getElementById('poker-maxbet').value);

    if (bjMin >= bjMax) {
      showToast('Blackjack: Cược tối đa phải lớn hơn cược tối thiểu!', 'error');
      return;
    }
    if (pokerMin >= pokerMax) {
      showToast('Poker: Cược tối đa phải lớn hơn cược tối thiểu!', 'error');
      return;
    }

    const payload = {
      blackjack: {
        minBet: bjMin,
        maxBet: bjMax,
        timeoutSeconds: parseInt(document.getElementById('bj-timeout').value),
        botWinRate: parseFloat(document.getElementById('bj-winrate').value) / 100,
        maxCards: 5
      },
      poker: {
        minBet: pokerMin,
        maxBet: pokerMax,
        timeoutSeconds: parseInt(document.getElementById('poker-timeout').value),
        botWinRate: parseFloat(document.getElementById('poker-winrate').value) / 100
      }
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        showToast('Đã lưu cấu hình trò chơi thành công', 'success');
      } else {
        showToast('Không thể lưu cấu hình', 'error');
      }
    } catch {
      showToast('Lỗi lưu cấu hình', 'error');
    }
  });

  // Reset Settings to Default Button
  const btnResetSettings = document.getElementById('btnResetSettings');
  btnResetSettings.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn khôi phục tất cả thiết lập game về mặc định (50% Winrate)?')) {
      // Set values back in inputs
      document.getElementById('bj-minbet').value = 1;
      document.getElementById('bj-maxbet').value = 1000000000;
      document.getElementById('bj-timeout').value = 120;
      document.getElementById('bj-winrate').value = 50;
      updateBjSliderUI(50);

      document.getElementById('poker-minbet').value = 1;
      document.getElementById('poker-maxbet').value = 1000000000;
      document.getElementById('poker-timeout').value = 120;
      document.getElementById('poker-winrate').value = 50;
      updatePokerSliderUI(50);

      showToast('Mẫu mặc định được load tạm thời. Vui lòng bấm "Lưu Cấu Hình" để ghi nhận lên DB.', 'success');
    }
  });

  // Load Leaderboard
  async function loadLeaderboard() {
    const coinsBody = document.getElementById('leaderboard-coins-body');
    const vndBody = document.getElementById('leaderboard-vnd-body');

    coinsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Đang tải dữ liệu...</td></tr>';
    vndBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Đang tải dữ liệu...</td></tr>';

    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        
        // Coins Leaderboard render
        if (data.topCoins.length === 0) {
          coinsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Chưa có dữ liệu</td></tr>';
        } else {
          coinsBody.innerHTML = '';
          data.topCoins.forEach((player, i) => {
            const tr = document.createElement('tr');
            tr.className = `rank-${i + 1}`;
            tr.innerHTML = `
              <td><span class="rank-badge">${i + 1}</span></td>
              <td>
                <div class="user-cell">
                  <span class="username">@${player.username}</span>
                </div>
              </td>
              <td class="amount-cell" style="text-align: right;">${player.balance.toLocaleString()} Coins</td>
            `;
            coinsBody.appendChild(tr);
          });
        }

        // VND Leaderboard render
        if (data.topVnd.length === 0) {
          vndBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Chưa có dữ liệu</td></tr>';
        } else {
          vndBody.innerHTML = '';
          data.topVnd.forEach((player, i) => {
            const tr = document.createElement('tr');
            tr.className = `rank-${i + 1}`;
            tr.innerHTML = `
              <td><span class="rank-badge">${i + 1}</span></td>
              <td>
                <div class="user-cell">
                  <span class="username">@${player.username}</span>
                </div>
              </td>
              <td class="amount-cell vnd-style" style="text-align: right;">${player.vnd.toLocaleString('vi-VN')} ₫</td>
            `;
            vndBody.appendChild(tr);
          });
        }
      } else {
        coinsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#EF4444;">Không thể tải bảng xếp hạng</td></tr>';
        vndBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#EF4444;">Không thể tải bảng xếp hạng</td></tr>';
      }
    } catch {
      coinsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#EF4444;">Lỗi kết nối máy chủ</td></tr>';
      vndBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#EF4444;">Lỗi kết nối máy chủ</td></tr>';
    }
  }

  // Toast Notification Helper
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let emoji = '🔔';
    if (type === 'success') emoji = '✅';
    if (type === 'error') emoji = '❌';

    toast.innerHTML = `<span>${emoji}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  // --- COMMAND PERMISSIONS TAB LOGIC ---
  let currentGuildId = '';
  let currentRoles = [];
  let currentCommands = [];
  let currentConfigPermissions = {};

  async function loadPermissionsTab() {
    const guildSelect = document.getElementById('guildSelect');
    const configContainer = document.getElementById('permissionsConfigContainer');
    
    guildSelect.innerHTML = '<option value="" disabled selected>Đang tải danh sách máy chủ...</option>';
    configContainer.classList.add('hidden');

    try {
      const res = await fetch('/api/permissions/guilds');
      if (res.ok) {
        const guilds = await res.json();
        guildSelect.innerHTML = '<option value="" disabled selected>-- Chọn một Máy Chủ (Guild) --</option>';
        guilds.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = g.name;
          guildSelect.appendChild(opt);
        });
      } else {
        showToast('Không thể tải danh sách máy chủ', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ', 'error');
    }
  }

  // Guild Select change listener
  const guildSelect = document.getElementById('guildSelect');
  if (guildSelect) {
    guildSelect.addEventListener('change', async (e) => {
      currentGuildId = e.target.value;
      const configContainer = document.getElementById('permissionsConfigContainer');
      const rolesBody = document.getElementById('roles-permissions-body');
      const commandSelect = document.getElementById('commandSelect');

      rolesBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Đang tải cấu hình quyền...</td></tr>';
      commandSelect.innerHTML = '<option value="" disabled selected>Đang tải danh sách lệnh...</option>';
      configContainer.classList.remove('hidden');

      try {
        // Fetch roles and commands in parallel
        const [resRoles, resCommands] = await Promise.all([
          fetch(`/api/permissions/${currentGuildId}/roles`),
          fetch(`/api/permissions/${currentGuildId}/commands`)
        ]);

        if (resRoles.ok && resCommands.ok) {
          currentRoles = await resRoles.json();
          const cmdData = await resCommands.json();
          currentCommands = cmdData.commands;
          currentConfigPermissions = cmdData.permissions;

          // Render command select options
          commandSelect.innerHTML = '';
          currentCommands.forEach((cmd, i) => {
            const opt = document.createElement('option');
            opt.value = cmd.name;
            opt.textContent = `/${cmd.name} - ${cmd.description || 'Không có mô tả'}`;
            if (i === 0) opt.selected = true;
            commandSelect.appendChild(opt);
          });

          // Trigger first command permissions render
          renderRolesPermissionsTable(commandSelect.value);
        } else {
          showToast('Lỗi tải thông tin máy chủ', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối máy chủ', 'error');
      }
    });
  }

  // Command Select change listener
  const commandSelect = document.getElementById('commandSelect');
  if (commandSelect) {
    commandSelect.addEventListener('change', (e) => {
      renderRolesPermissionsTable(e.target.value);
    });
  }

  function renderRolesPermissionsTable(commandName) {
    const rolesBody = document.getElementById('roles-permissions-body');
    if (!rolesBody) return;
    rolesBody.innerHTML = '';

    if (currentRoles.length === 0) {
      rolesBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Máy chủ không có vai trò custom nào (ngoại trừ @everyone)</td></tr>';
      return;
    }

    const commandRule = currentConfigPermissions[commandName] || { allowedRoles: [], deniedRoles: [] };
    const allowed = commandRule.allowedRoles || [];
    const denied = commandRule.deniedRoles || [];

    currentRoles.forEach(role => {
      const tr = document.createElement('tr');
      const isAllowed = allowed.includes(role.id);
      const isDenied = denied.includes(role.id);

      tr.innerHTML = `
        <td>
          <div class="role-badge-display">
            <span class="role-color-dot" style="background-color: ${role.color || '#FFF'}"></span>
            <span style="color: ${role.color !== '#000000' ? role.color : 'inherit'}; font-weight: 600;">${role.name}</span>
          </div>
        </td>
        <td style="text-align: center;">
          <label class="perm-checkbox allowed">
            <input type="checkbox" class="cb-allowed" data-role-id="${role.id}" ${isAllowed ? 'checked' : ''}>
            <span class="perm-checkmark"></span>
          </label>
        </td>
        <td style="text-align: center;">
          <label class="perm-checkbox denied">
            <input type="checkbox" class="cb-denied" data-role-id="${role.id}" ${isDenied ? 'checked' : ''}>
            <span class="perm-checkmark"></span>
          </label>
        </td>
      `;

      // Handlers to mutually exclude allowed and denied check
      const cbAllowed = tr.querySelector('.cb-allowed');
      const cbDenied = tr.querySelector('.cb-denied');

      cbAllowed.addEventListener('change', (e) => {
        if (e.target.checked) {
          cbDenied.checked = false;
        }
      });

      cbDenied.addEventListener('change', (e) => {
        if (e.target.checked) {
          cbAllowed.checked = false;
        }
      });

      rolesBody.appendChild(tr);
    });
  }

  // Save Button Action
  const btnSavePermissions = document.getElementById('btnSavePermissions');
  if (btnSavePermissions) {
    btnSavePermissions.addEventListener('click', async () => {
      if (!currentGuildId) return;

      const commandName = document.getElementById('commandSelect').value;
      const allowedRoles = [];
      const deniedRoles = [];

      const allowedCheckboxes = document.querySelectorAll('.cb-allowed');
      const deniedCheckboxes = document.querySelectorAll('.cb-denied');

      allowedCheckboxes.forEach(cb => {
        if (cb.checked) {
          allowedRoles.push(cb.getAttribute('data-role-id'));
        }
      });

      deniedCheckboxes.forEach(cb => {
        if (cb.checked) {
          deniedRoles.push(cb.getAttribute('data-role-id'));
        }
      });

      // Update locally
      currentConfigPermissions[commandName] = { allowedRoles, deniedRoles };

      btnSavePermissions.disabled = true;
      try {
        const res = await fetch(`/api/permissions/${currentGuildId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: currentConfigPermissions })
        });

        if (res.ok) {
          showToast(`Đã lưu cấu hình phân quyền cho lệnh /${commandName} thành công!`, 'success');
        } else {
          showToast('Không thể lưu cấu hình phân quyền', 'error');
        }
      } catch {
        showToast('Lỗi kết nối máy chủ', 'error');
      } finally {
        btnSavePermissions.disabled = false;
      }
    });
  }
});
