"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, FormEvent } from "react"
import { Eye } from "lucide-react"

export default function SignInClient() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // For demo - just redirect to dashboard
    setTimeout(() => {
      router.push("/pages/dashboard")
    }, 500)
  }

  const handleGoogleSignIn = () => {
    // For demo - just redirect to dashboard
    router.push("/pages/dashboard")
  }

  const handleGitHubSignIn = () => {
    // For demo - just redirect to dashboard
    router.push("/pages/dashboard")
  }

  return (
    <div className="w-full max-w-sm px-6">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-10 h-10 bg-mint rounded-xl flex items-center justify-center">
          <Eye className="w-5 h-5 text-gray-dark" />
        </div>
        <span className="text-2xl font-bold text-white tracking-tight">KIMSTORE</span>
      </div>

      <div className="bg-[#111] rounded-2xl border border-white/10 p-8">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Welcome back</h1>
        <p className="text-gray text-center text-sm mb-8">
          Don't have an account?{" "}
          <Link className="text-mint hover:underline" href="/sign-up">
            Sign up
          </Link>
        </p>

        {/* OAuth buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            onClick={handleGitHubSignIn}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#111] px-3 text-gray">or</span>
          </div>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-gray">Email</Label>
            <Input
              type="email"
              name="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray/50 focus:border-mint focus:ring-mint"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password" className="text-sm text-gray">Password</Label>
              <Link className="text-xs text-mint hover:underline" href="/forgot-password">
                Forgot?
              </Link>
            </div>
            <Input
              type="password"
              name="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray/50 focus:border-mint focus:ring-mint"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-mint text-gray-dark font-semibold rounded-lg hover:bg-mint-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}
