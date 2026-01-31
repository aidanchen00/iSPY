import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const ALERTS_DIR = path.join(process.cwd(), "alerts")
const SNAPSHOTS_DIR = path.join(ALERTS_DIR, "snapshots")
const INCIDENTS_FILE = path.join(ALERTS_DIR, "detected-incidents.json")

export interface DetectedIncident {
  id: string
  snapshotPath: string
  description: string
  cameraId: string
  timestamp: string
  createdAt: string
}

async function ensureDirs() {
  await fs.mkdir(ALERTS_DIR, { recursive: true })
  await fs.mkdir(SNAPSHOTS_DIR, { recursive: true })
}

async function readIncidents(): Promise<DetectedIncident[]> {
  try {
    const raw = await fs.readFile(INCIDENTS_FILE, "utf-8")
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function writeIncidents(incidents: DetectedIncident[]) {
  await fs.writeFile(INCIDENTS_FILE, JSON.stringify(incidents, null, 2), "utf-8")
}

export async function GET() {
  try {
    const incidents = await readIncidents()
    return NextResponse.json(
      incidents.map((inc) => ({
        ...inc,
        snapshotUrl: `/api/detected-incidents/snapshot/${inc.id}`,
      }))
    )
  } catch (e) {
    console.error("GET detected-incidents:", e)
    return NextResponse.json({ error: "Failed to load incidents" }, { status: 500 })
  }
}

const DEDUPE_WINDOW_MS = 90_000 // 90 seconds
const DESCRIPTION_NORMALIZE_LEN = 60

function normalizeDescription(d: string): string {
  return d.trim().toLowerCase().slice(0, DESCRIPTION_NORMALIZE_LEN)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { snapshotBase64, description, cameraId, timestamp } = body as {
      snapshotBase64?: string
      description?: string
      cameraId?: string
      timestamp?: string
    }
    if (!snapshotBase64 || !description) {
      return NextResponse.json(
        { error: "snapshotBase64 and description required" },
        { status: 400 }
      )
    }

    const cam = (cameraId ?? "live").trim()
    const normDesc = normalizeDescription(description)
    const now = Date.now()

    const incidents = await readIncidents()
    const recent = incidents.filter((inc) => {
      const created = new Date(inc.createdAt).getTime()
      return now - created <= DEDUPE_WINDOW_MS && inc.cameraId === cam && normalizeDescription(inc.description) === normDesc
    })
    if (recent.length > 0) {
      return NextResponse.json({
        id: recent[0].id,
        snapshotUrl: `/api/detected-incidents/snapshot/${recent[0].id}`,
        duplicate: true,
      })
    }

    await ensureDirs()
    const id = `inc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const ext = snapshotBase64.includes("png") ? "png" : "jpg"
    const snapshotPath = path.join(SNAPSHOTS_DIR, `${id}.${ext}`)

    const base64Data = snapshotBase64.replace(/^data:image\/\w+;base64,/, "")
    const buf = Buffer.from(base64Data, "base64")
    await fs.writeFile(snapshotPath, buf)

    const incident: DetectedIncident = {
      id,
      snapshotPath: `snapshots/${id}.${ext}`,
      description: description ?? "Possible theft/concealment",
      cameraId: cam,
      timestamp: timestamp ?? new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    incidents.unshift(incident)
    await writeIncidents(incidents)

    return NextResponse.json({ id, snapshotUrl: `/api/detected-incidents/snapshot/${id}` })
  } catch (e) {
    console.error("POST detected-incidents:", e)
    return NextResponse.json({ error: "Failed to save incident" }, { status: 500 })
  }
}
