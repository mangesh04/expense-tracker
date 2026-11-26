import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL || "https://mnjsbedhgwntpmpitzwq.supabase.co";
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_jUzsxz1Fq-xzWuYgFsRk-w_sIIqzRoP";

export const sb = createClient(URL, KEY);
