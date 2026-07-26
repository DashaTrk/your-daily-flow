import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Client-only: redirect to authenticated dashboard or /auth. SSR = false to allow localStorage session.
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/today" });
    throw redirect({ to: "/auth" });
  },
  ssr: false,
  component: () => null,
});
