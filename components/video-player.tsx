"use client"

import { forwardRef } from "react"
import type { Timestamp } from "@/types"

interface VideoPlayerProps {
  url: string
  timestamps: Timestamp[]
  onError?: () => void
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(({ url, timestamps, onError }, ref) => {
  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-black">
      <video
        ref={ref}
        src={url}
        className="w-full h-full object-contain"
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          const video = e.target as HTMLVideoElement
          video.currentTime = 0
        }}
        onError={onError}
      />
    </div>
  )
})

VideoPlayer.displayName = "VideoPlayer"

export default VideoPlayer
