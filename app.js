/* ==========================================================================
   NEXA SAAS PROTOTYPE - INTERACTIVE CORE ENGINE (JS ES6)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('Service Worker registration skipped in standalone mode:', err);
    });
  }

  // Global Reactive App State
  const state = {
    currentViewMode: 'dual', // 'mobile', 'desktop', 'dual', 'cashier'
    userLoggedIn: true,
    user: {
      name: 'Thomas Laurent',
      whatsapp: '+33 6 42 19 88 30',
      points: 140,
      tier: 'Silver',
      history: [
        { type: 'scan', text: 'Scan QR Table #4', points: '+10 pts', date: 'Aujourd\'hui, 12:45', isPlus: true },
        { type: 'scan', text: 'Scan QR Table #4', points: '+10 pts', date: 'Hier, 20:10', isPlus: true },
        { type: 'redeem', text: 'Café Gourmand échangé', points: '-50 pts', date: '04/08/2026', isPlus: false },
        { type: 'bonus', text: 'Bonus d\'inscription Nexa', points: '+50 pts', date: '01/08/2026', isPlus: true }
      ]
    },
    rewards: [
      { id: 1, title: 'Café Gourmand', desc: 'Un espresso accompagné de 3 mini gourmandises.', pts: 50, icon: '☕', category: 'Boisson' },
      { id: 2, title: 'Boisson fraîche au choix', desc: 'Soda, jus artisanal ou verre de vin maison.', pts: 100, icon: '🥤', category: 'Boisson' },
      { id: 3, title: 'Dessert de la maison offert', desc: 'Fondant au chocolat intense ou Tiramisu traditionnel.', pts: 200, icon: '🍰', category: 'Dessert' },
      { id: 4, title: 'Plat signature au choix', desc: 'Entrecôte grillée 250g ou Burger Le Savane.', pts: 500, icon: '🥩', category: 'Plat' }
    ],
    notifications: [
      { id: 101, title: '✨ Offre Privilège du Soir', text: '-20% sur la carte ce soir pour nos membres d\'or !', time: 'Il y a 10 min', read: false },
      { id: 102, title: '🎁 Cadeau Anniversaire', text: 'Profitez de +50 points bonus lors de votre prochaine visite.', time: 'Hier', read: true }
    ],
    clients: [
      { id: 1, name: 'Thomas Laurent', phone: '+33 6 42 ** 30', points: 140, visits: 8, lastVisit: 'Aujourd\'hui, 12:45', segment: 'VIP' },
      { id: 2, name: 'Sophie Martin', phone: '+33 6 12 ** 90', points: 280, visits: 14, lastVisit: 'Hier, 19:30', segment: 'VIP' },
      { id: 3, name: 'Lucas Bernard', phone: '+33 7 89 ** 12', points: 40, visits: 2, lastVisit: '05/08/2026', segment: 'Nouveau' },
      { id: 4, name: 'Camille Petit', phone: '+33 6 55 ** 44', points: 190, visits: 9, lastVisit: '02/08/2026', segment: 'Actif' },
      { id: 5, name: 'Alexandre Dubois', phone: '+33 6 77 ** 88', points: 90, visits: 4, lastVisit: '15/07/2026', segment: 'Inactif' }
    ],
    stats: {
      totalClients: 1248,
      newClientsMonth: 184,
      qrScansMonth: 3890,
      pointsGiven: 38900,
      rewardsRedeemed: 245
    }
  };

  // Lucide Icons Auto Initialization
  if (window.lucide) {
    lucide.createIcons();
  }

  /* ==========================================================================
     1. VIEW SWITCHER (Mobile vs Desktop vs Dual Side-by-Side vs Cashier)
     ========================================================================== */
  const viewportContainer = document.getElementById('viewport-container');
  const switchBtns = document.querySelectorAll('.switch-btn');

  switchBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.view;
      state.currentViewMode = mode;
      
      viewportContainer.className = 'main-viewport';
      if (mode === 'mobile') {
        viewportContainer.classList.add('viewport-mobile');
      } else if (mode === 'desktop') {
        viewportContainer.classList.add('viewport-desktop');
      } else if (mode === 'cashier') {
        viewportContainer.classList.add('viewport-cashier');
      } else {
        viewportContainer.classList.add('viewport-dual');
      }
    });
  });

  /* ==========================================================================
     2. CLIENT MOBILE NAVIGATION & TAB SYSTEM
     ========================================================================== */
  const navTabs = document.querySelectorAll('.mobile-nav .nav-tab');
  const clientScreens = document.querySelectorAll('.client-screen');

  function showClientScreen(screenId) {
    clientScreens.forEach(s => s.classList.remove('active'));
    navTabs.forEach(t => t.classList.remove('active'));
    
    const targetScreen = document.getElementById(`screen-${screenId}`);
    const targetTab = document.querySelector(`.nav-tab[data-tab="${screenId}"]`);
    
    if (targetScreen) targetScreen.classList.add('active');
    if (targetTab) targetTab.classList.add('active');
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      showClientScreen(tab.dataset.tab);
    });
  });

  /* ==========================================================================
     3. POINT ACCUMULATION & QR CODE SCANNER SIMULATOR (+10 PTS)
     ========================================================================== */
  const btnTriggerScan = document.getElementById('btn-trigger-scan');
  const scannerModal = document.getElementById('scanner-modal');
  const btnCloseScanner = document.getElementById('btn-close-scanner');
  const btnSimulateScanOk = document.getElementById('btn-simulate-scan-ok');

  // Open Scanner Modal
  if (btnTriggerScan) {
    btnTriggerScan.addEventListener('click', () => {
      scannerModal.classList.add('active');
    });
  }

  if (btnCloseScanner) {
    btnCloseScanner.addEventListener('click', () => {
      scannerModal.classList.remove('active');
    });
  }

  // Trigger +10 Points Scan Event
  window.triggerQRScan = function() {
    state.user.points += 10;
    state.stats.qrScansMonth += 1;
    state.stats.pointsGiven += 10;
    
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    state.user.history.unshift({
      type: 'scan',
      text: 'Scan QR Table #4',
      points: '+10 pts',
      date: `Aujourd'hui, ${nowStr}`,
      isPlus: true
    });

    // Close Scanner if open
    scannerModal.classList.remove('active');

    // Trigger Canvas Confetti in Gold Colors!
    if (window.confetti) {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#D97706', '#FDE68A', '#FFFFFF']
      });
    }

    // Render UI Updates
    renderClientUI();
    renderMerchantUI();

    // Show Toast Confirmation
    showToast('✨ +10 Points crédités !', 'Scan QR de la Table #4 validé avec succès.');
  };

  if (btnSimulateScanOk) {
    btnSimulateScanOk.addEventListener('click', triggerQRScan);
  }

  // Global Header Fast Action Button
  const btnFastScan = document.getElementById('btn-fast-scan');
  if (btnFastScan) {
    btnFastScan.addEventListener('click', triggerQRScan);
  }

  /* ==========================================================================
     4. CLIENT RENDERER & REWARDS UNLOCKING
     ========================================================================== */
  function renderClientUI() {
    // Render Points Display
    const pointsNum = document.getElementById('user-points-val');
    if (pointsNum) pointsNum.textContent = state.user.points;

    // Render Progress Bar towards Next Reward (200 pts Dessert)
    const nextRewardGoal = 200;
    const progressPercent = Math.min(100, Math.round((state.user.points / nextRewardGoal) * 100));
    const fillBar = document.getElementById('user-progress-fill');
    const labelPercent = document.getElementById('user-progress-lbl');
    
    if (fillBar) fillBar.style.width = `${progressPercent}%`;
    if (labelPercent) labelPercent.textContent = `${progressPercent}% de l'objectif Dessert (200 pts)`;

    // Render Rewards List
    const rewardsContainer = document.getElementById('client-rewards-list');
    if (rewardsContainer) {
      rewardsContainer.innerHTML = state.rewards.map(reward => {
        const canClaim = state.user.points >= reward.pts;
        const progress = Math.min(100, Math.round((state.user.points / reward.pts) * 100));
        
        return `
          <div class="reward-card">
            <div class="reward-icon-box">${reward.icon}</div>
            <div class="reward-details">
              <div class="reward-title">${reward.title}</div>
              <div class="reward-desc">${reward.desc}</div>
              <div class="reward-pts-badge">${reward.pts} points requis</div>
            </div>
            <button class="btn-claim ${canClaim ? 'unlocked' : 'locked'}" 
                    onclick="${canClaim ? `claimReward(${reward.id})` : ''}">
              ${canClaim ? 'Échanger' : `${progress}%`}
            </button>
          </div>
        `;
      }).join('');
    }

    // Render History Timeline
    const historyContainer = document.getElementById('client-history-feed');
    if (historyContainer) {
      historyContainer.innerHTML = state.user.history.map(item => `
        <div class="history-item">
          <div class="history-info">
            <h4>${item.text}</h4>
            <p>${item.date}</p>
          </div>
          <div class="history-val ${item.isPlus ? 'plus' : 'minus'}">${item.points}</div>
        </div>
      `).join('');
    }

    // Render Notifications Inbox
    const notifsContainer = document.getElementById('client-notifs-feed');
    const badgeNotif = document.getElementById('notif-badge-count');
    
    if (notifsContainer) {
      notifsContainer.innerHTML = state.notifications.map(n => `
        <div class="reward-card" style="${!n.read ? 'border-left: 3px solid var(--gold-accent);' : ''}">
          <div class="reward-icon-box">🔔</div>
          <div class="reward-details">
            <div class="reward-title">${n.title}</div>
            <div class="reward-desc">${n.text}</div>
            <div class="reward-pts-badge" style="color: var(--mobile-muted);">${n.time}</div>
          </div>
        </div>
      `).join('');
    }

    const unreadCount = state.notifications.filter(n => !n.read).length;
    if (badgeNotif) {
      badgeNotif.style.display = unreadCount > 0 ? 'inline-block' : 'none';
      badgeNotif.textContent = unreadCount;
    }
  }

  // Claim Reward Action
  window.claimReward = function(rewardId) {
    const reward = state.rewards.find(r => r.id === rewardId);
    if (!reward || state.user.points < reward.pts) return;

    state.user.points -= reward.pts;
    state.stats.rewardsRedeemed += 1;
    
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    state.user.history.unshift({
      type: 'redeem',
      text: `${reward.title} échangé`,
      points: `-${reward.pts} pts`,
      date: `Aujourd'hui, ${nowStr}`,
      isPlus: false
    });

    renderClientUI();
    renderMerchantUI();

    // Show Redemption Pass Modal
    showRedemptionPassModal(reward);
  };

  function showRedemptionPassModal(reward) {
    const passModal = document.getElementById('redemption-pass-modal');
    const passTitle = document.getElementById('pass-reward-title');
    const passQR = document.getElementById('pass-qr-box');
    
    if (passTitle) passTitle.textContent = reward.title;
    if (passQR) {
      passQR.innerHTML = `
        <div style="background: white; padding: 14px; border-radius: 14px; display: inline-block; border: 2px solid var(--gold-accent);">
          <svg width="140" height="140" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="#ffffff" />
            <path d="M10 10h30v30h-30zM50 10h40v10h-40zM10 50h10v40h-10zM30 50h30v10h-30zM70 40h20v50h-20z" fill="#D97706"/>
          </svg>
        </div>
      `;
    }
    
    if (passModal) passModal.classList.add('active');
  }

  const btnClosePass = document.getElementById('btn-close-pass');
  if (btnClosePass) {
    btnClosePass.addEventListener('click', () => {
      document.getElementById('redemption-pass-modal').classList.remove('active');
    });
  }

  /* ==========================================================================
     5. MERCHANT DASHBOARD SAAS SYSTEM
     ========================================================================== */
  const dashMenuItems = document.querySelectorAll('.dash-menu-item');
  const dashSections = document.querySelectorAll('.dash-section');

  dashMenuItems.forEach(item => {
    item.addEventListener('click', () => {
      dashMenuItems.forEach(m => m.classList.remove('active'));
      dashSections.forEach(s => s.classList.remove('active'));

      item.classList.add('active');
      const sectionId = item.dataset.section;
      const targetSection = document.getElementById(`dash-sec-${sectionId}`);
      if (targetSection) targetSection.classList.add('active');

      const titleEl = document.getElementById('dash-title');
      if (titleEl) titleEl.textContent = item.querySelector('span').textContent;
    });
  });

  function renderMerchantUI() {
    // Render Overview Stats
    document.getElementById('stat-total-clients').textContent = state.stats.totalClients.toLocaleString();
    document.getElementById('stat-qr-scans').textContent = state.stats.qrScansMonth.toLocaleString();
    document.getElementById('stat-pts-given').textContent = state.stats.pointsGiven.toLocaleString();
    document.getElementById('stat-rewards-redeemed').textContent = state.stats.rewardsRedeemed.toLocaleString();

    // Render Client CRM Table
    const crmTableBody = document.getElementById('crm-table-body');
    if (crmTableBody) {
      crmTableBody.innerHTML = state.clients.map(c => `
        <tr>
          <td style="font-weight: 600;">${c.name}</td>
          <td style="color: var(--dash-muted);">${c.phone}</td>
          <td><span style="font-weight: 700; color: var(--gold-accent);">${c.points} pts</span></td>
          <td>${c.visits} visites</td>
          <td style="color: var(--dash-muted); font-size: 0.8rem;">${c.lastVisit}</td>
          <td><span class="chip-tag ${c.segment === 'VIP' ? 'chip-vip' : c.segment === 'Nouveau' ? 'chip-new' : 'chip-active'}">${c.segment}</span></td>
          <td>
            <button class="btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="openWhatsAppModal('${c.name}')">
              📱 WhatsApp
            </button>
          </td>
        </tr>
      `).join('');
    }

    // Render Rewards Admin List
    const rewardsAdminBody = document.getElementById('rewards-admin-body');
    if (rewardsAdminBody) {
      rewardsAdminBody.innerHTML = state.rewards.map(r => `
        <tr>
          <td style="font-size: 1.3rem;">${r.icon}</td>
          <td style="font-weight: 600;">${r.title}</td>
          <td style="color: var(--dash-muted);">${r.desc}</td>
          <td style="font-weight: 700; color: var(--gold-accent);">${r.pts} pts</td>
          <td><span class="chip-tag chip-active">Actif</span></td>
          <td>
            <button class="btn-secondary" style="padding: 0.25rem 0.5rem; color: var(--primary);" onclick="deleteReward(${r.id})">
              Supprimer
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  // Create New Reward Action
  const modalAddReward = document.getElementById('modal-add-reward');
  const btnOpenAddReward = document.getElementById('btn-open-add-reward');
  const btnCloseAddReward = document.getElementById('btn-close-add-reward');
  const formAddReward = document.getElementById('form-add-reward');

  if (btnOpenAddReward) {
    btnOpenAddReward.addEventListener('click', () => modalAddReward.classList.add('active'));
  }
  if (btnCloseAddReward) {
    btnCloseAddReward.addEventListener('click', () => modalAddReward.classList.remove('active'));
  }

  if (formAddReward) {
    formAddReward.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('reward-title-input').value;
      const pts = parseInt(document.getElementById('reward-pts-input').value, 10);
      const desc = document.getElementById('reward-desc-input').value;
      const icon = document.getElementById('reward-icon-input').value || '🎁';

      state.rewards.push({
        id: Date.now(),
        title,
        pts,
        desc,
        icon,
        category: 'Spécial'
      });

      modalAddReward.classList.remove('active');
      formAddReward.reset();

      renderClientUI();
      renderMerchantUI();
      showToast('🎁 Récompense créée !', `"${title}" est maintenant disponible pour vos clients.`);
    });
  }

  window.deleteReward = function(rewardId) {
    state.rewards = state.rewards.filter(r => r.id !== rewardId);
    renderClientUI();
    renderMerchantUI();
    showToast('🗑️ Récompense supprimée', 'La liste des récompenses a été mise à jour.');
  };

  /* ==========================================================================
     6. BROADCAST CAMPAIGN NOTIFICATION ENGINE
     ========================================================================== */
  const formSendNotif = document.getElementById('form-send-notif');
  
  if (formSendNotif) {
    formSendNotif.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('notif-title-input').value;
      const text = document.getElementById('notif-text-input').value;

      // Add to notifications array
      state.notifications.unshift({
        id: Date.now(),
        title,
        text,
        time: 'À l\'instant',
        read: false
      });

      renderClientUI();
      formSendNotif.reset();

      // Trigger Live Toast Notification on Phone Screen!
      showToast(title, text);
    });
  }

  const btnFastNotif = document.getElementById('btn-fast-notif');
  if (btnFastNotif) {
    btnFastNotif.addEventListener('click', () => {
      showToast('✨ Offre Privilège Le Savane', '-20% sur la carte ce soir pour nos membres d\'or !');
    });
  }

  /* ==========================================================================
     7. TOAST NOTIFICATION OVERLAY
     ========================================================================== */
  function showToast(title, text) {
    const toast = document.getElementById('notification-toast');
    const toastTitle = document.getElementById('toast-title');
    const toastBody = document.getElementById('toast-body');

    if (toastTitle) toastTitle.textContent = title;
    if (toastBody) toastBody.textContent = text;

    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 4500);
  }

  /* ==========================================================================
     8. CHART.JS ANALYTICS GRAPH (GOLD PALETTE)
     ========================================================================== */
  const chartCanvas = document.getElementById('scansChart');
  if (chartCanvas && window.Chart) {
    new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
        datasets: [{
          label: 'Scans QR Code',
          data: [320, 450, 510, 680, 940, 1120, 880],
          borderColor: '#D97706',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#F59E0B'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: '#E8E2D5' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Initial Render Launch
  renderClientUI();
  renderMerchantUI();
});
