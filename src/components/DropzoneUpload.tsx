"use client";

import { analyzeProject, type ProjectAnalysisData } from "@/app/actions/analyzeProject";
import type { PlantaAnaliseIA } from "@/types/gabarito";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertPdfToImage, jpegDataUrlToFile } from "@/lib/pdf/convert-pdf-to-image";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, FileCheck, Loader2, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";

const DEFAULT_MAX = 10 * 1024 * 1024;

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

function validateFile(f: File, maxBytes: number): string | null {
  const okType =
    f.type === "application/pdf" ||
    f.type === "image/png" ||
    f.type === "image/jpeg" ||
    /\.(pdf|png|jpe?g)$/i.test(f.name);
  if (!okType) return "Use apenas PDF, PNG ou JPG.";
  if (f.size > maxBytes) return "Arquivo acima do limite de 10MB.";
  return null;
}

export type DropzoneUploadProps = {
  /** Zona para buscar `recuo_frontal_min` e `taxa_ocupacao_max` no servidor (padrão ZR1). */
  zonaUrbanistica?: string | null;
  onAnalysisResult?: (data: ProjectAnalysisData) => void;
  onAnalyze?: (file: File) => void | Promise<void>;
  maxSizeBytes?: number;
  disabled?: boolean;
  className?: string;
};

function DropzoneUploadInner({
  zonaUrbanistica,
  onAnalysisResult,
  onAnalyze,
  maxSizeBytes = DEFAULT_MAX,
  disabled = false,
  className,
}: DropzoneUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** `idle` | conversão PDF no cliente | chamada à Server Action */
  const [submitPhase, setSubmitPhase] = useState<"idle" | "pdf" | "analyze">("idle");
  const [analise, setAnalise] = useState<PlantaAnaliseIA | null>(null);
  /** Área do terreno (m²) — obrigatória para a Server Action. */
  const [areaTerreno, setAreaTerreno] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const areaTerrenoNum = Number(areaTerreno.trim().replace(",", "."));
  const areaTerrenoOk = Number.isFinite(areaTerrenoNum) && areaTerrenoNum > 0;

  const trySetFile = (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setAnalise(null);
    const msg = validateFile(f, maxSizeBytes);
    if (msg) {
      setError(msg);
      return;
    }
    setFile(f);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files[0];
    trySetFile(dropped);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    trySetFile(f);
    e.target.value = "";
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    setAnalise(null);
    setAreaTerreno("");
  };

  const handleAnalyze = async () => {
    if (!file) return;
    if (!areaTerrenoOk) {
      setError("Informe a área do terreno em m² (campo obrigatório).");
      return;
    }
    setError(null);
    setAnalise(null);

    let fileToSend: File = file;
    const originalFile = file;

    try {
      if (file.type === "application/pdf") {
        setSubmitPhase("pdf");
        const dataUrl = await convertPdfToImage(file);
        const jpegName = file.name.replace(/\.pdf$/i, "") + ".jpg";
        fileToSend = jpegDataUrlToFile(dataUrl, jpegName);
        if (fileToSend.size > maxSizeBytes) {
          setError("O JPEG gerado a partir do PDF ultrapassa o limite de 10MB. Tente um PDF menor ou com menos detalhe.");
          return;
        }
      }

      setSubmitPhase("analyze");
      const formData = new FormData();
      formData.set("file", fileToSend);
      formData.set("zona_urbanistica", (zonaUrbanistica ?? "ZR1").trim());
      formData.set("area_terreno", String(areaTerrenoNum));

      const result = await analyzeProject(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      console.log("Resultado análise projeto:", JSON.stringify(result.data, null, 2));
      if (result.persistError) {
        console.warn("Supabase (resultado_ia):", result.persistError);
      }

      setAnalise(result.data);
      onAnalysisResult?.(result.data);
      if (onAnalyze) await onAnalyze(originalFile);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg
          ? `Não foi possível processar o arquivo: ${msg}`
          : "Falha ao analisar o projeto. Tente novamente.",
      );
    } finally {
      setSubmitPhase("idle");
    }
  };

  const aprovado = analise?.status === "Aprovado";

  return (
    <div className={cn("mx-auto w-full max-w-2xl space-y-4", className)}>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Label htmlFor="dropzone-area-terreno" className="text-sm font-medium text-slate-800">
          Área do terreno (m²) <span className="text-red-600" aria-hidden>*</span>
        </Label>
        <Input
          id="dropzone-area-terreno"
          name="area_terreno"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          required
          placeholder="ex. 360"
          value={areaTerreno}
          onChange={(e) => setAreaTerreno(e.target.value)}
          disabled={disabled}
          className="mt-2 h-10 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:border-slate-300 focus-visible:ring-blue-500/25"
          aria-required="true"
        />
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Obrigatório: usada no servidor para calcular área máxima construída, projeção máxima e permeável mínima antes da
          análise na Replicate.
        </p>
      </div>

      {!file ? (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!disabled) inputRef.current?.click();
            }
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition-all duration-200",
            disabled && "pointer-events-none opacity-50",
            isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ACCEPT}
            disabled={disabled}
            onChange={handleInputChange}
          />
          <UploadCloud
            className={cn("mb-4 h-12 w-12", isDragging ? "text-blue-500" : "text-slate-400")}
            strokeWidth={1.25}
            aria-hidden
          />
          <h3 className="text-center text-lg font-semibold text-slate-700">
            Arraste seu projeto ou clique para fazer upload
          </h3>
          <p className="mt-2 text-sm text-slate-500">PDF, PNG ou JPG (Máx 10MB)</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex w-full items-center gap-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-700">
            <FileCheck className="h-8 w-8 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold" title={file.name}>
                {file.name}
              </p>
              <p className="text-sm opacity-80">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={clearFile}
              disabled={submitPhase !== "idle"}
              className="rounded-full p-2 transition hover:bg-emerald-200 disabled:opacity-50"
              aria-label="Remover arquivo"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            disabled={submitPhase !== "idle" || disabled || !areaTerrenoOk}
            onClick={() => void handleAnalyze()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white shadow-md transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitPhase === "pdf" ? (
              <>
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                Processando PDF…
              </>
            ) : submitPhase === "analyze" ? (
              <>
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                Analisando…
              </>
            ) : (
              "Analisar com Inteligência Artificial"
            )}
          </button>

          {analise ? (
            <div
              className={cn(
                "mt-6 w-full rounded-xl border p-4 text-left",
                aprovado
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                  : "border-amber-200 bg-amber-50/80 text-amber-950",
              )}
            >
              <div className="flex items-center gap-2 font-semibold">
                {aprovado ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                )}
                <span>{analise.status}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed opacity-90">{analise.resumo}</p>
              {analise.pendencias.length > 0 ? (
                <ul className="mt-3 list-inside list-disc space-y-1 text-sm">
                  {analise.pendencias.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-3 text-center text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export const DropzoneUpload = DropzoneUploadInner;
export default DropzoneUploadInner;
