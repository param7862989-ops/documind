"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Lock, Mail, User, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { registerUser } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await registerUser(email, password, fullName);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account.";
      setError(msg);
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-xl font-semibold text-[#171717] mt-4">Create your account</h1>
          <p className="text-xs text-[#777] mt-1">Get started with AI-powered document intelligence</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-black/[0.08] rounded-2xl p-7 shadow-sm">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#999] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="w-full bg-[#fafafa] border border-black/[0.1] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#2f2f2f] placeholder-[#aaa] focus:outline-none focus:border-[#171717] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444] mb-1.5">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#999] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@company.com"
                  required
                  className="w-full bg-[#fafafa] border border-black/[0.1] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#2f2f2f] placeholder-[#aaa] focus:outline-none focus:border-[#171717] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#999] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••• (min. 6 chars)"
                  required
                  minLength={6}
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 text-xs text-[#777]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#171717] font-semibold underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
