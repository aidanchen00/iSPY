"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  Video, 
  Upload, 
  Menu,
  X,
  Eye,
  Activity,
  ShoppingCart,
  ShieldAlert,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/pages/dashboard", icon: LayoutDashboard },
  { name: "Retail Theft", href: "/pages/retail-theft", icon: ShoppingCart, highlight: true },
  { name: "Detected Incidents", href: "/pages/detected-incidents", icon: ShieldAlert },
  { name: "CCTV Live", href: "/pages/realtimeStreamPage", icon: Activity },
  { name: "Saved Videos", href: "/pages/saved-videos", icon: Video },
  { name: "Upload", href: "/pages/upload", icon: Upload },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#111] border border-white/10 rounded-lg"
      >
        {collapsed ? <Menu className="w-5 h-5 text-white" /> : <X className="w-5 h-5 text-white" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-[#111] border-r border-white/5 transition-all duration-300 z-40",
          collapsed ? "-translate-x-full lg:translate-x-0 lg:w-20" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/5">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <span className="text-xl font-bold text-white">KIMSTORE</span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-gray hover:text-white hover:bg-white/5 hover:pl-4"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                )}
                <item.icon className={cn("w-5 h-5 flex-shrink-0 transition-transform duration-200", isActive && "scale-110")} />
                {!collapsed && (
                  <span className="text-sm font-medium">{item.name}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Status */}
        {!collapsed && (
          <div className="absolute bottom-20 left-4 right-4 p-4 bg-white/[0.03] rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray">System Status</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500/80 rounded-full animate-pulse" />
                <span className="text-xs text-gray-400 font-medium">Online</span>
              </div>
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute bottom-4 left-4 right-4 items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          {collapsed ? (
            <Menu className="w-4 h-4 text-gray" />
          ) : (
            <>
              <X className="w-4 h-4 text-gray" />
              <span className="text-xs text-gray">Collapse</span>
            </>
          )}
        </button>
      </aside>
    </>
  )
}
