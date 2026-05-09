"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  calcularImpactoGabarito,
  formatCurrencyBRL,
  type ImpactoGabaritoInput,
} from "@/lib/finance/impacto-gabarito";
import { Clock, Landmark, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

const defaults: ImpactoGabaritoInput = {
  horasPorRodadaComuniqueSe: 12,
  rodadasEvitadas: 2,
  vgv: 18_000_000,
  diasParalisacaoPorRodada: 21,
  taxaCustoOportunidadeMensalSobreVgv: 0.0025,
};

export function ImpactoCards() {
  const [horasPorRodada, setHorasPorRodada] = useState(String(defaults.horasPorRodadaComuniqueSe));
  const [rodadas, setRodadas] = useState(String(defaults.rodadasEvitadas));
  const [vgv, setVgv] = useState(String(defaults.vgv));
  const [dias, setDias] = useState(String(defaults.diasParalisacaoPorRodada));
  const [taxaMensal, setTaxaMensal] = useState(String(defaults.taxaCustoOportunidadeMensalSobreVgv));

  const resultado = useMemo(() => {
    const input: ImpactoGabaritoInput = {
      horasPorRodadaComuniqueSe: Math.max(0, Number(horasPorRodada) || 0),
      rodadasEvitadas: Math.max(0, Number(rodadas) || 0),
      vgv: Math.max(0, Number(vgv) || 0),
      diasParalisacaoPorRodada: Math.max(0, Number(dias) || 0),
      taxaCustoOportunidadeMensalSobreVgv: Math.max(0, Number(taxaMensal) || 0),
    };
    return calcularImpactoGabarito(input);
  }, [horasPorRodada, rodadas, vgv, dias, taxaMensal]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="h-cr">Horas por rodada (Comunique-se)</Label>
          <Input
            id="h-cr"
            inputMode="decimal"
            value={horasPorRodada}
            onChange={(e) => setHorasPorRodada(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rod">Rodadas evitadas</Label>
          <Input id="rod" inputMode="numeric" value={rodadas} onChange={(e) => setRodadas(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vgv">VGV (R$)</Label>
          <Input id="vgv" inputMode="numeric" value={vgv} onChange={(e) => setVgv(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dias">Dias parados / rodada</Label>
          <Input id="dias" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} />
        </div>
      </div>
      <div className="max-w-xs space-y-2">
        <Label htmlFor="taxa">Taxa mensal sobre VGV (custo de oportunidade)</Label>
        <Input
          id="taxa"
          inputMode="decimal"
          value={taxaMensal}
          onChange={(e) => setTaxaMensal(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Ex.: 0,0025 = 0,25% do VGV por mês de atraso estimado como referência de capital travado.
        </p>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas economizadas</CardTitle>
            <Clock className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {resultado.horasEconomizadas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            </div>
            <CardDescription>Revisão técnica e correções evitadas.</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Antecipação (dias)</CardTitle>
            <TrendingUp className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {resultado.diasAntecipados.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </div>
            <CardDescription>Menos idas e vindas na fila de protocolo.</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VGV “destravado” (estimativa)</CardTitle>
            <Landmark className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatCurrencyBRL(resultado.vgvEquivalenteTravadoEvitado)}
            </div>
            <CardDescription>Modelo simplificado de custo de oportunidade.</CardDescription>
          </CardContent>
        </Card>
      </div>
      <p className="text-muted-foreground text-xs">{resultado.formulaResumo}</p>
    </div>
  );
}
