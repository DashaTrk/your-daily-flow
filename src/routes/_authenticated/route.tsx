import { createFileRoute, Outlet, redirect, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, ListTodo, FileText, Settings, Sparkles, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const NAV = [
  { to: "/today", label: "Сегодня", icon: Sparkles },
  { to: "/week", label: "Неделя", icon: CalendarDays },
  { to: "/lists", label: "Списки", icon: ListTodo },
  { to: "/reports", label: "Отчёты", icon: FileText },
  { to: "/settings", label: "Настройки", icon: Settings },
] as const;

function AuthLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Вышли");
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border p-4 gap-2 glass sticky top-0 h-screen">
        <Link to="/today" className="flex items-center gap-2 px-2 py-3 mb-4">
          <div className="h-8 w-8 rounded-lg glass glow flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="font-display font-bold text-lg text-gradient">Flow</span>
        </Link>
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || (to === "/lists" && location.pathname.startsWith("/lists"));
          return (
            <Link key={to} to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                active ? "bg-primary/15 text-foreground glow" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          );
        })}
        <div className="flex-1" />
        <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground transition">
          <LogOut className="h-4 w-4" />Выйти
        </button>
      </aside>

      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-border flex justify-around items-center py-2 px-2 safe-area-bottom">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || (to === "/lists" && location.pathname.startsWith("/lists"));
          return (
            <Link key={to} to={to}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-lg text-[10px] font-medium transition min-w-0 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}>
              <Icon className="h-5 w-5" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
