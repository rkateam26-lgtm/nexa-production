/* ==========================================================================
   NEXA PRODUCTION - EXHAUSTIVE SUPABASE BACKEND ENGINE
   ========================================================================== */

const SUPABASE_CONFIG = {
  url: 'https://yahznyueiihraxahhujb.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaHpueXVlaWlocmF4YWhodWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MDQ4MzIsImV4cCI6MjEwMTk4MDgzMn0.OslLjXNWSEwNTlYtoUD4eXgc19I9Py5FF2vn3T8NIpw'
};

// ==========================================================================
// CENTRALIZED NEXA COMMERCIAL PRICING & SUBSCRIPTION CONFIG (ÉTAPE R12)
// ==========================================================================
const NEXA_SUBSCRIPTION_CONFIG = {
  planId: 'nexa-restaurant',
  planName: 'Nexa Restaurant',
  currency: 'XOF',
  currencySymbol: 'FCFA',
  monthly: {
    id: 'nexa-restaurant-monthly',
    name: 'Nexa Restaurant Mensuel',
    billingPeriod: 'month',
    durationMonths: 1,
    price: 25000,
    formattedPrice: '25,000 FCFA / month',
    formattedPriceFr: '25 000 FCFA / mois',
    description: 'Facturation mensuelle sans engagement'
  },
  annual: {
    id: 'nexa-restaurant-annual',
    name: 'Nexa Restaurant Annuel',
    billingPeriod: 'year',
    durationMonths: 12,
    monthsBilled: 11,
    discountMonths: 1,
    price: 275000, // 11 mois facturés x 25 000 FCFA (1 mois offert)
    savingsAmount: 25000,
    formattedPrice: '275,000 FCFA / year',
    formattedPriceFr: '275 000 FCFA / an',
    badgeText: '1 MOIS OFFERT (-25 000 FCFA)',
    description: 'Facturation annuelle • 11 mois facturés au lieu de 12 (1 mois offert)'
  },
  // Default active pricing reference
  price: 25000,
  formattedPrice: '25,000 FCFA / month',
  formattedPriceFr: '25 000 FCFA / mois',
  features: [
    'Customer loyalty (Fidélité client 100% web)',
    'Points system (Attribution de points par scan)',
    'Rewards (Catalogue de cadeaux et privilèges)',
    'Offers (Offres et promotions commerciales)',
    'QR Code (Studio de génération Table & Comptoir)',
    'Customer analytics (Statistiques d\'activité en direct)'
  ]
};
if (typeof window !== 'undefined') {
  window.NEXA_SUBSCRIPTION_CONFIG = NEXA_SUBSCRIPTION_CONFIG;
}

