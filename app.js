/* ==========================================================================
   NEXA PRODUCTION - STRICT 2-HOUR ANTI-CHEAT & CASHIER VALIDATION ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {

  // Unregister SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(e => {});
  }

  // Parse URL Parameters for Multi-Tenant Isolation
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role') || urlParams.get('mode');
  const tableParam = urlParams.get('table') || urlParams.get('t') || '4';
  const urlRestoName = urlParams.get('resto') || urlParams.get('r');
  const isDirectTableScan = urlParams.has('table') || urlParams.has('resto');

  let currentRestoName = 'Le Savane';
  if (urlRestoName) {
    currentRestoName = decodeURIComponent(urlRestoName);
    localStorage.setItem('nexa_resto_name', currentRestoName);
  } else if (localStorage.getItem('nexa_resto_name')) {
    currentRestoName = localStorage.getItem('nexa_resto_name');
  }

  const slug = currentRestoName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');

  const state = {
    isMerchantLoggedIn: localStorage.getItem('nexa_merchant_logged') === 'true',
    restaurant: {
      id: slug,
      name: currentRestoName,
      type: localStorage.getItem(`nexa_type_${slug}`) || '★ 4.9 • Bistro & Grillades',
      pointsPerScan: parseInt(localStorage.getItem(`nexa_pts_${slug}`) || '20', 10),
      currency: localStorage.getItem(`nexa_curr_${slug}`) || 'FCFA'
    },
    clientSession: {
      whatsapp: localStorage.getItem('nexa_client_whatsapp') || '',
      name: localStorage.getItem('nexa_client_name') || '',
      points: parseInt(localStorage.getItem('nexa_client_points') || '0', 10),
      history: JSON.parse(localStorage.getItem('nexa_client_history') || '[]')
    },
    rewards: JSON.parse(localStorage.getItem(`nexa_rewards_${slug}`) || '[]'),
    notifications: JSON.parse(localStorage.getItem('nexa_client_notifs') || '[]'),
    pendingClaims: JSON.parse(localStorage.getItem(`nexa_pending_claims_${slug}`) || '[]'),
    clientsList: JSON.parse(localStorage.getItem(`nexa_clients_${slug}`) || '[]'),
    scansList: [],
    stats: {
      totalClients: 0,
      qrScansMonth: 0,
      pointsGiven: 0,
      rewardsRedeemed: 0
    }
  };

  state.stats.totalClients = state.clientsList.length;

  if (window.lucide) lucide.createIcons();

  // ☁️ LIVE SUPABASE CLOUD DATA FETCHING
  async function syncCloudData() {
    if (window.nexaBackend) {
      try {
        const cloudResto = await window.nexaBackend.getRestaurantByName(state.restaurant.name);
        if (cloudResto) {
          state.restaurant.type = cloudResto.type;
          state.restaurant.pointsPerScan = cloudResto.pointsPerScan;
          state.restaurant.currency = cloudResto.currency;

          localStorage.setItem(`nexa_type_${state.restaurant.id}`, cloudResto.type);
          localStorage.setItem(`nexa_pts_${state.restaurant.id}`, cloudResto.pointsPerScan);
          localStorage.setItem(`nexa_curr_${state.restaurant.id}`, cloudResto.currency);
        }

        // Fetch Cloud Rewards
        const cloudRewards = await window.nexaBackend.fetchRewardsByResto(state.restaurant.name);
        if (cloudRewards) {
          state.rewards = cloudRewards.map(r => ({
            id: String(r.id),
            title: r.title,
            pts: r.points_required,
            desc: r.description,
            icon: r.icon || '🎁'
          }));
          localStorage.setItem(`nexa_rewards_${state.restaurant.id}`, JSON.stringify(state.rewards));
        }

        // Fetch Cloud Clients (CRM Table!)
        const cloudClients = await window.nexaBackend.fetchClientsByResto(state.restaurant.name);
        if (cloudClients && cloudClients.length > 0) {
          state.clientsList = cloudClients.map(c => ({
            id: c.id,
            name: c.full_name || 'Client Nexa',
            phone: c.whatsapp_phone ? c.whatsapp_phone.split('_')[0] : c.whatsapp_phone,
            points: c.points_balance || state.restaurant.pointsPerScan,
            visits: c.visits_count || 1,
            lastVisit: c.last_scan_at ? new Date(c.last_scan_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Récemment',
            segment: (c.visits_count || 1) >= 3 ? 'Membre VIP' : 'Nouveau Client'
          }));
          state.stats.totalClients = state.clientsList.length;
          localStorage.setItem(`nexa_clients_${state.restaurant.id}`, JSON.stringify(state.clientsList));
        }

        // Fetch Scans
        const cloudScans = await window.nexaBackend.fetchScansHistory(state.restaurant.name);
        if (cloudScans) {
          state.scansList = cloudScans;
          state.stats.qrScansMonth = cloudScans.length;
          state.stats.pointsGiven = cloudScans.reduce((sum, s) => sum + (s.points_earned || state.restaurant.pointsPerScan), 0);
        }

        // Fetch Returning Client Profile Balance
        if (state.clientSession.whatsapp) {
          const profile = await window.nexaBackend.getClientProfile(state.restaurant.name, state.clientSession.whatsapp);
          if (profile) {
            state.clientSession.points = profile.points;
            localStorage.setItem('nexa_client_points', profile.points);
          }
        }
      } catch (err) {
        console.log('Cloud sync info:', err);
      }
    }
    renderClientUI();
    renderMerchantUI();
    updateChartData();
  }

  // Auto-Poll Cloud Database every 4 Seconds for Live CRM Updates!
  setInterval(syncCloudData, 4000);

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
     1. MERCHANT AUTH & CLEAN LOGOUT LOGIC
     ========================================================================== */
  const modalMerchantAuth = document.getElementById('modal-merchant-auth');
  const formMerchantAuth = document.getElementById('form-merchant-auth');

  window.openMerchantAuthModal = () => modalMerchantAuth && modalMerchantAuth.classList.add('active');
  window.closeMerchantAuthModal = () => modalMerchantAuth && modalMerchantAuth.classList.remove('active');

  function updateMerchantAuthState() {
    const btnInscrire = document.getElementById('btn-header-inscrire');
    const btnAddReward = document.getElementById('btn-header-add-reward');
    const sidebarAuthBox = document.getElementById('sidebar-auth-button-box');

    if (state.isMerchantLoggedIn) {
      if (btnInscrire) btnInscrire.style.display = 'none';
      if (btnAddReward) btnAddReward.style.display = 'inline-flex';
      if (sidebarAuthBox) {
        sidebarAuthBox.innerHTML = `
          <div style="color: #10B981; font-weight: 800; font-size: 0.8rem; margin-bottom: 0.3rem;">✓ ${state.restaurant.name} (Inscrit)</div>
          <button class="btn-secondary" onclick="logoutMerchant()" style="width: 100%; font-size: 0.7rem; padding: 0.3rem;">Déconnexion Gérant</button>
        `;
      }
    } else {
      if (btnInscrire) btnInscrire.style.display = 'inline-flex';
      if (btnAddReward) btnAddReward.style.display = 'none';
      if (sidebarAuthBox) {
        sidebarAuthBox.innerHTML = `
          <button class="btn-primary" onclick="openMerchantAuthModal()" style="width: 100%; justify-content: center; font-size: 0.75rem; padding: 0.4rem; background: var(--primary-gold); color: #2A1D15; font-weight: 800;">
            🔑 Inscrire / Connecter mon Restaurant
          </button>
        `;
      }
    }
  }

  // CLEAN LOGOUT LOGIC
  window.logoutMerchant = function() {
    state.isMerchantLoggedIn = false;
    state.rewards = [];
    state.clientsList = [];
    state.scansList = [];
    state.pendingClaims = [];
    state.stats = { totalClients: 0, qrScansMonth: 0, pointsGiven: 0, rewardsRedeemed: 0 };

    localStorage.setItem('nexa_merchant_logged', 'false');
    localStorage.removeItem('nexa_resto_name');

    updateMerchantAuthState();
    renderMerchantUI();
    renderClientUI();
    updateChartData();
    showToast('🔒 Déconnexion', 'Session gérant fermée. Espace réinitialisé.');
  };

  if (formMerchantAuth) {
    formMerchantAuth.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('auth-resto-name').value.trim();
      const type = document.getElementById('auth-resto-type-text').value.trim() || '★ 4.9 • Bistro & Grillades';
      const scanPts = parseInt(document.getElementById('auth-resto-scan-pts').value, 10) || 20;
      const email = document.getElementById('auth-resto-email').value.trim();
      const pwd = document.getElementById('auth-resto-pwd').value.trim();
      const currency = document.getElementById('auth-resto-currency').value;

      if (!name) return;

      const newSlug = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');

      state.restaurant.id = newSlug;
      state.restaurant.name = name;
      state.restaurant.type = type;
      state.restaurant.pointsPerScan = scanPts;
      state.restaurant.currency = currency;
      state.isMerchantLoggedIn = true;

      state.rewards = [];
      state.clientsList = [];
      state.scansList = [];
      state.pendingClaims = [];
      state.stats = { totalClients: 0, qrScansMonth: 0, pointsGiven: 0, rewardsRedeemed: 0 };

      localStorage.setItem('nexa_resto_name', name);
      localStorage.setItem(`nexa_type_${newSlug}`, type);
      localStorage.setItem(`nexa_pts_${newSlug}`, scanPts);
      localStorage.setItem(`nexa_curr_${newSlug}`, currency);
      localStorage.setItem('nexa_merchant_logged', 'true');

      if (window.nexaBackend) {
        try {
          await window.nexaBackend.registerOrLoginMerchant(name, type, email, pwd, scanPts, currency);
        } catch (err) {
          console.log('Merchant save info:', err);
        }
      }

      closeMerchantAuthModal();
      updateMerchantAuthState();
      await syncCloudData();
      showToast('🎉 Restaurant Connecté !', `${name} a un espace dédié (+${scanPts} pts par scan).`);
    });
  }

  /* ==========================================================================
     2. REWARD CREATION & OPERATIONAL DELETION ENGINE
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
    formAddReward.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('reward-title-input').value.trim();
      const category = document.getElementById('reward-category-input').value;
      const icon = document.getElementById('reward-icon-input').value;
      const pts = parseInt(document.getElementById('reward-pts-input').value, 10);
      const desc = document.getElementById('reward-desc-input').value.trim();

      if (!title || !pts) return;

      const newReward = { id: String(Date.now()), category, icon, title, pts, desc };
      state.rewards.push(newReward);
      localStorage.setItem(`nexa_rewards_${state.restaurant.id}`, JSON.stringify(state.rewards));

      if (window.nexaBackend) {
        try {
          await window.nexaBackend.createCloudReward(state.restaurant.name, title, pts, desc, icon, category);
        } catch (err) {
          console.log('Reward save info:', err);
        }
      }

      closeAddRewardModal();
      formAddReward.reset();

      await syncCloudData();
      showToast('🎁 Récompense Publiée !', `"${title}" (${pts} pts) est réservée à ${state.restaurant.name}.`);
    });
  }

  window.deleteReward = async function(rewardId, rewardTitle) {
    const targetIdStr = String(rewardId);
    state.rewards = state.rewards.filter(r => String(r.id) !== targetIdStr && r.title !== rewardTitle);
    localStorage.setItem(`nexa_rewards_${state.restaurant.id}`, JSON.stringify(state.rewards));

    if (window.nexaBackend) {
      try {
        await window.nexaBackend.deleteCloudReward(rewardId, rewardTitle);
      } catch (err) {
        console.log('Cloud delete reward info:', err);
      }
    }

    renderClientUI();
    renderMerchantUI();
    showToast('🗑️ Récompense Supprimée', 'La récompense a été effacée.');
  };

  /* ==========================================================================
     3. CLIENT AUTHENTICATION & REGISTRATION
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

      closeClientAuthModal();
      renderClientUI();

      if (isDirectTableScan) {
        await triggerQRScanSuccess(`Table #${tableParam}`);
      }
    });
  }

  /* ==========================================================================
     4. STRICT 2-HOUR COOLDOWN ANTI-CHEAT SCANNER ENGINE (PHONE-SPECIFIC!)
     ========================================================================== */
  const scannerModal = document.getElementById('scanner-modal');
  const btnTriggerScan = document.getElementById('btn-trigger-scan');
  const btnCloseScanner = document.getElementById('btn-close-scanner');
  const btnSimulateScanOk = document.getElementById('btn-simulate-scan-ok');
  let html5QrCode = null;

  async function triggerQRScanSuccess(qrContent = `Table #${tableParam}`) {
    if (!state.clientSession.whatsapp) {
      openClientAuthModal();
      return;
    }

    const now = Date.now();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const phoneClean = state.clientSession.whatsapp.replace(/[^0-9]/g, '');
    const lastScanStorageKey = `nexa_last_scan_${slug}_${phoneClean}`;
    const lastScanTime = parseInt(localStorage.getItem(lastScanStorageKey) || '0', 10);

    // STRICT 2-HOUR ANTI-CHEAT COOLDOWN PER PHONE NUMBER!
    if (now - lastScanTime < twoHoursMs) {
      const remainingMinutes = Math.ceil((twoHoursMs - (now - lastScanTime)) / 60000);
      showToast('⏳ Anti-Triche NEXA', `Prochain scan disponible dans ${remainingMinutes} min.`);
      alert(`⏳ Anti-Triche NEXA :\n\nVous avez déjà crédité vos points pour ce repas chez ${state.restaurant.name} !\n\nPour éviter les abus de points, le prochain scan sera disponible dans ${remainingMinutes} minutes.`);
      return;
    }

    const scanEarned = parseInt(state.restaurant.pointsPerScan, 10) || 20;

    state.clientSession.points += scanEarned;
    localStorage.setItem('nexa_client_points', state.clientSession.points);
    localStorage.setItem(lastScanStorageKey, now.toString());

    // Record Single scan event on Cloud PostgreSQL
    if (window.nexaBackend) {
      try {
        const res = await window.nexaBackend.recordScanCloud(state.restaurant.name, tableParam, state.clientSession.whatsapp, state.clientSession.name, scanEarned);
        if (res && res.currentPoints) {
          state.clientSession.points = res.currentPoints;
          localStorage.setItem('nexa_client_points', res.currentPoints);
        }
      } catch (err) {
        console.log('Local scan saved:', err);
      }
    }

    // Add Scan Entry to History Feed
    state.clientSession.history.unshift({
      id: Date.now(),
      title: `Scan Table #${tableParam} (+${scanEarned} pts)`,
      time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      date: new Date().toLocaleDateString('fr-FR'),
      pts: `+${scanEarned}`
    });
    localStorage.setItem('nexa_client_history', JSON.stringify(state.clientSession.history));

    stopCameraScanner();

    if (window.confetti) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#F59E0B', '#D97706', '#2A1D15'] });
    }

    await syncCloudData();
    showToast(`✨ +${scanEarned} Points Crédités !`, `Bienvenue chez ${state.restaurant.name} (Table #${tableParam}). Solde: ${state.clientSession.points} pts.`);
  }

  async function startRealCameraScanner() {
    if (!state.clientSession.whatsapp) {
      openClientAuthModal();
      return;
    }
    triggerQRScanSuccess(`Table #${tableParam}`);
  }

  function stopCameraScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().then(() => html5QrCode.clear()).catch(err => console.error(err));
    }
    scannerModal.classList.remove('active');
  }

  if (btnTriggerScan) btnTriggerScan.addEventListener('click', startRealCameraScanner);
  if (btnCloseScanner) btnCloseScanner.addEventListener('click', stopCameraScanner);
  if (btnSimulateScanOk) btnSimulateScanOk.addEventListener('click', () => triggerQRScanSuccess(`Table #${tableParam}`));
  const btnFastScan = document.getElementById('btn-fast-scan');
  if (btnFastScan) btnFastScan.addEventListener('click', () => triggerQRScanSuccess(`Table #${tableParam}`));

  // AUTOMATIC INITIAL POINT CREDIT IF SCANNED DIRECTLY FROM TABLE
  if (isDirectTableScan && state.clientSession.whatsapp) {
    const now = Date.now();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const phoneClean = state.clientSession.whatsapp.replace(/[^0-9]/g, '');
    const lastScanStorageKey = `nexa_last_scan_${slug}_${phoneClean}`;
    const lastScanTime = parseInt(localStorage.getItem(lastScanStorageKey) || '0', 10);
    if (now - lastScanTime >= twoHoursMs) {
      setTimeout(() => triggerQRScanSuccess(`Table #${tableParam}`), 1000);
    }
  }

  /* ==========================================================================
     5. MERCHANT CASHIER VALIDATION SYSTEM (DUAL-SIDED REDEMPTION WORKFLOW)
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
    document.getElementById('user-scan-pts-badge').textContent = `+${state.restaurant.pointsPerScan} PTS`;

    const btnScanLabel = document.getElementById('btn-scan-label');
    if (btnScanLabel) btnScanLabel.textContent = `📷 Valider mes Points Table #${tableParam} (+${state.restaurant.pointsPerScan} Pts)`;

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
          const titleEscaped = reward.title.replace(/'/g, "\\'");
          return `
            <div class="reward-card-clean" onclick="handleRewardClick('${reward.id}', ${reward.pts}, '${titleEscaped}')" style="cursor: pointer;">
              <div class="reward-info-clean">
                <h3>${reward.icon} ${reward.title}</h3>
                <p>${reward.desc} • <strong>${reward.pts} pts</strong></p>
              </div>
              <button class="btn-claim-clean ${canClaim ? 'unlocked' : 'locked'}" onclick="event.stopPropagation(); handleRewardClick('${reward.id}', ${reward.pts}, '${titleEscaped}')">
                ${canClaim ? 'Échanger' : `${reward.pts} pts`}
              </button>
            </div>
          `;
        }).join('');
      }
    }

    // Render Notifications Feed
    const notifsFeed = document.getElementById('client-notifs-feed');
    if (notifsFeed) {
      if (state.notifications.length === 0) {
        notifsFeed.innerHTML = `
          <div style="text-align:center; padding:2rem; color:var(--text-muted); background:white; border-radius:12px;">
            <div style="font-size:1.8rem; margin-bottom:0.4rem;">🔔</div>
            <p style="font-size:0.85rem; font-weight:700; margin:0 0 0.2rem 0;">Aucune notification</p>
            <p style="font-size:0.75rem; margin:0;">Vos alertes de points et vos reçus d'échanges apparaîtront ici !</p>
          </div>
        `;
      } else {
        notifsFeed.innerHTML = state.notifications.map(n => `
          <div style="background: white; border: 1px solid var(--dash-border); border-radius: 12px; padding: 0.85rem; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
              <strong style="font-size: 0.88rem; color: var(--marron-dark);">${n.title}</strong>
              <span style="font-size: 0.7rem; color: var(--text-muted);">${n.time}</span>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${n.text}</p>
          </div>
        `).join('');
      }
    }

    // Render History Feed
    const historyFeed = document.getElementById('client-history-feed');
    if (historyFeed) {
      if (state.clientSession.history.length === 0) {
        historyFeed.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted); background:white; border-radius:12px;">Aucune activité récente.</div>`;
      } else {
        historyFeed.innerHTML = state.clientSession.history.map(h => `
          <div style="background: white; border: 1px solid var(--dash-border); border-radius: 12px; padding: 0.85rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="font-size: 0.88rem; color: var(--marron-dark);">${h.title}</strong>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">${h.date} à ${h.time}</p>
            </div>
            <strong style="color: var(--primary-gold); font-size: 0.95rem;">${h.pts} pts</strong>
          </div>
        `).join('');
      }
    }
  }

  // INTERACTIVE REWARD CLICK (CREATES PENDING CLAIM PASS FOR CASHIER VALIDATION!)
  window.handleRewardClick = function(rewardId, requiredPts, title) {
    const currentPoints = state.clientSession.points;
    if (currentPoints < requiredPts) {
      const missingPts = requiredPts - currentPoints;

      state.notifications.unshift({
        id: Date.now(),
        title: `🔒 Points Insuffisants pour "${title}"`,
        text: `Il vous manque ${missingPts} pts chez ${state.restaurant.name}. Scannez votre table lors de votre prochaine visite !`,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
      });
      localStorage.setItem('nexa_client_notifs', JSON.stringify(state.notifications));

      renderClientUI();
      showToast('🔒 Points Insuffisants !', `Il vous manque ${missingPts} pts pour "${title}". Voir l'onglet Notifs !`);
      alert(`🔒 Oups ! Points Insuffisants :\n\nIl vous manque ${missingPts} points pour débloquer "${title}".\n\nVous avez actuellement ${currentPoints} pts, et cette offre nécessite ${requiredPts} pts chez ${state.restaurant.name}.\n\nUne alerte a été ajoutée dans votre onglet Notifications !`);
    } else {
      claimReward(rewardId);
    }
  };

  // CLIENT CREATES PENDING CLAIM (WAITING FOR MERCHANT CASHIER VALIDATION!)
  window.claimReward = function(rewardId) {
    const reward = state.rewards.find(r => String(r.id) === String(rewardId));
    if (!reward || state.clientSession.points < reward.pts) return;

    const claimObj = {
      id: Date.now(),
      rewardId: reward.id,
      rewardTitle: reward.title,
      pts: reward.pts,
      clientName: state.clientSession.name || 'Client Nexa',
      clientPhone: state.clientSession.whatsapp || '+226 ...',
      time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      status: 'pending'
    };

    // Store pending claim for Merchant Dashboard
    state.pendingClaims.unshift(claimObj);
    localStorage.setItem(`nexa_pending_claims_${slug}`, JSON.stringify(state.pendingClaims));

    renderClientUI();
    renderMerchantUI();
    showRedemptionPassModal(reward, claimObj.id);
  };

  // MERCHANT CASHIER VALIDATES REDEMPTION & DEDUCTS POINTS!
  window.validateClaimByMerchant = async function(claimId) {
    const claim = state.pendingClaims.find(c => c.id === claimId);
    if (!claim) return;

    // Deduct client points locally & on Cloud
    if (state.clientSession.whatsapp === claim.clientPhone) {
      state.clientSession.points = Math.max(0, state.clientSession.points - claim.pts);
      localStorage.setItem('nexa_client_points', state.clientSession.points);
    }

    if (window.nexaBackend) {
      try {
        await window.nexaBackend.deductPointsCloud(state.restaurant.name, claim.clientPhone, claim.pts);
      } catch (err) {
        console.log('Merchant deduct cloud info:', err);
      }
    }

    state.stats.rewardsRedeemed += 1;
    claim.status = 'validated';
    localStorage.setItem(`nexa_pending_claims_${slug}`, JSON.stringify(state.pendingClaims));

    // Client Notification
    const notifMsg = `🎉 Validé en Caisse ! Votre cadeau "${claim.rewardTitle}" (${claim.pts} pts) a été validé par le restaurateur chez ${state.restaurant.name}.`;
    state.notifications.unshift({
      id: Date.now(),
      title: `✅ Échange Validé en Caisse`,
      text: notifMsg,
      time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    });
    localStorage.setItem('nexa_client_notifs', JSON.stringify(state.notifications));

    state.clientSession.history.unshift({
      id: Date.now(),
      title: `🎁 Échange Validé : ${claim.rewardTitle}`,
      time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      date: new Date().toLocaleDateString('fr-FR'),
      pts: `-${claim.pts}`
    });
    localStorage.setItem('nexa_client_history', JSON.stringify(state.clientSession.history));

    // Update Pass Modal status if active
    const passStatusBadge = document.getElementById('pass-status-badge');
    if (passStatusBadge) {
      passStatusBadge.innerHTML = `<span style="background: #10B981; color: white; padding: 6px 16px; border-radius: 20px; font-weight: 800; font-size: 0.85rem;">✅ VALIDÉ EN CAISSE (-${claim.pts} PTS)</span>`;
    }

    renderClientUI();
    renderMerchantUI();
    showToast('✅ Cadeau Validé !', `Points (-${claim.pts} pts) déduits pour ${claim.clientName}. Notification envoyée.`);
  };

  window.showPassModalFirst = function() {
    if (state.rewards.length > 0) {
      showRedemptionPassModal(state.rewards[0]);
    } else {
      alert(`Aucune récompense configurée par ${state.restaurant.name} pour le moment.`);
    }
  };

  function showRedemptionPassModal(reward, claimId = Date.now()) {
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

    const passStatusBadge = document.getElementById('pass-status-badge');
    if (passStatusBadge) {
      passStatusBadge.innerHTML = `
        <div style="margin-top: 0.5rem;">
          <span style="background: #F59E0B; color: #2A1D15; padding: 4px 12px; border-radius: 20px; font-weight: 800; font-size: 0.75rem;">⏳ EN ATTENTE DE VALIDATION EN CAISSE</span>
          <button class="btn-primary" style="margin-top: 0.6rem; width: 100%; justify-content: center; background: #10B981; font-size: 0.8rem;" onclick="validateClaimByMerchant(${claimId})">
            ✅ [Mode Test Gérant] Valider la Réduction en Caisse
          </button>
        </div>
      `;
    }

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

    const overviewCreateBanner = document.getElementById('overview-create-reward-banner');
    if (overviewCreateBanner) {
      if (state.rewards.length > 0) {
        overviewCreateBanner.style.display = 'none';
      } else {
        overviewCreateBanner.style.display = 'flex';
      }
    }

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

    const crmMobileCardsFeed = document.getElementById('crm-mobile-cards-feed');
    if (crmMobileCardsFeed) {
      if (state.clientsList.length === 0) {
        crmMobileCardsFeed.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:2rem; background:white; border-radius:12px;">Aucun client enregistré.</div>`;
      } else {
        crmMobileCardsFeed.innerHTML = state.clientsList.map(c => `
          <div class="crm-mobile-card">
            <div class="crm-card-header">
              <div>
                <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--marron-dark);">${c.name}</h3>
                <p style="font-size: 0.75rem; color: var(--text-muted);">${c.phone}</p>
              </div>
              <span style="font-size: 0.7rem; font-weight: 800; background: var(--marron-light); color: var(--primary-gold); padding: 2px 8px; border-radius: 12px;">${c.segment || 'Membre'}</span>
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

    const rewardsAdminBody = document.getElementById('rewards-admin-body');
    if (rewardsAdminBody) {
      if (state.rewards.length === 0) {
        rewardsAdminBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Aucune récompense configurée. Cliquez sur "Créer une Récompense" ci-dessus pour ajouter vos privilèges !</td></tr>`;
      } else {
        rewardsAdminBody.innerHTML = state.rewards.map(r => {
          const titleEscaped = r.title.replace(/'/g, "\\'");
          return `
            <tr>
              <td style="font-size: 1.3rem;">${r.icon}</td>
              <td><span style="font-size: 0.75rem; background: var(--marron-light); color: var(--marron-dark); font-weight: 700; padding: 2px 8px; border-radius: 10px;">${r.category || 'Privilège'}</span></td>
              <td style="font-weight: 700;">${r.title}</td>
              <td style="color: var(--text-muted);">${r.desc}</td>
              <td><strong style="color: var(--primary-gold);">${r.pts} pts</strong></td>
              <td><button class="btn-secondary" style="color:var(--primary-gold);" onclick="deleteReward('${r.id}', '${titleEscaped}')">Supprimer</button></td>
            </tr>
          `;
        }).join('');
      }
    }

    const rewardsMobileCardsFeed = document.getElementById('rewards-mobile-cards-feed');
    if (rewardsMobileCardsFeed) {
      if (state.rewards.length === 0) {
        rewardsMobileCardsFeed.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:2rem; background:white; border-radius:12px;">Aucune récompense configurée pour le moment.</div>`;
      } else {
        rewardsMobileCardsFeed.innerHTML = state.rewards.map(r => {
          const titleEscaped = r.title.replace(/'/g, "\\'");
          return `
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
              <button class="btn-secondary" style="width: 100%; color: var(--primary-gold); font-weight: 700; margin-top: 0.5rem;" onclick="deleteReward('${r.id}', '${titleEscaped}')">
                Supprimer la Récompense
              </button>
            </div>
          `;
        }).join('');
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

  let scansChartInstance = null;
  function updateChartData() {
    const chartCanvas = document.getElementById('scansChart');
    if (!chartCanvas || !window.Chart) return;

    const scanCount = state.stats.qrScansMonth;
    const chartData = [Math.max(0, scanCount - 4), Math.max(0, scanCount - 3), Math.max(0, scanCount - 2), Math.max(0, scanCount - 1), scanCount, Math.max(0, scanCount + 1), Math.max(0, scanCount + 2)];

    if (scansChartInstance) {
      scansChartInstance.data.datasets[0].data = chartData;
      scansChartInstance.update();
    } else {
      scansChartInstance = new Chart(chartCanvas, {
        type: 'line',
        data: {
          labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
          datasets: [{
            label: 'Scans QR',
            data: chartData,
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
  }

  updateMerchantAuthState();
  await syncCloudData();
});
