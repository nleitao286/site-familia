import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm';
export const supabase = createClient('https://rhpmebmytzmfwitjrfau.supabase.co', 'sb_publishable_4c94DsunCCoQjMyuHoxzWg_jK_7qQtm', {
  auth: {persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}
});
