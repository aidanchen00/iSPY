"use client"

import { ReactNode } from "react"
import { DashboardSidebar } from "./dashboard-sidebar"
import { DashboardHeader } from "./dashboard-header"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative selection:bg-white/20 selection:text-white">
      <div className="fixed inset-0 bg-[#0a0a0a] pointer-events-none" />
      <DashboardSidebar />
      <div className="lg:pl-64 relative z-10">
        <DashboardHeader />
        <main className="p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
