import { GabaritoDashboard } from "@/components/gabarito/gabarito-dashboard";

export const metadata = {
  title: "Dashboard | Gabarito",
  description: "Análise de plantas, impacto operacional e checklist urbanístico — Blumenau/SC.",
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-24 font-sans md:p-8 md:pb-28">
      <GabaritoDashboard />
    </div>
  );
}