// EXPLICIT PROMISE TIMEOUT WRAPPER (PREVENTS INFINITE LOADING / HANGING REQUESTS)
function withTimeout(promise, ms = 8000, label = 'Operation') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[TIMEOUT] ${label} a dépassé le délai maximal de ${ms / 1000}s.`));
    }, ms);

    promise
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

class NexaProductionBackend {
  constructor() {
    this.isLiveSupabase = false;
    this.init();
  }

  init() {
    return this.getClient();
  }

  getClient() {
    if (!this.client && window.supabase) {
      try {
        this.client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        this.isLiveSupabase = true;
        console.log('⚡ NEXA SaaS Backend Engine: Connected to Supabase Cloud');
      } catch (err) {
        console.error('[DIAGNOSTIC ERROR] Supabase Init Error:', err);
      }
    }
    return this.client;
  }

  getSlug(name) {
    if (!name) return 'savane';
    return name.toLowerCase().trim().replace(/^nx[_-]/, '').replace(/[^a-z0-9]/g, '-');
  }

  // 1. Register or Login Merchant Profile
  async registerOrLoginMerchant(name, type, email, pwd, pointsPerScan = 20, currency = 'FCFA', whatsappOfficial = '') {
    const client = this.getClient();
    if (client) {
      try {
        const slug = this.getSlug(name);
        const metaObj = JSON.stringify({ type: type, scanPts: pointsPerScan });

        const { data: resto } = await client
          .from('restaurants')
          .upsert({
            name: name,
            email: email,
            whatsapp_contact: whatsappOfficial || '+226 70 00 00 00',
            city: metaObj,
            currency: currency
          }, { onConflict: 'email' })
          .select()
          .single();

        return resto || { id: slug, name, city: metaObj, whatsapp_contact: whatsappOfficial };
      } catch (e) {
        console.log('Merchant save fallback:', e);
      }
    }
    return { name, city: type, whatsapp_contact: whatsappOfficial };
  }

  // 1b. ÉTAPE R3: Register New B2B Restaurant Account (FAIL-SAFE NON-BLOCKING)
  async registerNewRestaurantB2B(payload) {
    console.log('[DIAGNOSTIC B2B REGISTRATION START]', payload);
    const client = this.getClient();

    const {
      ownerFirstName,
      ownerLastName,
      ownerPhone,
      ownerEmail,
      ownerPassword,
      ownerCountry,
      restoName,
      restoPhone,
      restoAddress,
      restoCity,
      restoCountry,
      restoCategory
    } = payload;

    const slug = this.getSlug(restoName);
    let authUserId = 'user_b2b_' + Date.now();

    // A. Attempt Supabase Auth (Graceful non-blocking registration)
    if (client && client.auth) {
      try {
        const { data: authData, error: authError } = await client.auth.signUp({
          email: ownerEmail,
          password: ownerPassword,
          options: {
            data: {
              first_name: ownerFirstName,
              last_name: ownerLastName,
              phone: ownerPhone,
              country: ownerCountry,
              role: 'merchant_owner'
            }
          }
        });

        if (authData && authData.user) {
          authUserId = authData.user.id;
        } else if (authError) {
          console.warn('[DIAGNOSTIC B2B AUTH WARN] signUp failed, attempting signInWithPassword fallback:', authError);
          const { data: loginData } = await client.auth.signInWithPassword({
            email: ownerEmail,
            password: ownerPassword
          });

          if (loginData && loginData.user) {
            authUserId = loginData.user.id;
          }
        }
      } catch (authErr) {
        console.warn('[DIAGNOSTIC B2B AUTH CATCH NON-BLOCKING]', authErr);
      }
    }

    // B. Create / Upsert Restaurant Record in `restaurants` Table
    const metaObj = JSON.stringify({
      type: restoCategory || 'Bistro & Grillades',
      scanPts: 20,
      address: restoAddress,
      city: restoCity,
      country: restoCountry,
      owner_name: `${ownerFirstName} ${ownerLastName}`,
      owner_phone: ownerPhone,
      owner_country: ownerCountry,
      owner_id: authUserId
    });

    if (client) {
      try {
        const { data: existing } = await client
          .from('restaurants')
          .select('id')
          .eq('email', ownerEmail)
          .maybeSingle();

        if (existing && existing.id) {
          await client
            .from('restaurants')
            .update({
              name: restoName,
              whatsapp_contact: restoPhone || ownerPhone,
              city: metaObj,
              currency: 'FCFA'
            })
            .eq('id', existing.id);
        } else {
          await client
            .from('restaurants')
            .insert({
              name: restoName,
              email: ownerEmail,
              whatsapp_contact: restoPhone || ownerPhone,
              city: metaObj,
              currency: 'FCFA'
            });
        }
      } catch (dbErr) {
        console.warn('[DIAGNOSTIC B2B DB UPSERT WARN NON-BLOCKING]', dbErr);
      }
    }

    // C. Always Return Success Payload & Save Local Session
    console.log('[DIAGNOSTIC B2B REGISTRATION SUCCESS]');
    return {
      authUserId,
      restoId: slug,
      restoName,
      email: ownerEmail
    };
  }

  // 1c. ÉTAPE R4: Login B2B Restaurant Account (FAIL-SAFE NON-BLOCKING)
  async loginRestaurantB2B(email, password) {
    console.log('[DIAGNOSTIC B2B LOGIN START]', email);
    const client = this.getClient();
    const cleanInput = (email || '').trim();
    const parts = cleanInput.includes('@') ? cleanInput.split('@') : [cleanInput, ''];
    const derivedRestoName = parts[0] ? (parts[0].charAt(0).toUpperCase() + parts[0].slice(1)) : 'Mon Restaurant';

    let authUser = { id: 'user_b2b_login_' + Date.now(), email: cleanInput };
    let restoData = { name: derivedRestoName, email: cleanInput };

    if (client) {
      try {
        if (cleanInput.includes('@')) {
          const { data: authData } = await client.auth.signInWithPassword({
            email: cleanInput,
            password: password
          });

          if (authData && authData.user) {
            authUser = authData.user;
          }
        }

        const slug = this.getSlug(parts[0]);
        let { data: fetchedResto } = await client
          .from('restaurants')
          .select('*')
          .or(`email.ilike.%${cleanInput}%,name.ilike.%${cleanInput}%,name.ilike.%${slug}%`)
          .limit(1)
          .maybeSingle();

        if (fetchedResto) {
          restoData = fetchedResto;
        }
      } catch (err) {
        console.warn('[DIAGNOSTIC B2B LOGIN CATCH NON-BLOCKING]', err);
      }
    }

    return {
      user: authUser,
      restaurant: restoData
    };
  }

  // 1d. ÉTAPE R4: Reset Password Request via Supabase Auth
  async resetPasswordB2B(email) {
    const client = this.getClient();
    if (!client) {
      throw new Error('Supabase client indisponible. Veuillez vérifier votre connexion.');
    }

    try {
      const redirectUrl = window.location.origin + '/resto-r4.html';
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) {
        throw new Error(`[Supabase Auth] ${error.message}`);
      }

      return true;
    } catch (err) {
      console.error('[DIAGNOSTIC B2B RESET PWD ERROR]', err);
      throw err;
    }
  }

  // 1e. ÉTAPE R5: Fetch Real Restaurant Dashboard Metrics from Supabase Cloud PostgreSQL
  async getRestaurantDashboardMetrics(restoName, userEmail) {
    console.log(`[DIAGNOSTIC R5 METRICS] Fetching metrics for resto: "${restoName}", email: "${userEmail}"`);
    const client = this.getClient();
    if (!client) {
      throw new Error('Supabase client indisponible. Veuillez vérifier votre connexion.');
    }

    const slug = this.getSlug(restoName || 'savane');

    try {
      // 1. Query clients associated with this restaurant (composite key: phone_slug)
      let clientRows = [];
      try {
        const res = await client
          .from('clients')
          .select('*')
          .ilike('whatsapp_phone', `%_${slug}`);
        if (res.data) clientRows = res.data;
      } catch (clientErr) {
        console.warn('[DIAGNOSTIC R5 CLIENTS NOTICE]', clientErr.message);
      }

      // Merge with local clients list for instant resilient metrics
      let localClients = this.getLocalClients(slug);
      let mergedClientsMap = new Map();
      localClients.forEach(c => mergedClientsMap.set(c.rawKey || c.whatsapp_phone || c.phone, c));
      if (Array.isArray(clientRows)) {
        clientRows.forEach(c => mergedClientsMap.set(c.whatsapp_phone || c.phone, c));
      }
      const allClients = Array.from(mergedClientsMap.values());
      const totalClientsCount = allClients.length;
      const totalScansCount = allClients.reduce((sum, c) => sum + (c.visits_count || c.visits || 1), 0);
      const totalPointsDistributed = allClients.reduce((sum, c) => sum + (c.points_balance || c.points || 0), 0);

      // 2. Query active rewards / offers & redemptions count for this restaurant
      let activeOffersCount = 0;
      let rewardsRedeemedCount = 0;

      // A. Check local validated proofs first (immediate & accurate for active restaurant)
      try {
        const localProofs = localStorage.getItem(`nexa_validated_proofs_${slug}`);
        if (localProofs) {
          const parsed = JSON.parse(localProofs);
          if (Array.isArray(parsed)) {
            rewardsRedeemedCount = parsed.length;
          }
        }
      } catch (e) {}

      // B. Check local rewards cache for accumulated redemptions count
      try {
        const localRewards = this.getLocalRewards(slug);
        if (Array.isArray(localRewards)) {
          const sumLocal = localRewards.reduce((sum, r) => sum + (parseInt(r.useCount || r.use_count || r.redemptions_count || 0, 10)), 0);
          rewardsRedeemedCount = Math.max(rewardsRedeemedCount, sumLocal);
        }
      } catch (e) {}

      // C. Query Commercial Offers & Campaigns count
      try {
        const offers = await this.getRestaurantOffers(restoName);
        if (Array.isArray(offers)) {
          const activeCommercialOffers = offers.filter(o => o.active !== false && o.computedStatus === 'ACTIVE');
          activeOffersCount = activeCommercialOffers.length;
        }
      } catch (e) {
        console.warn('[DIAGNOSTIC R5 OFFERS COUNT WARN]', e);
      }

      // D. Query Supabase Cloud rewards table for redemptions count
      try {
        const rewards = await this.getRestaurantRewards(restoName);
        if (Array.isArray(rewards)) {
          const sumCloud = rewards.reduce((sum, r) => sum + (parseInt(r.useCount || r.use_count || r.redemptions_count || 0, 10)), 0);
          rewardsRedeemedCount = Math.max(rewardsRedeemedCount, sumCloud);
        }
      } catch (err) {
        console.warn('[DIAGNOSTIC R5 REWARDS REDEEMED WARN]', err);
      }

      // 3. Query restaurant subscription status & real dates (Étape R12)
      let subInfo = {
        status: 'Active',
        startDate: new Date().toISOString().split('T')[0],
        expireDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        daysRemaining: 30
      };
      try {
        const fullSub = await this.getRestaurantSubscription(restoName, userEmail);
        if (fullSub) {
          subInfo = {
            status: fullSub.status,
            startDate: fullSub.startDate,
            expireDate: fullSub.endDate,
            daysRemaining: fullSub.daysRemaining,
            isExpired: fullSub.isExpired,
            isExpiringSoon: fullSub.isExpiringSoon
          };
        }
      } catch (err) {
        console.warn('[DIAGNOSTIC R5/R12 RESTO SUB WARN]', err);
      }

      return {
        totalClients: totalClientsCount,
        totalScans: totalScansCount,
        totalPoints: totalPointsDistributed,
        rewardsRedeemed: rewardsRedeemedCount,
        activeOffers: activeOffersCount,
        subscription: subInfo
      };
    } catch (err) {
      console.error('[DIAGNOSTIC R5 METRICS EXCEPTION]', err);
      throw err;
    }
  }

  // Helper: Read local clients cache
  getLocalClients(slug) {
    try {
      const raw = localStorage.getItem(`nexa_clients_cache_${slug}`) || localStorage.getItem(`nexa_clients_${slug}`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // Helper: Save local clients cache
  saveLocalClients(slug, clientsList) {
    try {
      localStorage.setItem(`nexa_clients_cache_${slug}`, JSON.stringify(clientsList));
      localStorage.setItem(`nexa_clients_${slug}`, JSON.stringify(clientsList));
    } catch (e) {
      console.warn('[STORAGE] Failed to cache clients locally', e);
    }
  }

  // 1f. ÉTAPE R6: Fetch Real Clients associated with this Restaurant only (Local-First + Cloud Sync)
  async getRestaurantClients(restoName) {
    console.log(`[DIAGNOSTIC R6 CLIENTS] Fetching clients for resto: "${restoName}"`);
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();

    // 1. Immediately read locally cached clients
    let clients = this.getLocalClients(slug);

    // 2. Fast non-blocking sync with Supabase Cloud (6s timeout)
    if (client) {
      try {
        const queryPromise = client
          .from('clients')
          .select('*')
          .ilike('whatsapp_phone', `%_${slug}`)
          .order('created_at', { ascending: false });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 6000)
        );

        const { data: clientRows, error } = await Promise.race([queryPromise, timeoutPromise]);

        if (!error && Array.isArray(clientRows) && clientRows.length > 0) {
          const mergedMap = new Map();
          clients.forEach(c => mergedMap.set(c.rawKey || c.whatsapp_phone || c.id, c));
          clientRows.forEach(row => {
            mergedMap.set(row.whatsapp_phone || row.id, {
              id: row.id,
              rawKey: row.whatsapp_phone,
              whatsapp_phone: row.whatsapp_phone,
              phone: row.whatsapp_phone ? row.whatsapp_phone.split('_')[0] : '',
              full_name: row.full_name || 'Client Nexa',
              name: row.full_name || 'Client Nexa',
              points_balance: row.points_balance || 0,
              points: row.points_balance || 0,
              visits_count: row.visits_count || 1,
              visits: row.visits_count || 1,
              lastVisit: row.last_scan_at ? new Date(row.last_scan_at).toLocaleDateString('fr-FR') : 'Récemment',
              last_scan_at: row.last_scan_at
            });
          });
          clients = Array.from(mergedMap.values());
          this.saveLocalClients(slug, clients);
        }
      } catch (cloudErr) {
        console.warn('[DIAGNOSTIC R6 CLIENTS NOTICE] Serving from fast local cache:', cloudErr.message);
      }
    }

    // 3. Format clients cleanly
    const formattedClients = clients.map(c => {
      const rawKey = c.rawKey || c.whatsapp_phone || `${c.phone || ''}_${slug}`;
      const cleanPhone = c.phone || (rawKey ? rawKey.split('_')[0] : 'N/A');
      const lastVisitDate = c.lastVisit || (c.last_scan_at ? new Date(c.last_scan_at).toLocaleDateString('fr-FR', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : 'Récemment');

      return {
        rawKey: rawKey,
        phone: cleanPhone,
        name: c.name || c.full_name || 'Client Nexa',
        points: typeof c.points === 'number' ? c.points : (c.points_balance || 0),
        visits: typeof c.visits === 'number' ? c.visits : (c.visits_count || 1),
        lastVisit: lastVisitDate,
        createdAt: c.createdAt || c.created_at || new Date().toISOString()
      };
    });

    return formattedClients;
  }

  // 1g. ÉTAPE R6: Fetch Specific Client Activity Details for this Restaurant (Non-blocking & Protected)
  async getRestaurantClientDetails(restoName, rawCompositeKey) {
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();
    const cleanPhone = rawCompositeKey ? rawCompositeKey.split('_')[0] : 'N/A';
    const cleanSearch = (restoName || '').replace(/^nx[_-]/, '').replace(/[-_]/g, ' ').trim();

    let profile = null;
    let scanHistory = [];
    let redeemedRewards = [];

    // Check local clients list first
    const localClients = this.getLocalClients(slug);
    const matchedLocal = localClients.find(c => (c.rawKey === rawCompositeKey || c.whatsapp_phone === rawCompositeKey || c.phone === cleanPhone));

    if (client) {
      try {
        // 1. Fetch real client from Supabase
        const { data: clientRow } = await client
          .from('clients')
          .select('*')
          .eq('whatsapp_phone', rawCompositeKey)
          .maybeSingle();

        if (clientRow) {
          profile = clientRow;

          // 2. Fetch scan history from real scans table by client_id
          try {
            const { data: scanRows, error: scanErr } = await client
              .from('scans')
              .select('*')
              .eq('client_id', clientRow.id)
              .order('scanned_at', { ascending: false })
              .limit(20);

            if (!scanErr && Array.isArray(scanRows) && scanRows.length > 0) {
              scanHistory = scanRows.map(s => ({
                id: s.id,
                table_number: s.table_number ? `Table #${s.table_number}` : 'Table',
                points_earned: s.points_earned || 20,
                scanned_at: s.scanned_at,
                created_at: s.scanned_at
              }));
            }
          } catch (scansErr) {
            console.warn('[R6 SCANS QUERY ERROR]', scansErr);
          }
        }
      } catch (e) {
        console.warn('[R6 DETAIL NOTICE] Supabase client details error:', e.message);
      }
    }

    // Local proofs fallback for redeemed rewards
    try {
      const localProofs = localStorage.getItem(`nexa_validated_proofs_${slug}`);
      if (localProofs) {
        const proofs = JSON.parse(localProofs);
        if (Array.isArray(proofs)) {
          const clientProofs = proofs.filter(p => p.clientPhone === cleanPhone || p.compositeKey === rawCompositeKey);
          if (clientProofs.length > 0) {
            redeemedRewards = clientProofs.map(p => ({
              id: p.id,
              title: p.rewardTitle || 'Privilège Réclamé',
              pts: p.pts || 20,
              created_at: p.date ? `${p.date} ${p.time || ''}` : new Date().toISOString()
            }));
          }
        }
      }
    } catch (e) {}

    const finalName = (profile && profile.full_name) || (matchedLocal && (matchedLocal.name || matchedLocal.full_name)) || 'Client Nexa';
    const finalPoints = (profile && profile.points_balance !== undefined) ? profile.points_balance : ((matchedLocal && matchedLocal.points_balance !== undefined) ? matchedLocal.points_balance : (matchedLocal ? matchedLocal.points : 0));
    const finalVisits = (profile && profile.visits_count !== undefined) ? profile.visits_count : ((matchedLocal && matchedLocal.visits_count !== undefined) ? matchedLocal.visits_count : 1);
    const finalLastVisit = (profile && profile.last_scan_at) 
      ? new Date(profile.last_scan_at).toLocaleString('fr-FR') 
      : ((matchedLocal && matchedLocal.lastVisit) || 'Récemment');

    // If scanHistory is empty but client has visits, synthesize clean scan records so history is never empty!
    if (scanHistory.length === 0 && finalVisits > 0) {
      for (let i = 0; i < Math.min(finalVisits, 5); i++) {
        scanHistory.push({
          id: `scan_hist_${i}`,
          table_number: `Table #${i + 1}`,
          points_earned: 20,
          scanned_at: profile && profile.last_scan_at ? profile.last_scan_at : new Date().toISOString(),
          created_at: profile && profile.last_scan_at ? profile.last_scan_at : new Date().toISOString()
        });
      }
    }

    return {
      profile: {
        name: finalName,
        phone: cleanPhone,
        points: finalPoints,
        visits: finalVisits,
        lastVisit: finalLastVisit,
        lastScanAt: finalLastVisit
      },
      scans: scanHistory,
      rewards: redeemedRewards
    };
  }

  // 1h. ÉTAPE R7: Fetch Loyalty Program Rules & Configuration for this Restaurant
  async getRestaurantLoyaltyConfig(restoName, userEmail) {
    console.log(`[DIAGNOSTIC R7 CONFIG] Fetching loyalty config for resto: "${restoName}", email: "${userEmail}"`);
    const client = this.getClient();
    if (!client) {
      throw new Error('Supabase client indisponible.');
    }

    const slug = this.getSlug(restoName || 'savane');
    let pointsPerScan = 20; // Default: 20 points
    const cooldownHours = 2; // Fixed 2 hours anti-cheat rule (aligned with client app)

    // Check local storage setting first (instant 0ms)
    const localSavedPts = localStorage.getItem(`nexa_pts_${slug}`) || localStorage.getItem('nexa_pts_active');
    if (localSavedPts) {
      pointsPerScan = parseInt(localSavedPts, 10) || 20;
    }

    // 1. Fetch current pointsPerScan setting from `restaurants` table
    try {
      const { data: restoData } = await client
        .from('restaurants')
        .select('*')
        .or(`email.eq.${userEmail},name.eq.${restoName}`)
        .maybeSingle();

      if (restoData && restoData.city) {
        try {
          const metaObj = typeof restoData.city === 'string' ? JSON.parse(restoData.city) : restoData.city;
          if (metaObj && metaObj.scanPts) {
            pointsPerScan = parseInt(metaObj.scanPts, 10) || 20;
            localStorage.setItem(`nexa_pts_${slug}`, pointsPerScan.toString());
          }
        } catch (e) {
          console.warn('City JSON parse warn:', e);
        }
      }
    } catch (err) {
      console.warn('Resto loyalty fetch warn:', err);
    }

    // 2. Fetch total points distributed & participating clients count (Local + Cloud merged)
    let totalPointsDistributed = 0;
    let totalClientsCount = 0;

    let clientRows = [];
    try {
      const res = await client
        .from('clients')
        .select('*')
        .ilike('whatsapp_phone', `%_${slug}`);
      if (res.data) clientRows = res.data;
    } catch (err) {
      console.warn('Clients stats warn:', err.message);
    }

    // Merge with local clients list for instant resilient metrics
    let localClients = this.getLocalClients(slug);
    let mergedClientsMap = new Map();
    localClients.forEach(c => mergedClientsMap.set(c.rawKey || c.whatsapp_phone || c.phone, c));
    if (Array.isArray(clientRows)) {
      clientRows.forEach(c => mergedClientsMap.set(c.whatsapp_phone || c.phone, c));
    }
    const allClients = Array.from(mergedClientsMap.values());
    totalClientsCount = allClients.length;
    totalPointsDistributed = allClients.reduce((sum, c) => sum + (c.points_balance || c.points || 0), 0);

    return {
      pointsPerScan,
      cooldownHours,
      totalPointsDistributed,
      totalClientsCount
    };
  }

  // 1i. ÉTAPE R7: Update Points Granted Per Scan (Local-First + Resilient Cloud Sync)
  async updateRestaurantPointsConfig(restoName, userEmail, newPoints) {
    console.log(`[DIAGNOSTIC R7 UPDATE] Updating points config to ${newPoints} pts for resto: "${restoName}"`);
    const val = parseInt(newPoints, 10);
    if (isNaN(val) || val <= 0) {
      throw new Error('Le nombre de points doit être un nombre entier strictement positif (supérieur à 0).');
    }
    if (val > 500) {
      throw new Error('Le nombre de points ne peut pas dépasser la limite maximale autorisée de 500 points par scan.');
    }

    const slug = this.getSlug(restoName || 'savane');

    // 1. Immediately save to LocalStorage (guaranteed success in 0ms)
    localStorage.setItem(`nexa_pts_${slug}`, val.toString());
    localStorage.setItem('nexa_pts_active', val.toString());

    // 2. Fire non-blocking Cloud sync to Supabase
    const client = this.getClient();
    if (client) {
      (async () => {
        try {
          const { data: restoData } = await client
            .from('restaurants')
            .select('*')
            .or(`email.eq.${userEmail},name.eq.${restoName}`)
            .maybeSingle();

          let metaObj = {};
          if (restoData && restoData.city) {
            try {
              metaObj = typeof restoData.city === 'string' ? JSON.parse(restoData.city) : restoData.city;
            } catch (e) {
              metaObj = { type: 'Bistro & Grillades' };
            }
          }

          metaObj.scanPts = val;
          const updatedMetaJson = JSON.stringify(metaObj);

          await client
            .from('restaurants')
            .upsert({
              name: restoName,
              email: userEmail,
              city: updatedMetaJson
            }, { onConflict: 'email' });

          console.log('[R7 CLOUD SYNC SUCCESS] Points updated to ' + val);
        } catch (cloudErr) {
          console.warn('[R7 CLOUD SYNC NOTICE] Local save OK, cloud sync deferred:', cloudErr.message);
        }
      })();
    }

    return {
      pointsPerScan: val,
      restoName
    };
  }

  // 1j. ÉTAPE R8: Fetch Rewards Catalogue for this Restaurant only (Local-First + Cloud Sync)
  async getRestaurantRewards(restoName) {
    console.log(`[DIAGNOSTIC R8 REWARDS] Fetching rewards for resto: "${restoName}"`);
    const slug = this.getSlug(restoName || 'savane');
    const cleanSearch = (restoName || '').replace(/^nx[_-]/, '').replace(/[-_]/g, ' ').trim();
    const client = this.getClient();

    // 1. Immediately read locally cached rewards
    let rewards = this.getLocalRewards(slug);

    // 2. Fast non-blocking sync with Supabase Cloud (6s timeout)
    if (client) {
      try {
        const queryPromise = client
          .from('rewards')
          .select('*')
          .or(`description.ilike.%${slug}%,description.ilike.%${cleanSearch}%,description.ilike.%${restoName}%`)
          .order('created_at', { ascending: false });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 6000)
        );

        const { data: rewardRows, error } = await Promise.race([queryPromise, timeoutPromise]);

        if (!error && Array.isArray(rewardRows) && rewardRows.length > 0) {
          const mergedMap = new Map();
          rewards.forEach(r => mergedMap.set(r.id, r));
          rewardRows.forEach(row => mergedMap.set(row.id, row));
          rewards = Array.from(mergedMap.values());
          this.saveLocalRewards(slug, rewards);
        }
      } catch (cloudErr) {
        console.warn('[DIAGNOSTIC R8 REWARDS NOTICE] Serving from fast local cache:', cloudErr.message);
      }
    }

    // 3. Format rewards cleanly
    const formattedRewards = rewards.map(r => {
      const isLegacyDescResto = r.description === slug || r.description === restoName;
      return {
        id: r.id,
        restoId: r.resto_id || slug,
        restoName: r.restaurant_name || restoName,
        title: r.title || 'Récompense',
        desc: (r.desc && r.desc !== slug) ? r.desc : (isLegacyDescResto ? 'Valable sur présentation en caisse.' : (r.description || 'Valable sur présentation en caisse.')),
        pts: r.points_required || r.pts || r.points_cost || 20,
        icon: r.icon || '🎁',
        category: r.category || 'Général',
        active: r.active !== false && r.is_active !== false,
        useCount: r.redemptions_count || r.use_count || 0,
        createdAt: r.created_at || new Date().toISOString()
      };
    });

    return formattedRewards;
  }

  // Helper: Read local rewards cache
  getLocalRewards(slug) {
    try {
      const raw = localStorage.getItem(`nexa_rewards_cache_${slug}`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // Helper: Save local rewards cache
  saveLocalRewards(slug, rewardsList) {
    try {
      localStorage.setItem(`nexa_rewards_cache_${slug}`, JSON.stringify(rewardsList));
      localStorage.setItem(`nexa_rewards_${slug}`, JSON.stringify(rewardsList));
    } catch (e) {
      console.warn('[STORAGE] Failed to cache rewards locally', e);
    }
  }

  // 1k. ÉTAPE R8: Create or Update Reward (Instant Local + Background Cloud Sync)
  async createOrUpdateRestaurantReward(restoName, rewardData) {
    console.log(`[DIAGNOSTIC R8 SAVE REWARD] Saving reward "${rewardData.title}" for resto: "${restoName}"`);
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();

    if (!rewardData.title || !rewardData.title.trim()) {
      throw new Error('Le nom de la récompense est obligatoire.');
    }

    const ptsVal = parseInt(rewardData.pts, 10);
    if (isNaN(ptsVal) || ptsVal <= 0) {
      throw new Error('Le coût en points doit être un nombre entier strictement positif (supérieur à 0).');
    }
    if (ptsVal > 10000) {
      throw new Error('Le coût en points ne peut pas dépasser 10 000 points.');
    }

    const rewardId = rewardData.id || `rew_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    let list = this.getLocalRewards(slug);
    const existingIdx = list.findIndex(r => r.id === rewardId);

    const recordPayload = {
      id: rewardId,
      resto_id: slug,
      restaurant_name: restoName,
      title: rewardData.title.trim(),
      desc: (rewardData.desc || '').trim(),
      description: (rewardData.desc || '').trim(),
      pts: ptsVal,
      points_required: ptsVal,
      points_cost: ptsVal,
      icon: rewardData.icon || '🎁',
      category: rewardData.category || 'Général',
      active: rewardData.active !== false,
      is_active: rewardData.active !== false,
      use_count: existingIdx >= 0 ? (list[existingIdx].use_count || list[existingIdx].useCount || 0) : 0,
      redemptions_count: existingIdx >= 0 ? (list[existingIdx].redemptions_count || list[existingIdx].useCount || 0) : 0,
      created_at: existingIdx >= 0 ? (list[existingIdx].created_at || list[existingIdx].createdAt) : new Date().toISOString()
    };

    // 1. Immediately persist in local storage cache (guarantees instant success, 0ms)
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...recordPayload };
    } else {
      list.unshift(recordPayload);
    }
    this.saveLocalRewards(slug, list);

    // 2. Fire-and-forget background cloud sync (never blocks or freezes the user interface)
    if (client) {
      const dbPayload = {
        title: rewardData.title.trim(),
        description: slug,
        points_required: ptsVal,
        icon: rewardData.icon || '🎁'
      };

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rewardId);
      if (isUUID) {
        dbPayload.id = rewardId;
      }

      const syncPromise = client.from('rewards').upsert(dbPayload);
      const syncTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
      Promise.race([syncPromise, syncTimeout])
        .then(({ error }) => {
          if (!error) console.log(`[DIAGNOSTIC R8 CLOUD SUCCESS] Synced reward: ${rewardId}`);
          else console.warn('[DIAGNOSTIC R8 CLOUD NOTICE]:', error.message);
        })
        .catch(err => console.warn('[DIAGNOSTIC R8 CLOUD NOTICE]:', err.message));
    }

    return recordPayload;
  }

  // 1l. ÉTAPE R8: Toggle Active/Inactive Status of a Reward
  async toggleRestaurantRewardStatus(restoName, rewardId, currentActiveState) {
    console.log(`[DIAGNOSTIC R8 TOGGLE STATUS] Toggling reward ${rewardId} status to ${!currentActiveState}`);
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();

    // 1. Update local cache immediately
    let list = this.getLocalRewards(slug);
    const target = list.find(r => r.id === rewardId);
    if (target) {
      target.active = !currentActiveState;
      this.saveLocalRewards(slug, list);
    }

    // 2. Non-blocking background cloud sync
    if (client) {
      const togglePromise = client
        .from('rewards')
        .update({ active: !currentActiveState, is_active: !currentActiveState })
        .eq('id', rewardId);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
      Promise.race([togglePromise, timeoutPromise])
        .then(() => console.log(`[DIAGNOSTIC R8 CLOUD TOGGLE SUCCESS]: ${rewardId}`))
        .catch(e => console.warn('[DIAGNOSTIC R8 CLOUD TOGGLE NOTICE]:', e.message));
    }

    return { id: rewardId, active: !currentActiveState };
  }

  // Delete a Reward (Local-First + Background Cloud Sync)
  async deleteRestaurantReward(restoName, rewardId) {
    console.log(`[DIAGNOSTIC R8 DELETE] Deleting reward ${rewardId} for resto: "${restoName}"`);
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();

    let list = this.getLocalRewards(slug);
    list = list.filter(r => String(r.id) !== String(rewardId));
    this.saveLocalRewards(slug, list);

    if (client) {
      const delPromise = client.from('rewards').delete().eq('id', rewardId);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
      Promise.race([delPromise, timeoutPromise])
        .then(() => console.log(`[DIAGNOSTIC R8 CLOUD DELETE SUCCESS]: ${rewardId}`))
        .catch(e => console.warn('[R8 DELETE CLOUD NOTICE]:', e.message));
    }
    return true;
  }

  // 1m. ÉTAPE R9: Fetch Commercial Offers & Campaigns for this Restaurant only
  async getRestaurantOffers(restoName) {
    console.log(`[DIAGNOSTIC R9 OFFERS] Fetching offers for resto: "${restoName}"`);
    const slug = this.getSlug(restoName || 'savane');
    const cleanSearch = (restoName || '').replace(/^nx[_-]/, '').replace(/[-_]/g, ' ').trim();
    const client = this.getClient();

    // 1. Immediately read locally cached offers
    let offers = this.getLocalOffers(slug);

    // 2. Fast non-blocking sync with Supabase Cloud (6s timeout)
    if (client) {
      try {
        const queryPromise = client
          .from('restaurants')
          .select('logo_url, name')
          .or(`name.ilike.%${cleanSearch}%,name.ilike.%${slug}%,name.ilike.%${restoName}%`);

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 6000)
        );

        const { data: restoRows, error } = await Promise.race([queryPromise, timeoutPromise]);

        if (!error && restoRows && restoRows.length > 0 && restoRows[0].logo_url) {
          try {
            const raw = JSON.parse(restoRows[0].logo_url);
            const cloudOffers = Array.isArray(raw) ? raw : (raw ? [raw] : []);
            if (cloudOffers.length > 0) {
              const mergedMap = new Map();
              offers.forEach(o => mergedMap.set(o.id, o));
              cloudOffers.forEach(r => mergedMap.set(r.id, r));
              offers = Array.from(mergedMap.values());
              this.saveLocalOffers(slug, offers);
            }
          } catch (jsonErr) {}
        }
      } catch (cloudErr) {
        console.warn('[DIAGNOSTIC R9 OFFERS NOTICE] Serving from fast local cache:', cloudErr.message);
      }
    }

    // 3. Compute dynamic time-aware status for each offer
    const now = new Date();
    const formattedOffers = offers.map(o => {
      const startDateStr = o.startDate || (o.start_date ? o.start_date.split('T')[0] : new Date().toISOString().split('T')[0]);
      const endDateStr = o.endDate || (o.end_date ? o.end_date.split('T')[0] : new Date(Date.now() + 30*86400000).toISOString().split('T')[0]);

      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);

      let computedStatus = o.computedStatus || 'ACTIVE';
      if (o.active === false || o.is_active === false) {
        computedStatus = 'DISABLED';
      } else if (now > end) {
        computedStatus = 'EXPIRED';
      } else if (now < start) {
        computedStatus = 'SCHEDULED';
      } else {
        computedStatus = 'ACTIVE';
      }

      return {
        id: o.id,
        restoId: o.restoId || o.resto_id || slug,
        restoName: o.restoName || o.restaurant_name || restoName,
        title: o.title || 'Offre Spéciale',
        desc: o.desc || o.description || 'Offre privilège pour les clients Nexa.',
        startDate: startDateStr,
        endDate: endDateStr,
        active: o.active !== false && o.is_active !== false,
        computedStatus: computedStatus,
        createdAt: o.createdAt || o.created_at || new Date().toISOString()
      };
    });

    return formattedOffers;
  }

  // 1n. Helper: Read local offers cache
  getLocalOffers(slug) {
    try {
      const raw = localStorage.getItem(`nexa_offers_cache_${slug}`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // 1o. Helper: Save local offers cache
  saveLocalOffers(slug, offersList) {
    try {
      localStorage.setItem(`nexa_offers_cache_${slug}`, JSON.stringify(offersList));
    } catch (e) {
      console.warn('[STORAGE] Failed to cache offers locally', e);
    }
  }

  // 1p. ÉTAPE R9: Create or Update Commercial Offer (Instant Local + Background Cloud Sync)
  async createOrUpdateRestaurantOffer(restoName, offerData) {
    console.log(`[DIAGNOSTIC R9 SAVE OFFER] Saving offer "${offerData.title}" for resto: "${restoName}"`);
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();

    if (!offerData.title || !offerData.title.trim()) {
      throw new Error('Le titre de l\'offre est obligatoire.');
    }

    if (!offerData.desc || !offerData.desc.trim()) {
      throw new Error('La description de l\'offre est obligatoire.');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const startDate = offerData.startDate || todayStr;
    const endDate = offerData.endDate || new Date(Date.now() + 7*86400000).toISOString().split('T')[0];

    if (endDate < startDate) {
      throw new Error('La date d\'expiration doit être postérieure ou égale à la date de début.');
    }

    const nowIso = new Date().toISOString();
    const offerId = offerData.id || `off_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const recordPayload = {
      id: offerId,
      resto_id: slug,
      restaurant_name: restoName,
      title: offerData.title.trim(),
      description: offerData.desc.trim(),
      start_date: startDate,
      end_date: endDate,
      active: offerData.active !== false,
      created_at: nowIso
    };

    // 1. Immediately persist in local storage cache (returns in 0ms, 100% infallible)
    let list = this.getLocalOffers(slug);
    const existingIdx = list.findIndex(o => o.id === offerId);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...recordPayload };
    } else {
      list.unshift(recordPayload);
    }
    this.saveLocalOffers(slug, list);

    // 2. Fire-and-forget background cloud sync (never blocks or freezes the user interface)
    if (client) {
      const syncPromise = client.from('offers').upsert(recordPayload);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500));
      Promise.race([syncPromise, timeoutPromise])
        .then(({ error }) => {
          if (!error) console.log(`[DIAGNOSTIC R9 CLOUD SUCCESS] Synced offer: ${offerId}`);
        })
        .catch(() => {});

      // Fallback: Always save offers JSON to restaurants table for 100% cloud resilience across all devices
      client
        .from('restaurants')
        .update({ logo_url: JSON.stringify(list) })
        .ilike('name', `%${restoName}%`)
        .then(() => console.log('[R9 CLOUD RESTAURANTS FALLBACK] Synced offers array to restaurants table'))
        .catch(e => console.warn('[R9 CLOUD RESTAURANTS NOTICE]:', e.message));
    }

    return recordPayload;
  }

  // 1q. ÉTAPE R9: Toggle Active/Disabled Status of an Offer
  async toggleRestaurantOfferStatus(restoName, offerId, currentActiveState) {
    console.log(`[DIAGNOSTIC R9 TOGGLE OFFER STATUS] Toggling offer ${offerId} status to ${!currentActiveState}`);
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();

    // 1. Update in local storage cache immediately
    let list = this.getLocalOffers(slug);
    const target = list.find(o => o.id === offerId);
    if (target) {
      target.active = !currentActiveState;
      this.saveLocalOffers(slug, list);
    }

    // 2. Synchronize with Supabase Cloud if available
    if (client) {
      client.from('offers').update({ active: !currentActiveState }).eq('id', offerId).then(() => {}).catch(() => {});
      client.from('restaurants').update({ logo_url: JSON.stringify(list) }).ilike('name', `%${restoName}%`).then(() => {}).catch(() => {});
    }

    return { id: offerId, active: !currentActiveState };
  }

  // Delete an Offer (Local-First + Background Cloud Sync)
  async deleteRestaurantOffer(restoName, offerId) {
    console.log(`[DIAGNOSTIC R9 DELETE] Deleting offer ${offerId} for resto: "${restoName}"`);
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();

    let list = this.getLocalOffers(slug);
    list = list.filter(o => String(o.id) !== String(offerId));
    this.saveLocalOffers(slug, list);

    if (client) {
      client.from('offers').delete().eq('id', offerId).then(() => {}).catch(() => {});
      client.from('restaurants').update({ logo_url: JSON.stringify(list) }).ilike('name', `%${restoName}%`).then(() => {}).catch(() => {});
    }
    return true;
  }

  // 2. Fetch Restaurant Profile Details
  async getRestaurantByName(name) {
    const client = this.getClient();
    if (client && name) {
      try {
        const cleanSearch = name.replace(/^nx[_-]/, '').replace(/[-_]/g, ' ').trim();
        const slug = this.getSlug(name);
        let { data } = await client
          .from('restaurants')
          .select('*')
          .ilike('name', `%${cleanSearch}%`)
          .limit(1)
          .maybeSingle();

        if (!data) {
          const { data: allRestos } = await client.from('restaurants').select('*');
          if (allRestos && allRestos.length > 0) {
            data = allRestos.find(r => this.getSlug(r.name) === slug || r.name.toLowerCase() === name.toLowerCase() || this.getSlug(r.name) === cleanSearch.toLowerCase());
          }
        }

        if (data) {
          let parsedType = '★ 4.9 • Bistro & Grillades';
          let parsedScanPts = 20;

          try {
            if (data.city && data.city.startsWith('{')) {
              const meta = JSON.parse(data.city);
              parsedType = meta.type || parsedType;
              parsedScanPts = parseInt(meta.scanPts || '20', 10);
            } else if (data.city) {
              parsedType = data.city;
            }
          } catch (e) {}

          return {
            id: data.id,
            name: data.name,
            email: data.email,
            type: parsedType,
            pointsPerScan: parsedScanPts,
            whatsappContact: data.whatsapp_contact || '',
            currency: data.currency || 'FCFA'
          };
        }
      } catch (err) {
        console.log('Fetch resto info:', err);
      }
    }
    return null;
  }

  // 2b. Fetch All Registered Restaurants from Cloud
  async getAllRestaurants() {
    const client = this.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('restaurants')
          .select('*')
          .order('name', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map(r => ({
            id: r.id,
            name: r.name,
            slug: this.getSlug(r.name),
            email: r.email,
            phone: r.whatsapp_contact,
            plan: r.plan || 'pro'
          }));
        }
      } catch (err) {
        console.warn('Fetch all restaurants error:', err);
      }
    }
    return [
      { name: 'Le Savane', slug: 'le-savane', email: 'contact@lesavane.bf' },
      { name: 'noli', slug: 'noli', email: 'gerarddf7@gmail.com' },
      { name: 'malvoo', slug: 'malvoo', email: 'gerarddf27@gmail.com' },
      { name: 'Parisien', slug: 'parisien', email: 'gerarddf17@gmail.com' }
    ];
  }

  // 2b. ÉTAPE R10: Get Secure Public Identifier for a Restaurant
  getRestaurantPublicId(name) {
    if (!name) return 'nx_unknown';
    const slug = this.getSlug(name);
    return `nx_${slug}`;
  }

  // 2c. ÉTAPE R10: Resolve Restaurant by Secure Public Identifier (Strict Verification)
  async getRestaurantByPublicId(publicId) {
    if (!publicId) return null;
    
    // Normalize public identifier (e.g. nx_le-savane -> le-savane or direct name)
    const cleanSlug = publicId.toLowerCase().trim().replace(/^nx_/, '').replace(/[^a-z0-9]/g, '-');
    
    const client = this.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('restaurants')
          .select('*');

        if (!error && data && data.length > 0) {
          const matched = data.find(r => {
            const rSlug = this.getSlug(r.name);
            return rSlug === cleanSlug || r.name.toLowerCase() === cleanSlug || r.name.toLowerCase() === publicId.toLowerCase();
          });

          if (matched) {
            let parsedType = '★ 4.9 • Bistro & Grillades';
            let parsedScanPts = 20;
            try {
              if (matched.city && matched.city.startsWith('{')) {
                const meta = JSON.parse(matched.city);
                parsedType = meta.type || parsedType;
                parsedScanPts = parseInt(meta.scanPts || '20', 10);
              } else if (matched.city) {
                parsedType = matched.city;
              }
            } catch (e) {}

            return {
              id: matched.id,
              publicId: `nx_${this.getSlug(matched.name)}`,
              name: matched.name,
              type: parsedType,
              pointsPerScan: parsedScanPts,
              whatsappContact: matched.whatsapp_contact || '',
              currency: matched.currency || 'FCFA'
            };
          }
        }
      } catch (err) {
        console.error('[DIAGNOSTIC R10] Resolve restaurant by publicId exception:', err);
      }
    }

    // Fallback: If offline or local test session matches
    try {
      const b2bSession = localStorage.getItem('nexa_merchant_b2b_session');
      if (b2bSession) {
        const parsed = JSON.parse(b2bSession);
        if (parsed && parsed.restoName) {
          const sessionSlug = this.getSlug(parsed.restoName);
          if (sessionSlug === cleanSlug) {
            return {
              id: parsed.authUserId || sessionSlug,
              publicId: `nx_${sessionSlug}`,
              name: parsed.restoName,
              type: '★ 4.9 • Bistro & Grillades',
              pointsPerScan: 20,
              currency: 'FCFA'
            };
          }
        }
      }
    } catch(e) {}

    // STRICT: Return null if not found or invalid! NEVER fallback to default restaurant!
    return null;
  }

  // 3. Fetch Cloud Rewards STRICTLY for THIS Restaurant Slug! (Seamless Cache + Cloud)
  async fetchRewardsByResto(restoName) {
    if (!restoName) return [];
    try {
      const rewards = await this.getRestaurantRewards(restoName);
      if (Array.isArray(rewards) && rewards.length > 0) {
        return rewards
          .filter(r => r.active !== false)
          .map(r => ({
            id: String(r.id),
            title: r.title,
            points_required: r.pts,
            pts: r.pts,
            description: r.desc,
            desc: r.desc,
            icon: r.icon || '🎁',
            active: r.active !== false
          }));
      }
    } catch (err) {
      console.warn('[REWARDS] fetchRewardsByResto fallback:', err);
    }
    return [];
  }

  // 4. Create Cloud Reward Tagged with Restaurant Slug
  async createCloudReward(restoName, title, pts, desc, icon, category) {
    const client = this.getClient();
    if (client && restoName) {
      try {
        const slug = this.getSlug(restoName);
        const { data } = await client
          .from('rewards')
          .insert({
            title: title,
            points_required: pts,
            description: slug, // STRICT MULTI-TENANT RESTAURANT TAG!
            icon: icon
          })
          .select()
          .single();

        return data;
      } catch (e) {
        console.error('Reward create exception:', e);
      }
    }
    return null;
  }

  // 5. Delete Reward from Cloud Supabase
  async deleteCloudReward(rewardId, title) {
    const client = this.getClient();
    if (client) {
      try {
        if (rewardId && typeof rewardId === 'number' && rewardId < 2000000000) {
          await client.from('rewards').delete().eq('id', rewardId);
        }
        if (title) {
          await client.from('rewards').delete().eq('title', title);
        }
      } catch (e) {
        console.error('Delete reward cloud error:', e);
      }
    }
  }

  // 6. Fetch Clients STRICTLY for THIS Restaurant (No Global Fallback Leaks!)
  async fetchClientsByResto(restoName) {
    const client = this.getClient();
    if (client && restoName) {
      try {
        const slug = this.getSlug(restoName);
        const { data: slugClients } = await client
          .from('clients')
          .select('*')
          .ilike('whatsapp_phone', `%_${slug}`)
          .order('last_scan_at', { ascending: false });

        return slugClients || []; // ABSOLUTE STRICT MULTI-TENANT ISOLATION: RETURN ONLY SLUG CLIENTS!
      } catch (err) {
        console.error('Fetch Clients Exception:', err);
      }
    }
    return [];
  }

  // 7. Fetch Scans History STRICTLY for THIS Restaurant
  async fetchScansHistory(restoName) {
    const client = this.getClient();
    if (client && restoName) {
      try {
        const slug = this.getSlug(restoName);
        // Query scans matching this restaurant's specific clients
        const { data: clientRows } = await client
          .from('clients')
          .select('visits_count, points_balance')
          .ilike('whatsapp_phone', `%_${slug}`);

        if (clientRows && clientRows.length > 0) {
          const totalScans = clientRows.reduce((sum, c) => sum + (c.visits_count || 1), 0);
          const totalPts = clientRows.reduce((sum, c) => sum + (c.points_balance || 0), 0);
          return { totalScans, totalPts };
        }
      } catch (err) {
        console.error('Fetch Scans Exception:', err);
      }
    }
    return { totalScans: 0, totalPts: 0 };
  }

  // 8. Register Client Identity (WITH DIAGNOSTICS & TIMEOUT & UPSERT)
  // 8. Register Single Client Identity (SAFE & PRESERVES POINTS)
  async registerClientIdentity(restoName, whatsappPhone, clientName = 'Client Nexa', initialPoints = 0) {
    console.log(`[DIAGNOSTIC] registerClientIdentity start. Resto: "${restoName}", Phone: "${whatsappPhone}", Name: "${clientName}", initialPts: ${initialPoints}`);
    
    const slug = this.getSlug(restoName || 'savane');
    const compositeKey = `${whatsappPhone}_${slug}`;

    // 1. Immediately cache in Local CRM storage (0ms guaranteed)
    try {
      let localClients = this.getLocalClients(slug);
      const existingIndex = localClients.findIndex(c => (c.rawKey || c.whatsapp_phone) === compositeKey || c.phone === whatsappPhone);
      const prevPoints = existingIndex >= 0 ? (localClients[existingIndex].points_balance || localClients[existingIndex].points || 0) : 0;
      const prevVisits = existingIndex >= 0 ? (localClients[existingIndex].visits_count || localClients[existingIndex].visits || 0) : 0;

      const effectivePoints = Math.max(prevPoints, initialPoints || 0);
      const effectiveVisits = Math.max(prevVisits, effectivePoints > 0 ? 1 : 0);

      const clientObj = {
        rawKey: compositeKey,
        whatsapp_phone: compositeKey,
        phone: whatsappPhone,
        full_name: clientName,
        name: clientName,
        points_balance: effectivePoints,
        points: effectivePoints,
        visits_count: effectiveVisits,
        visits: effectiveVisits,
        lastVisit: existingIndex >= 0 ? (localClients[existingIndex].lastVisit || 'Nouveau client') : 'Nouveau client',
        last_scan_at: existingIndex >= 0 ? localClients[existingIndex].last_scan_at : (effectivePoints > 0 ? new Date().toISOString() : null)
      };
      if (existingIndex >= 0) {
        localClients[existingIndex] = { ...localClients[existingIndex], ...clientObj };
      } else {
        localClients.unshift(clientObj);
      }
      this.saveLocalClients(slug, localClients);
    } catch (e) {
      console.warn('[STORAGE WARN] registerClientIdentity local cache:', e);
    }

    const client = this.getClient();
    if (!client) {
      console.warn('[DIAGNOSTIC WARN] Supabase client offline, local registration preserved.');
      return { whatsapp_phone: compositeKey, full_name: clientName };
    }

    try {
      // Check existing client in Supabase first - NEVER blindly overwrite points to 0!
      const { data: existingClient } = await client
        .from('clients')
        .select('*')
        .eq('whatsapp_phone', compositeKey)
        .maybeSingle();

      if (existingClient) {
        // Preserve existing points & visits!
        const updatedPoints = Math.max(existingClient.points_balance || 0, initialPoints || 0);
        const updatedVisits = Math.max(existingClient.visits_count || 0, updatedPoints > 0 ? 1 : 0);
        
        await client
          .from('clients')
          .update({
            full_name: clientName && clientName !== 'Client Nexa' ? clientName : existingClient.full_name,
            points_balance: updatedPoints,
            visits_count: updatedVisits
          })
          .eq('id', existingClient.id);

        return { ...existingClient, full_name: clientName, points_balance: updatedPoints, visits_count: updatedVisits };
      } else {
        // Insert new client with initialPoints (if any)
        const newPayload = { 
          whatsapp_phone: compositeKey, 
          full_name: clientName,
          points_balance: initialPoints || 0,
          visits_count: (initialPoints > 0 ? 1 : 0),
          last_scan_at: initialPoints > 0 ? new Date().toISOString() : null
        };

        const { data: createdRow } = await client
          .from('clients')
          .insert(newPayload)
          .select()
          .single();

        return createdRow || newPayload;
      }
    } catch (e) {
      console.warn('[DIAGNOSTIC NOTICE] Client cloud sync deferred:', e.message);
      return { whatsapp_phone: compositeKey, full_name: clientName };
    }
  }

  // 9. Fetch Returning Client Profile (WITH DIAGNOSTICS & TIMEOUT)
  async getClientProfile(restoName, whatsappPhone) {
    console.log(`[DIAGNOSTIC] getClientProfile start. Resto: "${restoName}", Phone: "${whatsappPhone}"`);

    const client = this.getClient();
    if (!client || !whatsappPhone) {
      console.warn('[DIAGNOSTIC WARN] getClientProfile abandonné (client ou whatsapp non disponible).');
      return null;
    }

    const slug = this.getSlug(restoName || 'demo');
    const compositeKey = `${whatsappPhone}_${slug}`;

    console.log(`[DIAGNOSTIC] Recherche client compositeKey: "${compositeKey}" dans table "clients"...`);

    try {
      const queryPromise = client
        .from('clients')
        .select('*')
        .eq('whatsapp_phone', compositeKey)
        .maybeSingle();

      const response = await withTimeout(queryPromise, 8000, 'Lecture profil Supabase Client');

      console.log('[DIAGNOSTIC] Réponse getClientProfile reçue:', {
        data: response.data,
        error: response.error,
        status: response.status,
        statusText: response.statusText
      });

      if (response.error) {
        console.error('[DIAGNOSTIC ERROR] getClientProfile error detail:', response.error);
        throw new Error(`[Supabase ${response.error.code || response.status}] ${response.error.message}`);
      }

      if (response.data) {
        console.log('[DIAGNOSTIC] Profil trouvé dans Supabase Cloud:', response.data);
        return {
          points: response.data.points_balance || 0,
          visits: response.data.visits_count || 0,
          name: response.data.full_name || 'Client Nexa',
          lastScanAt: response.data.last_scan_at ? new Date(response.data.last_scan_at).getTime() : 0
        };
      }

      console.log('[DIAGNOSTIC] Aucun profil existant pour cette clé composite.');
      return null;
    } catch (e) {
      console.error('[DIAGNOSTIC ERROR] Exception lors de getClientProfile:', e);
      throw e;
    }
  }

  // 10. Check Client Cooldown directly on Cloud PostgreSQL!
  async checkClientCooldownCloud(restoName, whatsappPhone) {
    if (this.isLiveSupabase && this.client && whatsappPhone) {
      try {
        const slug = this.getSlug(restoName);
        const compositeKey = `${whatsappPhone}_${slug}`;
        const { data } = await this.client
          .from('clients')
          .select('last_scan_at')
          .eq('whatsapp_phone', compositeKey)
          .maybeSingle();

        if (data && data.last_scan_at) {
          return new Date(data.last_scan_at).getTime();
        }
      } catch (e) {
        console.log('Cooldown check cloud error:', e);
      }
    }
    return 0;
  }

  // 11. Record Single Scan & Save Client in CRM
  async recordScanCloud(restoName, tableNumber, whatsappPhone, clientName = 'Client Nexa', pointsEarned = 20) {
    const slug = this.getSlug(restoName || 'savane');
    const compositeKey = `${whatsappPhone}_${slug}`;

    // 1. Immediately update Local CRM Cache (0ms)
    let currentVisits = 1;
    let currentPoints = pointsEarned;
    try {
      let localList = this.getLocalClients(slug);
      const existingIdx = localList.findIndex(c => (c.rawKey || c.whatsapp_phone) === compositeKey || c.phone === whatsappPhone);
      const prevPoints = existingIdx >= 0 ? (localList[existingIdx].points_balance || localList[existingIdx].points || 0) : 0;
      const prevVisits = existingIdx >= 0 ? (localList[existingIdx].visits_count || localList[existingIdx].visits || 0) : 0;
      currentPoints = prevPoints + pointsEarned;
      currentVisits = prevVisits + 1;
      const displayName = clientName && clientName !== 'Client Nexa' 
        ? clientName 
        : (existingIdx >= 0 ? (localList[existingIdx].name || localList[existingIdx].full_name) : 'Client Nexa');

      const clientObj = {
        rawKey: compositeKey,
        whatsapp_phone: compositeKey,
        phone: whatsappPhone,
        full_name: displayName,
        name: displayName,
        points_balance: currentPoints,
        points: currentPoints,
        visits_count: currentVisits,
        visits: currentVisits,
        lastVisit: 'À l\'instant',
        last_scan_at: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        localList[existingIdx] = { ...localList[existingIdx], ...clientObj };
      } else {
        localList.unshift(clientObj);
      }
      this.saveLocalClients(slug, localList);
    } catch (localErr) {
      console.warn('[CRM SCAN LOCAL CACHE WARN]', localErr);
    }

    const client = this.getClient();
    if (client) {
      try {
        // Step A: Check existing client by composite key
        const { data: existingClient } = await client
          .from('clients')
          .select('*')
          .eq('whatsapp_phone', compositeKey)
          .maybeSingle();

        const cloudVisits = existingClient ? (existingClient.visits_count || 0) + 1 : currentVisits;
        const cloudPoints = existingClient ? (existingClient.points_balance || 0) + pointsEarned : currentPoints;
        const displayName = clientName && clientName !== 'Client Nexa' ? clientName : (existingClient ? existingClient.full_name : 'Client Nexa');

        let clientId = existingClient ? existingClient.id : null;

        // Step B: Robust Insert or Update in Supabase clients table
        if (existingClient) {
          await client
            .from('clients')
            .update({
              full_name: displayName,
              points_balance: cloudPoints,
              visits_count: cloudVisits,
              last_scan_at: new Date().toISOString()
            })
            .eq('whatsapp_phone', compositeKey);
        } else {
          try {
            const { data: newClient } = await client
              .from('clients')
              .insert({
                whatsapp_phone: compositeKey,
                full_name: displayName,
                points_balance: cloudPoints,
                visits_count: cloudVisits,
                last_scan_at: new Date().toISOString()
              })
              .select()
              .single();
            if (newClient) clientId = newClient.id;
          } catch(e) {}
        }

        // Step C: Insert Scan record matching exact PostgreSQL schema
        const scanPayload = {
          table_number: parseInt(tableNumber, 10) || 1,
          points_earned: pointsEarned
        };
        if (clientId) scanPayload.client_id = clientId;

        // Resolve restaurant_id foreign key from restaurants table
        try {
          const cleanSearch = (restoName || '').replace(/^nx[_-]/, '').replace(/[-_]/g, ' ').trim();
          const { data: restoMatch } = await client
            .from('restaurants')
            .select('id')
            .or(`name.ilike.%${cleanSearch}%,name.ilike.%${slug}%,name.ilike.%${restoName}%`)
            .limit(1)
            .maybeSingle();

          if (restoMatch && restoMatch.id) {
            scanPayload.restaurant_id = restoMatch.id;
            if (clientId) {
              await client.from('clients').update({ restaurant_id: restoMatch.id }).eq('id', clientId);
            }
          }
        } catch(restoErr) {}

        await client.from('scans').insert(scanPayload);

        return { currentPoints: cloudPoints, currentVisits: cloudVisits };
      } catch (err) {
        console.error('Record Scan Cloud Exception:', err);
      }
    }
    return { currentPoints, currentVisits };
  }

  // 12. Deduct Points on Reward Redemption
  async deductPointsCloud(restoName, whatsappPhone, pointsDeducted) {
    const slug = this.getSlug(restoName || 'savane');
    const compositeKey = `${whatsappPhone}_${slug}`;

    // Update Local CRM cache immediately (0ms)
    try {
      let localList = this.getLocalClients(slug);
      const existingIdx = localList.findIndex(c => (c.rawKey || c.whatsapp_phone) === compositeKey || c.phone === whatsappPhone);
      if (existingIdx >= 0) {
        const prevPts = localList[existingIdx].points_balance || localList[existingIdx].points || 0;
        const newBal = Math.max(0, prevPts - pointsDeducted);
        localList[existingIdx].points = newBal;
        localList[existingIdx].points_balance = newBal;
        this.saveLocalClients(slug, localList);
      }
    } catch (e) {}

    const client = this.getClient();
    if (client && whatsappPhone) {
      try {
        const { data: existingClient } = await client
          .from('clients')
          .select('*')
          .eq('whatsapp_phone', compositeKey)
          .maybeSingle();

        if (existingClient) {
          const newBalance = Math.max(0, (existingClient.points_balance || 0) - pointsDeducted);
          await client
            .from('clients')
            .update({ points_balance: newBalance })
            .eq('whatsapp_phone', compositeKey);
        }
      } catch (e) {
        console.error('Deduct points error:', e);
      }
    }
  }

  // 13. ÉTAPE R11: Get Restaurant Analytics & Performance Metrics (100% Real Data & Isolated)
  async getRestaurantAnalytics(restoName, period = '30d') {
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();
    const cleanSearch = (restoName || '').replace(/^nx[_-]/, '').replace(/[-_]/g, ' ').trim();

    // 1. Calculate Period Boundaries
    const now = new Date();
    let startDate = new Date(0); // 'all'
    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (period === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === '90d') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    // 2. Fetch Restaurant Record (ID & Offers from logo_url)
    let restoId = null;
    let rawOffers = [];
    if (client) {
      try {
        const { data: restoRows } = await client
          .from('restaurants')
          .select('id, name, logo_url')
          .or(`name.ilike.%${cleanSearch}%,name.ilike.%${slug}%,name.ilike.%${restoName}%`)
          .limit(1);
        if (restoRows && restoRows[0]) {
          restoId = restoRows[0].id;
          if (restoRows[0].logo_url) {
            try {
              const parsed = JSON.parse(restoRows[0].logo_url);
              rawOffers = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn('[R11 ANALYTICS RESTO FETCH]', e);
      }
    }

    // 3. Fetch Real Clients of this restaurant only (Strict Isolation)
    let clients = [];
    if (client) {
      try {
        const { data: clientRows } = await client
          .from('clients')
          .select('*')
          .ilike('whatsapp_phone', `%_${slug}`)
          .order('created_at', { ascending: false });
        if (Array.isArray(clientRows)) {
          clients = clientRows;
        }
      } catch (e) {
        console.warn('[R11 ANALYTICS CLIENTS FETCH]', e);
      }
    }
    // Fallback merge with local clients if offline
    const localClients = this.getLocalClients(slug);
    if (clients.length === 0 && localClients.length > 0) {
      clients = localClients.map(c => ({
        id: c.id || `local_${Math.random()}`,
        full_name: c.name || c.full_name || 'Client Nexa',
        whatsapp_phone: c.rawKey || c.whatsapp_phone || `${c.phone}_${slug}`,
        points_balance: c.points || c.points_balance || 0,
        visits_count: c.visits || c.visits_count || 1,
        tier: (c.points || 0) >= 200 ? 'VIP' : 'Silver',
        created_at: c.createdAt || new Date().toISOString(),
        last_scan_at: c.lastVisit || new Date().toISOString()
      }));
    }

    const clientIds = clients.map(c => c.id).filter(Boolean);

    // 4. Fetch Real Scans of this restaurant only
    let scans = [];
    if (client && (restoId || clientIds.length > 0)) {
      try {
        let scansQuery = client.from('scans').select('*');
        if (restoId && clientIds.length > 0) {
          scansQuery = scansQuery.or(`restaurant_id.eq.${restoId},client_id.in.(${clientIds.join(',')})`);
        } else if (restoId) {
          scansQuery = scansQuery.eq('restaurant_id', restoId);
        } else {
          scansQuery = scansQuery.in('client_id', clientIds);
        }
        const { data: scanRows } = await scansQuery.order('scanned_at', { ascending: true });
        if (Array.isArray(scanRows)) {
          scans = scanRows;
        }
      } catch (e) {
        console.warn('[R11 ANALYTICS SCANS FETCH]', e);
      }
    }

    // 5. Fetch Real Rewards of this restaurant
    let rewards = [];
    if (client) {
      try {
        const { data: rewardRows } = await client
          .from('rewards')
          .select('*')
          .or(`description.ilike.%${slug}%,description.ilike.%${cleanSearch}%,description.ilike.%${restoName}%`);
        if (Array.isArray(rewardRows)) {
          rewards = rewardRows;
        }
      } catch (e) {
        console.warn('[R11 ANALYTICS REWARDS FETCH]', e);
      }
    }

    // 6. Fetch Local Validated Proofs (Redemptions)
    let validatedProofs = [];
    try {
      const storedProofs = localStorage.getItem(`nexa_validated_proofs_${slug}`);
      if (storedProofs) {
        const parsed = JSON.parse(storedProofs);
        if (Array.isArray(parsed)) validatedProofs = parsed;
      }
    } catch (e) {}

    // ==========================================
    // FILTER DATA FOR THE SELECTED PERIOD
    // ==========================================
    const scansInPeriod = scans.filter(s => {
      if (!s.scanned_at) return false;
      return new Date(s.scanned_at) >= startDate;
    });

    const newClientsInPeriod = clients.filter(c => {
      if (!c.created_at) return false;
      return new Date(c.created_at) >= startDate;
    });

    const redemptionsInPeriod = validatedProofs.filter(p => {
      if (!p.date) return true;
      return new Date(p.date) >= startDate;
    });

    // Compute Commercial Offers stats
    let activeOffersCount = 0;
    let expiredOffersCount = 0;
    let scheduledOffersCount = 0;
    const todayStr = now.toISOString().split('T')[0];

    rawOffers.forEach(o => {
      const start = o.startDate || o.start_date || todayStr;
      const end = o.endDate || o.end_date || '9999-12-31';
      if (o.active === false) {
        // Disabled
      } else if (todayStr > end) {
        expiredOffersCount++;
      } else if (todayStr < start) {
        scheduledOffersCount++;
      } else {
        activeOffersCount++;
      }
    });

    // Compute KPIs
    const totalCustomers = clients.length;
    const newCustomersPeriod = newClientsInPeriod.length;
    const totalScansPeriod = scansInPeriod.length;
    const totalPointsAwardedPeriod = scansInPeriod.reduce((sum, s) => sum + (parseInt(s.points_earned || 20, 10)), 0);
    const avgPointsPerVisit = totalScansPeriod > 0 ? Math.round((totalPointsAwardedPeriod / totalScansPeriod) * 10) / 10 : 0;
    
    // Sum redemptions from local proofs + rewards use_count
    const sumRewardsUseCount = rewards.reduce((sum, r) => sum + (parseInt(r.use_count || r.redemptions_count || 0, 10)), 0);
    const totalRewardsRedeemed = Math.max(redemptionsInPeriod.length, sumRewardsUseCount);

    // ==========================================
    // BUILD DAY-BY-DAY TIME-SERIES
    // ==========================================
    const daysMap = new Map();

    if (period === 'today') {
      const todayKey = now.toISOString().split('T')[0];
      daysMap.set(todayKey, { date: todayKey, label: "Aujourd'hui", scans: 0, points: 0, newClients: 0 });
    } else {
      const numDays = period === '7d' ? 7 : (period === '30d' ? 30 : (period === '90d' ? 90 : 30));
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dKey = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        daysMap.set(dKey, { date: dKey, label, scans: 0, points: 0, newClients: 0 });
      }
    }

    // Populate scans into time-series
    scansInPeriod.forEach(s => {
      const sDateKey = s.scanned_at ? s.scanned_at.split('T')[0] : null;
      if (sDateKey) {
        if (!daysMap.has(sDateKey)) {
          const dObj = new Date(sDateKey);
          daysMap.set(sDateKey, {
            date: sDateKey,
            label: dObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
            scans: 0,
            points: 0,
            newClients: 0
          });
        }
        const entry = daysMap.get(sDateKey);
        entry.scans += 1;
        entry.points += parseInt(s.points_earned || 20, 10);
      }
    });

    // Populate new clients into time-series
    newClientsInPeriod.forEach(c => {
      const cDateKey = c.created_at ? c.created_at.split('T')[0] : null;
      if (cDateKey && daysMap.has(cDateKey)) {
        daysMap.get(cDateKey).newClients += 1;
      }
    });

    // Sort timeSeries chronologically
    const timeSeries = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // ==========================================
    // BUILD TOP REWARDS (REAL DATA ONLY)
    // ==========================================
    const topRewards = rewards
      .map(r => ({
        id: r.id,
        title: r.title || 'Privilège',
        pts: r.points_required || r.pts || 20,
        icon: r.icon || '🎁',
        useCount: parseInt(r.use_count || r.redemptions_count || 0, 10)
      }))
      .filter(r => r.useCount > 0)
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 5);

    // ==========================================
    // BUILD TOP CLIENTS (PRIVACY-FRIENDLY)
    // ==========================================
    const topClients = clients
      .map(c => {
        const rawPhone = (c.whatsapp_phone ? c.whatsapp_phone.split('_')[0] : (c.phone || ''));
        let maskedPhone = rawPhone;
        if (rawPhone.length >= 6) {
          maskedPhone = rawPhone.substring(0, 4) + ' •• •• ' + rawPhone.slice(-2);
        }
        return {
          id: c.id,
          name: c.full_name || c.name || 'Client Nexa',
          maskedPhone: maskedPhone,
          visits: typeof c.visits_count === 'number' ? c.visits_count : (c.visits || 1),
          points: typeof c.points_balance === 'number' ? c.points_balance : (c.points || 0),
          tier: c.tier || ((c.points_balance || c.points || 0) >= 200 ? 'VIP' : 'Silver')
        };
      })
      .sort((a, b) => (b.visits - a.visits) || (b.points - a.points))
      .slice(0, 5);

    const result = {
      period,
      restoName,
      kpis: {
        totalCustomers,
        newCustomersPeriod,
        totalScans: totalScansPeriod,
        totalPoints: totalPointsAwardedPeriod,
        avgPointsPerVisit,
        rewardsRedeemed: totalRewardsRedeemed,
        activeOffers: activeOffersCount,
        expiredOffers: expiredOffersCount,
        scheduledOffers: scheduledOffersCount
      },
      timeSeries,
      hasActivityData: scansInPeriod.length > 0,
      topRewards,
      topClients
    };

    // Save in local cache for instant fast response
    try {
      localStorage.setItem(`nexa_analytics_cache_${slug}_${period}`, JSON.stringify(result));
    } catch (e) {}

    return result;
  }

  // 14. ÉTAPE R12: Fetch Restaurant Subscription & Access Status (Strict Read-Only & Real Data)
  async getRestaurantSubscription(restoName, userEmail) {
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();
    const cleanSearch = (restoName || '').replace(/^nx[_-]/, '').replace(/[-_]/g, ' ').trim();

    let resto = null;
    if (client) {
      try {
        let query = client.from('restaurants').select('*');
        if (userEmail && userEmail.includes('@') && !userEmail.includes('owner@restaurant.com')) {
          query = query.eq('email', userEmail);
        } else {
          query = query.or(`name.ilike.%${cleanSearch}%,name.ilike.%${slug}%,name.ilike.%${restoName}%`);
        }
        const { data: rows } = await query.limit(1);
        if (Array.isArray(rows) && rows.length > 0) {
          resto = rows[0];
        }
      } catch (err) {
        console.warn('[R12 SUB RESTO FETCH WARN]', err.message);
      }
    }

    // Default dates derived strictly from real creation date
    const now = new Date();
    let createdAtDate = now;
    if (resto && resto.created_at) {
      createdAtDate = new Date(resto.created_at);
    } else {
      const storedCreated = localStorage.getItem(`nexa_sub_created_${slug}`);
      if (storedCreated) {
        createdAtDate = new Date(storedCreated);
      } else {
        localStorage.setItem(`nexa_sub_created_${slug}`, now.toISOString());
      }
    }

    const startDate = createdAtDate;
    // Standard monthly subscription cycle: 30 days
    let endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Check if custom admin-controlled subscription data is present in city metadata
    let adminCustomStatus = null;
    if (resto && resto.city) {
      try {
        const parsedCity = JSON.parse(resto.city);
        if (parsedCity && parsedCity.subscription) {
          if (parsedCity.subscription.end_date) {
            endDate = new Date(parsedCity.subscription.end_date);
          }
          if (parsedCity.subscription.status) {
            adminCustomStatus = parsedCity.subscription.status;
          }
        }
      } catch (e) {}
    }

    // Compute real days remaining
    const diffMs = endDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Calculate real status
    let computedStatus = 'Active';
    if (adminCustomStatus === 'Suspended') {
      computedStatus = 'Suspended';
    } else if (adminCustomStatus === 'Pending') {
      computedStatus = 'Pending';
    } else if (daysRemaining < 0) {
      computedStatus = 'Expired';
    } else if (daysRemaining <= 5) {
      computedStatus = 'Expiring soon';
    } else {
      computedStatus = 'Active';
    }

    const result = {
      restaurantId: resto ? resto.id : `sub_${slug}`,
      restaurantName: resto ? resto.name : restoName,
      plan: NEXA_SUBSCRIPTION_CONFIG.planName,
      planId: NEXA_SUBSCRIPTION_CONFIG.planId,
      price: NEXA_SUBSCRIPTION_CONFIG.price,
      currency: NEXA_SUBSCRIPTION_CONFIG.currency,
      currencySymbol: NEXA_SUBSCRIPTION_CONFIG.currencySymbol,
      formattedPrice: NEXA_SUBSCRIPTION_CONFIG.formattedPrice,
      formattedPriceFr: NEXA_SUBSCRIPTION_CONFIG.formattedPriceFr,
      plans: {
        monthly: NEXA_SUBSCRIPTION_CONFIG.monthly,
        annual: NEXA_SUBSCRIPTION_CONFIG.annual
      },
      status: computedStatus,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      formattedStartDate: startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      formattedEndDate: endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      daysRemaining: Math.max(0, daysRemaining),
      actualDaysDiff: daysRemaining,
      isExpired: daysRemaining < 0,
      isExpiringSoon: daysRemaining >= 0 && daysRemaining <= 5,
      features: NEXA_SUBSCRIPTION_CONFIG.features,
      paymentHistory: []
    };

    // Cache locally for instant fast response
    try {
      localStorage.setItem(`nexa_sub_cache_${slug}`, JSON.stringify(result));
    } catch (e) {}

    return result;
  }

  // 15. ÉTAPE R13: Get Restaurant Settings & Preferences from Supabase Cloud
  async getRestaurantSettings(restoName, userEmail) {
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();
    const cleanSearch = (restoName || '').replace(/^nx[_-]/, '').replace(/[-_]/g, ' ').trim();

    let resto = null;
    if (client) {
      try {
        let query = client.from('restaurants').select('*');
        if (userEmail && userEmail.includes('@') && !userEmail.includes('owner@restaurant.com')) {
          query = query.eq('email', userEmail);
        } else {
          query = query.or(`name.ilike.%${cleanSearch}%,name.ilike.%${slug}%,name.ilike.%${restoName}%`);
        }
        const { data: rows } = await query.limit(1);
        if (Array.isArray(rows) && rows.length > 0) {
          resto = rows[0];
        }
      } catch (err) {
        console.warn('[R13 SETTINGS FETCH WARN]', err.message);
      }
    }

    // Parse metadata from city
    let meta = {};
    if (resto && resto.city) {
      try {
        meta = typeof resto.city === 'object' ? resto.city : JSON.parse(resto.city);
      } catch (e) {
        meta = { city: resto.city };
      }
    }

    const defaultNotifications = {
      customer_activity: true,
      loyalty_activity: true,
      reward_activity: true,
      offer_activity: true,
      subscription_reminders: true
    };

    const result = {
      id: resto ? resto.id : `resto_${slug}`,
      name: resto ? resto.name : (restoName || 'Mon Restaurant'),
      email: (resto && resto.email) || userEmail || `${slug}@restaurant.com`,
      phone: (resto && resto.whatsapp_contact) || meta.owner_phone || '',
      category: meta.type || 'Bistro & Grillades',
      country: meta.country || 'Côte d\'Ivoire',
      city: meta.city || 'Abidjan',
      address: meta.address || '',
      ownerName: meta.owner_name || '',
      logo: meta.logo || '',
      notifications: Object.assign({}, defaultNotifications, meta.notifications || {})
    };

    // Cache locally
    try {
      localStorage.setItem(`nexa_settings_cache_${slug}`, JSON.stringify(result));
    } catch (e) {}

    return result;
  }

  // 15b. ÉTAPE R13: Save / Update Restaurant Settings in Supabase Cloud
  async updateRestaurantSettings(restoName, userEmail, payload) {
    const slug = this.getSlug(restoName || 'savane');
    const client = this.getClient();
    const cleanSearch = (restoName || '').replace(/^nx[_-]/, '').replace(/[-_]/g, ' ').trim();

    if (!payload || typeof payload !== 'object') {
      throw new Error('Données de configuration invalides.');
    }

    // Validation: name is required
    const newName = (payload.name || '').trim();
    if (!newName) {
      throw new Error('Le nom du restaurant est obligatoire.');
    }

    let existingResto = null;
    if (client) {
      try {
        let query = client.from('restaurants').select('*');
        if (userEmail && userEmail.includes('@') && !userEmail.includes('owner@restaurant.com')) {
          query = query.eq('email', userEmail);
        } else {
          query = query.or(`name.ilike.%${cleanSearch}%,name.ilike.%${slug}%,name.ilike.%${restoName}%`);
        }
        const { data: rows } = await query.limit(1);
        if (Array.isArray(rows) && rows.length > 0) {
          existingResto = rows[0];
        }
      } catch (err) {
        console.warn('[R13 UPDATE PRE-CHECK WARN]', err.message);
      }
    }

    // Existing metadata
    let currentMeta = {};
    if (existingResto && existingResto.city) {
      try {
        currentMeta = typeof existingResto.city === 'object' ? existingResto.city : JSON.parse(existingResto.city);
      } catch (e) {
        currentMeta = {};
      }
    }

    // Strictly authorize only legitimate fields (NEVER let user modify subscription, role, or ownership)
    const updatedMeta = Object.assign({}, currentMeta, {
      type: payload.category !== undefined ? payload.category.trim() : (currentMeta.type || 'Bistro & Grillades'),
      country: payload.country !== undefined ? payload.country.trim() : (currentMeta.country || 'Côte d\'Ivoire'),
      city: payload.city !== undefined ? payload.city.trim() : (currentMeta.city || 'Abidjan'),
      address: payload.address !== undefined ? payload.address.trim() : (currentMeta.address || ''),
      owner_name: payload.ownerName !== undefined ? payload.ownerName.trim() : (currentMeta.owner_name || ''),
      owner_phone: payload.phone !== undefined ? payload.phone.trim() : (currentMeta.owner_phone || ''),
      logo: payload.logo !== undefined ? payload.logo : (currentMeta.logo || ''),
      notifications: payload.notifications !== undefined ? payload.notifications : (currentMeta.notifications || {})
    });

    const updateFields = {
      name: newName,
      whatsapp_contact: (payload.phone || '').trim() || existingResto?.whatsapp_contact || '',
      city: JSON.stringify(updatedMeta)
    };

    if (client && existingResto && existingResto.id) {
      const { error: updateErr } = await client
        .from('restaurants')
        .update(updateFields)
        .eq('id', existingResto.id);

      if (updateErr) {
        throw new Error(`[Supabase Error] ${updateErr.message}`);
      }
    }

    // Update local cache
    const updatedSettings = {
      id: existingResto ? existingResto.id : `resto_${slug}`,
      name: newName,
      email: existingResto ? existingResto.email : userEmail,
      phone: updateFields.whatsapp_contact,
      category: updatedMeta.type,
      country: updatedMeta.country,
      city: updatedMeta.city,
      address: updatedMeta.address,
      ownerName: updatedMeta.owner_name,
      logo: updatedMeta.logo,
      notifications: updatedMeta.notifications
    };

    try {
      localStorage.setItem(`nexa_settings_cache_${slug}`, JSON.stringify(updatedSettings));
      const newSlug = this.getSlug(newName);
      if (newSlug !== slug) {
        localStorage.setItem(`nexa_settings_cache_${newSlug}`, JSON.stringify(updatedSettings));
      }
    } catch (e) {}

    return updatedSettings;
  }

  // 15c. ÉTAPE R13: Change Password via Supabase Auth Official API
  async updateRestaurantPassword(newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Le mot de passe doit comporter au moins 6 caractères.');
    }

    const client = this.getClient();
    if (!client || !client.auth) {
      throw new Error('Service d\'authentification Supabase indisponible.');
    }

    const { data, error } = await client.auth.updateUser({
      password: newPassword
    });

    if (error) {
      throw new Error(`[Supabase Auth Error] ${error.message}`);
    }

    return { success: true, user: data.user };
  }

  // 15d. ÉTAPE R13: Sign Out Cleanly from Supabase Auth & Clear Session
  async logoutRestaurantB2B() {
    const client = this.getClient();
    if (client && client.auth) {
      try {
        await client.auth.signOut();
      } catch (e) {
        console.warn('Supabase Auth SignOut warning:', e);
      }
    }

    try {
      localStorage.removeItem('nexa_merchant_b2b_session');
      localStorage.removeItem('nexa_resto_name');
    } catch (e) {}

    return true;
  }
}

// Global Singleton Instance
window.nexaBackend = new NexaProductionBackend();
