"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Lock, Mail, ArrowRight, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { loginUser } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performLogin(loginEmail: string, loginPass: string) {
    if (!loginEmail || !loginPass) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await loginUser(loginEmail, loginPass);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in. Please verify your credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    performLogin(email, password);
  }

  function handleDemoLogin() {
    setEmail("founder@documind.ai");
    setPassword("SecurePassword123!");
    performLogin("founder@documind.ai", "SecurePassword123!");
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#2f2f2f] flex items-center justify-center p-6 selection:bg-[#171717] selection:text-white">
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-[#171717] flex items-center justify-center text-white shadow-sm transition group-hover:scale-105">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#171717]">
              DocuMind
            </span>
          </Link>
          <h1 className="text-xl font-semibold text-[#171717] mt-4">Welcome back</h1>
          <p className="text-xs text-[#777] mt-1">Sign in to your document intelligence workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-black/[0.08] rounded-2xl p-7 shadow-sm">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* One-Click Demo Sign-in Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full mb-5 py-2.5 px-4 rounded-xl bg-[#f7f7f7] hover:bg-[#efefef] border border-black/[0.08] text-[#2f2f2f] text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-[#171717]" />
            <span>One-Click Demo Account Sign-In</span>
          </button>

          <div className="relative mb-5 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/[0.08]"></div>
            </div>
            <span className="relative bg-white px-3 text-[11px] uppercase tracking-wider text-[#999]">
              Or sign in with email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#999] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full bg-[#fafafa] border border-black/[0.1] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#2f2f2f] placeholder-[#aaa] focus:outline-none focus:border-[#171717] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#444]">Password</label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#999] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#fafafa] border border-black/[0.1] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#2f2f2f] placeholder-[#aaa] focus:outline-none focus:border-[#171717] focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#171717] hover:bg-[#000] disabled:opacity-50 text-white font-medium text-sm shadow-sm flex items-center justify-center space-x-2 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Info */}
          <div className="mt-5 p-3 rounded-xl bg-[#fafafa] border border-black/[0.06] text-[11px] text-[#666] flex items-center justify-between">
            <div>
              <span className="font-semibold text-[#333] block">Demo User:</span>
              <span className="font-mono text-[10px] text-[#777]">founder@documind.ai</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail("founder@documind.ai");
                setPassword("SecurePassword123!");
              }}
              className="text-xs text-[#171717] hover:underline font-semibold"
            >
              Fill Credentials
            </button>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-[#777]">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[#171717] font-semibold underline-offset-4 hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
