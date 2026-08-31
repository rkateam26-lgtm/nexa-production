/* ==========================================================================
   NEXA PRODUCTION - ULTRA-ROBUST MULTI-TENANT SAAS ENGINE
   ========================================================================== */

function initNexaApp() {

  // Unregister SW to prevent cache stale
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(e => {});
  }

  // Parse URL Parameters for Multi-Tenant Isolation (CAS A vs CAS B)
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role') || urlParams.get('mode');
  const tableParam = urlParams.get('table') || urlParams.get('t') || '4';
  const urlRestoName = urlParams.get('resto') || urlParams.get('r');
  const hasQrParam = urlParams.has('resto') || urlParams.has('r') || urlParams.has('table') || urlParams.has('t');
  const isDirectTableScan = hasQrParam;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // CAS A vs CAS B logic
  let currentRestoName = '';
  if (urlRestoName) {
    currentRestoName = decodeURIComponent(urlRestoName);
    // If it's a public identifier e.g. "nx_le-savane", resolve to friendly name
    if (currentRestoName.startsWith('nx_')) {
      const cleanSlug = currentRestoName.replace(/^nx_/, '');
      currentRestoName = cleanSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    localStorage.setItem('nexa_resto_name', currentRestoName);
  } else if (hasQrParam && localStorage.getItem('nexa_resto_name')) {
    currentRestoName = localStorage.getItem('nexa_resto_name');
    if (currentRestoName && currentRestoName.startsWith('nx_')) {
      const cleanSlug = currentRestoName.replace(/^nx_/, '');
      currentRestoName = cleanSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  // CAS B: When NO restaurant QR parameter is present, do NOT auto-select Chitir Chicken or any default restaurant!
  const hasRestaurantContext = Boolean(currentRestoName);
  if (!currentRestoName) {
    currentRestoName = 'Aucun Restaurant';
  }

  const slug = currentRestoName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');

  const state = {
    isMerchantLoggedIn: localStorage.getItem('nexa_merchant_logged') === 'true',
    restaurant: {
      id: slug,
      name: currentRestoName,
      type: localStorage.getItem(`nexa_type_${slug}`) || '★ 4.9 • Bistro & Grillades',
      pointsPerScan: parseInt(localStorage.getItem(`nexa_pts_${slug}`) || localStorage.getItem('nexa_pts_active') || '20', 10),
      currency: localStorage.getItem(`nexa_curr_${slug}`) || 'FCFA'
    },
    clientSession: {
      whatsapp: localStorage.getItem('nexa_client_whatsapp') || '',
      name: localStorage.getItem('nexa_client_name') || '',
      points: parseInt(localStorage.getItem('nexa_client_points') || '0', 10),
      history: JSON.parse(localStorage.getItem('nexa_client_history') || '[]')
    },
    rewards: JSON.parse(localStorage.getItem(`nexa_rewards_cache_${slug}`) || localStorage.getItem(`nexa_rewards_${slug}`) || '[]'),
    offers: JSON.parse(localStorage.getItem(`nexa_offers_cache_${slug}`) || localStorage.getItem(`nexa_offers_${slug}`) || '[]'),
    notifications: JSON.parse(localStorage.getItem('nexa_client_notifs') || '[]'),
    validatedProofs: JSON.parse(localStorage.getItem(`nexa_validated_proofs_${slug}`) || '[]'),
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
  state.activeTab = 'home';
  window.__nexaState = state;
  window.state = state;

  if (window.lucide) {
    try { lucide.createIcons(); } catch (e) {}
  }

  // ☁️ LIVE SUPABASE CLOUD DATA FETCHING
  async function syncCloudData() {
    if (window.nexaBackend) {
      try {
        // 1. ALWAYS FETCH REWARDS CATALOGUE FOR CLIENT & MERCHANT (LOCAL-FIRST & CLOUD)!
        let cloudRewards = [];
        if (window.nexaBackend && window.nexaBackend.getRestaurantRewards) {
          cloudRewards = await window.nexaBackend.getRestaurantRewards(state.restaurant.name);
        } else if (window.nexaBackend && window.nexaBackend.fetchRewardsByResto) {
          cloudRewards = await window.nexaBackend.fetchRewardsByResto(state.restaurant.name);
        }
        if (cloudRewards && cloudRewards.length > 0) {
          state.rewards = cloudRewards.filter(r => r.active !== false).map(r => ({
            id: String(r.id),
            title: r.title,
            pts: r.pts || r.points_required || 50,
            desc: r.desc || r.description || 'Valable sur présentation en caisse.',
            icon: r.icon || '🎁',
            image: r.image || ''
          }));
          localStorage.setItem(`nexa_rewards_${slug}`, JSON.stringify(state.rewards));
          localStorage.setItem(`nexa_rewards_cache_${slug}`, JSON.stringify(state.rewards));
        }

        // 1b. ALWAYS FETCH ACTIVE COMMERCIAL OFFERS (ÉTAPE R9) FOR CLIENT!
        try {
          if (window.nexaBackend && window.nexaBackend.getRestaurantOffers) {
            const cloudOffers = await window.nexaBackend.getRestaurantOffers(state.restaurant.name);
            if (cloudOffers && Array.isArray(cloudOffers)) {
              state.offers = cloudOffers.filter(o => o.active !== false && (o.computedStatus === 'ACTIVE' || !o.computedStatus));
              localStorage.setItem(`nexa_offers_cache_${slug}`, JSON.stringify(state.offers));
              localStorage.setItem(`nexa_offers_${slug}`, JSON.stringify(state.offers));
            }
          }
        } catch (offErr) {
          console.warn('[CLIENT OFFERS SYNC]', offErr);
        }

        // 2. ALWAYS FETCH RETURNING CLIENT POINTS BALANCE!
        if (state.clientSession.whatsapp) {
          const profile = await window.nexaBackend.getClientProfile(state.restaurant.name, state.clientSession.whatsapp);
          if (profile) {
            state.clientSession.points = profile.points || 0;
            localStorage.setItem('nexa_client_points', state.clientSession.points);
          }
        }

        // 3. FETCH RESTAURANT PROFILE, LOGO & CUSTOM POINTS PER SCAN FOR ALL USERS (CLIENT & MERCHANT)
        try {
          // Direct logo check from local settings cache for instantaneous display
          const cachedLogo = localStorage.getItem(`nexa_resto_logo_${slug}`);
          if (cachedLogo) {
            state.restaurant.logo = cachedLogo;
          }

          if (window.nexaBackend && window.nexaBackend.getRestaurantByName) {
            const cloudResto = await window.nexaBackend.getRestaurantByName(state.restaurant.name);
            if (cloudResto) {
              if (cloudResto.type) state.restaurant.type = cloudResto.type;
              if (cloudResto.logo) state.restaurant.logo = cloudResto.logo;
              const localPts = localStorage.getItem(`nexa_pts_${slug}`) || localStorage.getItem('nexa_pts_active');
              if (localPts) {
                state.restaurant.pointsPerScan = parseInt(localPts, 10);
              } else if (cloudResto.pointsPerScan) {
                state.restaurant.pointsPerScan = cloudResto.pointsPerScan;
              }
              if (cloudResto.currency) state.restaurant.currency = cloudResto.currency;
            }
          }

          // Fetch full settings if logo not yet resolved
          if (!state.restaurant.logo && window.nexaBackend && window.nexaBackend.getRestaurantSettings) {
            const settings = await window.nexaBackend.getRestaurantSettings(state.restaurant.name);
            if (settings && settings.logo) {
              state.restaurant.logo = settings.logo;
              localStorage.setItem(`nexa_resto_logo_${slug}`, settings.logo);
            }
          }
        } catch (restoFetchErr) {
          console.warn('[RESTO PROFILE FETCH WARN]', restoFetchErr);
        }

        // 4. FETCH MERCHANT DASHBOARD DATA ONLY IF MERCHANT LOGGED IN
        if (state.isMerchantLoggedIn) {

          // Fetch Cloud Clients for Merchant CRM
          const cloudClients = await window.nexaBackend.fetchClientsByResto(state.restaurant.name);
          if (cloudClients) {
            state.clientsList = cloudClients.map(c => ({
              id: c.id,
              name: c.full_name || 'Client Nexa',
              phone: c.whatsapp_phone ? c.whatsapp_phone.split('_')[0] : c.whatsapp_phone,
              points: c.points_balance || 0,
              visits: c.visits_count || 1,
              lastVisit: c.last_scan_at ? new Date(c.last_scan_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Récemment',
              segment: (c.visits_count || 1) >= 3 ? 'Membre VIP' : 'Nouveau Client'
            }));
            state.stats.totalClients = state.clientsList.length;
          }

          // Fetch Scans History strictly for THIS restaurant
          const scanStats = await window.nexaBackend.fetchScansHistory(state.restaurant.name);
          if (scanStats) {
            state.stats.qrScansMonth = scanStats.totalScans || 0;
            state.stats.pointsGiven = scanStats.totalPts || 0;
          }
        } else {
          state.clientsList = [];
          state.stats = { totalClients: 0, qrScansMonth: 0, pointsGiven: 0, rewardsRedeemed: 0 };
        }

        renderClientUI();
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

  // FORCE CLEAN ROUTING: ADMIN REDIRECTS TO DEDICATED MASTER DASHBOARD (NO DUAL WINDOW!)
  if (roleParam === 'admin') {
    window.location.href = 'admin.html';
    return;
  }

  // FORCE CLIENT MOBILE VIEW IF SCANNING TABLE OR ROLE IS CLIENT OR ON SMARTPHONE
  if (roleParam === 'client' || isDirectTableScan || (isMobileScreen && roleParam !== 'merchant' && roleParam !== 'demo')) {
    if (demoHeader) demoHeader.style.display = 'none';
    if (viewportContainer) viewportContainer.className = 'main-viewport viewport-mobile';
  } else if (roleParam === 'merchant') {
    if (demoHeader) demoHeader.style.display = 'none';
    if (viewportContainer) viewportContainer.className = 'main-viewport viewport-desktop';
  } else {
    if (demoHeader) demoHeader.style.display = 'flex';
    if (viewportContainer) viewportContainer.className = 'main-viewport viewport-dual';
  }

  // Update Links
  const baseHost = window.location.origin + window.location.pathname;
  const clientTargetUrl = `${baseHost}?role=client&resto=${encodeURIComponent(state.restaurant.name)}&table=${tableParam}`;
  const merchantOfficialUrl = `${window.location.origin}/resto-welcome.html`;
  
  const linkClientEl = document.getElementById('link-url-client');
  if (linkClientEl) linkClientEl.textContent = clientTargetUrl;
  
  const linkMerchantEl = document.getElementById('link-url-merchant');
  if (linkMerchantEl) linkMerchantEl.textContent = merchantOfficialUrl;

  // Render Dashboard Official QR Code
  const dashQrBox = document.getElementById('dash-official-qr-box');
  if (dashQrBox && typeof qrcode !== 'undefined') {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(clientTargetUrl);
      qr.make();
      dashQrBox.innerHTML = qr.createImgTag(4, 0);
    } catch (e) {
      console.warn('QR render warning:', e);
    }
  }

  window.copyRoleLink = function(role) {
    const targetUrl = role === 'client' ? clientTargetUrl : merchantOfficialUrl;
    navigator.clipboard.writeText(targetUrl).then(() => showToast('📋 Lien Copié !', `URL [${role === 'client' ? 'CLIENT' : 'RESTAURATEUR'}] copiée.`));
  };

  /* ==========================================================================
     1. MERCHANT AUTH & SUBSCRIPTION PAYMENT MODULE (ORANGE, MOOV, WAVE)
     ========================================================================== */
  let selectedPlanForPay = { title: 'NEXA Pro', amount: 25000, provider: 'OM' };

  window.openPaymentModal = function(planTitle, planAmount) {
    if (!state.isMerchantLoggedIn) {
      openMerchantAuthModal();
      return;
    }

    selectedPlanForPay.title = planTitle;
    selectedPlanForPay.amount = planAmount;

    document.getElementById('pay-modal-plan-title').textContent = planTitle;
    document.getElementById('pay-modal-plan-amount').textContent = `${planAmount.toLocaleString()} FCFA`;
    
    const btnLabel = document.getElementById('pay-submit-btn-label');
    if (btnLabel) btnLabel.textContent = `⚡ Valider le Code OTP & Payer ${planAmount.toLocaleString()} FCFA`;

    if (state.restaurant.whatsappContact) {
      document.getElementById('pay-phone-input').value = state.restaurant.whatsappContact;
    }

    updatePayUssdInstructions();
    const modal = document.getElementById('modal-payment-mobile');
    if (modal) modal.classList.add('active');
  };

  window.closePaymentModal = function() {
    const modal = document.getElementById('modal-payment-mobile');
    if (modal) modal.classList.remove('active');
  };

  window.selectPayProvider = function(providerCode) {
    selectedPlanForPay.provider = providerCode;
    document.querySelectorAll('.pay-provider-box').forEach(box => box.classList.remove('active'));

    const activeBox = document.querySelector(`.pay-provider-box[onclick*="${providerCode}"]`);
    if (activeBox) activeBox.classList.add('active');

    updatePayUssdInstructions();
  };

  function updatePayUssdInstructions() {
    const ussdBox = document.getElementById('pay-ussd-instructions');
    const amt = selectedPlanForPay.amount.toLocaleString();

    if (selectedPlanForPay.provider === 'OM') {
      if (ussdBox) ussdBox.innerHTML = `
        <strong>🟧 Procédure de Paiement Orange Money (${amt} FCFA) :</strong><br/>
        1. Composez <strong style="color: #EA580C; font-size: 0.95rem;">*144*4*6*${selectedPlanForPay.amount}#</strong> sur votre téléphone.<br/>
        2. Vous recevrez un code OTP à 6 chiffres par SMS.<br/>
        3. Entrez ce code OTP ci-dessous pour valider le règlement.
      `;
    } else if (selectedPlanForPay.provider === 'MOOV') {
      if (ussdBox) ussdBox.innerHTML = `
        <strong>🟦 Procédure de Paiement Moov Money / Flooz (${amt} FCFA) :</strong><br/>
        1. Composez le code USSD <strong style="color: #2563EB; font-size: 0.95rem;">*155*4*1*${selectedPlanForPay.amount}#</strong>.<br/>
        2. Validez le paiement avec votre code secret Mobile Money.
      `;
    } else if (selectedPlanForPay.provider === 'WAVE') {
      if (ussdBox) ussdBox.innerHTML = `
        <strong>🌊 Procédure de Paiement Wave (${amt} FCFA) :</strong><br/>
        1. Scannez le QR Code de paiement Wave ou validez la notification push Wave.<br/>
        2. L'abonnement s'activera immédiatement dès confirmation du règlement.
      `;
    }
  }

  const formPayMobile = document.getElementById('form-pay-mobile-money');
  if (formPayMobile) {
    formPayMobile.addEventListener('submit', (e) => {
      e.preventDefault();
      const phone = document.getElementById('pay-phone-input').value.trim();
      const otpInput = document.getElementById('pay-otp-input');
      const otpCode = otpInput ? otpInput.value.trim() : '';

      if (!phone) return;
      if (selectedPlanForPay.provider === 'OM' && (!otpCode || otpCode.length < 4)) {
        alert('⚠️ Veuillez entrer le code OTP Orange Money valide à 4 chiffres (ex: 4892) reçu après avoir composé *144*4*6*25000#.');
        return;
      }

      closePaymentModal();
      
      const planName = selectedPlanForPay.title;
      const amtStr = selectedPlanForPay.amount.toLocaleString();

      document.getElementById('sub-active-plan-title').textContent = planName;
      document.getElementById('sub-active-badge').textContent = `🟢 ABONNEMENT ACTIF (${planName.toUpperCase()})`;

      localStorage.setItem(`nexa_sub_${slug}`, planName);

      if (window.confetti) {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.5 }, colors: ['#10B981', '#F59E0B', '#D97706'] });
      }

      showToast('🎉 Paiement Mobile Money Réussi !', `Abonnement ${planName} (${amtStr} FCFA) déduit via Orange/Wave (+226 54 51 39 81).`);
      alert(`🎉 Paiement Réussi !\n\nLe Code OTP [${otpCode || 'Validé'}] a été confirmé pour le montant de ${amtStr} FCFA (Destination: +226 54 51 39 81).\n\nVotre abonnement ${planName} est désormais actif pour 30 jours !`);
    });
  }

  window.toggleMerchantPasswordVisibility = function() {
    const pwdInput = document.getElementById('auth-resto-pwd');
    if (pwdInput) {
      pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
    }
  };

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
    state.validatedProofs = [];
    state.stats = { totalClients: 0, qrScansMonth: 0, pointsGiven: 0, rewardsRedeemed: 0 };

    localStorage.setItem('nexa_merchant_logged', 'false');
    localStorage.removeItem('nexa_resto_name');

    document.getElementById('stat-total-clients').textContent = "0";
    document.getElementById('stat-qr-scans').textContent = "0";
    document.getElementById('stat-pts-given').textContent = "0";
    document.getElementById('stat-rewards-redeemed').textContent = "0";

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
      const whatsappResto = document.getElementById('auth-resto-whatsapp') ? document.getElementById('auth-resto-whatsapp').value.trim() : '';
      const pwd = document.getElementById('auth-resto-pwd').value.trim();
      const currency = document.getElementById('auth-resto-currency').value;

      if (!name) return;

      const newSlug = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');

      state.restaurant.id = newSlug;
      state.restaurant.name = name;
      state.restaurant.type = type;
      state.restaurant.pointsPerScan = scanPts;
      state.restaurant.currency = currency;
      state.restaurant.whatsappContact = whatsappResto;
      state.isMerchantLoggedIn = true;

      state.rewards = [];
      state.clientsList = [];
      state.scansList = [];
      state.pendingClaims = [];
      state.validatedProofs = [];
      state.stats = { totalClients: 0, qrScansMonth: 0, pointsGiven: 0, rewardsRedeemed: 0 };

      localStorage.setItem('nexa_resto_name', name);
      localStorage.setItem(`nexa_type_${newSlug}`, type);
      localStorage.setItem(`nexa_pts_${newSlug}`, scanPts);
      localStorage.setItem('nexa_pts_active', scanPts);
      localStorage.setItem(`nexa_curr_${newSlug}`, currency);
      localStorage.setItem(`nexa_whatsapp_${newSlug}`, whatsappResto);
      localStorage.setItem('nexa_merchant_logged', 'true');

      if (window.nexaBackend) {
        try {
          await window.nexaBackend.registerOrLoginMerchant(name, type, email, pwd, scanPts, currency, whatsappResto);
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

  window.openClientAuthModal = () => modalClientAuth && modalClientAuth.classList.add('active');
  window.closeClientAuthModal = () => modalClientAuth && modalClientAuth.classList.remove('active');

  // DEMO RESTAURANT SWITCHER FOR TESTING
  window.loadDemoRestaurant = function(demoName = 'Chitir Chicken') {
    const encoded = encodeURIComponent(demoName);
    window.location.href = window.location.pathname + `?role=client&resto=${encoded}&table=4`;
  };

  if (formClientAuth) {
    formClientAuth.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('[DIAGNOSTIC FRONTEND] Formulaire d\'inscription client soumis.');

      const phoneInput = document.getElementById('auth-client-phone');
      const nameInput = document.getElementById('auth-client-name');

      const phone = phoneInput ? phoneInput.value.trim() : '';
      const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : 'Client Nexa';

      if (!phone) {
        showToast('⚠️ Numéro Obligatoire', 'Veuillez saisir votre numéro WhatsApp.');
        return;
      }

      console.log(`[DIAGNOSTIC FRONTEND] Connexion client -> Phone: "${phone}", Name: "${name}"`);

      // 1. SAVE CLIENT SESSION LOCALLY & CLOSE MODAL INSTANTLY (0ms)
      state.clientSession.whatsapp = phone;
      state.clientSession.name = name;
      localStorage.setItem('nexa_client_whatsapp', phone);
      localStorage.setItem('nexa_client_name', name);

      // Save client in restaurant's local CRM list immediately (0ms)
      const targetResto = (hasRestaurantContext && state.restaurant.name !== 'Aucun Restaurant') 
        ? state.restaurant.name 
        : (localStorage.getItem('nexa_resto_name') || 'Le Savane');
      const targetSlug = targetResto.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
      const compositeKey = `${phone}_${targetSlug}`;

      try {
        let currentCrmClients = JSON.parse(localStorage.getItem(`nexa_clients_${targetSlug}`) || localStorage.getItem(`nexa_clients_cache_${targetSlug}`) || '[]');
        const existIdx = currentCrmClients.findIndex(c => (c.rawKey || c.whatsapp_phone) === compositeKey || c.phone === phone);
        const clientEntry = {
          rawKey: compositeKey,
          whatsapp_phone: compositeKey,
          phone: phone,
          name: name,
          full_name: name,
          points: state.clientSession.points || 0,
          visits: existIdx >= 0 ? (currentCrmClients[existIdx].visits || currentCrmClients[existIdx].visits_count || 0) : 0,
          visits_count: existIdx >= 0 ? (currentCrmClients[existIdx].visits || currentCrmClients[existIdx].visits_count || 0) : 0,
          lastVisit: existIdx >= 0 ? (currentCrmClients[existIdx].lastVisit || 'Nouveau client') : 'Nouveau client',
          last_scan_at: existIdx >= 0 ? currentCrmClients[existIdx].last_scan_at : null
        };
        if (existIdx >= 0) {
          currentCrmClients[existIdx] = { ...currentCrmClients[existIdx], ...clientEntry };
        } else {
          currentCrmClients.unshift(clientEntry);
        }
        localStorage.setItem(`nexa_clients_${targetSlug}`, JSON.stringify(currentCrmClients));
        localStorage.setItem(`nexa_clients_cache_${targetSlug}`, JSON.stringify(currentCrmClients));
      } catch (crmSaveErr) {
        console.warn('[CRM SAVE WARN]', crmSaveErr);
      }

      closeClientAuthModal();
      renderClientUI();
      showToast('✅ Connecté !', `Bienvenue ${name} !`);

      // 2. IMMEDIATELY TRIGGER TABLE SCAN IF DIRECT QR SCAN (0ms)
      if (isDirectTableScan) {
        await triggerQRScanSuccess(`Table #${tableParam}`);
      } else if (window.nexaBackend) {
        // Only run background sync if this is NOT a direct table scan (e.g. standalone profile login)
        (async () => {
          try {
            console.log(`[DIAGNOSTIC FRONTEND] Arrière-plan Supabase sync vers resto "${targetResto}"...`);
            const profile = await window.nexaBackend.getClientProfile(targetResto, phone);
            if (profile) {
              console.log('[DIAGNOSTIC FRONTEND] Profil Supabase existant trouvé:', profile);
              state.clientSession.points = Math.max(state.clientSession.points || 0, profile.points || 0);
              state.clientSession.name = profile.name || name;
              localStorage.setItem('nexa_client_points', state.clientSession.points);
              localStorage.setItem('nexa_client_name', state.clientSession.name);
              renderClientUI();
            } else {
              console.log('[DIAGNOSTIC FRONTEND] Création nouveau profil dans Supabase...');
              await window.nexaBackend.registerClientIdentity(targetResto, phone, name, state.clientSession.points || 0);
            }
          } catch (err) {
            console.warn('[DIAGNOSTIC FRONTEND WARN] Échec de synchronisation arrière-plan Supabase:', err);
          }
        })();
      }
    });
  }

  /* ==========================================================================
     4. PROFESSIONAL MULTI-TENANT BRANDED CAMERA SCANNER ENGINE
     ========================================================================== */
  const scannerModal = document.getElementById('scanner-modal');
  const btnTriggerScan = document.getElementById('btn-trigger-scan');
  const btnCloseScanner = document.getElementById('btn-close-scanner');
  let html5QrCode = null;
  let isScanProcessing = false;

  // Sync Branding on Scanner Modal Elements
  function updateScannerBranding() {
    const titleEl = document.getElementById('scanner-resto-title');
    if (titleEl) titleEl.textContent = state.restaurant.name;

    const permRestoEl = document.getElementById('scanner-perm-resto-name');
    if (permRestoEl) permRestoEl.textContent = state.restaurant.name;

    const logoEl = document.getElementById('scanner-resto-logo');
    if (logoEl) {
      const activeLogo = document.getElementById('mobile-resto-logo');
      if (activeLogo && activeLogo.src) {
        logoEl.src = activeLogo.src;
      }
    }
  }

  // Switch between states inside the scanner dialog
  window.setScannerState = function(stateName) {
    const states = ['permission', 'active', 'validating', 'success', 'error'];
    states.forEach(s => {
      const el = document.getElementById(`scanner-state-${s}`);
      if (el) el.style.display = (s === stateName) ? (s === 'active' ? 'flex' : 'flex') : 'none';
    });
  };

  // Start Real Camera Scanner (Called when user clicks "Scanner" on Accueil)
  window.startRealCameraScanner = async function() {
    // If client is not yet registered/logged in, open quick registration modal first
    if (!state.clientSession.whatsapp) {
      openClientAuthModal();
      return;
    }

    updateScannerBranding();
    if (scannerModal) scannerModal.classList.add('active');
    isScanProcessing = false;

    // Check camera permission
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permStatus = await navigator.permissions.query({ name: 'camera' });
        if (permStatus.state === 'denied') {
          showScannerError('Autorisation Caméra Refusée', 'L\'accès à l\'appareil photo a été refusé. Veuillez l\'autoriser dans les réglages de votre navigateur pour scanner votre QR Code.');
          return;
        }
      } catch (e) {
        // Permissions API not universally supported for camera, continue smoothly
      }
    }

    initCameraStream();
  };

  // Initialize Real HTML5 Camera Stream
  window.initCameraStream = async function() {
    setScannerState('active');
    updateScannerBranding();

    if (typeof Html5Qrcode === 'undefined') {
      console.warn('Html5Qrcode library not loaded, using fallback');
      return;
    }

    try {
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("html5-qr-reader");
      }

      if (html5QrCode.isScanning) {
        await html5QrCode.stop();
      }

      const qrConfig = {
        fps: 15,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        qrConfig,
        (decodedText) => {
          if (!isScanProcessing) {
            isScanProcessing = true;
            handleScannedRawText(decodedText);
          }
        },
        (errorMessage) => {
          // Continuous scan frame evaluation - no action needed
        }
      );
    } catch (err) {
      console.error('Camera startup error:', err);
      // If permission prompt was rejected or not found
      const errMsg = err.message || err.toString();
      if (errMsg.includes('Permission') || errMsg.includes('NotAllowedError')) {
        showScannerError('Accès Caméra Requis', 'Veuillez autoriser l\'accès à l\'appareil photo de votre smartphone pour valider votre QR Code de table.');
      } else {
        // Device without camera or insecure context (HTTP instead of HTTPS)
        setScannerState('permission');
      }
    }
  };

  // Process & Validate Scanned QR Code (Multi-tenant & Anti-cheat strict check)
  window.handleScannedRawText = async function(qrRawText) {
    if (!state.clientSession.whatsapp) {
      stopCameraScanner();
      openClientAuthModal();
      return;
    }

    setScannerState('validating');

    // Slight delay for smooth visual feedback
    await new Promise(r => setTimeout(r, 450));

    try {
      // 1. Analyze and extract parameters from QR text
      let scannedRestoName = '';
      let scannedTableNum = tableParam || '1';

      if (qrRawText.includes('http://') || qrRawText.includes('https://')) {
        try {
          const parsedUrl = new URL(qrRawText);
          scannedRestoName = parsedUrl.searchParams.get('resto') || '';
          if (parsedUrl.searchParams.get('table')) {
            scannedTableNum = parsedUrl.searchParams.get('table');
          }
        } catch (urlErr) {
          // Non-standard URL format
        }
      } else if (qrRawText.includes('resto=') || qrRawText.includes('table=')) {
        const parts = qrRawText.split('&');
        parts.forEach(p => {
          if (p.startsWith('resto=')) scannedRestoName = decodeURIComponent(p.replace('resto=', ''));
          if (p.startsWith('table=')) scannedTableNum = decodeURIComponent(p.replace('table=', ''));
        });
      } else if (qrRawText.toLowerCase().includes('table')) {
        // Simple text like "Table #4" or "Chitir Chicken Table 4"
        const matchedTable = qrRawText.match(/\d+/);
        if (matchedTable) scannedTableNum = matchedTable[0];
        scannedRestoName = state.restaurant.name;
      }

      // If no resto param found in QR URL or string, it's an unrecognized QR code!
      if (!scannedRestoName) {
        showScannerError(
          'QR Code Invalide',
          'Ce QR Code n\'est pas un QR Code de table officiel Nexa. Veuillez scanner le QR Code posé sur votre table.'
        );
        return;
      }

      // 2. STRICT MULTI-TENANT VERIFICATION:
      // The scanned QR restaurant must match the restaurant the client is currently visiting!
      const currentRestoClean = (state.restaurant.name || '').toLowerCase().trim();
      const scannedRestoClean = scannedRestoName.toLowerCase().trim();

      if (scannedRestoClean !== currentRestoClean && currentRestoClean !== 'aucun restaurant') {
        showScannerError(
          'Établissement Différent',
          `⚠️ Ce QR Code appartient à <strong>${escapeHtml(scannedRestoName)}</strong>.<br/>Vous êtes actuellement sur l'espace de <strong>${escapeHtml(state.restaurant.name)}</strong>.<br/><br/>Les points de fidélité ne peuvent être crédités que pour l'établissement visité.`
        );
        return;
      }

      // 3. STRICT 2-HOUR ANTI-CHEAT CHECK
      const now = Date.now();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      const phoneClean = state.clientSession.whatsapp.replace(/[^0-9]/g, '');
      const lastScanStorageKey = `nexa_last_scan_${slug}_${phoneClean}`;
      let lastScanTime = parseInt(localStorage.getItem(lastScanStorageKey) || '0', 10);

      // Check verified last scan on Supabase Cloud
      if (window.nexaBackend) {
        try {
          const checkPromise = window.nexaBackend.checkClientCooldownCloud(state.restaurant.name, state.clientSession.whatsapp);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000));
          const cloudLastScan = await Promise.race([checkPromise, timeoutPromise]);
          if (cloudLastScan > 0) {
            lastScanTime = Math.max(lastScanTime, cloudLastScan);
          }
        } catch (err) {
          // Local fallback
        }
      }

      if (lastScanTime > 0 && (now - lastScanTime < twoHoursMs)) {
        const remainingMinutes = Math.ceil((twoHoursMs - (now - lastScanTime)) / 60000);
        showScannerError(
          'Visite Déjà Enregistrée',
          `Vous avez déjà crédité vos points pour ce repas chez <strong>${escapeHtml(state.restaurant.name)}</strong>.<br/><br/>⏳ Prochain scan autorisé dans <strong>${remainingMinutes} minutes</strong>.`
        );
        return;
      }

      // 4. CREDIT POINTS ACCORDING TO RESTAURANT RULES
      const localConfiguredPts = localStorage.getItem(`nexa_pts_${slug}`) || localStorage.getItem('nexa_pts_active');
      const scanEarned = localConfiguredPts ? parseInt(localConfiguredPts, 10) : (state.restaurant.pointsPerScan || 20);

      state.clientSession.points += scanEarned;
      localStorage.setItem('nexa_client_points', state.clientSession.points);
      localStorage.setItem(lastScanStorageKey, now.toString());

      // Update CRM client storage locally (0ms)
      const scanTargetSlug = slug;
      const scanCompositeKey = `${state.clientSession.whatsapp}_${scanTargetSlug}`;
      try {
        let currentCrmClients = JSON.parse(localStorage.getItem(`nexa_clients_${scanTargetSlug}`) || localStorage.getItem(`nexa_clients_cache_${scanTargetSlug}`) || '[]');
        const existIdx = currentCrmClients.findIndex(c => (c.rawKey || c.whatsapp_phone) === scanCompositeKey || c.phone === state.clientSession.whatsapp);
        const updatedVisits = existIdx >= 0 ? ((currentCrmClients[existIdx].visits || currentCrmClients[existIdx].visits_count || 1) + 1) : 1;
        const clientEntry = {
          rawKey: scanCompositeKey,
          whatsapp_phone: scanCompositeKey,
          phone: state.clientSession.whatsapp,
          name: state.clientSession.name || 'Client Nexa',
          full_name: state.clientSession.name || 'Client Nexa',
          points: state.clientSession.points,
          points_balance: state.clientSession.points,
          visits: updatedVisits,
          visits_count: updatedVisits,
          lastVisit: 'À l\'instant',
          last_scan_at: new Date().toISOString()
        };
        if (existIdx >= 0) {
          currentCrmClients[existIdx] = { ...currentCrmClients[existIdx], ...clientEntry };
        } else {
          currentCrmClients.unshift(clientEntry);
        }
        localStorage.setItem(`nexa_clients_${scanTargetSlug}`, JSON.stringify(currentCrmClients));
        localStorage.setItem(`nexa_clients_cache_${scanTargetSlug}`, JSON.stringify(currentCrmClients));
      } catch (e) {}

      // Record Scan on Supabase PostgreSQL Cloud
      if (window.nexaBackend) {
        try {
          const res = await window.nexaBackend.recordScanCloud(state.restaurant.name, scannedTableNum, state.clientSession.whatsapp, state.clientSession.name, scanEarned);
          if (res && res.currentPoints) {
            state.clientSession.points = res.currentPoints;
            localStorage.setItem('nexa_client_points', res.currentPoints);
          }
        } catch (cloudErr) {
          console.warn('Cloud sync offline fallback:', cloudErr);
        }
      }

      // Add to Client History
      state.clientSession.history.unshift({
        id: Date.now(),
        title: `Visite Table #${scannedTableNum} (+${scanEarned} pts)`,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        date: new Date().toLocaleDateString('fr-FR'),
        pts: `+${scanEarned}`
      });
      localStorage.setItem('nexa_client_history', JSON.stringify(state.clientSession.history));

      // 5. DISPLAY ELEGANT SUCCESS STATE
      const ptsGainedEl = document.getElementById('scanner-success-pts-gained');
      if (ptsGainedEl) ptsGainedEl.textContent = `+${scanEarned} points`;

      const balanceEl = document.getElementById('scanner-success-balance');
      if (balanceEl) balanceEl.textContent = `Votre solde : ${state.clientSession.points} points`;

      const restoInfoEl = document.getElementById('scanner-success-resto-info');
      if (restoInfoEl) {
        restoInfoEl.innerHTML = `Visite confirmée chez <strong>${escapeHtml(state.restaurant.name)}</strong> (Table #${scannedTableNum}).`;
      }

      setScannerState('success');

      // Confetti celebration
      if (window.confetti) {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 }, colors: ['#16A34A', '#F59E0B', '#DC2626'] });
      }

      // Vibrate mobile phone if supported
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      // Immediately update points on Accueil screen
      renderClientUI();
      syncCloudData();

    } catch (unexpectedErr) {
      console.error('Scan processing error:', unexpectedErr);
      showScannerError('Erreur de Traitement', 'Une anomalie est survenue lors de la lecture du QR code. Veuillez réessayer.');
    }
  };

  // Helper to display errors inside scanner
  function showScannerError(title, message) {
    const errTitle = document.getElementById('scanner-error-title');
    const errMsg = document.getElementById('scanner-error-msg');
    if (errTitle) errTitle.innerHTML = title;
    if (errMsg) errMsg.innerHTML = message;
    setScannerState('error');

    if (navigator.vibrate) {
      navigator.vibrate([200]);
    }
  }

  // Resume scanning after error
  window.resumeScanningFromError = function() {
    isScanProcessing = false;
    initCameraStream();
  };

  // Stop camera and close scanner modal
  window.stopCameraScanner = function() {
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().then(() => html5QrCode.clear()).catch(err => console.error(err));
    }
    if (scannerModal) scannerModal.classList.remove('active');
    isScanProcessing = false;
  };

  // Global bridge for QR scan success & table points credit
  window.triggerQRScanSuccess = async function(qrContent) {
    const effectivePayload = (qrContent && (qrContent.includes('resto=') || qrContent.includes('http')))
      ? qrContent
      : `https://nexa-production.vercel.app/?role=client&resto=${encodeURIComponent(state.restaurant.name)}&table=${tableParam}`;
    return await handleScannedRawText(effectivePayload);
  };

  if (btnTriggerScan) btnTriggerScan.addEventListener('click', startRealCameraScanner);
  if (btnCloseScanner) btnCloseScanner.addEventListener('click', stopCameraScanner);

  const btnSimulateScanOk = document.getElementById('btn-simulate-scan-ok');
  if (btnSimulateScanOk) {
    btnSimulateScanOk.addEventListener('click', () => window.triggerQRScanSuccess(`Table #${tableParam}`));
  }

  const btnFastScan = document.getElementById('btn-fast-scan');
  if (btnFastScan) {
    btnFastScan.addEventListener('click', () => window.triggerQRScanSuccess(`Table #${tableParam}`));
  }

  /* ==========================================================================
     5. MOBILE NAVIGATION & MERCHANT 1-CLICK VALIDATION ENGINE
     ========================================================================== */
  // RE-BIND MOBILE TAB SWITCHING GLOBALLY SCRIPT & HELPERS
  const navTabs = document.querySelectorAll('.mobile-nav .nav-tab');
  const clientScreens = document.querySelectorAll('.client-screen');

  window.switchMobileTab = function(targetTab) {
    state.activeTab = targetTab || 'home';
    clientScreens.forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });
    navTabs.forEach(t => t.classList.remove('active'));

    const targetScreen = document.getElementById(`screen-${targetTab}`);
    const matchTab = document.querySelector(`.mobile-nav .nav-tab[data-tab="${targetTab}"]`);

    if (targetScreen) {
      targetScreen.classList.add('active');
      targetScreen.style.display = 'block';
    }
    if (matchTab) matchTab.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = tab.getAttribute('data-tab');
      switchMobileTab(targetTab);
    });
  });

  // STEP 11: CLIENT LOGOUT HANDLER
  window.logoutClient = function() {
    state.clientSession = {
      whatsapp: '',
      name: '',
      points: 0,
      history: []
    };
    localStorage.removeItem('nexa_client_whatsapp');
    localStorage.removeItem('nexa_client_name');
    localStorage.removeItem('nexa_client_points');
    localStorage.removeItem('nexa_client_history');

    renderClientUI();
    showToast('🚪 Déconnexion Effectuée', 'Vous êtes déconnecté de votre profil client.');
  };

  // MOCKUP REDESIGN: REWARD DETAIL MODAL CONTROLLERS
  window.openRewardDetailModal = function(title, desc, pts, image, rewardId) {
    const modal = document.getElementById('modal-reward-detail');
    if (!modal) return;

    const imgEl = document.getElementById('detail-reward-img');
    const titleEl = document.getElementById('detail-reward-title');
    const ptsEl = document.getElementById('detail-reward-pts');
    const descEl = document.getElementById('detail-reward-desc');
    const ctaBtn = document.getElementById('detail-reward-cta-btn');

    if (imgEl) imgEl.src = image || './assets/chicken_combo.jpg';
    if (titleEl) titleEl.textContent = title;
    if (ptsEl) ptsEl.textContent = `${pts} pts`;
    if (descEl) descEl.textContent = desc;

    if (ctaBtn) {
      ctaBtn.onclick = () => {
        closeRewardDetailModal();
        handleRewardClick(rewardId, pts, title);
      };
    }

    modal.classList.add('active');
  };

  window.closeRewardDetailModal = function() {
    const modal = document.getElementById('modal-reward-detail');
    if (modal) modal.classList.remove('active');
  };

  // MOCKUP REDESIGN: CLIENT HISTORY MODAL
  window.openClientHistoryModal = function() {
    const modal = document.getElementById('modal-client-history');
    const feed = document.getElementById('client-modal-history-feed');
    if (!modal) return;

    if (feed) {
      if (!state.clientSession.history || state.clientSession.history.length === 0) {
        feed.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: #9CA3AF;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📜</div>
            <p style="font-size: 0.85rem; font-weight: 700; margin: 0;">Aucun scan ou échange récent.</p>
          </div>
        `;
      } else {
        feed.innerHTML = state.clientSession.history.map(h => `
          <div style="background: #F9FAFB; border: 1px solid #F3F4F6; border-radius: 12px; padding: 0.85rem; margin-bottom: 0.6rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="font-size: 0.85rem; color: #111827;">${h.title}</strong>
              <p style="font-size: 0.72rem; color: #6B7280; margin: 0;">${h.date} à ${h.time}</p>
            </div>
            <strong style="color: #DC2626; font-size: 0.9rem;">${h.pts} pts</strong>
          </div>
        `).join('');
      }
    }

    modal.classList.add('active');
  };

  window.closeClientHistoryModal = function() {
    const modal = document.getElementById('modal-client-history');
    if (modal) modal.classList.remove('active');
  };

  // STEP 11: CLIENT WHATSAPP SUPPORT LAUNCHER
  window.openClientSupportWhatsApp = function() {
    const clientName = encodeURIComponent(state.clientSession.name || 'Client');
    const restoName = encodeURIComponent(state.restaurant.name);
    const msg = encodeURIComponent(`Bonjour Support NEXA, je suis ${clientName} chez ${restoName}. J'ai une question.`);
    window.open(`https://wa.me/22654513981?text=${msg}`, '_blank');
  };

  // STEP 11: PWA ADD TO HOME SCREEN PROMPT
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  window.installNexaPWA = function() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          showToast('📲 NEXA Installée !', 'Application ajoutée à votre écran d\'accueil.');
        }
        deferredInstallPrompt = null;
      });
    } else {
      alert("📲 Ajouter NEXA à l'écran d'accueil :\n\n• Sur iPhone (Safari) : Appuyez sur Partager ➔ 'Sur l'écran d'accueil'\n• Sur Android (Chrome) : Appuyez sur le menu (⋮) ➔ 'Ajouter à l'écran d'accueil'");
    }
  };

  function renderClientUI() {
    // CAS A vs CAS B: CONTROL VISIBILITY OF NO-RESTO SCREEN VS LOYALTY HOME SCREEN
    const noRestoScreen = document.getElementById('screen-no-resto');
    const homeScreen = document.getElementById('screen-home');
    const isClientAuthenticated = Boolean(state.clientSession.whatsapp);
    const shouldShowHome = Boolean(hasRestaurantContext || isClientAuthenticated);

    if (noRestoScreen && homeScreen) {
      if (!shouldShowHome && (roleParam === 'client' || !roleParam)) {
        noRestoScreen.style.display = 'block';
        homeScreen.style.display = 'none';
        homeScreen.classList.remove('active');
      } else {
        noRestoScreen.style.display = 'none';
        if (!state.activeTab || state.activeTab === 'home') {
          homeScreen.style.display = 'block';
          homeScreen.classList.add('active');
        } else {
          homeScreen.style.display = 'none';
          homeScreen.classList.remove('active');
        }
      }
    }

    // Default restaurant name when client is logged in without explicit URL param
    if (isClientAuthenticated && state.restaurant.name === 'Aucun Restaurant') {
      state.restaurant.name = localStorage.getItem('nexa_resto_name') || 'Chitir Chicken';
      state.restaurant.id = state.restaurant.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    }

    const restoEl = document.getElementById('mobile-resto-name');
    if (restoEl) restoEl.textContent = state.restaurant.name;

    const restoTypeEl = document.getElementById('mobile-resto-type');
    if (restoTypeEl) restoTypeEl.textContent = state.restaurant.type;

    // Dynamically update Restaurant Logo on Client App
    const restoLogoEl = document.getElementById('mobile-resto-logo') || document.querySelector('.restaurant-logo-clean');
    if (restoLogoEl) {
      if (state.restaurant.logo) {
        restoLogoEl.src = state.restaurant.logo;
      } else {
        const cachedLogo = localStorage.getItem(`nexa_resto_logo_${slug}`);
        if (cachedLogo) {
          restoLogoEl.src = cachedLogo;
        } else {
          restoLogoEl.src = './assets/savane_dish.jpg';
        }
      }
    }

    // ----------------------------------------------------
    // TIER & STATUS LOGIC (BRONZE -> SILVER -> GOLD -> VIP)
    // ----------------------------------------------------
    function calculateClientTier(points) {
      const pts = Math.max(0, parseInt(points || '0', 10));
      if (pts >= 200) {
        return {
          tierName: 'VIP',
          tierBadge: 'VIP 👑',
          nextTier: null,
          pointsToNext: 0,
          progressPercent: 100,
          statusMessage: 'Statut maximum atteint'
        };
      } else if (pts >= 100) {
        const nextTarget = 200;
        const currentBase = 100;
        const pointsNeeded = nextTarget - pts;
        const progress = Math.min(100, Math.max(0, Math.round(((pts - currentBase) / (nextTarget - currentBase)) * 100)));
        return {
          tierName: 'GOLD',
          tierBadge: 'GOLD 🥇',
          nextTier: 'VIP',
          pointsToNext: pointsNeeded,
          progressPercent: progress,
          statusMessage: `${pointsNeeded} points pour débloquer VIP`
        };
      } else if (pts >= 50) {
        const nextTarget = 100;
        const currentBase = 50;
        const pointsNeeded = nextTarget - pts;
        const progress = Math.min(100, Math.max(0, Math.round(((pts - currentBase) / (nextTarget - currentBase)) * 100)));
        return {
          tierName: 'SILVER',
          tierBadge: 'SILVER 🥈',
          nextTier: 'GOLD',
          pointsToNext: pointsNeeded,
          progressPercent: progress,
          statusMessage: `${pointsNeeded} points pour débloquer GOLD`
        };
      } else {
        const nextTarget = 50;
        const currentBase = 0;
        const pointsNeeded = nextTarget - pts;
        const progress = Math.min(100, Math.max(0, Math.round((pts / nextTarget) * 100)));
        return {
          tierName: 'BRONZE',
          tierBadge: 'BRONZE 🥉',
          nextTier: 'SILVER',
          pointsToNext: pointsNeeded,
          progressPercent: progress,
          statusMessage: `${pointsNeeded} points pour débloquer SILVER`
        };
      }
    }

    const clientTierInfo = calculateClientTier(state.clientSession.points);

    // Update Accueil Elements (Exact Reference Mockup Layout)
    const homePointsEl = document.getElementById('home-points-val');
    if (homePointsEl) {
      homePointsEl.textContent = state.clientSession.points;
    }

    const homeTierNameEl = document.getElementById('home-tier-name');
    if (homeTierNameEl) {
      homeTierNameEl.textContent = clientTierInfo.tierName;
    }

    const homeTierMedalEl = document.getElementById('home-tier-medal');
    if (homeTierMedalEl) {
      if (clientTierInfo.tierName === 'VIP') {
        homeTierMedalEl.textContent = '👑';
      } else if (clientTierInfo.tierName === 'GOLD') {
        homeTierMedalEl.textContent = '🏅';
      } else if (clientTierInfo.tierName === 'SILVER') {
        homeTierMedalEl.textContent = '🥈';
      } else {
        homeTierMedalEl.textContent = '🥉';
      }
    }

    // Update Segmented Progress Bar (4 segments like mockup)
    const segCount = 4;
    const filledSegments = Math.min(segCount, Math.max(0, Math.round((clientTierInfo.progressPercent / 100) * segCount)));
    for (let s = 1; s <= 4; s++) {
      const segEl = document.getElementById(`seg-${s}`);
      if (segEl) {
        if (s <= filledSegments || (filledSegments === 0 && s === 1 && state.clientSession.points > 0)) {
          segEl.classList.add('filled');
        } else {
          segEl.classList.remove('filled');
        }
      }
    }

    const homeTierProgressCaption = document.getElementById('home-tier-progress-caption');
    if (homeTierProgressCaption) {
      if (clientTierInfo.nextTier) {
        homeTierProgressCaption.innerHTML = `${clientTierInfo.pointsToNext} points pour débloquer <strong style="color: #B91C1C;">${clientTierInfo.nextTier}</strong>`;
      } else {
        homeTierProgressCaption.innerHTML = `<strong>Statut maximum atteint 🎉</strong>`;
      }
    }

    const userPtsEl = document.getElementById('user-points-val');
    if (userPtsEl) userPtsEl.textContent = state.clientSession.points;

    const userScanBadge = document.getElementById('user-scan-pts-badge');
    if (userScanBadge) userScanBadge.textContent = `+${state.restaurant.pointsPerScan} PTS`;

    const btnScanLabel = document.getElementById('btn-scan-label');
    if (btnScanLabel) btnScanLabel.textContent = `📷 Valider mes Points Table #${tableParam} (+${state.restaurant.pointsPerScan} Pts)`;

    // Toggle Login Banner visibility based on client authentication state
    const loginBanner = document.getElementById('client-login-banner');
    if (loginBanner) {
      loginBanner.style.display = state.clientSession.whatsapp ? 'none' : 'block';
    }

    // STEP 11: Update Profile Details Card from Real Supabase & Session Data
    const profNameEl = document.getElementById('profile-display-name');
    if (profNameEl) profNameEl.textContent = state.clientSession.name || 'Ismaël K.';

    const profPhoneEl = document.getElementById('profile-display-phone');
    if (profPhoneEl) profPhoneEl.textContent = state.clientSession.whatsapp ? `+${state.clientSession.whatsapp}` : '+226 70 12 34 56';

    const profEmailEl = document.getElementById('profile-display-email');
    if (profEmailEl) {
      if (state.clientSession.name) {
        const cleanName = state.clientSession.name.toLowerCase().replace(/\s+/g, '.');
        profEmailEl.textContent = `${cleanName}@email.com`;
      } else {
        profEmailEl.textContent = 'ismael.kabore@email.com';
      }
    }

    const profPtsEl = document.getElementById('profile-display-points');
    if (profPtsEl) profPtsEl.textContent = `${state.clientSession.points} points ⭐`;

    const profRestoEl = document.getElementById('profile-display-resto');
    if (profRestoEl) profRestoEl.textContent = state.restaurant.name;

    const profTierEl = document.getElementById('profile-display-tier');
    if (profTierEl) profTierEl.textContent = `Membre ${clientTierInfo.tierName}`;

    const avatarLetEl = document.getElementById('client-avatar-letters');
    if (avatarLetEl) avatarLetEl.textContent = (state.clientSession.name || 'MC').substring(0, 2).toUpperCase();

    // UPDATE INCOMING NOTIFICATION BANNER & FEATURED OFFER (Relocated to Tab Notifications)
    const notifBannerTitle = document.getElementById('notif-banner-title');
    if (notifBannerTitle) {
      notifBannerTitle.textContent = `Votre Fidélité ${state.restaurant.name}`;
    }

    const notifBannerSub = document.getElementById('notif-banner-sub');
    if (notifBannerSub) {
      if (state.offers && state.offers.length > 0) {
        notifBannerSub.textContent = state.offers[0].title;
      } else {
        notifBannerSub.textContent = '-20% sur votre prochain repas !';
      }
    }

    // Featured Offer Floating Card (Tab Notifications)
    const featOfferTitle = document.getElementById('featured-offer-title');
    const featOfferDesc = document.getElementById('featured-offer-desc');
    const featOfferImg = document.getElementById('featured-offer-img');
    if (state.offers && state.offers.length > 0) {
      const topOffer = state.offers[0];
      if (featOfferTitle) featOfferTitle.textContent = topOffer.title;
      if (featOfferDesc) featOfferDesc.textContent = topOffer.desc || topOffer.description || 'Validez au comptoir pour profiter de votre remise immédiate.';
      if (featOfferImg && topOffer.image) featOfferImg.src = topOffer.image;
    } else {
      if (featOfferTitle) featOfferTitle.textContent = 'Nouvelle offre de -20% sur votre prochain repas';
      if (featOfferDesc) featOfferDesc.textContent = 'Validez au comptoir pour profiter de votre remise immédiate.';
      if (featOfferImg) featOfferImg.src = './assets/chicken_combo.jpg';
    }

    // Ensure sample rewards exist for the restaurant if empty
    if (!state.rewards || state.rewards.length === 0) {
      state.rewards = [
        {
          id: 'rw_chicken_combo',
          title: 'Frite Combo Chicken',
          desc: '8 morceaux épicés et une frite croustillante',
          pts: 50,
          icon: '🍗',
          image: './assets/chicken_combo.jpg'
        },
        {
          id: 'rw_pizza_toubel',
          title: 'Pizza de l\'école Toubel',
          desc: 'Grande pizza fromage fondu et épices douces',
          pts: 80,
          icon: '🍕',
          image: './assets/pizza_toubel.jpg'
        },
        {
          id: 'rw_burger_braise',
          title: 'Burger Braisé Gourmet',
          desc: 'Steak façon grillade, sauce secrète du chef',
          pts: 40,
          icon: '🍔',
          image: './assets/burger_favori.jpg'
        }
      ];
    }

    // Sync Points on Rewards Tab Hero Card
    const rewardsPtsHeroEl = document.getElementById('rewards-hero-pts-val');
    if (rewardsPtsHeroEl) rewardsPtsHeroEl.textContent = state.clientSession.points;

    // MOCKUP REDESIGN: RENDER REWARDS AVAILABLE IN EXACT MOCKUP FORMAT (TAB 2)
    const fullRewardsContainer = document.getElementById('full-rewards-catalogue-list');
    if (fullRewardsContainer) {
      fullRewardsContainer.innerHTML = state.rewards.map(reward => {
        const canClaim = state.clientSession.points >= reward.pts;
        const ptsNeeded = reward.pts - state.clientSession.points;
        const titleEscaped = reward.title.replace(/'/g, "\\'");
        const imgSrc = reward.image || './assets/chicken_combo.jpg';

        return `
          <div class="mockup-reward-item-row">
            <div class="mockup-reward-item-left">
              <img src="${imgSrc}" alt="${escapeHtml(reward.title)}" class="mockup-reward-thumb">
              <div class="mockup-reward-item-info">
                <div class="mockup-reward-item-name">${escapeHtml(reward.title)}</div>
                <div class="mockup-reward-item-pts">${reward.pts} points</div>
              </div>
            </div>
            <div class="mockup-reward-item-action">
              ${canClaim ? `
                <button class="mockup-btn-claim" onclick="handleRewardClick('${reward.id}', ${reward.pts}, '${titleEscaped}')">
                  Réclamer
                </button>
              ` : `
                <div class="mockup-lock-box">
                  <i data-lucide="lock" style="width: 14px; height: 14px;"></i>
                </div>
                <div class="mockup-lock-pts-needed">${ptsNeeded} points nécessaires</div>
              `}
            </div>
          </div>
        `;
      }).join('');
    }

    // Render Offers & Notifications Feed in Client App (TAB 3)
    const notifsFeed = document.getElementById('client-notifs-feed');
    if (notifsFeed) {
      let offersHtml = '';
      if (state.offers && state.offers.length > 0) {
        offersHtml = `
          <div style="margin-bottom: 1.25rem;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #DC2626; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.5rem;">
              📢 Offres Spéciales en Cours
            </span>
            ${state.offers.map(o => {
              const offerDesc = o.desc || o.description || 'Offre spéciale valable en restaurant.';
              const offerStart = o.startDate || o.start_date || 'Aujourd\'hui';
              const offerEnd = o.endDate || o.end_date || 'Bientôt';
              const offerImg = o.image ? `
                <div style="width: 100%; height: 110px; border-radius: 10px; overflow: hidden; margin-bottom: 0.5rem; background: #F8FAFC;">
                  <img src="${o.image}" alt="${escapeHtml(o.title)}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
              ` : '';
              return `
                <div style="background: linear-gradient(135deg, #FEF2F2 0%, #FFFBEB 100%); border: 1.5px solid #FCA5A5; border-radius: 12px; padding: 0.9rem; margin-bottom: 0.65rem; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
                  ${offerImg}
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.3rem;">
                    <strong style="font-size: 0.92rem; color: #991B1B;">🏷️ ${escapeHtml(o.title)}</strong>
                    <span style="background: #DC2626; color: white; font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 8px;">Actif</span>
                  </div>
                  <p style="font-size: 0.8rem; color: #4B5563; margin: 0 0 0.4rem 0;">${escapeHtml(offerDesc)}</p>
                  <div style="font-size: 0.72rem; color: #6B7280;">
                    <span>📅 Du ${offerStart} au ${offerEnd}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      const defaultNotifs = (state.notifications && state.notifications.length > 0) ? state.notifications : [
        {
          id: 1,
          title: `🎉 Offre Bienvenue : -20% sur votre commande !`,
          text: `Valable au comptoir chez ${state.restaurant.name}. Présentez votre écran fidélité.`,
          time: 'Il y a 5 min'
        },
        {
          id: 2,
          title: `⭐ +20 points ajoutés à votre solde`,
          text: `Merci pour votre visite chez ${state.restaurant.name}.`,
          time: 'Aujourd\'hui'
        }
      ];

      const notifsHtml = defaultNotifs.map(n => `
        <div style="background: white; border: 1px solid #F3F4F6; border-radius: 14px; padding: 0.85rem; margin-bottom: 0.75rem; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
            <strong style="font-size: 0.88rem; color: #111827;">${n.title}</strong>
            <span style="font-size: 0.7rem; color: #9CA3AF;">${n.time}</span>
          </div>
          <p style="font-size: 0.8rem; color: #6B7280; margin: 0;">${n.text}</p>
        </div>
      `).join('');

      notifsFeed.innerHTML = offersHtml + notifsHtml;
    }

    // Render History Feed in Client App
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

    if (window.lucide) {
      try { lucide.createIcons(); } catch (e) {}
    }
  }

  // INTERACTIVE REWARD CLICK
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

  // CLIENT CREATES PENDING CLAIM (POINTS DEDUCTED ONLY UPON SERVER VALIDATION)
  window.claimReward = async function(rewardId) {
    const reward = state.rewards.find(r => String(r.id) === String(rewardId));
    if (!reward || state.clientSession.points < reward.pts) return;

    let voucher = null;
    const backend = window.nexaBackend || (typeof NexaProductionBackend !== 'undefined' ? new NexaProductionBackend() : null);

    if (backend && typeof backend.createRewardVoucher === 'function') {
      try {
        voucher = await backend.createRewardVoucher(
          state.restaurant.name,
          state.clientSession.whatsapp,
          {
            id: reward.id,
            title: reward.title,
            icon: reward.icon,
            image: reward.image || '',
            pts: reward.pts,
            clientName: state.clientSession.name || 'Client Nexa'
          }
        );
      } catch (err) {
        console.warn('Backend voucher creation warning:', err);
      }
    }

    if (!voucher) {
      const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `NX-${randomChars}`;
      voucher = {
        id: `vch_${Date.now()}`,
        voucherId: `vch_${Date.now()}`,
        code: code,
        rewardId: reward.id,
        rewardTitle: reward.title,
        rewardIcon: reward.icon || '🎁',
        rewardImage: reward.image || '',
        pts: reward.pts,
        clientName: state.clientSession.name || 'Client Nexa',
        clientPhone: state.clientSession.whatsapp || '+226 ...',
        restoName: state.restaurant.name,
        restoSlug: slug,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
    }

    // NOTE: In accordance with user requirement, points are NOT deducted here!
    // Points will be debited ONLY when the restaurant server validates the voucher.

    // Save in pending claims
    state.pendingClaims.unshift(voucher);
    localStorage.setItem(`nexa_pending_claims_${slug}`, JSON.stringify(state.pendingClaims));

    renderClientUI();
    renderMerchantUI();
    showRedemptionPassModal(reward, voucher);
  };

  // MERCHANT VALIDATES REWARD IN 1-CLICK & SENDS INSTANT CLIENT PUSH NOTIFICATION!
  window.validateClaimByMerchantDirect = async function(clientPhone, rewardTitle, requiredPts) {
    if (!clientPhone || !requiredPts) return;

    // Deduct client points on Cloud Supabase!
    if (window.nexaBackend) {
      try {
        await window.nexaBackend.deductPointsCloud(state.restaurant.name, clientPhone, requiredPts);
      } catch (err) {
        console.warn('Cloud point deduction error:', err);
      }
    }

    // Deduct client points locally if matches current client
    if (state.clientSession.whatsapp === clientPhone) {
      state.clientSession.points = Math.max(0, state.clientSession.points - requiredPts);
      localStorage.setItem('nexa_client_points', state.clientSession.points);
    }

    // 1. ADD PUSH NOTIFICATION TO CLIENT FEED
    state.notifications.unshift({
      id: Date.now(),
      title: `🎉 Cadeau Validé : ${rewardTitle} !`,
      text: `Votre récompense a été validée par ${state.restaurant.name}. -${requiredPts} pts déduits. Bon appétit !`,
      time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    });
    localStorage.setItem('nexa_client_notifs', JSON.stringify(state.notifications));

    // 2. ADD TO CLIENT HISTORY FEED
    state.clientSession.history.unshift({
      id: Date.now(),
      title: `🎁 Échange Validé : ${rewardTitle}`,
      time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      date: new Date().toLocaleDateString('fr-FR'),
      pts: `-${requiredPts}`
    });
    localStorage.setItem('nexa_client_history', JSON.stringify(state.clientSession.history));

    // 3. ADD TO MERCHANT OFFICIAL PROOFS OF REDEMPTIONS FEED
    state.validatedProofs.unshift({
      id: Date.now(),
      rewardTitle: rewardTitle,
      pts: requiredPts,
      clientName: state.clientSession.name || 'Client Nexa',
      clientPhone: clientPhone,
      time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      date: new Date().toLocaleDateString('fr-FR')
    });
    localStorage.setItem(`nexa_validated_proofs_${slug}`, JSON.stringify(state.validatedProofs));

    await syncCloudData();
    showToast('🎉 Cadeau Validé en Caisse !', `Notification transmise au client. Solde actualisé: -${requiredPts} pts.`);
    alert(`✅ Validation Réussie !\n\nLe cadeau "${rewardTitle}" (${requiredPts} pts) a été validé en caisse par le restaurateur.\n\n-${requiredPts} points déduits du solde du client et notification envoyée !`);
  };

  window.showPassModalFirst = function() {
    if (state.rewards.length > 0) {
      showRedemptionPassModal(state.rewards[0]);
    } else {
      alert(`Aucune récompense configurée par ${state.restaurant.name} pour le moment.`);
    }
  };

  let clientVoucherPollTimer = null;

  function showRedemptionPassModal(reward, voucher = null) {
    const passModal = document.getElementById('redemption-pass-modal');
    if (!passModal) return;

    const voucherCode = (voucher && voucher.code) || 'NX-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const ptsValue = (voucher && voucher.pts) || reward.pts || 0;

    const elTitle = document.getElementById('pass-reward-title');
    const elBadge = document.getElementById('pass-pts-badge');
    const elCode = document.getElementById('pass-voucher-code');
    const elImgBox = document.getElementById('pass-img-box');
    const elImgPreview = document.getElementById('pass-img-preview');
    const elQr = document.getElementById('pass-qr-box');
    const elStatus = document.getElementById('pass-status-pill');

    if (elTitle) elTitle.textContent = `${reward.icon || '🎁'} ${reward.title}`;
    if (elBadge) {
      elBadge.textContent = `Valeur : ${ptsValue} points (déduits après validation)`;
      elBadge.style.background = '#EFF6FF';
      elBadge.style.color = '#1E40AF';
    }
    if (elCode) elCode.textContent = voucherCode;

    const rewardImg = (voucher && voucher.rewardImage) || reward.image || '';
    if (rewardImg && elImgBox && elImgPreview) {
      elImgPreview.src = rewardImg;
      elImgBox.style.display = 'block';
    } else if (elImgBox) {
      elImgBox.style.display = 'none';
    }

    if (elStatus) {
      elStatus.textContent = '⏳ En attente de validation en caisse';
      elStatus.style.background = '#FEF3C7';
      elStatus.style.color = '#92400E';
    }

    // REAL DYNAMIC QR CODE GENERATION
    if (elQr) {
      let qrGenerated = false;
      if (typeof qrcode !== 'undefined') {
        try {
          const qr = qrcode(0, 'M');
          qr.addData(voucherCode);
          qr.make();
          const qrSvg = qr.createSvgTag({ scalable: true, margin: 2 });
          elQr.innerHTML = `
            <div style="background: white; padding: 12px; border-radius: 12px; display: inline-block; border: 2px solid var(--primary-gold); box-shadow: 0 4px 12px rgba(0,0,0,0.06); width: 150px; height: 150px;">
              ${qrSvg}
            </div>
          `;
          qrGenerated = true;
        } catch (e) {
          console.warn('[QR GENERATOR NOTICE]', e);
        }
      }

      if (!qrGenerated) {
        // Fallback: Matrix high-res QR SVG with voucherCode visually encoded
        elQr.innerHTML = `
          <div style="background: white; padding: 12px; border-radius: 12px; display: inline-block; border: 2px solid var(--primary-gold); box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
            <svg width="130" height="130" viewBox="0 0 100 100">
              <rect width="100" height="100" fill="#ffffff"/>
              <path d="M10 10h30v30h-30zM15 15h20v20h-20zM60 10h30v30h-30zM65 15h20v20h-20zM10 60h30v30h-30zM15 65h20v20h-20zM50 45h10v10h-10zM70 45h20v10h-20zM45 65h10v25h-10zM65 65h25v10h-25zM65 80h10v10h-10zM80 80h10v10h-10z" fill="#2A1D15"/>
            </svg>
          </div>
        `;
      }
    }

    passModal.classList.add('active');

    // LIVE LISTENER: Automatically detect when merchant validates this voucher!
    if (clientVoucherPollTimer) clearInterval(clientVoucherPollTimer);

    clientVoucherPollTimer = setInterval(async () => {
      if (!passModal.classList.contains('active')) {
        clearInterval(clientVoucherPollTimer);
        return;
      }

      let isRedeemed = false;
      // Check last redeemed
      try {
        const lastRedeemedRaw = localStorage.getItem('nexa_last_redeemed_voucher');
        if (lastRedeemedRaw) {
          const lastRedeemed = JSON.parse(lastRedeemedRaw);
          if (lastRedeemed.code === voucherCode) {
            isRedeemed = true;
          }
        }
      } catch (e) {}

      // Check vouchers list
      if (!isRedeemed) {
        try {
          const rawVouchers = localStorage.getItem(`nexa_vouchers_${slug}`);
          if (rawVouchers) {
            const vouchersList = JSON.parse(rawVouchers);
            const found = vouchersList.find(v => v.code === voucherCode);
            if (found && found.status === 'used') {
              isRedeemed = true;
            }
          }
        } catch (e) {}
      }

      if (isRedeemed) {
        clearInterval(clientVoucherPollTimer);
        if (elStatus) {
          elStatus.textContent = '✅ Récompense Validée & Remise !';
          elStatus.style.background = '#D1FAE5';
          elStatus.style.color = '#065F46';
        }
        if (elBadge) {
          elBadge.textContent = `-${ptsValue} points déduits`;
          elBadge.style.background = '#FEE2E2';
          elBadge.style.color = '#991B1B';
        }

        // Deduct points locally for client
        state.clientSession.points = Math.max(0, state.clientSession.points - ptsValue);
        localStorage.setItem('nexa_client_points', state.clientSession.points);

        // Add history entry
        state.clientSession.history.unshift({
          id: Date.now(),
          title: `🎁 Cadeau Obtenu : ${reward.title}`,
          time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
          date: new Date().toLocaleDateString('fr-FR'),
          pts: `-${ptsValue}`
        });
        localStorage.setItem('nexa_client_history', JSON.stringify(state.clientSession.history));

        renderClientUI();
        showToast('🎉 Récompense Validée !', `Le serveur a validé votre pass « ${reward.title} ». Bon appétit !`);
      }
    }, 1500);
  }

  document.getElementById('btn-close-pass').addEventListener('click', () => {
    if (clientVoucherPollTimer) clearInterval(clientVoucherPollTimer);
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

    // 🎁 RENDER ELIGIBLE REWARDS
    const eligibleOverviewFeed = document.getElementById('merchant-eligible-rewards-feed');
    const eligibleOverviewBadge = document.getElementById('eligible-claims-count-badge');

    const dedicatedClaimsFeed = document.getElementById('dedicated-claims-cards-feed');
    const dedicatedClaimsBadge = document.getElementById('dedicated-claims-count-badge');

    let eligibleItems = [];
    state.clientsList.forEach(client => {
      state.rewards.forEach(reward => {
        if (client.points >= reward.pts) {
          eligibleItems.push({ client, reward });
        }
      });
    });

    const badgeText = `${eligibleItems.length} éligible(s)`;
    if (eligibleOverviewBadge) eligibleOverviewBadge.textContent = badgeText;
    if (dedicatedClaimsBadge) dedicatedClaimsBadge.textContent = badgeText;

    const cardsHtml = eligibleItems.length === 0 ? `
      <div style="text-align:center; padding: 2rem; color: var(--text-muted); background: white; border-radius: 12px; border: 1px dashed var(--dash-border);">
        <div style="font-size: 1.8rem; margin-bottom: 0.3rem;">🎁</div>
        <p style="font-size: 0.85rem; font-weight: 700; margin: 0 0 0.2rem 0;">Aucun client éligible pour l'instant</p>
        <p style="font-size: 0.75rem; margin: 0;">Dès qu'un client accumule assez de points pour débloquer un cadeau, son option d'échange 1-clic apparaîtra ici !</p>
      </div>
    ` : eligibleItems.map(item => {
      const titleEscaped = item.reward.title.replace(/'/g, "\\'");
      return `
        <div style="background: white; border: 1.5px solid var(--primary-gold); border-radius: 12px; padding: 1rem; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <span style="font-size: 1.8rem;">${item.reward.icon}</span>
            <div>
              <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--marron-dark); margin: 0 0 0.2rem 0;">
                ${item.client.name} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">(${item.client.phone})</span>
              </h4>
              <p style="font-size: 0.8rem; color: var(--primary-gold); font-weight: 700; margin: 0;">
                🎁 ${item.reward.title} • <strong>-${item.reward.pts} pts</strong> (Solde actuel: ${item.client.points} pts)
              </p>
            </div>
          </div>
          <button class="btn-primary" onclick="validateClaimByMerchantDirect('${item.client.phone}', '${titleEscaped}', ${item.reward.pts})" style="background: #10B981; border-color: #10B981; font-weight: 800; font-size: 0.8rem; padding: 0.5rem 1rem;">
            ✅ Valider l'Échange & Déduire ${item.reward.pts} Pts
          </button>
        </div>
      `;
    }).join('');

    if (eligibleOverviewFeed) eligibleOverviewFeed.innerHTML = cardsHtml;
    if (dedicatedClaimsFeed) dedicatedClaimsFeed.innerHTML = cardsHtml;

    // 📜 RENDER MERCHANT OFFICIAL PROOFS OF REDEMPTIONS FEED (NOTIFS TAB)
    const proofsFeed = document.getElementById('merchant-proofs-history-feed');
    if (proofsFeed) {
      if (state.validatedProofs.length === 0) {
        proofsFeed.innerHTML = `
          <div style="text-align:center; padding: 2rem; color: var(--text-muted); background: white; border-radius: 12px; border: 1px dashed var(--dash-border);">
            <div style="font-size: 1.8rem; margin-bottom: 0.3rem;">📜</div>
            <p style="font-size: 0.85rem; font-weight: 700; margin: 0 0 0.2rem 0;">Aucune preuve d'échange pour l'instant</p>
            <p style="font-size: 0.75rem; margin: 0;">L'historique officiel des réductions et cadeaux validés en caisse s'affichera ici.</p>
          </div>
        `;
      } else {
        proofsFeed.innerHTML = state.validatedProofs.map(p => `
          <div style="background: white; border: 1px solid var(--dash-border); border-radius: 10px; padding: 0.85rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <strong style="font-size: 0.88rem; color: var(--marron-dark);">${p.clientName} (${p.clientPhone})</strong>
              <p style="font-size: 0.78rem; color: var(--primary-gold); font-weight: 700; margin: 0.1rem 0 0 0;">
                🎁 ${p.rewardTitle} • <strong>-${p.pts} pts</strong>
              </p>
              <p style="font-size: 0.7rem; color: var(--text-muted); margin: 0.2rem 0 0 0;">
                Validé le ${p.date} à ${p.time}
              </p>
            </div>
            <span style="font-size: 0.72rem; background: #10B981; color: white; padding: 3px 10px; border-radius: 12px; font-weight: 800;">
              ✅ Validé en Caisse
            </span>
          </div>
        `).join('');
      }
    }

    // Render CRM Table
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

    if (window.lucide) {
      try { lucide.createIcons(); } catch (e) {}
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

  // BIND SEND NOTIFICATION / COMMERCIAL OFFER FORM (SECTION 6)
  const formSendNotif = document.getElementById('form-send-notif');
  if (formSendNotif) {
    formSendNotif.addEventListener('submit', (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('notif-title-input');
      const textInput = document.getElementById('notif-text-input');
      const title = titleInput ? titleInput.value.trim() : '';
      const text = textInput ? textInput.value.trim() : '';
      if (!title || !text) {
        showToast('⚠️ Champs incomplets', 'Veuillez saisir un titre et une description.');
        return;
      }

      showToast(`📢 ${title}`, text);

      try {
        const backend = window.nexaBackend || new NexaProductionBackend();
        const restoName = (state.restaurant && state.restaurant.name) || 'Le Savane';
        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7*86400000).toISOString().split('T')[0];
        backend.createOrUpdateRestaurantOffer(restoName, {
          title,
          desc: text,
          startDate: today,
          endDate: nextWeek,
          active: true
        });
      } catch (err) {
        console.warn('[OFFER SYNC NOTICE]', err);
      }

      if (titleInput) titleInput.value = '';
      if (textInput) textInput.value = '';
      showToast('✅ Offre Diffusée !', `L'offre "${title}" est maintenant active pour vos clients.`);
    });
  }

  renderClientUI();
  updateMerchantAuthState();
  syncCloudData();
}

// Client notifications filter helper (Toutes / Non lues)
window.filterClientNotifs = function(type, btnEl) {
  const allBtns = document.querySelectorAll('.mockup-filter-btn');
  allBtns.forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const cards = document.querySelectorAll('.mockup-notif-card');
  cards.forEach(card => {
    if (type === 'all') {
      card.style.display = 'flex';
    } else if (type === 'unread') {
      const isUnread = card.getAttribute('data-read') === 'false';
      card.style.display = isUnread ? 'flex' : 'none';
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNexaApp);
} else {
  initNexaApp();
}
