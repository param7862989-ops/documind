"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  FileText, 
  Sparkles, 
  ShieldCheck, 
  Search, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Cpu,
  Database,
  LogIn
} from "lucide-react";
import { checkBackendHealth, getAuthToken, HealthCheckResponse } from "@/lib/api";

export default function Home() {
  const [backendHealth, setBackendHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!getAuthToken());

    async function verifyBackend() {
      try {
        setLoading(true);
        const data = await checkBackendHealth();
        setBackendHealth(data);
        setError(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to reach FastAPI backend";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    verifyBackend();
  }, []);

  const getStartedHref = hasToken ? "/dashboard" : "/login";

  return (
    <div className="min-h-screen bg-white text-[#2f2f2f] selection:bg-[#2f2f2f] selection:text-white flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="border-b border-black/[0.08] sticky top-0 z-50 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="h-8 w-8 rounded-lg bg-[#171717] flex items-center justify-center text-white shadow-sm transition group-hover:scale-105">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-[#171717]">
              DocuMind
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-[#f0f0f0] text-[#666] border border-black/[0.06]">
              v1.0
            </span>
          </Link>

          {/* Backend Status Indicator & Navigation */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#fafafa] border border-black/[0.08]">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2 w-2">
                  {loading ? (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  ) : backendHealth?.status === "healthy" ? (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  ) : (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    loading ? "bg-amber-400" : backendHealth?.status === "healthy" ? "bg-emerald-500" : "bg-rose-500"
                  }`}></span>
                </span>
                <span className="text-[#555] text-[11px]">
                  {loading ? "Checking Backend..." : backendHealth?.status === "healthy" ? "Backend Online" : "Backend Offline"}
                </span>
              </div>
            </div>

            <Link
              href="/login"
              className="text-xs font-medium text-[#555] hover:text-[#111] px-3 py-2 rounded-lg hover:bg-[#f5f5f5] transition flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5 text-[#777]" />
              <span>Sign In</span>
            </Link>

            <Link
              href={getStartedHref}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#171717] hover:bg-[#000] text-white shadow-sm transition-all duration-150 flex items-center gap-1.5"
            >
              <span>{hasToken ? "Open Dashboard" : "Get Started"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-20 pb-20 px-6">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#f7f7f7] border border-black/[0.08] text-xs text-[#555] mb-8 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#171717]" />
              <span className="font-medium">Production AI Document Intelligence & RAG Platform</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-[#171717] max-w-3xl mx-auto leading-[1.12]">
              Extract Grounded Truth from Documents with{" "}
              <span className="underline decoration-black/[0.2] decoration-2 underline-offset-8">
                Exact Citations
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-[#666] max-w-2xl mx-auto leading-relaxed">
              Upload multi-page PDFs, Word contracts, plain text, and scanned documents. Ask questions, compare terms across versions, and receive hallucination-free answers backed by verifiable page-level citations.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={getStartedHref}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#171717] hover:bg-[#000] text-white font-medium text-sm shadow-sm flex items-center justify-center space-x-2 transition-all duration-200"
              >
                <span>{hasToken ? "Go to Dashboard" : "Get Started Now"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="http://localhost:8000/api/v1/docs"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-[#f7f7f7] border border-black/[0.1] text-[#333] font-medium text-sm flex items-center justify-center space-x-2 transition-all duration-200"
              >
                <Cpu className="w-4 h-4 text-[#777]" />
                <span>FastAPI Swagger Docs</span>
              </a>
            </div>

            {/* Live Backend Communication Verification Card */}
            <div className="mt-14 max-w-xl mx-auto p-5 rounded-2xl bg-[#fafafa] border border-black/[0.08] shadow-sm text-left">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.08]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#777] flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-[#171717]" />
                  Full-Stack Connectivity
                </span>
                <span className="text-[11px] font-mono text-[#888]">GET /api/v1/health</span>
              </div>

              <div className="pt-3 font-mono text-xs">
                {loading ? (
                  <div className="text-amber-600 animate-pulse">Connecting to FastAPI backend...</div>
                ) : backendHealth ? (
                  <div className="space-y-1.5 text-[#333]">
                    <div className="flex items-center space-x-2 text-emerald-600 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Connected to {backendHealth.service}</span>
                    </div>
                    <div className="text-[#777] text-[11px] pl-6">
                      Environment: <span className="text-[#222] font-semibold">{backendHealth.environment}</span> | Version: <span className="text-[#222] font-semibold">{backendHealth.version}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-rose-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error || "Backend unreachable. Ensure FastAPI is running on port 8000."}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-16 border-t border-black/[0.08] bg-[#fafafa] px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#171717] tracking-tight">
                High-Precision Document Intelligence
              </h2>
              <p className="mt-2.5 text-[#666] text-sm leading-relaxed">
                Decoupled pipeline for page extraction, recursive chunking, pgvector indexing, and citation generation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-6 rounded-2xl bg-white border border-black/[0.08] hover:border-black/[0.15] shadow-sm transition-all duration-200">
                <div className="h-10 w-10 rounded-xl bg-[#f5f5f5] border border-black/[0.06] flex items-center justify-center mb-4 text-[#171717]">
                  <Search className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-[#171717] mb-2">Vector RAG + Exact Citations</h3>
                <p className="text-xs text-[#666] leading-relaxed">
                  Every answer cites the specific document filename, page number, and snippet so users can verify information instantly.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-black/[0.08] hover:border-black/[0.15] shadow-sm transition-all duration-200">
                <div className="h-10 w-10 rounded-xl bg-[#f5f5f5] border border-black/[0.06] flex items-center justify-center mb-4 text-[#171717]">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-[#171717] mb-2">Multi-Document Comparison</h3>
                <p className="text-xs text-[#666] leading-relaxed">
                  Cross-compare clauses, financial obligations, and policies across 2 or more contracts with side-by-side matrices.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-black/[0.08] hover:border-black/[0.15] shadow-sm transition-all duration-200">
                <div className="h-10 w-10 rounded-xl bg-[#f5f5f5] border border-black/[0.06] flex items-center justify-center mb-4 text-[#171717]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-[#171717] mb-2">Isolated Multi-Tenant Security</h3>
                <p className="text-xs text-[#666] leading-relaxed">
                  Per-user tenant isolation, cryptographic JWT token verification, and strict ownership boundaries across document chunks.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/[0.08] py-8 px-6 text-center text-xs text-[#777] bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-medium text-[#555]">DocuMind Document Intelligence Platform</p>
          <div className="flex items-center space-x-6 text-[#777] text-[11px]">
            <span>Next.js 14</span>
            <span>FastAPI</span>
            <span>PostgreSQL + pgvector</span>
            <span>Docker Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
