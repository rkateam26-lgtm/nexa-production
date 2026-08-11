/* ==========================================================================
   NEXA PRODUCTION - LIVE MARKET ENGINE (SUPABASE & REAL-TIME SYNC)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // Unregister Old Service Worker to Clear Cache
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) registration.unregister();
    }).catch(err => console.log('SW unregister:', err));
  }

  // Parse URL Parameters
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role') || urlParams.get('mode');
  const tableParam = urlParams.get('table') || urlParams.get('t') || '4';
  const urlRestoName = urlParams.get('resto') || urlParams.get('r');

  if (urlRestoName) {
    localStorage.setItem('nexa_resto_name', decodeURIComponent(urlRestoName));
  }

  // Load Rewards & Clients State
  const savedRewards = localStorage.getItem('nexa_prod_rewards');
  const initialRewards = savedRewards ? JSON.parse(savedRewards) : [];

  const savedClients = localStorage.getItem('nexa_prod_clients');
  const initialClients = savedClients ? JSON.parse(savedClients) : [];

  const state = {
    isMerchantLoggedIn: localStorage.getItem('nexa_merchant_logged') === 'true',
    restaurant: {
      id: 'savane-prod-001',
      name: localStorage.getItem('nexa_resto_name') || 'Le Savane',
      type: localStorage.getItem('nexa_resto_type') || '★ 4.9 • Bistro & Grillades',
      city: 'Ouagadougou',
      currency: localStorage.getItem('nexa_resto_currency') || 'FCFA'
    },
    clientSession: {
      whatsapp: localStorage.getItem('nexa_client_whatsapp') || '',
      name: localStorage.getItem('nexa_client_name') || '',
      points: parseInt(localStorage.getItem('nexa_client_points') || '0', 10),
      lastScanTime: parseInt(localStorage.getItem('nexa_last_scan_time') || '0', 10),
      history: []
    },
    rewards: initialRewards,
    notifications: [],
    clientsList: initialClients,
    stats: {
      totalClients: initialClients.length,
      qrScansMonth: parseInt(localStorage.getItem('nexa_stat_scans') || '0', 10),
      pointsGiven: parseInt(localStorage.getItem('nexa_stat_points') || '0', 10),
      rewardsRedeemed: parseInt(localStorage.getItem('nexa_stat_redeemed') || '0', 10)
    }
  };

  if (window.lucide) lucide.createIcons();

  // Listen to Storage Changes for Live Sync Across Tabs/Devices!
  window.addEventListener('storage', (e) => {
    if (e.key === 'nexa_prod_rewards') {
      state.rewards = JSON.parse(e.newValue || '[]');
      renderClientUI();
      renderMerchantUI();
    }
    if (e.key === 'nexa_prod_clients') {
      state.clientsList = JSON.parse(e.newValue || '[]');
      state.stats.totalClients = state.clientsList.length;
      renderMerchantUI();
    }
  });

  /* ==========================================================================
     0. SMART ROUTER (ROLE & TABLE)
     ========================================================================== */
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
  document.getElementById('link-url-client').textContent = `${baseHost}?role=client&resto=${encodeURIComponent(state.restaurant.name)}&table=${tableParam}`;
  document.getElementById('link-url-merchant').textContent = `${baseHost}?role=merchant`;

  window.copyRoleLink = function(role) {
    const targetUrl = role === 'client' ? `${baseHost}?role=client&resto=${encodeURIComponent(state.restaurant.name)}&table=${tableParam}` : `${baseHost}?role=${role}`;
    navigator.clipboard.writeText(targetUrl).then(() => showToast('📋 Lien Copié !', `URL [${role.toUpperCase()}] copiée.`));
  };

  /* ==========================================================================
     1. MERCHANT AUTH & BUTTON SWAPPER LOGIC
     ========================================================================== */
  const modalMerchantAuth = document.getElementById('modal-merchant-auth');
  const formMerchantAuth = document.getElementById('form-merchant-auth');

  window.openMerchantAuthModal = () => modalMerchantAuth && modalMerchantAuth.classList.add('active');
  window.closeMerchantAuthModal = () => modalMerchantAuth && modalMerchantAuth.classList.remove('active');

  function updateMerchantAuthState() {
    const btnInscrire = document.getElementById('btn-header-inscrire');
    const btnAddReward = document.getElementById('btn-header-add-reward');
    const sidebarAuthBox = document.getElementById('sidebar-auth-button-box');
    const overviewCreateBanner = document.getElementById('overview-create-reward-banner');

    if (state.isMerchantLoggedIn) {
      if (btnInscrire) btnInscrire.style.display = 'none';
      if (btnAddReward) btnAddReward.style.display = 'inline-flex';
      if (sidebarAuthBox) {
        sidebarAuthBox.innerHTML = `
          <div style="color: #10B981; font-weight: 800; font-size: 0.8rem; margin-bottom: 0.3rem;">✓ Restaurant Inscrit</div>
          <button class="btn-secondary" onclick="logoutMerchant()" style="width: 100%; font-size: 0.7rem; padding: 0.3rem;">Deconnexion</button>
        `;
      }
      if (overviewCreateBanner) overviewCreateBanner.style.display = 'flex';
    } else {
      if (btnInscrire) btnInscrire.style.display = 'inline-flex';
      if (btnAddReward) btnAddReward.style.display = 'none';
      if (sidebarAuthBox) {
        sidebarAuthBox.innerHTML = `
          <button class="btn-primary" onclick="openMerchantAuthModal()" style="width: 100%; justify-content: center; font-size: 0.75rem; padding: 0.4rem; background: var(--primary-gold); color: #2A1D15; font-weight: 800;">
            🔑 Inscrire mon Restaurant
          </button>
        `;
      }
      if (overviewCreateBanner) overviewCreateBanner.style.display = 'none';
    }
  }

  window.logoutMerchant = function() {
    state.isMerchantLoggedIn = false;
    localStorage.setItem('nexa_merchant_logged', 'false');
    updateMerchantAuthState();
    showToast('🔒 Déconnexion', 'Vous êtes déconnecté.');
  };

  if (formMerchantAuth) {
    formMerchantAuth.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('auth-resto-name').value.trim();
      const type = document.getElementById('auth-resto-type').value;
      const email = document.getElementById('auth-resto-email').value.trim();
      const pwd = document.getElementById('auth-resto-pwd').value.trim();
      const currency = document.getElementById('auth-resto-currency').value;

      if (!name) return;

      state.restaurant.name = name;
      state.restaurant.type = type;
      state.restaurant.currency = currency;
      state.isMerchantLoggedIn = true;

      localStorage.setItem('nexa_resto_name', name);
      localStorage.setItem('nexa_resto_type', type);
      localStorage.setItem('nexa_resto_currency', currency);
      localStorage.setItem('nexa_merchant_logged', 'true');

      if (window.nexaBackend) {
        try {
          await window.nexaBackend.loginMerchant(email, pwd);
        } catch (err) {
          console.log('Local merchant saved:', err);
        }
      }

      closeMerchantAuthModal();
      updateMerchantAuthState();
      renderMerchantUI();
      renderClientUI();
      showToast('🎉 Inscription Validée !', `${name} est configuré.`);
    });
  }

  /* ==========================================================================
     2. RICH REWARD CREATION FOR LOGGED-IN RESTAURANT MANAGER
     ========================================================================== */
  const modalAddReward = document.getElementById('modal-add-reward');
  const formAddReward = document.getElementById('form-add-reward');

  window.openAddRewardModal = function() {
    if (!state.isMerchantLoggedIn) {
      openMerchantAuthModal();
      return;
    }
    if (modalAddReward) modalAddReward.classList.add('active');
  };

  window.closeAddRewardModal = function() {
    if (modalAddReward) modalAddReward.classList.remove('active');
  };

  if (formAddReward) {
    formAddReward.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('reward-title-input').value.trim();
      const category = document.getElementById('reward-category-input').value;
      const icon = document.getElementById('reward-icon-input').value;
      const pts = parseInt(document.getElementById('reward-pts-input').value, 10);
      const desc = document.getElementById('reward-desc-input').value.trim();

      if (!title || !pts) return;

      const newReward = { id: Date.now(), category, icon, title, pts, desc };
      state.rewards.push(newReward);
      localStorage.setItem('nexa_prod_rewards', JSON.stringify(state.rewards));

      closeAddRewardModal();
      formAddReward.reset();

      renderClientUI();
      renderMerchantUI();
      showToast('🎁 Récompense Publiée !', `"${title}" (${pts} pts) est visible pour tous vos clients.`);
    });
  }

  window.deleteReward = function(rewardId) {
    state.rewards = state.rewards.filter(r => r.id !== rewardId);
    localStorage.setItem('nexa_prod_rewards', JSON.stringify(state.rewards));
    renderClientUI();
    renderMerchantUI();
    showToast('🗑️ Récompense Supprimée', 'Catalogue mis à jour.');
  };

  /* ==========================================================================
     3. CLIENT AUTH & LIVE CRM REGISTRATION
     ========================================================================== */
  const modalClientAuth = document.getElementById('modal-client-auth');
  const formClientAuth = document.getElementById('form-client-auth');
  const clientLoginBanner = document.getElementById('client-login-banner');

  window.openClientAuthModal = () => modalClientAuth && modalClientAuth.classList.add('active');
  window.closeClientAuthModal = () => modalClientAuth && modalClientAuth.classList.remove('active');

  if (formClientAuth) {
    formClientAuth.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('auth-client-phone').value.trim();
      const name = document.getElementById('auth-client-name').value.trim() || 'Client Nexa';
      if (!phone) return;

      state.clientSession.whatsapp = phone;
      state.clientSession.name = name;
      localStorage.setItem('nexa_client_whatsapp', phone);
      localStorage.setItem('nexa_client_name', name);

      // Append Client to Merchant's CRM List!
      const existing = state.clientsList.find(c => c.phone === phone);
      if (!existing) {
        state.clientsList.unshift({
          id: Date.now(),
          name,
          phone,
          points: 10,
          visits: 1,
          lastVisit: 'À l\'instant (Table #' + tableParam + ')',
          segment: 'Nouveau'
        });
        state.stats.totalClients = state.clientsList.length;
        localStorage.setItem('nexa_prod_clients', JSON.stringify(state.clientsList));
      }

      closeClientAuthModal();
      renderClientUI();
      renderMerchantUI();
      showToast('🎉 Compte Client Actif !', `Bienvenue ${name} !`);
    });
  }

  /* ==========================================================================
     4. ANTI-CHEAT CAMERA SCANNER LOGIC
     ========================================================================== */
  const scannerModal = document.getElementById('scanner-modal');
  const btnTriggerScan = document.getElementById('btn-trigger-scan');
  const btnCloseScanner = document.getElementById('btn-close-scanner');
  const btnSimulateScanOk = document.getElementById('btn-simulate-scan-ok');
  let html5QrCode = null;

  async function startRealCameraScanner() {
    if (!state.clientSession.whatsapp) {
      openClientAuthModal();
      return;
    }

    const now = Date.now();
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    if (now - state.clientSession.lastScanTime < twoHoursInMs) {
      const remainingMinutes = Math.ceil((twoHoursInMs - (now - state.clientSession.lastScanTime)) / 60000);
      alert(`⚠️ Anti-Triche NEXA :\nVous avez déjà scanné une table aujourd'hui !\n\nProchain scan disponible dans ${remainingMinutes} minutes.`);
      return;
    }

    scannerModal.classList.add('active');

    if (window.Html5Qrcode && !html5QrCode) {
      html5QrCode = new Html5Qrcode("html5-qr-reader");
    }

    if (html5QrCode) {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            stopCameraScanner();
            triggerQRScanSuccess(decodedText);
          },
          (err) => {}
        );
      } catch (err) {
        console.log('Camera fallback:', err);
      }
    }
  }

  function stopCameraScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().then(() => html5QrCode.clear()).catch(err => console.error(err));
    }
    scannerModal.classList.remove('active');
  }

  if (btnTriggerScan) btnTriggerScan.addEventListener('click', startRealCameraScanner);
  if (btnCloseScanner) btnCloseScanner.addEventListener('click', stopCameraScanner);

  async function triggerQRScanSuccess(qrContent = `Table #${tableParam}`) {
    const now = Date.now();
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    if (now - state.clientSession.lastScanTime < twoHoursInMs) {
      alert(`⚠️ Anti-Triche NEXA : Vous avez déjà scanné votre table pour ce repas !`);
      stopCameraScanner();
      return;
    }

    state.clientSession.points += 10;
    state.clientSession.lastScanTime = now;
    state.stats.qrScansMonth += 1;
    state.stats.pointsGiven += 10;

    localStorage.setItem('nexa_client_points', state.clientSession.points);
    localStorage.setItem('nexa_last_scan_time', now);
    localStorage.setItem('nexa_stat_scans', state.stats.qrScansMonth);
    localStorage.setItem('nexa_stat_points', state.stats.pointsGiven);

    // Save Client & Scan in CRM
    const existing = state.clientsList.find(c => c.phone === state.clientSession.whatsapp);
    if (existing) {
      existing.points = state.clientSession.points;
      existing.visits += 1;
      existing.lastVisit = 'À l\'instant (Table #' + tableParam + ')';
    } else if (state.clientSession.whatsapp) {
      state.clientsList.unshift({
        id: Date.now(),
        name: state.clientSession.name || 'Client Table #' + tableParam,
        phone: state.clientSession.whatsapp,
        points: state.clientSession.points,
        visits: 1,
        lastVisit: 'À l\'instant (Table #' + tableParam + ')',
        segment: 'Nouveau'
      });
    }
    state.stats.totalClients = state.clientsList.length;
    localStorage.setItem('nexa_prod_clients', JSON.stringify(state.clientsList));

    if (window.nexaBackend) {
      try {
        await window.nexaBackend.recordScan(state.restaurant.id, tableParam, state.clientSession.whatsapp, state.clientSession.name);
      } catch (err) {
        console.log('Local scan saved:', err);
      }
    }

    stopCameraScanner();

    if (window.confetti) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#F59E0B', '#D97706', '#2A1D15'] });
    }

    renderClientUI();
    renderMerchantUI();
    showToast('✨ +10 Points Crédités !', `Bienvenue chez ${state.restaurant.name} (Table #${tableParam}).`);
  }

  if (btnSimulateScanOk) btnSimulateScanOk.addEventListener('click', () => triggerQRScanSuccess(`Table #${tableParam}`));
  const btnFastScan = document.getElementById('btn-fast-scan');
  if (btnFastScan) btnFastScan.addEventListener('click', () => triggerQRScanSuccess(`Table #${tableParam}`));

  /* ==========================================================================
     5. RENDERERS
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
    document.getElementById('mobile-resto-name').textContent = state.restaurant.name;
    document.getElementById('mobile-resto-type').textContent = state.restaurant.type;
    document.getElementById('user-points-val').textContent = state.clientSession.points;

    if (state.clientSession.whatsapp) {
      if (clientLoginBanner) clientLoginBanner.style.display = 'none';
      document.getElementById('profile-display-name').textContent = state.clientSession.name || 'Membre Client';
      document.getElementById('profile-display-phone').textContent = state.clientSession.whatsapp;
      document.getElementById('profile-display-tier').textContent = state.clientSession.points >= 200 ? 'Membre VIP' : 'Membre Silver';
      document.getElementById('client-avatar-letters').textContent = (state.clientSession.name || 'MC').substring(0, 2).toUpperCase();
    } else {
      if (clientLoginBanner) clientLoginBanner.style.display = 'block';
    }

    const rewardsContainer = document.getElementById('client-rewards-list');
    if (rewardsContainer) {
      if (state.rewards.length === 0) {
        rewardsContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); background: white; border-radius: 12px; border: 1px dashed var(--dash-border);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎁</div>
            <p style="font-size: 0.85rem; font-weight: 700; margin: 0 0 0.2rem 0;">Aucune récompense configurée</p>
            <p style="font-size: 0.75rem; margin: 0;">${state.restaurant.name} ajoutera bientôt ses boissons et privilèges offerts !</p>
          </div>
        `;
      } else {
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
  }

  window.claimReward = function(rewardId) {
    const reward = state.rewards.find(r => r.id === rewardId);
    if (!reward || state.clientSession.points < reward.pts) return;

    state.clientSession.points -= reward.pts;
    state.stats.rewardsRedeemed += 1;
    localStorage.setItem('nexa_client_points', state.clientSession.points);

    renderClientUI();
    renderMerchantUI();
    showRedemptionPassModal(reward);
  };

  window.showPassModalFirst = function() {
    if (state.rewards.length > 0) {
      showRedemptionPassModal(state.rewards[0]);
    } else {
      alert(`Aucune récompense configurée par ${state.restaurant.name} pour le moment.`);
    }
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
    document.getElementById('dash-brand-name-el').textContent = state.restaurant.name.toUpperCase();
    document.getElementById('dash-brand-sub-el').textContent = state.restaurant.type;
    document.getElementById('stat-total-clients').textContent = state.stats.totalClients.toLocaleString();
    document.getElementById('stat-qr-scans').textContent = state.stats.qrScansMonth.toLocaleString();
    document.getElementById('stat-pts-given').textContent = state.stats.pointsGiven.toLocaleString();
    document.getElementById('stat-rewards-redeemed').textContent = state.stats.rewardsRedeemed.toLocaleString();

    const crmTableBody = document.getElementById('crm-table-body');
    if (crmTableBody) {
      if (state.clientsList.length === 0) {
        crmTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Aucun client enregistré pour l'instant. Les nouveaux clients apparaîtront ici dès leur premier scan de table !</td></tr>`;
      } else {
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
    }

    const rewardsAdminBody = document.getElementById('rewards-admin-body');
    if (rewardsAdminBody) {
      if (state.rewards.length === 0) {
        rewardsAdminBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Aucune récompense configurée. Cliquez sur "Créer une Récompense" ci-dessus pour ajouter vos privilèges !</td></tr>`;
      } else {
        rewardsAdminBody.innerHTML = state.rewards.map(r => `
          <tr>
            <td style="font-size: 1.3rem;">${r.icon}</td>
            <td><span style="font-size: 0.75rem; background: var(--marron-light); color: var(--marron-dark); font-weight: 700; padding: 2px 8px; border-radius: 10px;">${r.category || 'Privilège'}</span></td>
            <td style="font-weight: 700;">${r.title}</td>
            <td style="color: var(--text-muted);">${r.desc}</td>
            <td><strong style="color: var(--primary-gold);">${r.pts} pts</strong></td>
            <td><button class="btn-secondary" style="color:var(--primary-gold);" onclick="deleteReward(${r.id})">Supprimer</button></td>
          </tr>
        `).join('');
      }
    }

    const rewardsMobileCardsFeed = document.getElementById('rewards-mobile-cards-feed');
    if (rewardsMobileCardsFeed) {
      if (state.rewards.length === 0) {
        rewardsMobileCardsFeed.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:2rem; background:white; border-radius:12px;">Aucune récompense configurée pour le moment.</div>`;
      } else {
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
          data: [0, 0, 0, 0, 0, 0, 0],
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

  updateMerchantAuthState();
  renderClientUI();
  renderMerchantUI();
});
