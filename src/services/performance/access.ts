import { supabase } from "@/integrations/supabase/client";

export async function isPerformanceAdmin(): Promise<boolean> {
  try {
    const { data, error } = await (
      supabase.rpc as unknown as (name: string) => Promise<{ data: unknown; error: unknown }>
    )("is_performance_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}
