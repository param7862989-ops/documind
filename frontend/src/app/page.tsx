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
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-50 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              DocuMind
            </span>
            <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              v1.0
            </span>
          </Link>

          {/* Backend Status Indicator & Navigation */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-800">
              <div className="flex items-center space-x-1.5">
                <span className="relative flex h-2 w-2">
                  {loading ? (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  ) : backendHealth?.status === "healthy" ? (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  ) : (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    loading ? "bg-amber-400" : backendHealth?.status === "healthy" ? "bg-emerald-400" : "bg-rose-400"
                  }`}></span>
                </span>
                <span className="text-slate-300">
                  {loading ? "Checking Backend..." : backendHealth?.status === "healthy" ? "Backend Online" : "Backend Offline"}
                </span>
              </div>
            </div>

            <Link
              href="/login"
              className="text-xs font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-900 transition flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-400" />
              <span>Sign In</span>
            </Link>

            <Link
              href={getStartedHref}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all duration-150 flex items-center gap-1.5"
            >
              <span>{hasToken ? "Open Dashboard" : "Get Started"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-20 pb-24 px-6">
          {/* Subtle glow background */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 mb-8 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Production-Grade Document Intelligence & RAG Platform</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
              Extract Grounded Truth from Complex Documents with{" "}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
                Exact Citations
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Upload multi-page PDFs, Word documents, text files, and scanned imagery. Ask questions, compare contracts across versions, and get hallucination-free answers backed by verifiable page-level citations.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={getStartedHref}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl shadow-blue-600/25 flex items-center justify-center space-x-2 transition-all duration-200"
              >
                <span>{hasToken ? "Go to Dashboard" : "Get Started Now"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="http://localhost:8000/api/v1/docs"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold text-sm flex items-center justify-center space-x-2 transition-all duration-200"
              >
                <Cpu className="w-4 h-4 text-slate-400" />
                <span>FastAPI Swagger Docs</span>
              </a>
            </div>

            {/* Live Backend Communication Verification Card */}
            <div className="mt-14 max-w-xl mx-auto p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-2xl backdrop-blur-sm text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  Full-Stack Connectivity Verification
                </span>
                <span className="text-[11px] font-mono text-slate-500">GET /api/v1/health</span>
              </div>

              <div className="pt-3 font-mono text-xs">
                {loading ? (
                  <div className="text-amber-400/90 animate-pulse">Connecting to FastAPI backend...</div>
                ) : backendHealth ? (
                  <div className="space-y-1.5 text-slate-300">
                    <div className="flex items-center space-x-2 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Connected Successfully to {backendHealth.service}</span>
                    </div>
                    <div className="text-slate-400 text-[11px] pl-6">
                      Environment: <span className="text-slate-200">{backendHealth.environment}</span> | Version: <span className="text-slate-200">{backendHealth.version}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-rose-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error || "Backend unreachable. Ensure FastAPI is running on port 8000."}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-20 border-t border-slate-800/80 bg-slate-950/40 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Engineered for High-Precision Document Understanding
              </h2>
              <p className="mt-3 text-slate-400 text-sm sm:text-base">
                Architected with a decoupled pipeline for text extraction, chunking, pgvector indexing, and verifiable citation generation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all duration-200">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
                  <Search className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Vector RAG + Exact Citations</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Every answer cites the specific document filename, page number, and snippet so users can verify information instantly.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all duration-200">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Multi-Document Comparison</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Cross-compare clauses, financial obligations, and termination policies across 2 or more contracts with structured side-by-side matrices.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all duration-200">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Isolated Multi-Tenant Security</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Per-user tenant isolation, cryptographic JWT token verification, and strict ownership boundaries across document chunks and storage.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-6 text-center text-xs text-slate-500 bg-slate-950">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>DocuMind Document Intelligence Platform</p>
          <div className="flex items-center space-x-6 text-slate-400">
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
