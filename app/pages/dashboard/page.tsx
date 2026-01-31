"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { StopCircle, PlayCircle, Loader2, Camera, ShieldAlert, Video, Activity, AlertTriangle, Clock, TrendingUp } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { detectEvents } from "./actions"

import type * as blazeface from "@tensorflow-models/blazeface"
import type * as posedetection from "@tensorflow-models/pose-detection"

let blazefaceModel: typeof blazeface
let poseDetection: typeof posedetection

const PRE_SEC = 3000   // 3 seconds before incident
const POST_SEC = 3000  // 3 seconds after (clip total 6 sec)
const BUFFER_MS = 10_000
const CHUNK_MS = 500
const TOTAL_CAMERAS = 4  // 1 main camera + 3 secondary feeds

interface ChunkItem {
  blob: Blob
  ts: number
}

export default function Page() {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [initializationProgress, setInitializationProgress] = useState("")
  const [mlModelsReady, setMlModelsReady] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [showRedFlash, setShowRedFlash] = useState(false)
  const [incidentCount, setIncidentCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)
  const [recentIncidents, setRecentIncidents] = useState<Array<{
    description: string
    time: string
    isDangerous: boolean
  }>>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const detectionFrameRef = useRef<number | null>(null)
  const lastDetectionTime = useRef<number>(0)
  const startTimeRef = useRef<Date | null>(null)
  const faceModelRef = useRef<blazeface.BlazeFaceModel | null>(null)
  const poseModelRef = useRef<posedetection.PoseDetector | null>(null)
  const isRecordingRef = useRef<boolean>(false)
  const chunksRef = useRef<ChunkItem[]>([])
  const incidentTimeRef = useRef<number | null>(null)
  const incidentDescRef = useRef<string | null>(null)
  const postTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const initMLModels = async () => {
    try {
      setIsInitializing(true)
      setMlModelsReady(false)
      setError(null)
      setInitializationProgress("Loading TensorFlow.js...")
      const tf = await import("@tensorflow/tfjs")
      await tf.ready()
      await tf.setBackend("webgl")
      setInitializationProgress("Loading detection models...")
      const [blazefaceModule, poseDetectionModule] = await Promise.all([
        import("@tensorflow-models/blazeface"),
        import("@tensorflow-models/pose-detection"),
      ])
      blazefaceModel = blazefaceModule
      poseDetection = poseDetectionModule
      setInitializationProgress("Initializing models...")
      const [faceModel, poseModel] = await Promise.all([
        blazefaceModel.load({ maxFaces: 1, scoreThreshold: 0.5 }),
        poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
          minPoseScore: 0.3,
        }),
      ])
      faceModelRef.current = faceModel
      poseModelRef.current = poseModel
      setMlModelsReady(true)
      setIsInitializing(false)
    } catch (err) {
      setError("Failed to load ML models: " + (err as Error).message)
      setMlModelsReady(false)
      setIsInitializing(false)
    }
  }

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: "user" },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        mediaStreamRef.current = stream
        await new Promise<void>((resolve) => {
          videoRef.current!.onloadedmetadata = () => resolve()
        })
        if (canvasRef.current) {
          canvasRef.current.width = 640
          canvasRef.current.height = 360
        }
      }
    } catch {
      setError("Failed to access webcam. Please grant camera permissions.")
    }
  }

  const stopWebcam = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const runDetection = async () => {
    if (!isRecordingRef.current) return
    const now = performance.now()
    if (now - lastDetectionTime.current < 100) {
      detectionFrameRef.current = requestAnimationFrame(runDetection)
      return
    }
    lastDetectionTime.current = now
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) {
      detectionFrameRef.current = requestAnimationFrame(runDetection)
      return
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      detectionFrameRef.current = requestAnimationFrame(runDetection)
      return
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const scaleX = canvas.width / video.videoWidth
    const scaleY = canvas.height / video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    if (faceModelRef.current) {
      try {
        const predictions = await faceModelRef.current.estimateFaces(video, false)
        predictions.forEach((p: blazeface.NormalizedFace) => {
          const [sx, sy] = [(p.topLeft as number[])[0] * scaleX, (p.topLeft as number[])[1] * scaleY]
          const [sw, sh] = [(p.bottomRight as number[])[0] * scaleX - sx, (p.bottomRight as number[])[1] * scaleY - sy]
          ctx.strokeStyle = "#4DFFBC"
          ctx.lineWidth = 2
          ctx.strokeRect(sx, sy, sw, sh)
        })
      } catch {}
    }
    if (poseModelRef.current) {
      try {
        const poses = await poseModelRef.current.estimatePoses(video)
        if (poses.length > 0) {
          poses[0].keypoints.forEach((kp) => {
            if ((kp.score ?? 0) > 0.3) {
              const x = kp.x * scaleX
              const y = kp.y * scaleY
              ctx.beginPath()
              ctx.arc(x, y, 4, 0, 2 * Math.PI)
              ctx.fillStyle = "#FF4D4D"
              ctx.fill()
            }
          })
        }
      } catch {}
    }
    detectionFrameRef.current = requestAnimationFrame(runDetection)
  }

  const captureFrame = async (): Promise<string | null> => {
    const video = videoRef.current
    if (!video) return null
    const w = video.videoWidth
    const h = video.videoHeight
    const maxW = 1280
    const scale = w > maxW ? maxW / w : 1
    const cw = Math.round(w * scale)
    const ch = Math.round(h * scale)
    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = cw
    tempCanvas.height = ch
    const context = tempCanvas.getContext("2d")
    if (!context) return null
    try {
      context.drawImage(video, 0, 0, w, h, 0, 0, cw, ch)
      return tempCanvas.toDataURL("image/jpeg", 0.92)
    } catch {
      return null
    }
  }

  const getElapsedTime = () => {
    if (!startTimeRef.current) return "00:00"
    const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000)
    return `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
  }

  const saveIncidentClipToSavedVideos = async (blob: Blob, description: string): Promise<string | undefined> => {
    const name = `Incident - ${description.slice(0, 40)}${description.length > 40 ? "…" : ""} - ${new Date().toLocaleString()}`
    const timestamps = [{ timestamp: "00:05", description }]
    let id = `inc-${Date.now()}`
    let url: string

    try {
      const form = new FormData()
      form.append("file", blob)
      form.append("name", name)
      form.append("timestamps", JSON.stringify(timestamps))
      const res = await fetch("/api/saved-videos", { method: "POST", body: form })
      if (res.ok) {
        const data = await res.json()
        id = data.id
        url = data.url ?? `/api/saved-videos/stream/${data.id}`
      } else {
        url = URL.createObjectURL(blob)
      }
    } catch {
      url = URL.createObjectURL(blob)
    }

    try {
      const existing: { id: string; name: string; url: string; thumbnailUrl: string; timestamps: { timestamp: string; description: string }[] }[] =
        JSON.parse(typeof window !== "undefined" ? localStorage.getItem("savedVideos") || "[]" : "[]")
      existing.unshift({ id, name, url, thumbnailUrl: url, timestamps })
      localStorage.setItem("savedVideos", JSON.stringify(existing))
      const clipUrlForRetail = url.startsWith("/api/") ? url : undefined
      return clipUrlForRetail
    } catch (e) {
      console.error("Failed to save incident clip:", e)
      return undefined
    }
  }

  const updateRetailTheftClipUrl = (clipUrl: string) => {
    try {
      const key = "retailTheftLiveIncidents"
      const existing: { clipUrl?: string }[] = JSON.parse(typeof window !== "undefined" ? localStorage.getItem(key) || "[]" : "[]")
      if (existing.length > 0 && !existing[0].clipUrl) {
        existing[0] = { ...existing[0], clipUrl }
        localStorage.setItem(key, JSON.stringify(existing))
      }
    } catch {}
  }

  const flushPostIncidentClip = () => {
    console.log('[VIDEO SAVE] Flushing post-incident clip...')
    const t0 = incidentTimeRef.current
    const desc = incidentDescRef.current
    incidentTimeRef.current = null
    incidentDescRef.current = null
    if (t0 == null || !desc) {
      console.log('[VIDEO SAVE] Aborted: Missing time or description')
      return
    }
    const tEnd = t0 + POST_SEC
    const arr = chunksRef.current
      .filter((c) => c.ts >= t0 - PRE_SEC && c.ts <= tEnd)
      .sort((a, b) => a.ts - b.ts)
    console.log(`[VIDEO SAVE] Collected ${arr.length} chunks for 6-second clip`)
    if (arr.length === 0) {
      console.log('[VIDEO SAVE] Aborted: No chunks available')
      return
    }
    const blob = new Blob(arr.map((c) => c.blob), { type: arr[0].blob.type || "video/webm" })
    console.log(`[VIDEO SAVE] Created blob of size: ${blob.size} bytes, type: ${blob.type}`)
    console.log('[VIDEO SAVE] Saving to Saved Videos...')
    saveIncidentClipToSavedVideos(blob, desc)
      .then((clipUrl) => {
        if (clipUrl) {
          console.log('[VIDEO SAVE] ✅ Successfully saved! URL:', clipUrl)
          updateRetailTheftClipUrl(clipUrl)
        } else {
          console.log('[VIDEO SAVE] ✅ Saved to localStorage')
        }
      })
      .catch((e) => console.error('[VIDEO SAVE] ❌ Error:', e))
  }

  const saveIncidentSnapshot = async (frameBase64: string, description: string) => {
    try {
      const res = await fetch("/api/detected-incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotBase64: frameBase64,
          description,
          cameraId: "your-camera",
          timestamp: getElapsedTime(),
        }),
      })
      const data = await res.json()
      if (data.duplicate) return
    } catch (e) {
      console.error("Failed to save incident snapshot:", e)
    }
  }

  const addToRetailTheft = (description: string, clipUrl?: string) => {
    try {
      const key = "retailTheftLiveIncidents"
      const existing: unknown[] = JSON.parse(typeof window !== "undefined" ? localStorage.getItem(key) || "[]" : "[]")
      const id = `live-${Date.now()}`
      const event = {
        id,
        timestamp: new Date().toISOString(),
        cameraId: "your-camera",
        storeId: "store-1",
        zoneId: "live-camera",
        behaviorType: "concealment",
        suspicionScore: 75,
        severity: "high",
        description,
        reasoning: "Live AI detection: placing into bag or clothing.",
        keyframes: [],
        ...(clipUrl && { clipUrl }),
        alertSent: true,
        alertChannels: ["voice"],
      }
      existing.unshift(event)
      localStorage.setItem(key, JSON.stringify(existing))
    } catch (e) {
      console.error("Failed to add to Retail Theft:", e)
    }
  }

  const onIncidentDetected = (frameBase64: string, description: string) => {
    const now = Date.now()
    incidentTimeRef.current = now
    incidentDescRef.current = description
    saveIncidentSnapshot(frameBase64, description)
    addToRetailTheft(description)

    // Update metrics
    setIncidentCount(prev => prev + 1)
    setAlertCount(prev => prev + 1)

    // Add to recent incidents
    const timeStr = getElapsedTime()
    setRecentIncidents(prev => [{
      description,
      time: timeStr,
      isDangerous: true
    }, ...prev].slice(0, 5)) // Keep only last 5 incidents

    // Trigger red flash effect
    setShowRedFlash(true)
    setTimeout(() => setShowRedFlash(false), 1000) // Flash for 1 second

    // Speak the alert with description - "Shoplifter detected. [description]"
    const shortDesc = description.length > 100 ? description.substring(0, 100) + "..." : description
    const ttsMessage = `Shoplifter detected. ${shortDesc}`

    fetch("/api/theft-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: ttsMessage }),
    }).catch(() => {})

    if (postTimeoutRef.current) clearTimeout(postTimeoutRef.current)
    postTimeoutRef.current = setTimeout(flushPostIncidentClip, POST_SEC)
  }

  const analyzeFrame = async () => {
    if (!isRecordingRef.current) return
    try {
      const frame = await captureFrame()
      if (!frame || !frame.startsWith("data:image/jpeg")) return
      const result = await detectEvents(frame, "")
      if (!isRecordingRef.current) return
      if (result.events?.length) {
        for (const event of result.events) {
          if (event.isDangerous) {
            onIncidentDetected(frame, event.description)
            break
          }
        }
      }
    } catch (e) {
      console.error("Error analyzing frame:", e)
    }
  }

  const trimChunks = () => {
    const now = Date.now()
    const cut = now - BUFFER_MS
    if (incidentTimeRef.current == null) {
      chunksRef.current = chunksRef.current.filter((c) => c.ts >= cut)
    } else {
      chunksRef.current = chunksRef.current.filter((c) => c.ts >= Math.min(cut, incidentTimeRef.current! - PRE_SEC))
    }
  }

  const startRecording = () => {
    if (!mlModelsReady || !mediaStreamRef.current) return
    setError(null)
    startTimeRef.current = new Date()
    isRecordingRef.current = true
    setIsRecording(true)
    chunksRef.current = []

    const stream = mediaStreamRef.current
    let mimeType = "video/webm"
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) mimeType = "video/webm;codecs=vp9"
    else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) mimeType = "video/webm;codecs=vp8"
    const recorder = new MediaRecorder(stream, { mimeType })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push({ blob: e.data, ts: Date.now() })
        trimChunks()
      }
    }
    recorder.start(CHUNK_MS)
    mediaRecorderRef.current = recorder

    if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current)
    lastDetectionTime.current = 0
    detectionFrameRef.current = requestAnimationFrame(runDetection)
    if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current)
    analyzeFrame()
    analysisIntervalRef.current = setInterval(analyzeFrame, 1500) // Check every 1.5 seconds for faster detection
  }

  const stopRecording = () => {
    startTimeRef.current = null
    isRecordingRef.current = false
    setIsRecording(false)
    if (postTimeoutRef.current) {
      clearTimeout(postTimeoutRef.current)
      postTimeoutRef.current = null
    }
    incidentTimeRef.current = null
    incidentDescRef.current = null
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    if (detectionFrameRef.current) {
      cancelAnimationFrame(detectionFrameRef.current)
      detectionFrameRef.current = null
    }
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current)
      analysisIntervalRef.current = null
    }
  }

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    const init = async () => {
      await startWebcam()
      await initMLModels()
    }
    init()
    return () => {
      stopWebcam()
      if (postTimeoutRef.current) clearTimeout(postTimeoutRef.current)
      if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current)
      if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  return (
    <DashboardLayout>
      {/* Red Flash Overlay - Covers entire screen edges */}
      {showRedFlash && (
        <div className="fixed inset-0 pointer-events-none z-[9999]">
          {/* Top border */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-red-500 to-transparent animate-pulse" />
          {/* Bottom border */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-red-500 to-transparent animate-pulse" />
          {/* Left border */}
          <div className="absolute top-0 left-0 bottom-0 w-16 bg-gradient-to-r from-red-500 to-transparent animate-pulse" />
          {/* Right border */}
          <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-red-500 to-transparent animate-pulse" />
          {/* Inner glow */}
          <div className="absolute inset-0 border-[20px] border-red-500/30 animate-pulse" style={{
            boxShadow: 'inset 0 0 100px 20px rgba(239, 68, 68, 0.6), 0 0 100px 20px rgba(239, 68, 68, 0.6)'
          }} />
        </div>
      )}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Security Dashboard</h1>
            <p className="text-gray-400 text-sm mt-0.5 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live AI Detection Active · 6 Cameras Online
            </p>
          </div>
          <Link
            href="/pages/detected-incidents"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            View All Incidents
          </Link>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-xl p-5 border border-white/10 hover:border-green-500/20 transition-all duration-300 hover:scale-[1.02] shadow-lg group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Cameras</span>
              <Video className="w-4 h-4 text-green-500 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{TOTAL_CAMERAS}</div>
            <div className="text-green-500 text-xs mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              All online
            </div>
          </div>

          <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-xl p-5 border border-white/10 hover:border-blue-500/20 transition-all duration-300 hover:scale-[1.02] shadow-lg group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Incidents</span>
              <Activity className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{incidentCount}</div>
            <div className="text-gray-400 text-xs mt-1 font-medium">This session</div>
          </div>

          <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-xl p-5 border border-white/10 hover:border-red-500/20 transition-all duration-300 hover:scale-[1.02] shadow-lg group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Alerts</span>
              <AlertTriangle className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{alertCount}</div>
            <div className="text-red-500 text-xs mt-1 font-medium">Active</div>
          </div>

          <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-xl p-5 border border-white/10 hover:border-green-500/20 transition-all duration-300 hover:scale-[1.02] shadow-lg group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Response</span>
              <Clock className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors duration-300" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">&lt;3s</div>
            <div className="text-gray-400 text-xs mt-1 font-medium">AI Analysis</div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Feeds - Takes 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            {/* Primary Feed - Your Camera with AI */}
            <div className="bg-[#111] rounded-xl border border-white/5 overflow-hidden shadow-2xl ring-1 ring-white/10 relative group">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02] backdrop-blur-sm absolute top-0 left-0 right-0 z-10 transition-transform duration-300 -translate-y-full group-hover:translate-y-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'} shadow-[0_0_10px_rgba(239,68,68,0.5)]`} />
                  <span className="text-white text-sm font-medium drop-shadow-md">Your Camera - AI Detection {isRecording ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex gap-2">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      disabled={isInitializing || !mlModelsReady}
                      className="px-3 py-1.5 bg-green-500/90 backdrop-blur-sm text-white text-xs font-medium rounded-lg hover:bg-green-500 transition-colors flex items-center gap-1 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PlayCircle className="w-3 h-3" />
                      Start AI
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-3 py-1.5 bg-red-500/90 backdrop-blur-sm text-white text-xs font-medium rounded-lg hover:bg-red-500 transition-colors flex items-center gap-1 shadow-lg"
                    >
                      <StopCircle className="w-3 h-3" />
                      Stop
                    </button>
                  )}
                </div>
              </div>
              <div className="aspect-video bg-black relative">
                {isClient && (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover opacity-0"
                      width={640}
                      height={360}
                    />
                    <canvas
                      ref={canvasRef}
                      width={640}
                      height={360}
                      className="absolute inset-0 w-full h-full object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-100"
                    />
                  </>
                )}
                {isInitializing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-10">
                    <Loader2 className="w-10 h-10 animate-spin text-white/60 mb-3" />
                    <span className="text-white/60 text-xs font-medium">{initializationProgress}</span>
                  </div>
                )}
                {/* Always visible status when header is hidden */}
                <div className="absolute top-4 left-4 flex items-center gap-2 group-hover:opacity-0 transition-opacity duration-300">
                  <div className="px-2 py-1 bg-black/50 backdrop-blur-md rounded-md border border-white/10 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
                    <span className="text-xs text-white font-medium">{isRecording ? 'LIVE AI' : 'READY'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Feeds - Mock Videos */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { zone: 'Zone B - Storage', video: '/videos/Shoplifting1.mp4' },
                { zone: 'Zone C - Office', video: '/videos/Fighting1.mp4' },
                { zone: 'Zone D - Parking', video: '/videos/Vandalism3.mp4' }
              ].map((item, i) => (
                <div key={i} className="bg-[#111] rounded-lg border border-white/5 overflow-hidden group cursor-pointer hover:ring-1 hover:ring-green-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/5">
                  <div className="aspect-video bg-black relative">
                    <video
                      src={item.video}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute top-2 left-2">
                      <div className="flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        Live
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs text-gray-400">{item.zone}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Info Note */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-blue-400 text-sm">
                <strong>AI Detection:</strong> Your camera analyzes every 3 seconds. When shoplifting detected: 🔴 Red flash, 🔊 Voice alert, 💾 6-sec clip saved (3s before + 3s after).
              </p>
            </div>
          </div>

          {/* Sidebar - Recent Activity */}
          <div className="space-y-4">
            {/* Recent Incidents */}
            <div className="bg-[#111] rounded-xl border border-white/5 p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-gray-400" />
                <span className="text-white font-medium">Recent Activity</span>
              </div>
              <div className="space-y-3">
                {recentIncidents.length > 0 ? (
                  recentIncidents.map((incident, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border bg-red-500/5 border-red-500/20 hover:bg-red-500/10 hover:shadow-[0_0_15px_-5px_rgba(239,68,68,0.3)] transition-all duration-300"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-red-500">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium">Shoplifting Detected</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{incident.description}</p>
                          <p className="text-xs text-gray-500 mt-1">{incident.time}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                    <p className="text-sm text-gray-500">No incidents detected yet</p>
                    <p className="text-xs text-gray-600 mt-1">Start analysis to begin monitoring</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">
              <h3 className="text-white font-medium mb-1">System Status</h3>
              <p className="text-green-500 text-sm mb-4">All systems operational</p>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/pages/statistics">
                  <button className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-center">
                    <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <p className="text-xs text-gray-400">Analytics</p>
                  </button>
                </Link>
                <Link href="/pages/saved-videos">
                  <button className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-center">
                    <Video className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-400">Videos</p>
                  </button>
                </Link>
                <Link href="/pages/upload">
                  <button className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-center">
                    <Camera className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-400">Upload</p>
                  </button>
                </Link>
                <Link href="/pages/detected-incidents">
                  <button className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-center">
                    <ShieldAlert className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-400">Incidents</p>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
