/* ==========================================================================
   NEXA PRODUCTION - LIVE SUPABASE & POSTGRESQL BACKEND ENGINE
   ========================================================================== */

// Live Supabase Production Credentials
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
        console.log('⚡ NEXA Production: Connected Live to Supabase Cloud PostgreSQL Database');
      } catch (err) {
        console.error('Supabase Init Error:', err);
      }
    }
  }

  // 1. Authenticate & Save Restaurant
  async saveRestaurant(name, type, email, pwd, pointsPerScan = 20, currency = 'FCFA') {
    if (this.isLiveSupabase && this.client) {
      const { data, error } = await this.client
        .from('restaurants')
        .upsert({
          name: name,
          city: type,
          currency: currency,
          whatsapp_contact: pointsPerScan.toString()
        }, { onConflict: 'email' })
        .select()
        .single();

      if (error) console.error('Save Restaurant Error:', error);
      return data;
    }
    return null;
  }

  // 2. Fetch Rewards from Cloud Supabase
  async fetchRewards(restaurantId = 'savane-prod-001') {
    if (this.isLiveSupabase && this.client) {
      const { data, error } = await this.client.from('rewards').select('*');
      if (error) console.error('Fetch Rewards Error:', error);
      return data || [];
    }
    return [];
  }

  // 3. Create Reward on Cloud Supabase
  async createReward(title, pts, desc, icon, category) {
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

      if (error) console.error('Create Reward Error:', error);
      return data;
    }
    return null;
  }

  // 4. Fetch Clients from Cloud Supabase
  async fetchClients() {
    if (this.isLiveSupabase && this.client) {
      const { data, error } = await this.client.from('clients').select('*');
      if (error) console.error('Fetch Clients Error:', error);
      return data || [];
    }
    return [];
  }

  // 5. Record Client Scan & Points on Cloud Supabase
  async recordScan(tableNumber, whatsappPhone, clientName = 'Client Nexa', pointsEarned = 20) {
    if (this.isLiveSupabase && this.client) {
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

      if (clientErr) console.error('Scan Error:', clientErr);

      await this.client.from('scans').insert({
        table_number: parseInt(tableNumber, 10) || 4,
        points_earned: pointsEarned
      });

      return client;
    }
    return null;
  }
}

// Global Singleton Instance
window.nexaBackend = new NexaProductionBackend();
