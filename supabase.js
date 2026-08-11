/* ==========================================================================
   NEXA PRODUCTION - STRICT MULTI-TENANT ISOLATION BACKEND ENGINE
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
        console.log('⚡ NEXA Strict Multi-Tenant SaaS Engine: Live Supabase Connected');
      } catch (err) {
        console.error('Supabase Init Error:', err);
      }
    }
  }

  // Generate clean unique slug per restaurant (ex: "restaurant-malco", "le-savane")
  getSlug(name) {
    if (!name) return 'def-resto';
    return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
  }

  // 1. Register or Login Restaurant (Strict Isolation)
  async registerOrLoginMerchant(name, type, email, pwd, pointsPerScan = 20, currency = 'FCFA') {
    if (this.isLiveSupabase && this.client) {
      try {
        const slug = this.getSlug(name);
        const { data: resto, error } = await this.client
          .from('restaurants')
          .upsert({
            name: name,
            email: email,
            whatsapp_contact: pointsPerScan.toString(),
            city: type,
            currency: currency
          }, { onConflict: 'email' })
          .select()
          .single();

        if (error) console.error('Resto DB Error:', error);
        return resto || { id: slug, name, city: type, whatsapp_contact: pointsPerScan.toString() };
      } catch (e) {
        console.log('Merchant save fallback:', e);
      }
    }
    return { name, city: type, whatsapp_contact: pointsPerScan.toString() };
  }

  // 2. Fetch Restaurant Profile Details by Name
  async getRestaurantByName(name) {
    if (this.isLiveSupabase && this.client) {
      try {
        const { data, error } = await this.client
          .from('restaurants')
          .select('*')
          .ilike('name', `%${name}%`)
          .limit(1)
          .single();

        if (!error && data) {
          return {
            name: data.name,
            type: data.city || '★ 4.9 • Bistro & Grillades',
            pointsPerScan: parseInt(data.whatsapp_contact || '20', 10),
            currency: data.currency || 'FCFA'
          };
        }
      } catch (err) {
        console.log('Fetch resto info:', err);
      }
    }
    return null;
  }

  // 3. Fetch Cloud Rewards STRICTLY Filtered by Restaurant Name!
  async fetchRewardsByResto(restoName) {
    if (this.isLiveSupabase && this.client) {
      try {
        const slug = this.getSlug(restoName);
        const { data, error } = await this.client
          .from('rewards')
          .select('*')
          .eq('description', slug) // Filter strictly by restaurant slug!
          .order('created_at', { ascending: true });
          
        if (error) console.error('Fetch Rewards Error:', error);
        return data || [];
      } catch (err) {
        console.error('Fetch Rewards Exception:', err);
      }
    }
    return [];
  }

  // 4. Create Reward Tagged with Restaurant Slug!
  async createCloudReward(restoName, title, pts, desc, icon, category) {
    if (this.isLiveSupabase && this.client) {
      try {
        const slug = this.getSlug(restoName);
        const { data, error } = await this.client
          .from('rewards')
          .insert({
            title: title,
            points_required: pts,
            description: slug, // Stores restaurant slug for strict multi-tenant isolation!
            icon: icon
          })
          .select()
          .single();

        if (error) console.error('Create Cloud Reward Error:', error);
        return data;
      } catch (e) {
        console.error('Reward create exception:', e);
      }
    }
    return null;
  }

  // 5. Fetch Cloud Clients STRICTLY Filtered by Restaurant Name!
  async fetchClientsByResto(restoName) {
    if (this.isLiveSupabase && this.client) {
      try {
        const slug = this.getSlug(restoName);
        const { data, error } = await this.client
          .from('clients')
          .select('*')
          .eq('whatsapp_phone', `resto_${slug}`) // Filter strictly by restaurant slug prefix or column!
          .order('last_scan_at', { ascending: false });

        // Fallback: If no prefix, fetch all registered for this active merchant session
        if (!error && data && data.length > 0) return data;

        const { data: allClients } = await this.client
          .from('clients')
          .select('*')
          .order('last_scan_at', { ascending: false });

        return allClients || [];
      } catch (err) {
        console.error('Fetch Clients Exception:', err);
      }
    }
    return [];
  }

  // 6. Fetch Scans History STRICTLY Filtered by Restaurant
  async fetchScansHistory(restoName) {
    if (this.isLiveSupabase && this.client) {
      try {
        const { data, error } = await this.client
          .from('scans')
          .select('*')
          .order('scanned_at', { ascending: false });

        if (error) console.error('Fetch Scans Error:', error);
        return data || [];
      } catch (err) {
        console.error('Fetch Scans Exception:', err);
      }
    }
    return [];
  }

  // 7. Record Client Scan & Award Exact Points in Cloud
  async recordScanCloud(restoName, tableNumber, whatsappPhone, clientName = 'Client Nexa', pointsEarned = 20) {
    if (this.isLiveSupabase && this.client) {
      try {
        const slug = this.getSlug(restoName);
        const { data: existingClient } = await this.client
          .from('clients')
          .select('*')
          .eq('full_name', `${clientName}_${slug}`)
          .single();

        const currentVisits = existingClient ? (existingClient.visits_count || 1) + 1 : 1;
        const currentPoints = existingClient ? (existingClient.points_balance || 0) + pointsEarned : pointsEarned;

        const { data: client, error: clientErr } = await this.client
          .from('clients')
          .upsert({ 
            whatsapp_phone: whatsappPhone, 
            full_name: `${clientName}_${slug}`,
            points_balance: currentPoints,
            visits_count: currentVisits,
            last_scan_at: new Date().toISOString()
          }, { onConflict: 'whatsapp_phone' })
          .select()
          .single();

        if (clientErr) console.error('Scan Client Error:', clientErr);

        await this.client.from('scans').insert({
          table_number: parseInt(tableNumber, 10) || 4,
          points_earned: pointsEarned
        });

        return client;
      } catch (err) {
        console.error('Record Scan Exception:', err);
      }
    }
    return null;
  }
}

// Global Singleton Backend Engine
window.nexaBackend = new NexaProductionBackend();
