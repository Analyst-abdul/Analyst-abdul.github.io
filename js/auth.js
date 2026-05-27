const Auth = {
  async signIn(email, password){ return sb.auth.signInWithPassword({ email, password }); },
  async signUp(email, password, name){
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + window.location.pathname, data: { display_name: name } }
    });
    if (!error && data.user) {
      // create profile row (best-effort; ignore if RLS blocks until email confirm)
      await sb.from('profiles').upsert({ id: data.user.id, display_name: name, currency: window.FINTRACK_CONFIG.DEFAULT_CURRENCY });
    }
    return { data, error };
  },
  async forgot(email){
    return sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  },
  async signOut(){ return sb.auth.signOut(); },
  async getSession(){ const { data } = await sb.auth.getSession(); return data.session; },
};
