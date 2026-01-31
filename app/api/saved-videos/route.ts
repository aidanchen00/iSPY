import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const SAVED_VIDEOS_DIR = path.join(process.cwd(), "alerts", "saved-videos")
const META_FILE = path.join(SAVED_VIDEOS_DIR, "index.json")

interface SavedVideoMeta {
  id: string
  name: string
  timestamps: { timestamp: string; description: string }[]
  createdAt: string
}

async function ensureDir() {
  await fs.mkdir(SAVED_VIDEOS_DIR, { recursive: true })
}

async function readMeta(): Promise<SavedVideoMeta[]> {
  try {
    const raw = await fs.readFile(META_FILE, "utf-8")
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function writeMeta(meta: SavedVideoMeta[]) {
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2), "utf-8")
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const name = (formData.get("name") as string) || "Incident clip"
    const timestampsStr = (formData.get("timestamps") as string) || "[]"

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 })
    }

    await ensureDir()
    const id = `sv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const ext = file.type.includes("mp4") ? "mp4" : "webm"
    const filePath = path.join(SAVED_VIDEOS_DIR, `${id}.${ext}`)
    const buf = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buf)

    let timestamps: { timestamp: string; description: string }[]
    try {
      timestamps = JSON.parse(timestampsStr)
    } catch {
      timestamps = []
    }

    const meta: SavedVideoMeta = {
      id,
      name,
      timestamps,
      createdAt: new Date().toISOString(),
    }
    const all = await readMeta()
    all.unshift(meta)
    await writeMeta(all)

    const url = `/api/saved-videos/stream/${id}`
    return NextResponse.json({ id, url })
  } catch (e) {
    console.error("POST saved-videos:", e)
    return NextResponse.json({ error: "Failed to save video" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const meta = await readMeta()
    return NextResponse.json(
      meta.map((m) => ({
        ...m,
        url: `/api/saved-videos/stream/${m.id}`,
      }))
    )
  } catch (e) {
    console.error("GET saved-videos:", e)
    return NextResponse.json({ error: "Failed to load" }, { status: 500 })
  }
}
