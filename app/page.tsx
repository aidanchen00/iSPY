import Link from "next/link"
import { Shield, Video, TrendingUp, Bell, Eye, Activity, AlertTriangle, BarChart3, Zap, ArrowRight } from "lucide-react"
import HomeLink from "@/components/home-link"
import { HeaderNav } from "@/components/header-nav"
import HeaderAuth from "@/components/header-auth"
import { GeminiFooter } from "@/components/gemini-footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-dark">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-gray-dark/90 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <HomeLink />
            <HeaderNav />
          </div>
          <HeaderAuth />
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-mint/10 rounded-full mb-8">
              <div className="w-2 h-2 bg-mint rounded-full" />
              <span className="text-mint text-sm font-medium">AI-Powered Security</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold text-white tracking-tight leading-[1.1] mb-6">
              Intelligent
              <br />
              <span className="text-mint">Surveillance</span>
            </h1>
            
            <p className="text-xl text-gray leading-relaxed mb-10 max-w-xl">
              Real-time threat detection with actionable insights. 
              Monitor your security ecosystem with precision.
            </p>

            <div className="flex items-center gap-4">
              <Link
                href="/pages/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-mint text-gray-dark font-semibold rounded-lg hover:bg-mint-light transition-all duration-200 active:scale-95 shadow-[0_0_20px_-5px_rgba(77,255,188,0.4)] hover:shadow-[0_0_25px_-5px_rgba(77,255,188,0.5)]"
              >
                Open Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/5 text-white font-semibold rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-200 active:scale-95"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-4xl font-bold text-white mb-1">24/7</div>
              <div className="text-gray text-sm">Live Monitoring</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-1">99.8%</div>
              <div className="text-gray text-sm">Detection Rate</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-1">&lt;2s</div>
              <div className="text-gray text-sm">Response Time</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-mint mb-1">Instant</div>
              <div className="text-gray text-sm">Alert System</div>
            </div>
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Dashboard Preview</h2>
            <p className="text-gray">Your security command center at a glance</p>
          </div>

          <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 transform hover:scale-[1.01] transition-transform duration-500">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-coral" />
                <div className="w-3 h-3 rounded-full bg-[#FFB84D]" />
                <div className="w-3 h-3 rounded-full bg-mint" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-white/5 rounded-md px-3 py-1.5 text-xs text-gray max-w-xs">
                  kimstore/dashboard
                </div>
              </div>
            </div>

            {/* Dashboard content */}
            <div className="p-6">
              {/* Metric cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray text-xs uppercase tracking-wide">Cameras</span>
                    <Video className="w-4 h-4 text-mint" />
                  </div>
                  <div className="text-2xl font-bold text-white">8</div>
                  <div className="text-mint text-xs mt-1">All online</div>
                </div>

                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray text-xs uppercase tracking-wide">Incidents</span>
                    <Activity className="w-4 h-4 text-gray" />
                  </div>
                  <div className="text-2xl font-bold text-white">1,250</div>
                  <div className="text-gray text-xs mt-1">This month</div>
                </div>

                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray text-xs uppercase tracking-wide">Alerts</span>
                    <AlertTriangle className="w-4 h-4 text-coral" />
                  </div>
                  <div className="text-2xl font-bold text-white">4</div>
                  <div className="text-coral text-xs mt-1">Needs attention</div>
                </div>

                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray text-xs uppercase tracking-wide">Response</span>
                    <Zap className="w-4 h-4 text-gray" />
                  </div>
                  <div className="text-2xl font-bold text-white">2.3s</div>
                  <div className="text-gray text-xs mt-1">Average</div>
                </div>
              </div>

              {/* Video + Activity */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white/[0.03] rounded-xl border border-white/5 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                    <div className="w-2 h-2 bg-mint rounded-full animate-pulse" />
                    <span className="text-white text-sm font-medium">Zone A - Main Entrance</span>
                  </div>
                  <div className="aspect-video bg-black">
                    <video 
                      src="/videos/Robbery1.mp4" 
                      autoPlay 
                      loop 
                      muted
                      playsInline
                      className="w-full h-full object-cover opacity-80"
                    />
                  </div>
                </div>

                <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-gray" />
                    <span className="text-white text-sm font-medium">Recent Activity</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-coral/10 rounded-lg border border-coral/20">
                      <AlertTriangle className="w-4 h-4 text-coral mt-0.5" />
                      <div>
                        <p className="text-white text-sm font-medium">Security Alert</p>
                        <p className="text-gray text-xs">Motion detected in Zone A</p>
                        <p className="text-gray/50 text-xs mt-1">2 min ago</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-lg border border-white/5">
                      <Eye className="w-4 h-4 text-gray mt-0.5" />
                      <div>
                        <p className="text-white text-sm font-medium">Camera Online</p>
                        <p className="text-gray text-xs">Zone B camera reconnected</p>
                        <p className="text-gray/50 text-xs mt-1">15 min ago</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-lg border border-white/5">
                      <TrendingUp className="w-4 h-4 text-mint mt-0.5" />
                      <div>
                        <p className="text-white text-sm font-medium">Analysis Complete</p>
                        <p className="text-gray text-xs">Video processed successfully</p>
                        <p className="text-gray/50 text-xs mt-1">1 hour ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-8">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3 bg-mint text-gray-dark font-semibold rounded-lg hover:bg-mint-light transition-colors"
            >
              Try Dashboard Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Features</h2>
            <p className="text-gray">Everything you need for intelligent security</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-white/[0.02] rounded-xl border border-white/5 hover:border-mint/20 transition-colors">
              <Shield className="w-8 h-8 text-mint mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Threat Detection</h3>
              <p className="text-gray text-sm leading-relaxed">
                AI identifies suspicious activities, violence, theft, and safety hazards automatically.
              </p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-xl border border-white/5 hover:border-mint/20 transition-colors">
              <BarChart3 className="w-8 h-8 text-mint mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Real-Time Analytics</h3>
              <p className="text-gray text-sm leading-relaxed">
                Live dashboards with metrics, trends, and actionable insights at your fingertips.
              </p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-xl border border-white/5 hover:border-mint/20 hover:bg-white/[0.04] hover:scale-[1.02] transition-all duration-300 shadow-lg hover:shadow-mint/5 group">
              <Bell className="w-8 h-8 text-coral mb-4 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-lg font-semibold text-white mb-2">Smart Alerts</h3>
              <p className="text-gray text-sm leading-relaxed">
                Instant notifications with context, video evidence, and severity classification.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <GeminiFooter />
        </div>
      </footer>
    </div>
  )
}
