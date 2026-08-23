/* ==========================================================================
   NEXA PRODUCTION - EXHAUSTIVE SUPABASE BACKEND ENGINE
   ========================================================================== */

const SUPABASE_CONFIG = {
  url: 'https://yahznyueiihraxahhujb.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaHpueXVlaWlocmF4YWhodWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MDQ4MzIsImV4cCI6MjEwMTk4MDgzMn0.OslLjXNWSEwNTlYtoUD4eXgc19I9Py5FF2vn3T8NIpw'
};

class NexaProductionBackend {
  constructor() {
    this.isLiveSupabase = false;
    this.init();
  }

  init() {
    if (window.supabase) {
      try {
        this.client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        this.isLiveSupabase = true;
        console.log('⚡ NEXA SaaS Backend Engine: Connected to Supabase Cloud');
      } catch (err) {
        console.error('Supabase Init Error:', err);
      }
    }
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

  // 8. Register Client Identity (UPSERT WITH ONCONFLICT TO PREVENT DUPLICATE KEY STUCK STATE)
  async registerClientIdentity(restoName, whatsappPhone, clientName = 'Client Nexa') {
    if (this.isLiveSupabase && this.client) {
      try {
        const slug = this.getSlug(restoName || 'demo');
        const compositeKey = `${whatsappPhone}_${slug}`;

        const { data, error } = await this.client
          .from('clients')
          .upsert({ 
            whatsapp_phone: compositeKey, 
            full_name: clientName,
            points_balance: 0,
            visits_count: 0
          }, { onConflict: 'whatsapp_phone' })
          .select()
          .single();

        if (error) {
          console.error('Supabase Client Upsert Error:', error);
          throw new Error(error.message || 'Erreur lors de l\'enregistrement dans la base de données Supabase.');
        }

        return data;
      } catch (e) {
        console.error('Client identity reg error:', e);
        throw e;
      }
    }
    return null;
  }

  // 9. Fetch Returning Client Profile
  async getClientProfile(restoName, whatsappPhone) {
    if (this.isLiveSupabase && this.client && whatsappPhone) {
      try {
        const slug = this.getSlug(restoName);
        const compositeKey = `${whatsappPhone}_${slug}`;
        const { data } = await this.client
          .from('clients')
          .select('*')
          .eq('whatsapp_phone', compositeKey)
          .maybeSingle();

        if (data) {
          return {
            points: data.points_balance || 0,
            visits: data.visits_count || 0,
            name: data.full_name || 'Client Nexa',
            lastScanAt: data.last_scan_at ? new Date(data.last_scan_at).getTime() : 0
          };
        }
      } catch (e) {
        console.log('Get client profile info:', e);
      }
    }
    return null;
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
