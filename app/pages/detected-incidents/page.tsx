"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ShieldAlert, Camera, Clock, RefreshCw, ImageOff } from "lucide-react"

interface DetectedIncident {
  id: string
  snapshotPath: string
  description: string
  cameraId: string
  timestamp: string
  createdAt: string
  snapshotUrl?: string
}

export default function DetectedIncidentsPage() {
  const [incidents, setIncidents] = useState<DetectedIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchIncidents = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/detected-incidents")
      if (!res.ok) throw new Error("Failed to load incidents")
      const data = await res.json()
      setIncidents(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
      setIncidents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIncidents()
    const interval = setInterval(fetchIncidents, 10000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts)
      if (isNaN(d.getTime())) return ts
      return d.toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "medium",
      })
    } catch {
      return ts
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Detected Incidents</h1>
            <p className="text-gray text-sm">
              Snapshots when possible theft/concealment is detected. Use these to find the person and check bag, pocket, or clothing.
            </p>
          </div>
          <button
            onClick={fetchIncidents}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-gray-300 rounded-lg border border-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading && incidents.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-[#0d0d0d] rounded-lg border border-white/5 overflow-hidden animate-pulse"
              >
                <div className="aspect-video bg-white/5" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <div className="bg-[#111] rounded-xl border border-white/5 p-12 text-center">
            <ShieldAlert className="w-12 h-12 text-gray/50 mx-auto mb-3" />
            <p className="text-gray">No detected incidents yet.</p>
            <p className="text-gray-500 text-sm mt-1">
              When the system flags possible theft or concealment on a live camera, a snapshot will appear here for security to review.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="bg-[#0d0d0d] rounded-lg border border-white/5 overflow-hidden hover:border-white/10 transition-colors"
              >
                <div className="aspect-video bg-black relative">
                  {inc.snapshotUrl ? (
                    <img
                      src={inc.snapshotUrl}
                      alt="Incident snapshot"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray/50">
                      <ImageOff className="w-10 h-10" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 text-gray-400 text-xs font-medium">
                    <Camera className="w-3.5 h-3.5" />
                    {inc.cameraId}
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <p className="text-white text-sm font-medium line-clamp-2">
                    {inc.description}
                  </p>
                  <div className="flex items-center gap-2 text-gray text-xs">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    {formatTime(inc.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
