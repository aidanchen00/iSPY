"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { StopCircle, PlayCircle, Loader2, Camera, ShieldAlert } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { detectEvents, type VideoEvent } from "./actions"
import { MOCK_CAMERA_LABELS, MOCK_VIDEO_URLS, YOUR_CAMERA_INDEX, TOTAL_CAMERAS } from "./mock-cameras"

import type * as blazeface from "@tensorflow-models/blazeface"
import type * as posedetection from "@tensorflow-models/pose-detection"

let blazefaceModel: typeof blazeface
let poseDetection: typeof posedetection

const PRE_SEC = 3000   // 3 seconds before incident
const POST_SEC = 3000  // 3 seconds after (clip total 6 sec)
const BUFFER_MS = 10_000
const CHUNK_MS = 500

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
  const [lastAlert, setLastAlert] = useState<{ description: string; time: string } | null>(null)
  const [isClient, setIsClient] = useState(false)

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
    const t0 = incidentTimeRef.current
    const desc = incidentDescRef.current
    incidentTimeRef.current = null
    incidentDescRef.current = null
    if (t0 == null || !desc) return
    const tEnd = t0 + POST_SEC
    const arr = chunksRef.current
      .filter((c) => c.ts >= t0 - PRE_SEC && c.ts <= tEnd)
      .sort((a, b) => a.ts - b.ts)
    if (arr.length === 0) return
    const blob = new Blob(arr.map((c) => c.blob), { type: arr[0].blob.type || "video/webm" })
    saveIncidentClipToSavedVideos(blob, desc)
      .then((clipUrl) => { if (clipUrl) updateRetailTheftClipUrl(clipUrl) })
      .catch((e) => console.error("Save clip:", e))
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
      setLastAlert({ description, time: getElapsedTime() })
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
    fetch("/api/theft-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "THEFT detected" }),
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
    analysisIntervalRef.current = setInterval(analyzeFrame, 3000)
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
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
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
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop()
    }
  }, [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">CCTV Live</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              5 demo feeds + your camera (6th) · Your camera runs AI detection
            </p>
          </div>
          <Link
            href="/pages/detected-incidents"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            Detected Incidents
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {lastAlert && (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
            <span className="text-gray-300 text-sm">Snapshot saved: {lastAlert.description}</span>
            <Link href="/pages/detected-incidents" className="text-sm font-medium text-white hover:underline">
              View
            </Link>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-3 gap-3 max-w-4xl">
          {Array.from({ length: TOTAL_CAMERAS }, (_, i) => {
            const isYourCamera = i === YOUR_CAMERA_INDEX
            const label = isYourCamera ? "Your camera" : (MOCK_CAMERA_LABELS[i] ?? `Cam ${i + 1}`)
            return (
              <div
                key={i}
                className={`rounded-xl overflow-hidden flex flex-col border transition-all duration-200 ${
                  isYourCamera
                    ? "bg-white/[0.04] border-white/20 ring-1 ring-white/10 shadow-lg"
                    : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                }`}
              >
                <div className="aspect-video bg-black relative flex-shrink-0">
                  {isYourCamera ? (
                    <>
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
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        </>
                      )}
                      {isInitializing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-10">
                          <Loader2 className="w-10 h-10 animate-spin text-white/60 mb-3" />
                          <span className="text-white/60 text-xs font-medium">{initializationProgress}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <video
                      src={MOCK_VIDEO_URLS[i]}
                      className="absolute inset-0 w-full h-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                      aria-label={label}
                    />
                  )}
                  {/* Label */}
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
                    <span className="text-xs font-medium text-white/90">{label}</span>
                  </div>
                  {/* LIVE pill (mock feeds) */}
                  {!isYourCamera && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] font-medium text-white/90 uppercase tracking-wider">Live</span>
                    </div>
                  )}
                </div>
                {isYourCamera && (
                  <div className="p-3 flex justify-center border-t border-white/5 bg-white/[0.02]">
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        disabled={isInitializing || !mlModelsReady}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Start analysis
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium border border-red-500/30 transition-colors"
                      >
                        <StopCircle className="w-4 h-4" />
                        Stop
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-gray-500 text-sm max-w-2xl">
          Only <strong className="text-gray-400">Your camera</strong> runs AI. Incidents only when there is proof of placing something into a bag or clothing. Clip: 3s before + 3s after (6s) saved to Saved Videos; added to Retail Theft. Voice: &quot;THEFT detected&quot; via MiniMax when configured.
        </p>
      </div>
    </DashboardLayout>
  )
}
