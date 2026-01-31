"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Trash2, Search, Video, Clock, Eye } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DashboardLayout } from "@/components/dashboard-layout"

interface SavedVideo {
  id: string
  name: string
  url: string
  thumbnailUrl: string
  timestamps: { timestamp: string; description: string }[]
}

export default function SavedVideosPage() {
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredVideos, setFilteredVideos] = useState<SavedVideo[]>([])

  useEffect(() => {
    const existing: SavedVideo[] = JSON.parse(localStorage.getItem("savedVideos") || "[]")
    const fromStorage = Array.isArray(existing) ? existing : []

    if (fromStorage.length === 0) {
      const demoSeed: SavedVideo[] = [
        {
          id: "demo-1",
          name: "Front Entrance Monitor",
          url: "/videos/Robbery1.mp4",
          thumbnailUrl: "/cat1.png",
          timestamps: [
            { timestamp: "00:15", description: "Person loitering near entrance" },
            { timestamp: "02:30", description: "Unauthorized access attempt" },
            { timestamp: "05:45", description: "Normal foot traffic" },
            { timestamp: "08:20", description: "Suspicious package left" },
          ],
        },
      ]
      localStorage.setItem("savedVideos", JSON.stringify(demoSeed))
      setSavedVideos(demoSeed)
      setFilteredVideos(demoSeed)
    } else {
      setSavedVideos(fromStorage)
      setFilteredVideos(fromStorage)
    }

    const mergeWithServer = async () => {
      try {
        const res = await fetch("/api/saved-videos")
        if (!res.ok) return
        const serverList: { id: string; name: string; url: string; timestamps: { timestamp: string; description: string }[] }[] = await res.json()
        const fromStorageAfter = JSON.parse(localStorage.getItem("savedVideos") || "[]") as SavedVideo[]
        const byId = new Map(fromStorageAfter.map((v) => [v.id, v]))
        for (const s of serverList) {
          const entry = byId.get(s.id)
          if (!entry) byId.set(s.id, { id: s.id, name: s.name, url: s.url, thumbnailUrl: s.url, timestamps: s.timestamps || [] })
          else if (entry.url.startsWith("blob:") || !entry.url) byId.set(s.id, { ...entry, url: s.url, thumbnailUrl: s.url })
        }
        const merged = Array.from(byId.values())
        setSavedVideos(merged)
        setFilteredVideos(merged)
        localStorage.setItem("savedVideos", JSON.stringify(merged))
      } catch {
        // keep current state
      }
    }
    mergeWithServer()
  }, [])

  useEffect(() => {
    const filtered = savedVideos.filter(
      (video) =>
        video.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        video.timestamps.some((ts) => ts.description.toLowerCase().includes(searchTerm.toLowerCase())),
    )
    setFilteredVideos(filtered)
  }, [searchTerm, savedVideos])

  const handleDelete = (id: string) => {
    const updated = savedVideos.filter((v) => v.id !== id)
    setSavedVideos(updated)
    setFilteredVideos((prev) => prev.filter((v) => v.id !== id))
    localStorage.setItem("savedVideos", JSON.stringify(updated))
  }

  const handleVideoError = (id: string) => {
    const updated = savedVideos.filter((v) => v.id !== id)
    setSavedVideos(updated)
    setFilteredVideos((prev) => prev.filter((v) => v.id !== id))
    localStorage.setItem("savedVideos", JSON.stringify(updated))
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Saved Videos</h1>
          <p className="text-gray-500 text-sm">{savedVideos.length} videos in your library</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray" />
          <Input
            type="text"
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#0d0d0d] border-white/10 text-white placeholder:text-gray-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="group bg-[#0d0d0d] border border-white/5 rounded-lg overflow-hidden hover:border-white/10 transition-colors"
            >
              <div className="aspect-video bg-black relative overflow-hidden">
                <video
                  src={video.url}
                  className="w-full h-full object-contain bg-black"
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => handleVideoError(video.id)}
                />
                <div className="absolute top-3 right-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-lg">
                    <Video className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-white">{video.timestamps.length}</span>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h2 className="text-white font-medium mb-2 truncate">{video.name}</h2>
                <div className="flex items-center gap-2 mb-4 text-gray text-xs">
                  <Clock className="w-3 h-3" />
                  <span>{video.timestamps.length} key moments</span>
                </div>
                <div className="flex gap-2">
                  <Link href={`/pages/video/${video.id}`} className="flex-1">
                    <button className="w-full py-2.5 bg-white/10 text-white text-sm font-medium rounded-lg hover:bg-white/15 border border-white/10 transition-colors flex items-center justify-center gap-2">
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(video.id)}
                    className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg border border-white/5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredVideos.length === 0 && (
          <div className="text-center py-12">
            <Video className="w-12 h-12 text-gray/30 mx-auto mb-4" />
            <p className="text-gray">
              {searchTerm ? "No videos match your search" : "No saved videos yet"}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
