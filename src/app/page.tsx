import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Gabarito · Blumenau / SC
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Checklist de aprovação com IA e visão computacional
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Automatize o confronto de plantas baixas com as normas municipais de Blumenau (Plano Diretor, meio ambiente,
          circulação, parcelamento, zoneamento, edificações e sistema viário), antecipe inconformidades e estime o
          impacto em horas e em VGV travado por burocracia.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>
          Abrir motor de análise
        </Link>
      </div>
    </main>
  );
}
