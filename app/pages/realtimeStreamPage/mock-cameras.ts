/** Dashboard-style videos (same as dashboard), repeated for 5 demo tiles. */
const DASHBOARD_VIDEOS = [
  "/videos/Robbery1.mp4",
  "/videos/Shoplifting1.mp4",
  "/videos/Fighting1.mp4",
  "/videos/Vandalism3.mp4",
]

function repeatToLength<T>(arr: T[], length: number): T[] {
  const out: T[] = []
  for (let i = 0; i < length; i++) out.push(arr[i % arr.length])
  return out
}

export const MOCK_VIDEO_URLS: string[] = repeatToLength(DASHBOARD_VIDEOS, 5)

export const MOCK_CAMERA_LABELS: string[] = [
  "Zone A – Main",
  "Zone B – Storage",
  "Zone C – Office",
  "Zone D – Parking",
  "Zone E – Cam 5",
]

/** Your live camera is the 6th tile (index 5). */
export const YOUR_CAMERA_INDEX = 5

export const TOTAL_CAMERAS = 6
