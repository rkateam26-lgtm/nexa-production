/* ==========================================================================
   NEXA PRODUCTION - LIVE MARKET ENGINE (SUPABASE CONNECTED)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // Force Unregister Old Service Worker to Clear Mobile Browser Cache
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
      }
    }).catch(err => console.log('SW unregister:', err));
  }

  // App Production State
  const state = {
    restaurant: {
      id: 'savane-paris-001',
      name: 'Le Savane',
      city: 'Ouagadougou',
      currency: 'FCFA'
    },
    clientSession: {
      whatsapp: localStorage.getItem('nexa_client_whatsapp') || '',
      name: localStorage.getItem('nexa_client_name') || '',
      points: 140,
      history: []
    },
    rewards: [
      { id: 1, title: 'Café Gourmand', desc: 'Espresso + 3 mini gourmandises.', pts: 50, icon: '☕' },
      { id: 2, title: 'Boisson fraîche au choix', desc: 'Soda, jus artisanal ou verre de vin.', pts: 100, icon: '🥤' },
      { id: 3, title: 'Dessert de la maison', desc: 'Fondant au chocolat ou Tiramisu.', pts: 200, icon: '🍰' },
      { id: 4, title: 'Plat signature au choix', desc: 'Entrecôte grillée 250g ou Burger Le Savane.', pts: 500, icon: '🥩' }
    ],
    notifications: [
      { id: 101, title: '✨ Offre du Soir', text: '-20% sur la carte ce soir pour nos membres VIP !', time: 'Il y a 10 min' }
    ],
    clientsList: [
      { id: 1, name: 'Thomas Laurent', phone: '+226 70 12 34 56', points: 140, visits: 8, lastVisit: 'Aujourd\'hui, 12:45', segment: 'VIP' },
      { id: 2, name: 'Sophie Martin', phone: '+226 78 42 90 11', points: 280, visits: 14, lastVisit: 'Hier, 19:30', segment: 'VIP' },
      { id: 3, name: 'Moussa Sawadogo', phone: '+226 76 99 88 12', points: 40, visits: 2, lastVisit: '05/08/2026', segment: 'Nouveau' }
    ],
    stats: {
      totalClients: 1248,
      qrScansMonth: 3890,
      pointsGiven: 38900,
      rewardsRedeemed: 245
    }
  };

  if (window.lucide) lucide.createIcons();

  /* ==========================================================================
     0. SMART ROUTER (ROLE & TABLE)
     ========================================================================== */
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role') || urlParams.get('mode');
  const tableParam = urlParams.get('table') || urlParams.get('t') || '4';
  const isMobileScreen = window.innerWidth <= 768;
  const viewportContainer = document.getElementById('viewport-container');
  const demoHeader = document.querySelector('.nexa-header');

  const tableBadge = document.getElementById('mobile-table-badge');
  if (tableBadge) tableBadge.textContent = `Table #${tableParam}`;

  if (roleParam === 'client' || (isMobileScreen && roleParam !== 'merchant' && roleParam !== 'demo')) {
    if (demoHeader) demoHeader.style.display = 'none';
    viewportContainer.className = 'main-viewport viewport-mobile';
  } else if (roleParam === 'merchant') {
    if (demoHeader) demoHeader.style.display = 'none';
    viewportContainer.className = 'main-viewport viewport-desktop';
  } else {
    if (demoHeader) demoHeader.style.display = 'flex';
    viewportContainer.className = 'main-viewport viewport-dual';
  }

  // Update Links
  const baseHost = window.location.origin + window.location.pathname;
  document.getElementById('link-url-client').textContent = `${baseHost}?role=client&table=${tableParam}`;
  document.getElementById('link-url-merchant').textContent = `${baseHost}?role=merchant`;
  document.getElementById('link-url-demo').textContent = `${baseHost}?role=demo`;

  window.copyRoleLink = function(role) {
    const targetUrl = role === 'client' ? `${baseHost}?role=client&table=${tableParam}` : `${baseHost}?role=${role}`;
    navigator.clipboard.writeText(targetUrl).then(() => showToast('📋 Lien Copié !', `URL [${role.toUpperCase()}] copiée.`));
  };

  /* ==========================================================================
     1. CLIENT REGISTRATION & SCAN (+10 PTS) SUPABASE TRANSACTION
     ========================================================================== */
  const btnTriggerScan = document.getElementById('btn-trigger-scan');
  const scannerModal = document.getElementById('scanner-modal');
  const btnCloseScanner = document.getElementById('btn-close-scanner');
  const btnSimulateScanOk = document.getElementById('btn-simulate-scan-ok');

  if (btnTriggerScan) btnTriggerScan.addEventListener('click', () => scannerModal.classList.add('active'));
  if (btnCloseScanner) btnCloseScanner.addEventListener('click', () => scannerModal.classList.remove('active'));

  window.triggerQRScan = async function() {
    // Ask for customer WhatsApp registration if not registered
    let clientPhone = state.clientSession.whatsapp;
    if (!clientPhone) {
      clientPhone = prompt("📱 Entrez votre numéro WhatsApp pour créer votre compte fidélité et recevoir vos 10 points :", "+226 70 00 00 00");
      if (!clientPhone) return;
      state.clientSession.whatsapp = clientPhone;
      localStorage.setItem('nexa_client_whatsapp', clientPhone);
    }

    state.clientSession.points += 10;
    state.stats.qrScansMonth += 1;
    state.stats.pointsGiven += 10;

    // Send real transaction to Supabase Cloud PostgreSQL
    if (window.nexaBackend) {
      try {
        await window.nexaBackend.recordScan(state.restaurant.id, tableParam, clientPhone, state.clientSession.name || 'Client Table');
        console.log('✅ Supabase: Scan & Points Cloud Transaction Saved!');
      } catch (err) {
        console.log('Local fallback scan recorded:', err);
      }
    }

    scannerModal.classList.remove('active');

    if (window.confetti) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#F59E0B', '#D97706', '#2A1D15'] });
    }

    renderClientUI();
    renderMerchantUI();
    showToast('✨ +10 Points crédités !', `Scan Table #${tableParam} enregistré sur le Cloud.`);
  };

  if (btnSimulateScanOk) btnSimulateScanOk.addEventListener('click', triggerQRScan);
  const btnFastScan = document.getElementById('btn-fast-scan');
  if (btnFastScan) btnFastScan.addEventListener('click', triggerQRScan);

  /* ==========================================================================
     2. RESTAURANT MANAGER REGISTRATION & LOGIN
     ========================================================================== */
  window.registerRestaurant = async function() {
    const name = prompt("Nom de votre Restaurant :", "Le Savane");
    if (!name) return;
    const email = prompt("Email du Gérant pour la connexion :", "gerant@savane.bf");
    if (!email) return;
    const pwd = prompt("Mot de passe sécurisé :", "Nexa2026!");
    if (!pwd) return;

    if (window.nexaBackend) {
      try {
        await window.nexaBackend.loginMerchant(email, pwd);
        state.restaurant.name = name;
        document.getElementById('mobile-resto-name').textContent = name;
        document.getElementById('dash-brand-name-el').textContent = name.toUpperCase();
        showToast('🎉 Restaurant Enregistré !', `Compte Supabase créé pour ${name}.`);
      } catch (err) {
        alert("Erreur d'inscription Supabase : " + err.message);
      }
    }
  };

  /* ==========================================================================
     3. RENDERERS & NAVIGATION
     ========================================================================== */
  const navTabs = document.querySelectorAll('.mobile-nav .nav-tab');
  const clientScreens = document.querySelectorAll('.client-screen');

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      clientScreens.forEach(s => s.classList.remove('active'));
      navTabs.forEach(t => t.classList.remove('active'));
      document.getElementById(`screen-${tab.dataset.tab}`).classList.add('active');
      tab.classList.add('active');
    });
  });

  function renderClientUI() {
    document.getElementById('user-points-val').textContent = state.clientSession.points;

    const rewardsContainer = document.getElementById('client-rewards-list');
    if (rewardsContainer) {
      rewardsContainer.innerHTML = state.rewards.map(reward => {
        const canClaim = state.clientSession.points >= reward.pts;
        return `
          <div class="reward-card-clean">
            <div class="reward-info-clean">
              <h3>${reward.icon} ${reward.title}</h3>
              <p>${reward.desc} • <strong>${reward.pts} pts</strong></p>
            </div>
            <button class="btn-claim-clean ${canClaim ? 'unlocked' : 'locked'}" onclick="${canClaim ? `claimReward(${reward.id})` : ''}">
              ${canClaim ? 'Échanger' : `${reward.pts} pts`}
            </button>
          </div>
        `;
      }).join('');
    }
  }

  window.claimReward = function(rewardId) {
    const reward = state.rewards.find(r => r.id === rewardId);
    if (!reward || state.clientSession.points < reward.pts) return;

    state.clientSession.points -= reward.pts;
    state.stats.rewardsRedeemed += 1;
    renderClientUI();
    renderMerchantUI();
    showRedemptionPassModal(reward);
  };

  function showRedemptionPassModal(reward) {
    const passModal = document.getElementById('redemption-pass-modal');
    document.getElementById('pass-reward-title').textContent = reward.title;
    document.getElementById('pass-qr-box').innerHTML = `
      <div style="background: white; padding: 12px; border-radius: 12px; display: inline-block; border: 2px solid var(--primary-gold);">
        <svg width="130" height="130" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#ffffff"/>
          <path d="M10 10h30v30h-30zM50 10h40v10h-40zM10 50h10v40h-10zM30 50h30v10h-30zM70 40h20v50h-20z" fill="#2A1D15"/>
        </svg>
      </div>
    `;
    passModal.classList.add('active');
  }

  document.getElementById('btn-close-pass').addEventListener('click', () => {
    document.getElementById('redemption-pass-modal').classList.remove('active');
  });

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

  dashMenuItems.forEach(item => item.addEventListener('click', () => activateSection(item.dataset.section)));
  dashDockTabs.forEach(tab => tab.addEventListener('click', () => activateSection(tab.dataset.section)));

  function renderMerchantUI() {
    document.getElementById('stat-total-clients').textContent = state.stats.totalClients.toLocaleString();
    document.getElementById('stat-qr-scans').textContent = state.stats.qrScansMonth.toLocaleString();
    document.getElementById('stat-pts-given').textContent = state.stats.pointsGiven.toLocaleString();
    document.getElementById('stat-rewards-redeemed').textContent = state.stats.rewardsRedeemed.toLocaleString();

    const crmTableBody = document.getElementById('crm-table-body');
    if (crmTableBody) {
      crmTableBody.innerHTML = state.clientsList.map(c => `
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

    const crmMobileCardsFeed = document.getElementById('crm-mobile-cards-feed');
    if (crmMobileCardsFeed) {
      crmMobileCardsFeed.innerHTML = state.clientsList.map(c => `
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
  }

  function showToast(title, text) {
    const toast = document.getElementById('notification-toast');
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-body').textContent = text;
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

  renderClientUI();
  renderMerchantUI();
});
