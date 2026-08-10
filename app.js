/* ==========================================================================
   NEXA SAAS PROTOTYPE & PRODUCTION ENGINE (JS ES6)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // Force Unregister Old Service Worker to Clear Mobile Browser Cache
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
      }
    }).catch(err => {
      console.log('SW unregister ok:', err);
    });
  }

  // Global Reactive App State with Local Storage Persistence
  const storedState = localStorage.getItem('nexa_prod_state');
  const initialState = storedState ? JSON.parse(storedState) : {
    currentViewMode: 'mobile',
    userLoggedIn: true,
    user: {
      name: 'Thomas Laurent',
      whatsapp: '+33 6 42 19 88 30',
      points: 140,
      tier: 'Silver',
      history: [
        { type: 'scan', text: 'Scan QR Table #4', points: '+10 pts', date: 'Aujourd\'hui, 12:45', isPlus: true },
        { type: 'scan', text: 'Scan QR Table #4', points: '+10 pts', date: 'Hier, 20:10', isPlus: true },
        { type: 'redeem', text: 'Café Gourmand échangé', points: '-50 pts', date: '04/08/2026', isPlus: false }
      ]
    },
    rewards: [
      { id: 1, title: 'Café Gourmand', desc: 'Espresso + 3 mini gourmandises.', pts: 50, icon: '☕' },
      { id: 2, title: 'Boisson fraîche au choix', desc: 'Soda, jus artisanal ou verre de vin.', pts: 100, icon: '🥤' },
      { id: 3, title: 'Dessert de la maison', desc: 'Fondant au chocolat ou Tiramisu.', pts: 200, icon: '🍰' },
      { id: 4, title: 'Plat signature au choix', desc: 'Entrecôte grillée 250g ou Burger Le Savane.', pts: 500, icon: '🥩' }
    ],
    notifications: [
      { id: 101, title: '✨ Offre du Soir', text: '-20% sur la carte ce soir pour nos membres d\'or !', time: 'Il y a 10 min', read: false }
    ],
    clients: [
      { id: 1, name: 'Thomas Laurent', phone: '+33 6 42 ** 30', points: 140, visits: 8, lastVisit: 'Aujourd\'hui, 12:45', segment: 'VIP' },
      { id: 2, name: 'Sophie Martin', phone: '+33 6 12 ** 90', points: 280, visits: 14, lastVisit: 'Hier, 19:30', segment: 'VIP' },
      { id: 3, name: 'Lucas Bernard', phone: '+33 7 89 ** 12', points: 40, visits: 2, lastVisit: '05/08/2026', segment: 'Nouveau' }
    ],
    stats: {
      totalClients: 1248,
      qrScansMonth: 3890,
      pointsGiven: 38900,
      rewardsRedeemed: 245
    }
  };

  const state = initialState;

  function persistState() {
    localStorage.setItem('nexa_prod_state', JSON.stringify(state));
  }

  // Lucide Icons Initializer
  if (window.lucide) {
    lucide.createIcons();
  }

  /* ==========================================================================
     0. SMART ROLE & TABLE SCAN ROUTER
     ========================================================================== */
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role') || urlParams.get('mode');
  const tableParam = urlParams.get('table') || urlParams.get('t') || '4';
  const isMobileScreen = window.innerWidth <= 768;
  const viewportContainer = document.getElementById('viewport-container');
  const demoHeader = document.querySelector('.nexa-header');

  // Update Dynamic Table Number Badge
  const tableBadge = document.getElementById('mobile-table-badge');
  if (tableBadge) tableBadge.textContent = `Table #${tableParam}`;

  if (roleParam === 'client' || (isMobileScreen && roleParam !== 'merchant' && roleParam !== 'demo')) {
    if (demoHeader) demoHeader.style.display = 'none';
    viewportContainer.className = 'main-viewport viewport-mobile';
    state.currentViewMode = 'mobile';
  } else if (roleParam === 'merchant' || roleParam === 'admin') {
    if (demoHeader) demoHeader.style.display = 'none';
    viewportContainer.className = 'main-viewport viewport-desktop';
    state.currentViewMode = 'desktop';
  } else if (roleParam === 'demo') {
    if (demoHeader) demoHeader.style.display = 'flex';
    viewportContainer.className = 'main-viewport viewport-dual';
    state.currentViewMode = 'dual';
  } else {
    if (isMobileScreen) {
      if (demoHeader) demoHeader.style.display = 'none';
      viewportContainer.className = 'main-viewport viewport-mobile';
      state.currentViewMode = 'mobile';
    } else {
      if (demoHeader) demoHeader.style.display = 'flex';
      viewportContainer.className = 'main-viewport viewport-dual';
      state.currentViewMode = 'dual';
    }
  }

  // Update Shareable Role Links with Current Origin
  const baseHost = window.location.origin + window.location.pathname;
  const linkClient = document.getElementById('link-url-client');
  const linkMerchant = document.getElementById('link-url-merchant');
  const linkDemo = document.getElementById('link-url-demo');

  if (linkClient) linkClient.textContent = `${baseHost}?role=client&table=${tableParam}`;
  if (linkMerchant) linkMerchant.textContent = `${baseHost}?role=merchant`;
  if (linkDemo) linkDemo.textContent = `${baseHost}?role=demo`;

  window.copyRoleLink = function(role) {
    const targetUrl = role === 'client' ? `${baseHost}?role=client&table=${tableParam}` : `${baseHost}?role=${role}`;
    navigator.clipboard.writeText(targetUrl).then(() => {
      showToast('📋 Lien Copié !', `Le lien [${role.toUpperCase()}] a été copié.`);
    }).catch(() => {
      alert(`Lien : ${targetUrl}`);
    });
  };

  /* ==========================================================================
     1. VIEW SWITCHER BUTTONS
     ========================================================================== */
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
      } else {
        viewportContainer.classList.add('viewport-dual');
      }
    });
  });

  /* ==========================================================================
     2. MOBILE TAB SYSTEM
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
     3. SCAN QR SIMULATION (+10 PTS)
     ========================================================================== */
  const btnTriggerScan = document.getElementById('btn-trigger-scan');
  const scannerModal = document.getElementById('scanner-modal');
  const btnCloseScanner = document.getElementById('btn-close-scanner');
  const btnSimulateScanOk = document.getElementById('btn-simulate-scan-ok');

  if (btnTriggerScan) btnTriggerScan.addEventListener('click', () => scannerModal.classList.add('active'));
  if (btnCloseScanner) btnCloseScanner.addEventListener('click', () => scannerModal.classList.remove('active'));

  window.triggerQRScan = function() {
    state.user.points += 10;
    state.stats.qrScansMonth += 1;
    state.stats.pointsGiven += 10;
    
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    state.user.history.unshift({
      type: 'scan',
      text: `Scan QR Table #${tableParam}`,
      points: '+10 pts',
      date: `Aujourd'hui, ${nowStr}`,
      isPlus: true
    });

    scannerModal.classList.remove('active');

    if (window.confetti) {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#D97706', '#2A1D15']
      });
    }

    persistState();
    renderClientUI();
    renderMerchantUI();
    showToast('✨ +10 Points crédités !', `Scan de la Table #${tableParam} validé.`);
  };

  if (btnSimulateScanOk) btnSimulateScanOk.addEventListener('click', triggerQRScan);
  const btnFastScan = document.getElementById('btn-fast-scan');
  if (btnFastScan) btnFastScan.addEventListener('click', triggerQRScan);

  /* ==========================================================================
     4. RENDER CLIENT UI
     ========================================================================== */
  function renderClientUI() {
    const pointsNum = document.getElementById('user-points-val');
    if (pointsNum) pointsNum.textContent = state.user.points;

    const nextRewardGoal = 200;
    const progressPercent = Math.min(100, Math.round((state.user.points / nextRewardGoal) * 100));
    const labelPercent = document.getElementById('user-progress-lbl');
    if (labelPercent) labelPercent.textContent = `${progressPercent}% (200 pts)`;

    const rewardsContainer = document.getElementById('client-rewards-list');
    if (rewardsContainer) {
      rewardsContainer.innerHTML = state.rewards.map(reward => {
        const canClaim = state.user.points >= reward.pts;
        
        return `
          <div class="reward-card-clean">
            <div class="reward-info-clean">
              <h3>${reward.icon} ${reward.title}</h3>
              <p>${reward.desc} • <strong>${reward.pts} pts</strong></p>
            </div>
            <button class="btn-claim-clean ${canClaim ? 'unlocked' : 'locked'}" 
                    onclick="${canClaim ? `claimReward(${reward.id})` : ''}">
              ${canClaim ? 'Échanger' : `${reward.pts} pts`}
            </button>
          </div>
        `;
      }).join('');
    }

    const historyContainer = document.getElementById('client-history-feed');
    if (historyContainer) {
      historyContainer.innerHTML = state.user.history.map(item => `
        <div class="reward-card-clean">
          <div>
            <h4 style="font-size:0.85rem; font-weight:700;">${item.text}</h4>
            <p style="font-size:0.75rem; color:var(--text-muted);">${item.date}</p>
          </div>
          <strong style="font-size:0.9rem; color:${item.isPlus ? 'var(--accent-green)' : 'var(--primary-gold)'};">${item.points}</strong>
        </div>
      `).join('');
    }

    const notifsContainer = document.getElementById('client-notifs-feed');
    if (notifsContainer) {
      notifsContainer.innerHTML = state.notifications.map(n => `
        <div class="reward-card-clean" style="border-left: 3px solid var(--primary-gold);">
          <div>
            <h3 style="font-size:0.88rem; font-weight:800;">${n.title}</h3>
            <p style="font-size:0.75rem; color:var(--text-muted);">${n.text}</p>
          </div>
        </div>
      `).join('');
    }
  }

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

    persistState();
    renderClientUI();
    renderMerchantUI();
    showRedemptionPassModal(reward);
  };

  function showRedemptionPassModal(reward) {
    const passModal = document.getElementById('redemption-pass-modal');
    const passTitle = document.getElementById('pass-reward-title');
    const passQR = document.getElementById('pass-qr-box');
    
    if (passTitle) passTitle.textContent = reward.title;
    if (passQR) {
      passQR.innerHTML = `
        <div style="background: white; padding: 12px; border-radius: 12px; display: inline-block; border: 2px solid var(--primary-gold);">
          <svg width="130" height="130" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="#ffffff" />
            <path d="M10 10h30v30h-30zM50 10h40v10h-40zM10 50h10v40h-10zM30 50h30v10h-30zM70 40h20v50h-20z" fill="#2A1D15"/>
          </svg>
        </div>
      `;
    }
    if (passModal) passModal.classList.add('active');
  }

  const btnClosePass = document.getElementById('btn-close-pass');
  if (btnClosePass) btnClosePass.addEventListener('click', () => document.getElementById('redemption-pass-modal').classList.remove('active'));

  /* ==========================================================================
     5. RENDER MERCHANT UI (DESKTOP TABLE + NATIVE MOBILE CARDS)
     ========================================================================== */
  const dashMenuItems = document.querySelectorAll('.dash-menu-item');
  const dashDockTabs = document.querySelectorAll('.dash-dock-tab');
  const dashSections = document.querySelectorAll('.dash-section');

  function activateSection(sectionId) {
    dashSections.forEach(s => s.classList.remove('active'));
    dashMenuItems.forEach(m => m.classList.remove('active'));
    dashDockTabs.forEach(t => t.classList.remove('active'));

    const targetSection = document.getElementById(`dash-sec-${sectionId}`);
    const matchDesktop = document.querySelector(`.dash-menu-item[data-section="${sectionId}"]`);
    const matchDock = document.querySelector(`.dash-dock-tab[data-section="${sectionId}"]`);

    if (targetSection) targetSection.classList.add('active');
    if (matchDesktop) matchDesktop.classList.add('active');
    if (matchDock) matchDock.classList.add('active');
  }

  dashMenuItems.forEach(item => {
    item.addEventListener('click', () => activateSection(item.dataset.section));
  });

  dashDockTabs.forEach(tab => {
    tab.addEventListener('click', () => activateSection(tab.dataset.section));
  });

  function renderMerchantUI() {
    document.getElementById('stat-total-clients').textContent = state.stats.totalClients.toLocaleString();
    document.getElementById('stat-qr-scans').textContent = state.stats.qrScansMonth.toLocaleString();
    document.getElementById('stat-pts-given').textContent = state.stats.pointsGiven.toLocaleString();
    document.getElementById('stat-rewards-redeemed').textContent = state.stats.rewardsRedeemed.toLocaleString();

    // 1. Render Desktop CRM Table
    const crmTableBody = document.getElementById('crm-table-body');
    if (crmTableBody) {
      crmTableBody.innerHTML = state.clients.map(c => `
        <tr>
          <td style="font-weight: 700;">${c.name}</td>
          <td style="color: var(--text-muted);">${c.phone}</td>
          <td><strong style="color: var(--primary-gold);">${c.points} pts</strong></td>
          <td>${c.visits} visites</td>
          <td style="color: var(--text-muted);">${c.lastVisit}</td>
          <td><button class="btn-secondary" onclick="alert('Message WhatsApp envoyé à ${c.name}')">📱 Contact</button></td>
        </tr>
      `).join('');
    }

    // 2. Render Native Mobile CRM Cards (100% COMPLETE DATA VISIBLE ON PHONE!)
    const crmMobileCardsFeed = document.getElementById('crm-mobile-cards-feed');
    if (crmMobileCardsFeed) {
      crmMobileCardsFeed.innerHTML = state.clients.map(c => `
        <div class="crm-mobile-card">
          <div class="crm-card-header">
            <div>
              <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--marron-dark);">${c.name}</h3>
              <p style="font-size: 0.75rem; color: var(--text-muted);">${c.phone}</p>
            </div>
            <span style="font-size: 0.7rem; font-weight: 800; background: var(--marron-light); color: var(--primary-gold); padding: 2px 8px; border-radius: 12px;">${c.segment}</span>
          </div>
          <div class="crm-card-metrics">
            <div class="crm-metric-pill">
              <span style="font-size: 0.7rem; color: var(--text-muted);">Points</span>
              <strong style="font-size: 1rem; color: var(--primary-gold);">${c.points} pts</strong>
            </div>
            <div class="crm-metric-pill">
              <span style="font-size: 0.7rem; color: var(--text-muted);">Visites</span>
              <strong style="font-size: 1rem; color: var(--marron-dark);">${c.visits} visites</strong>
            </div>
            <div class="crm-metric-pill">
              <span style="font-size: 0.7rem; color: var(--text-muted);">Dernier scan</span>
              <strong style="font-size: 0.8rem; color: var(--text-main);">${c.lastVisit}</strong>
            </div>
          </div>
          <button class="btn-primary" style="width: 100%; justify-content: center; margin-top: 0.5rem; font-size: 0.8rem;" onclick="alert('Message WhatsApp envoyé à ${c.name}')">
            📱 Envoyer un message WhatsApp
          </button>
        </div>
      `).join('');
    }

    // 3. Render Desktop Rewards Table
    const rewardsAdminBody = document.getElementById('rewards-admin-body');
    if (rewardsAdminBody) {
      rewardsAdminBody.innerHTML = state.rewards.map(r => `
        <tr>
          <td style="font-size: 1.2rem;">${r.icon}</td>
          <td style="font-weight: 700;">${r.title}</td>
          <td style="color: var(--text-muted);">${r.desc}</td>
          <td><strong style="color: var(--primary-gold);">${r.pts} pts</strong></td>
          <td><button class="btn-secondary" style="color:var(--primary-gold);" onclick="deleteReward(${r.id})">Supprimer</button></td>
        </tr>
      `).join('');
    }

    // 4. Render Native Mobile Rewards Cards
    const rewardsMobileCardsFeed = document.getElementById('rewards-mobile-cards-feed');
    if (rewardsMobileCardsFeed) {
      rewardsMobileCardsFeed.innerHTML = state.rewards.map(r => `
        <div class="crm-mobile-card">
          <div class="crm-card-header">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.5rem;">${r.icon}</span>
              <div>
                <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--marron-dark);">${r.title}</h3>
                <p style="font-size: 0.75rem; color: var(--text-muted);">${r.desc}</p>
              </div>
            </div>
            <strong style="color: var(--primary-gold); font-size: 0.95rem;">${r.pts} pts</strong>
          </div>
          <button class="btn-secondary" style="width: 100%; color: var(--primary-gold); font-weight: 700; margin-top: 0.5rem;" onclick="deleteReward(${r.id})">
            Supprimer la Récompense
          </button>
        </div>
      `).join('');
    }
  }

  const modalAddReward = document.getElementById('modal-add-reward');
  const btnOpenAddReward = document.getElementById('btn-open-add-reward');
  const btnCloseAddReward = document.getElementById('btn-close-add-reward');
  const formAddReward = document.getElementById('form-add-reward');

  if (btnOpenAddReward) btnOpenAddReward.addEventListener('click', () => modalAddReward.classList.add('active'));
  if (btnCloseAddReward) btnCloseAddReward.addEventListener('click', () => modalAddReward.classList.remove('active'));

  if (formAddReward) {
    formAddReward.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('reward-title-input').value;
      const pts = parseInt(document.getElementById('reward-pts-input').value, 10);
      const desc = document.getElementById('reward-desc-input').value;

      state.rewards.push({ id: Date.now(), title, pts, desc, icon: '🎁' });
      modalAddReward.classList.remove('active');
      formAddReward.reset();

      persistState();
      renderClientUI();
      renderMerchantUI();
      showToast('🎁 Récompense créée !', `"${title}" ajoutée.`);
    });
  }

  window.deleteReward = function(rewardId) {
    state.rewards = state.rewards.filter(r => r.id !== rewardId);
    persistState();
    renderClientUI();
    renderMerchantUI();
    showToast('🗑️ Récompense supprimée', 'Catalogue mis à jour.');
  };

  const formSendNotif = document.getElementById('form-send-notif');
  if (formSendNotif) {
    formSendNotif.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('notif-title-input').value;
      const text = document.getElementById('notif-text-input').value;

      state.notifications.unshift({ id: Date.now(), title, text, time: 'À l\'instant', read: false });
      persistState();
      renderClientUI();
      formSendNotif.reset();
      showToast(title, text);
    });
  }

  function showToast(title, text) {
    const toast = document.getElementById('notification-toast');
    const toastTitle = document.getElementById('toast-title');
    const toastBody = document.getElementById('toast-body');

    if (toastTitle) toastTitle.textContent = title;
    if (toastBody) toastBody.textContent = text;
    if (toast) {
      toast.classList.add('active');
      setTimeout(() => toast.classList.remove('active'), 4000);
    }
  }

  const chartCanvas = document.getElementById('scansChart');
  if (chartCanvas && window.Chart) {
    new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
        datasets: [{
          label: 'Scans QR',
          data: [320, 450, 510, 680, 940, 1120, 880],
          borderColor: '#D97706',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { grid: { color: '#F5F1EB' } }, x: { grid: { display: false } } }
      }
    });
  }

  // Initial Render Launch
  renderClientUI();
  renderMerchantUI();
});
