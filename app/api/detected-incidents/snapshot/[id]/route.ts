import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const ALERTS_DIR = path.join(process.cwd(), "alerts")
const SNAPSHOTS_DIR = path.join(ALERTS_DIR, "snapshots")

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const safeId = id.replace(/[^a-zA-Z0-9-_.]/g, "")
    const jpgPath = path.join(SNAPSHOTS_DIR, `${safeId}.jpg`)
    const pngPath = path.join(SNAPSHOTS_DIR, `${safeId}.png`)
    let filePath: string | null = null
    let contentType = "image/jpeg"
    try {
      await fs.access(jpgPath)
      filePath = jpgPath
    } catch {
      try {
        await fs.access(pngPath)
        filePath = pngPath
        contentType = "image/png"
      } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
    }
    const buf = await fs.readFile(filePath)
    return new NextResponse(buf, {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=86400" },
    })
  } catch (e) {
    console.error("GET snapshot:", e)
    return NextResponse.json({ error: "Failed to load snapshot" }, { status: 500 })
  }
}
