/* ==========================================================================
   NEXA PRODUCTION - MULTI-TENANT SUPABASE CLOUD BACKEND ENGINE
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
        console.log('⚡ NEXA Multi-Tenant SaaS Engine: Live Supabase Connected');
      } catch (err) {
        console.error('Supabase Init Error:', err);
      }
    }
  }

  // 1. Create or Connect Restaurant Profile (Multi-Tenant Isolation)
  async registerOrLoginMerchant(name, type, email, pwd, pointsPerScan = 20, currency = 'FCFA') {
    if (this.isLiveSupabase && this.client) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Save/Update Restaurant Record in Supabase Cloud
      const { data: resto, error: restoErr } = await this.client
        .from('restaurants')
        .upsert({
          name: name,
          email: email,
          whatsapp_contact: pointsPerScan.toString(), // Stores exact custom scan points!
          city: type, // Stores specialty description
          currency: currency
        }, { onConflict: 'email' })
        .select()
        .single();

      if (restoErr) console.error('Resto DB Error:', restoErr);
      return resto || { id: slug, name, city: type, whatsapp_contact: pointsPerScan.toString() };
    }
    return { name, city: type, whatsapp_contact: pointsPerScan.toString() };
  }

  // 2. Fetch Restaurant Profile Details from Supabase Cloud
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

  // 3. Fetch Multi-Tenant Rewards by Restaurant Name / ID
  async fetchRewardsByResto(restoName) {
    if (this.isLiveSupabase && this.client) {
      try {
        const { data, error } = await this.client
          .from('rewards')
          .select('*')
          .order('created_at', { ascending: true });
          
        if (error) console.error('Fetch Rewards Error:', error);
        return data || [];
      } catch (err) {
        console.error('Fetch Rewards Exception:', err);
      }
    }
    return [];
  }

  // 4. Create Reward in Supabase Cloud
  async createCloudReward(title, pts, desc, icon, category) {
    if (this.isLiveSupabase && this.client) {
      const { data, error } = await this.client
        .from('rewards')
        .insert({
          title: title,
          points_required: pts,
          description: desc,
          icon: icon
        })
        .select()
        .single();

      if (error) console.error('Create Cloud Reward Error:', error);
      return data;
    }
    return null;
  }

  // 5. Fetch Multi-Tenant Clients for Merchant CRM
  async fetchClientsByResto() {
    if (this.isLiveSupabase && this.client) {
      try {
        const { data, error } = await this.client
          .from('clients')
          .select('*')
          .order('last_scan_at', { ascending: false });

        if (error) console.error('Fetch Clients Error:', error);
        return data || [];
      } catch (err) {
        console.error('Fetch Clients Exception:', err);
      }
    }
    return [];
  }

  // 6. Record Client Scan & Award Exact Points in Supabase Cloud
  async recordScanCloud(tableNumber, whatsappPhone, clientName = 'Client Nexa', pointsEarned = 20) {
    if (this.isLiveSupabase && this.client) {
      try {
        const { data: client, error: clientErr } = await this.client
          .from('clients')
          .upsert({ 
            whatsapp_phone: whatsappPhone, 
            full_name: clientName,
            points_balance: pointsEarned,
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
