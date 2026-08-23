/* ==========================================================================
   NEXA PRODUCTION - EXHAUSTIVE SUPABASE BACKEND ENGINE
   ========================================================================== */

const SUPABASE_CONFIG = {
  url: 'https://yahznyueiihraxahhujb.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaHpueXVlaWlocmF4YWhodWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MDQ4MzIsImV4cCI6MjEwMTk4MDgzMn0.OslLjXNWSEwNTlYtoUD4eXgc19I9Py5FF2vn3T8NIpw'
};

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
    return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
  }

  // 1. Register or Login Merchant Profile
  async registerOrLoginMerchant(name, type, email, pwd, pointsPerScan = 20, currency = 'FCFA', whatsappOfficial = '') {
    if (this.isLiveSupabase && this.client) {
      try {
        const slug = this.getSlug(name);
        const metaObj = JSON.stringify({ type: type, scanPts: pointsPerScan });

        const { data: resto } = await this.client
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

  // 1b. ÉTAPE R3: Register New B2B Restaurant Account with Supabase Auth & Restaurant Record
  async registerNewRestaurantB2B(payload) {
    const client = this.getClient();
    if (!client) {
      throw new Error('Supabase client indisponible. Veuillez vérifier votre connexion.');
    }

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

    // A. Create Supabase Auth User for Manager
    let authUserId = null;
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

      if (authError) {
        if (authError.message.includes('already registered') || authError.status === 400 || authError.status === 422) {
          throw new Error('Cet e-mail est déjà utilisé pour un compte Nexa. Veuillez utiliser un autre e-mail ou vous connecter.');
        }
        throw new Error(`[Supabase Auth] ${authError.message}`);
      }

      if (authData && authData.user) {
        authUserId = authData.user.id;
      }
    } catch (authErr) {
      console.error('[DIAGNOSTIC B2B AUTH ERROR]', authErr);
      throw authErr;
    }

    // B. Create / Upsert Restaurant Record in `restaurants` Table
    const slug = this.getSlug(restoName);
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

    try {
      const { data: restoData, error: restoError } = await client
        .from('restaurants')
        .upsert({
          name: restoName,
          email: ownerEmail,
          whatsapp_contact: restoPhone || ownerPhone,
          city: metaObj,
          currency: 'FCFA'
        }, { onConflict: 'email' })
        .select()
        .single();

      if (restoError) {
        console.error('[DIAGNOSTIC B2B RESTO ERROR]', restoError);
        throw new Error(`[Supabase DB] ${restoError.message}`);
      }

      return {
        authUserId,
        restoId: restoData ? restoData.id : slug,
        restoName,
        email: ownerEmail
      };
    } catch (dbErr) {
      console.error('[DIAGNOSTIC B2B DB ERROR]', dbErr);
      throw dbErr;
    }
  }

  // 2. Fetch Restaurant Profile Details
  async getRestaurantByName(name) {
    if (this.isLiveSupabase && this.client && name) {
      try {
        const { data } = await this.client
          .from('restaurants')
          .select('*')
          .ilike('name', `%${name}%`)
          .limit(1)
          .maybeSingle();

        if (data) {
          let parsedType = data.city || '★ 4.9 • Bistro & Grillades';
          let parsedScanPts = 20;

          try {
            if (data.city && data.city.startsWith('{')) {
              const meta = JSON.parse(data.city);
              parsedType = meta.type || parsedType;
              parsedScanPts = parseInt(meta.scanPts || '20', 10);
            }
          } catch (e) {}

          return {
            name: data.name,
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

  // 3. Fetch Cloud Rewards STRICTLY for THIS Restaurant Slug!
  async fetchRewardsByResto(restoName) {
    if (this.isLiveSupabase && this.client && restoName) {
      try {
        const slug = this.getSlug(restoName);
        const { data } = await this.client
          .from('rewards')
          .select('*')
          .eq('description', slug)
          .order('created_at', { ascending: true });
          
        return data || [];
      } catch (err) {
        console.error('Fetch Rewards Exception:', err);
      }
    }
    return [];
  }

  // 4. Create Cloud Reward Tagged with Restaurant Slug
  async createCloudReward(restoName, title, pts, desc, icon, category) {
    if (this.isLiveSupabase && this.client && restoName) {
      try {
        const slug = this.getSlug(restoName);
        const { data } = await this.client
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
    if (this.isLiveSupabase && this.client) {
      try {
        if (rewardId && typeof rewardId === 'number' && rewardId < 2000000000) {
          await this.client.from('rewards').delete().eq('id', rewardId);
        }
        if (title) {
          await this.client.from('rewards').delete().eq('title', title);
        }
      } catch (e) {
        console.error('Delete reward cloud error:', e);
      }
    }
  }

  // 6. Fetch Clients STRICTLY for THIS Restaurant (No Global Fallback Leaks!)
  async fetchClientsByResto(restoName) {
    if (this.isLiveSupabase && this.client && restoName) {
      try {
        const slug = this.getSlug(restoName);
        const { data: slugClients } = await this.client
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
    if (this.isLiveSupabase && this.client && restoName) {
      try {
        const slug = this.getSlug(restoName);
        // Query scans matching this restaurant's specific clients
        const { data: clientRows } = await this.client
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
  async registerClientIdentity(restoName, whatsappPhone, clientName = 'Client Nexa') {
    console.log(`[DIAGNOSTIC] registerClientIdentity start. Resto: "${restoName}", Phone: "${whatsappPhone}", Name: "${clientName}"`);
    
    const client = this.getClient();
    if (!client) {
      console.error('[DIAGNOSTIC ERROR] Supabase client is NOT available!');
      throw new Error('Supabase client indisponible. Veuillez vérifier votre connexion.');
    }

    const slug = this.getSlug(restoName || 'demo');
    const compositeKey = `${whatsappPhone}_${slug}`;
    const payload = { 
      whatsapp_phone: compositeKey, 
      full_name: clientName,
      points_balance: 0,
      visits_count: 0
    };

    console.log('[DIAGNOSTIC] Payload préparé pour table "clients":', JSON.stringify(payload));
    console.log(`[DIAGNOSTIC] Envoi requête Supabase upsert vers table "clients" pour compositeKey "${compositeKey}"...`);

    try {
      const queryPromise = client
        .from('clients')
        .upsert(payload, { onConflict: 'whatsapp_phone' })
        .select();

      const response = await withTimeout(queryPromise, 8000, 'Enregistrement Supabase Client');

      console.log('[DIAGNOSTIC] Réponse Supabase reçue:', {
        data: response.data,
        error: response.error,
        status: response.status,
        statusText: response.statusText
      });

      if (response.error) {
        console.error('[DIAGNOSTIC ERROR] Supabase error detail:', response.error);
        throw new Error(`[Supabase ${response.error.code || response.status}] ${response.error.message || response.error.details}`);
      }

      console.log('[DIAGNOSTIC] Profil client inséré avec succès dans Supabase Cloud !');
      return response.data;
    } catch (e) {
      console.error('[DIAGNOSTIC ERROR] Exception lors de registerClientIdentity:', e);
      throw e;
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
    if (this.isLiveSupabase && this.client) {
      try {
        const slug = this.getSlug(restoName);
        const compositeKey = `${whatsappPhone}_${slug}`;

        // Step A: Check existing client by composite key
        const { data: existingClient } = await this.client
          .from('clients')
          .select('*')
          .eq('whatsapp_phone', compositeKey)
          .maybeSingle();

        const currentVisits = existingClient ? (existingClient.visits_count || 0) + 1 : 1;
        const currentPoints = existingClient ? (existingClient.points_balance || 0) + pointsEarned : pointsEarned;
        const displayName = clientName && clientName !== 'Client Nexa' ? clientName : (existingClient ? existingClient.full_name : 'Client Nexa');

        // Step B: Robust Insert or Update in Supabase clients table
        if (existingClient) {
          await this.client
            .from('clients')
            .update({
              full_name: displayName,
              points_balance: currentPoints,
              visits_count: currentVisits,
              last_scan_at: new Date().toISOString()
            })
            .eq('whatsapp_phone', compositeKey);
        } else {
          await this.client
            .from('clients')
            .insert({
              whatsapp_phone: compositeKey,
              full_name: displayName,
              points_balance: currentPoints,
              visits_count: currentVisits,
              last_scan_at: new Date().toISOString()
            });
        }

        // Step C: Insert Scan record
        await this.client.from('scans').insert({
          table_number: slug.length,
          points_earned: pointsEarned
        });

        return { currentPoints, currentVisits };
      } catch (err) {
        console.error('Record Scan Exception:', err);
      }
    }
    return null;
  }

  // 12. Deduct Points on Reward Redemption
  async deductPointsCloud(restoName, whatsappPhone, pointsDeducted) {
    if (this.isLiveSupabase && this.client && whatsappPhone) {
      try {
        const slug = this.getSlug(restoName);
        const compositeKey = `${whatsappPhone}_${slug}`;

        const { data: existingClient } = await this.client
          .from('clients')
          .select('*')
          .eq('whatsapp_phone', compositeKey)
          .maybeSingle();

        if (existingClient) {
          const newBalance = Math.max(0, (existingClient.points_balance || 0) - pointsDeducted);
          await this.client
            .from('clients')
            .update({ points_balance: newBalance })
            .eq('whatsapp_phone', compositeKey);
        }
      } catch (e) {
        console.error('Deduct points error:', e);
      }
    }
  }
}

// Global Singleton Instance
window.nexaBackend = new NexaProductionBackend();
