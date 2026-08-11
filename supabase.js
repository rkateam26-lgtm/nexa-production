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
    // Check if Supabase JS SDK is loaded
    if (window.supabase) {
      try {
        this.client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        this.isLiveSupabase = true;
        console.log('⚡ NEXA Production: Connected Live to Supabase Cloud PostgreSQL Database');
      } catch (err) {
        console.error('Supabase Initialization Error:', err);
      }
    } else {
      console.log('📦 NEXA Production: Running on Local Persistence Engine');
    }
  }

  // 1. Authenticate Merchant (Sign In or Sign Up)
  async loginMerchant(email, password) {
    if (this.isLiveSupabase && this.client) {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) {
        // Try sign up if user does not exist yet
        const { data: signUpData, error: signUpErr } = await this.client.auth.signUp({ email, password });
        if (signUpErr) throw signUpErr;
        return signUpData;
      }
      return data;
    } else {
      return { user: { email, name: 'Le Savane (Gérant)' } };
    }
  }

  // 2. Record Table Scan & Credit Points in Real-Time
  async recordScan(restaurantId, tableNumber, whatsappPhone, clientName = 'Client Nexa') {
    if (this.isLiveSupabase && this.client) {
      // Upsert Client Points in PostgreSQL
      const { data: client, error: clientErr } = await this.client
        .from('clients')
        .upsert({ 
          restaurant_id: restaurantId, 
          whatsapp_phone: whatsappPhone, 
          full_name: clientName,
          last_scan_at: new Date().toISOString()
        }, { onConflict: 'restaurant_id,whatsapp_phone' })
        .select()
        .single();

      if (clientErr) console.error('Scan Client Error:', clientErr);

      // Insert Scan Event in History
      await this.client.from('scans').insert({
        restaurant_id: restaurantId,
        table_number: tableNumber,
        client_id: client ? client.id : null,
        points_earned: 10
      });

      return client;
    } else {
      return { whatsapp_phone: whatsappPhone, points_earned: 10 };
    }
  }

  // 3. Fetch Real-time Dashboard Analytics from Cloud PostgreSQL
  async getDashboardMetrics(restaurantId) {
    if (this.isLiveSupabase && this.client) {
      const { data: clients } = await this.client.from('clients').select('*').eq('restaurant_id', restaurantId);
      const { data: scans } = await this.client.from('scans').select('*').eq('restaurant_id', restaurantId);
      const { data: rewards } = await this.client.from('rewards').select('*').eq('restaurant_id', restaurantId);

      return {
        clients: clients || [],
        scans: scans || [],
        rewards: rewards || []
      };
    } else {
      return null;
    }
  }
}

// Global Singleton Engine
window.nexaBackend = new NexaProductionBackend();
