import { NextResponse } from "next/server"

const TARGET_COUNT = 23
const PEXELS_VIDEO_SEARCH = "https://api.pexels.com/videos/search"

interface PexelsVideoFile {
  id: number
  quality?: string
  width?: number
  height?: number
  link: string
  file_type?: string
}

interface PexelsVideo {
  id: number
  video_files: PexelsVideoFile[]
}

interface PexelsSearchResponse {
  videos: PexelsVideo[]
}

function pickBestMp4(files: PexelsVideoFile[]): string | null {
  const mp4s = files.filter((f) => f.link?.endsWith(".mp4") || f.file_type?.includes("mp4"))
  if (mp4s.length === 0) return files[0]?.link ?? null
  const hd = mp4s.find((f) => f.quality === "hd" || (f.height && f.height >= 720))
  const sd = mp4s.find((f) => f.quality === "sd" || (f.height && f.height >= 480))
  return (hd?.link ?? sd?.link ?? mp4s[0].link) ?? null
}

export async function GET() {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ urls: null, source: "none" })
  }

  try {
    const queries = ["grocery store", "supermarket", "people in grocery store"]
    const seen = new Set<number>()
    const urls: string[] = []

    for (const query of queries) {
      const res = await fetch(
        `${PEXELS_VIDEO_SEARCH}?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`,
        { headers: { Authorization: apiKey } }
      )
      if (!res.ok) continue
      const data: PexelsSearchResponse = await res.json()
      for (const video of data.videos ?? []) {
        if (seen.has(video.id) || urls.length >= TARGET_COUNT) continue
        const link = pickBestMp4(video.video_files ?? [])
        if (link) {
          seen.add(video.id)
          urls.push(link)
        }
      }
    }

    return NextResponse.json({
      urls: urls.length > 0 ? urls : null,
      source: urls.length > 0 ? "pexels" : "none",
    })
  } catch (e) {
    console.error("grocery-videos fetch:", e)
    return NextResponse.json({ urls: null, source: "error" })
  }
}
