import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const SAVED_VIDEOS_DIR = path.join(process.cwd(), "alerts", "saved-videos")

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const safeId = id.replace(/[^a-zA-Z0-9-_.]/g, "")
    const webmPath = path.join(SAVED_VIDEOS_DIR, `${safeId}.webm`)
    const mp4Path = path.join(SAVED_VIDEOS_DIR, `${safeId}.mp4`)

    let filePath: string | null = null
    let contentType = "video/webm"
    try {
      await fs.access(webmPath)
      filePath = webmPath
    } catch {
      try {
        await fs.access(mp4Path)
        filePath = mp4Path
        contentType = "video/mp4"
      } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
    }

    const buf = await fs.readFile(filePath)
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      },
    })
  } catch (e) {
    console.error("GET saved-videos stream:", e)
    return NextResponse.json({ error: "Failed to load video" }, { status: 500 })
  }
}
