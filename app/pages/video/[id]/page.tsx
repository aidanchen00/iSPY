"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Download, ArrowLeft, Video, Clock } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import VideoPlayer from "@/components/video-player"
import TimestampList from "@/components/timestamp-list"
import { Timeline } from "@/app/components/Timeline"
import type { Timestamp } from "@/app/types"

interface SavedVideo {
  id: string
  name: string
  url: string
  thumbnailUrl: string
  timestamps: Timestamp[]
}

export default function VideoPage() {
  const [video, setVideo] = useState<SavedVideo | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoError, setVideoError] = useState(false)
  const params = useParams()
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setVideoError(false)
    const savedVideos: SavedVideo[] = JSON.parse(localStorage.getItem("savedVideos") || "[]")
    const foundVideo = savedVideos.find((v) => v.id === params.id)
    if (foundVideo) {
      setVideo(foundVideo)
    } else {
      router.push("/pages/saved-videos")
    }
  }, [params.id, router])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => setCurrentTime(video.currentTime)
    const handleLoadedMetadata = () => setVideoDuration(video.duration)

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)

    if (video.duration) handleLoadedMetadata()

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [])

  const handleTimestampClick = (timestamp: string) => {
    if (!videoRef.current) return
    const [minutes, seconds] = timestamp.split(":").map(Number)
    videoRef.current.currentTime = minutes * 60 + seconds
    videoRef.current.play()
  }

  const handleVideoError = () => {
    setVideoError(true)
    if (video?.id && typeof window !== "undefined") {
      const saved: SavedVideo[] = JSON.parse(localStorage.getItem("savedVideos") || "[]")
      const updated = saved.filter((v) => v.id !== video.id)
      localStorage.setItem("savedVideos", JSON.stringify(updated))
    }
  }

  if (!video) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Video className="w-12 h-12 text-gray mx-auto mb-3" />
            <p className="text-gray">Loading video...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/pages/saved-videos">
              <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">{video.name}</h1>
              <div className="flex items-center gap-2 mt-1 text-gray text-sm">
                <Clock className="w-4 h-4" />
                <span>{video.timestamps.length} key moments</span>
              </div>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                const a = document.createElement('a')
                a.href = video.url
                a.download = video.name.toLowerCase().endsWith('.mp4') ? video.name : `${video.name}.mp4`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
              } catch (error) {
                console.error('Download error:', error)
              }
            }}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>

        <div className="max-w-4xl space-y-6">
          <div className="bg-[#0d0d0d] border border-white/5 rounded-lg overflow-hidden">
            {videoError ? (
              <div className="aspect-video flex flex-col items-center justify-center bg-black text-gray-400 p-6">
                <Video className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">This video couldn’t be loaded.</p>
                <p className="text-xs mt-1">If it was an incident clip, it may have been saved before we stored videos on the server. New clips will play correctly.</p>
              </div>
            ) : (
              <VideoPlayer url={video.url} timestamps={video.timestamps} ref={videoRef} onError={handleVideoError} />
            )}
          </div>
          
          <div className="bg-[#111] border border-white/5 rounded-xl p-5">
            <h2 className="text-white font-medium mb-4">Timeline</h2>
            <Timeline
              events={video.timestamps.map(ts => {
                let timeInSeconds
                if (typeof ts.timestamp === 'string' && ts.timestamp.includes(':')) {
                  const [minutes, seconds] = ts.timestamp.split(':').map(Number)
                  timeInSeconds = minutes * 60 + seconds
                } else {
                  timeInSeconds = Number(ts.timestamp)
                }
                return {
                  startTime: timeInSeconds,
                  endTime: timeInSeconds + 3,
                  type: ts.isDangerous ? 'warning' : 'normal',
                  label: ts.description
                }
              })}
              totalDuration={videoDuration || 100}
              currentTime={currentTime}
            />
          </div>

          <TimestampList timestamps={video.timestamps} onTimestampClick={handleTimestampClick} />
        </div>
      </div>
    </DashboardLayout>
  )
}
