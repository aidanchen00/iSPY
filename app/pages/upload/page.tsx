"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Upload, Save, Video, FileVideo, ArrowRight } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { DashboardLayout } from "@/components/dashboard-layout"
import VideoPlayer from "@/components/video-player"
import TimestampList from "@/components/timestamp-list"
import type { Timestamp } from "@/types"
import { detectEvents, type VideoEvent } from "./actions"
import Link from "next/link"

interface SavedVideo {
  id: string
  name: string
  url: string
  thumbnailUrl: string
  timestamps: Timestamp[]
}

export default function UploadPage() {
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [timestamps, setTimestamps] = useState<Timestamp[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [videoName, setVideoName] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)

  const captureFrame = async (video: HTMLVideoElement, time: number): Promise<string | null> => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return null

    try {
      video.currentTime = time
    } catch (error) {
      return null
    }
    
    await new Promise((resolve) => { video.onseeked = resolve })

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    return canvas.toDataURL('image/jpeg', 0.8)
  }

  const handleFileUpload = async (e: { target: { files: FileList | null } }) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadProgress(0)
    setTimestamps([])

    try {
      const localUrl = URL.createObjectURL(file)
      setVideoUrl(localUrl)
      setVideoName(file.name)

      while (!videoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const video = videoRef.current
      video.src = localUrl

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 10000)
        const handleLoad = () => { clearTimeout(timeout); resolve(true) }
        video.addEventListener('loadeddata', handleLoad)
        if (video.readyState >= 2) handleLoad()
      })
      
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setIsUploading(false)
      setUploadProgress(100)

      setIsAnalyzing(true)
      const duration = video.duration
      
      if (!duration || duration === Infinity || isNaN(duration)) {
        throw new Error('Invalid video duration')
      }

      const interval = 3
      const newTimestamps: Timestamp[] = []

      for (let time = 0; time < duration; time += interval) {
        const progress = Math.floor((time / duration) * 100)
        setUploadProgress(progress)

        const frame = await captureFrame(video, time)
        if (frame) {
          try {
            const result = await detectEvents(frame)
            if (result.events && result.events.length > 0) {
              result.events.forEach((event: VideoEvent) => {
                const minutes = Math.floor(time / 60)
                const seconds = Math.floor(time % 60)
                newTimestamps.push({
                  timestamp: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
                  description: event.description,
                  isDangerous: event.isDangerous
                })
              })
            }
          } catch (error) {
            console.error('Error analyzing frame:', error)
          }
        }
      }

      setTimestamps(newTimestamps)
      setIsAnalyzing(false)
      setUploadProgress(100)
    } catch (error) {
      console.error("Error:", error)
      setIsUploading(false)
      setIsAnalyzing(false)
    }
  }

  const handleTimestampClick = (timestamp: string) => {
    if (!videoRef.current) return
    const [minutes, seconds] = timestamp.split(":").map(Number)
    videoRef.current.currentTime = minutes * 60 + seconds
    videoRef.current.play()
  }

  const handleSaveVideo = () => {
    if (!videoUrl || !videoName) return
    const savedVideos: SavedVideo[] = JSON.parse(localStorage.getItem("savedVideos") || "[]")
    const newVideo: SavedVideo = {
      id: Date.now().toString(),
      name: videoName,
      url: videoUrl,
      thumbnailUrl: videoUrl, 
      timestamps: timestamps,
    }
    savedVideos.push(newVideo)
    localStorage.setItem("savedVideos", JSON.stringify(savedVideos))
    alert("Video saved successfully!")
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Upload & Analyze</h1>
            <p className="text-gray text-sm">Upload videos to detect key moments</p>
          </div>
          <Link href="/pages/saved-videos">
            <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2">
              <Video className="w-4 h-4" />
              Saved Videos
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>

        <div className="max-w-4xl space-y-6">
          {!videoUrl && (
            <div className="bg-[#111] rounded-xl border border-white/5 p-8">
              <label
                htmlFor="video-upload"
                className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-mint/50 hover:bg-white/[0.02] transition-all"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-mint') }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-mint') }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-mint')
                  const file = e.dataTransfer.files[0]
                  if (file?.type.startsWith('video/')) {
                    const input = document.getElementById('video-upload') as HTMLInputElement
                    if (input) {
                      const dt = new DataTransfer()
                      dt.items.add(file)
                      input.files = dt.files
                      handleFileUpload({ target: { files: dt.files } } as any)
                    }
                  }
                }}
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="p-4 bg-mint/10 rounded-xl mb-4">
                    <FileVideo className="h-10 w-10 text-mint" />
                  </div>
                  <p className="mb-2 text-lg font-medium text-white">
                    Upload Video
                  </p>
                  <p className="text-sm text-gray mb-4">
                    <span className="text-mint">Click to browse</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray/50">MP4, MOV, AVI up to 500MB</p>
                </div>
                <input
                  id="video-upload"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading || isAnalyzing}
                />
              </label>
            </div>
          )}

          {(isUploading || isAnalyzing) && (
            <div className="bg-[#111] rounded-xl border border-white/5 p-6">
              <Progress value={uploadProgress} className="w-full mb-3" />
              <p className="text-center text-sm text-gray">
                {isUploading ? "Uploading video..." : "Analyzing video content..."}
              </p>
            </div>
          )}

          {videoUrl && (
            <div className="space-y-4">
              <div className="bg-[#111] rounded-xl border border-white/5 overflow-hidden">
                <VideoPlayer url={videoUrl} timestamps={timestamps} ref={videoRef} />
              </div>
              <TimestampList timestamps={timestamps} onTimestampClick={handleTimestampClick} />
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  placeholder="Video name"
                  value={videoName}
                  onChange={(e) => setVideoName(e.target.value)}
                  className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray/50"
                />
                <button 
                  onClick={handleSaveVideo} 
                  className="px-4 py-2.5 bg-mint text-gray-dark font-medium rounded-lg hover:bg-mint-light transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
