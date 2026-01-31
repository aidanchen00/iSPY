/**
 * Grocery Store Theft Detection - Zone Management Utilities
 * 
 * This module provides utilities for:
 * - Checking if a point is inside a zone polygon
 * - Finding which zones a person/object is in
 * - Calculating zone-based risk multipliers
 */

import type { Zone, Point, BoundingBox, ZoneType } from './types'

// ============================================
// POINT-IN-POLYGON ALGORITHM
// ============================================

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param point - The point to check (normalized 0-1 coordinates)
 * @param polygon - Array of vertices defining the polygon
 * @returns true if point is inside the polygon
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false
  
  let inside = false
  const n = polygon.length
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)
    
    if (intersect) inside = !inside
  }
  
  return inside
}

/**
 * Get the center point of a bounding box (normalized coords)
 */
export function getBoundingBoxCenter(box: BoundingBox): Point {
  return {
    x: (box.x1 + box.x2) / 2,
    y: (box.y1 + box.y2) / 2,
  }
}

/**
 * Get all corner points of a bounding box
 */
export function getBoundingBoxCorners(box: BoundingBox): Point[] {
  return [
    { x: box.x1, y: box.y1 },  // Top-left
    { x: box.x2, y: box.y1 },  // Top-right
    { x: box.x2, y: box.y2 },  // Bottom-right
    { x: box.x1, y: box.y2 },  // Bottom-left
  ]
}

// ============================================
// ZONE DETECTION
// ============================================

/**
 * Find all zones that contain a given point
 * @param point - The point to check
 * @param zones - Array of zones to check against
 * @param enabledOnly - Only check enabled zones
 * @returns Array of zones containing the point
 */
export function findZonesContainingPoint(
  point: Point,
  zones: Zone[],
  enabledOnly = true
): Zone[] {
  return zones.filter(zone => {
    if (enabledOnly && !zone.enabled) return false
    return isPointInPolygon(point, zone.polygon)
  })
}

/**
 * Find all zones that a bounding box overlaps with
 * Uses center point + corner checks for accuracy
 * @param box - Bounding box to check
 * @param zones - Array of zones
 * @param enabledOnly - Only check enabled zones
 * @returns Array of overlapping zones with overlap scores
 */
export function findZonesForBoundingBox(
  box: BoundingBox,
  zones: Zone[],
  enabledOnly = true
): Array<{ zone: Zone; overlapScore: number }> {
  const center = getBoundingBoxCenter(box)
  const corners = getBoundingBoxCorners(box)
  const results: Array<{ zone: Zone; overlapScore: number }> = []
  
  for (const zone of zones) {
    if (enabledOnly && !zone.enabled) continue
    
    // Check center
    const centerInZone = isPointInPolygon(center, zone.polygon)
    
    // Check corners
    let cornersInZone = 0
    for (const corner of corners) {
      if (isPointInPolygon(corner, zone.polygon)) {
        cornersInZone++
      }
    }
    
    // Calculate overlap score (0-1)
    // Center counts for 0.5, each corner counts for 0.125
    const overlapScore = (centerInZone ? 0.5 : 0) + (cornersInZone * 0.125)
    
    if (overlapScore > 0) {
      results.push({ zone, overlapScore })
    }
  }
  
  // Sort by overlap score descending
  return results.sort((a, b) => b.overlapScore - a.overlapScore)
}

/**
 * Get the primary zone for a bounding box (highest overlap)
 */
export function getPrimaryZoneForBoundingBox(
  box: BoundingBox,
  zones: Zone[],
  enabledOnly = true
): Zone | null {
  const overlapping = findZonesForBoundingBox(box, zones, enabledOnly)
  return overlapping.length > 0 ? overlapping[0].zone : null
}

// ============================================
// RISK CALCULATION
// ============================================

/**
 * Calculate the combined risk multiplier for a position
 * Takes the maximum multiplier from all overlapping zones
 */
export function calculateRiskMultiplier(
  position: Point,
  zones: Zone[],
  enabledOnly = true
): number {
  const containingZones = findZonesContainingPoint(position, zones, enabledOnly)
  
  if (containingZones.length === 0) {
    return 1.0  // Default multiplier
  }
  
  // Return maximum multiplier
  return Math.max(...containingZones.map(z => z.riskMultiplier))
}

/**
 * Calculate risk multiplier for a bounding box
 * Uses weighted average based on overlap
 */
export function calculateRiskMultiplierForBox(
  box: BoundingBox,
  zones: Zone[],
  enabledOnly = true
): number {
  const overlapping = findZonesForBoundingBox(box, zones, enabledOnly)
  
  if (overlapping.length === 0) {
    return 1.0
  }
  
  // Weighted average by overlap score
  let totalWeight = 0
  let weightedSum = 0
  
  for (const { zone, overlapScore } of overlapping) {
    totalWeight += overlapScore
    weightedSum += zone.riskMultiplier * overlapScore
  }
  
  return weightedSum / totalWeight
}

// ============================================
// ZONE TYPE HELPERS
// ============================================

/**
 * Check if any zone of a specific type contains the point
 */
export function isInZoneType(
  point: Point,
  zones: Zone[],
  zoneType: ZoneType
): boolean {
  return zones.some(zone => 
    zone.enabled && 
    zone.type === zoneType && 
    isPointInPolygon(point, zone.polygon)
  )
}

/**
 * Get all zones of a specific type that contain the point
 */
export function getZonesOfType(
  point: Point,
  zones: Zone[],
  zoneType: ZoneType
): Zone[] {
  return zones.filter(zone =>
    zone.enabled &&
    zone.type === zoneType &&
    isPointInPolygon(point, zone.polygon)
  )
}

/**
 * Check for critical zone transitions (e.g., moving toward exit with items)
 */
export interface ZoneTransition {
  from: Zone | null
  to: Zone | null
  isCritical: boolean
  reason?: string
}

export function detectZoneTransition(
  previousPosition: Point | null,
  currentPosition: Point,
  zones: Zone[]
): ZoneTransition {
  const currentZones = findZonesContainingPoint(currentPosition, zones)
  const currentZone = currentZones.length > 0 ? currentZones[0] : null
  
  let previousZone: Zone | null = null
  if (previousPosition) {
    const prevZones = findZonesContainingPoint(previousPosition, zones)
    previousZone = prevZones.length > 0 ? prevZones[0] : null
  }
  
  // Check for critical transitions
  const transition: ZoneTransition = {
    from: previousZone,
    to: currentZone,
    isCritical: false,
  }
  
  // Critical: Moving from shopping area directly to exit
  if (previousZone?.type !== 'exit' && currentZone?.type === 'exit') {
    // Check if they bypassed checkout
    if (previousZone?.type !== 'checkout') {
      transition.isCritical = true
      transition.reason = 'Approaching exit without passing through checkout'
    }
  }
  
  // Critical: Non-staff entering staff-only area
  if (previousZone?.type !== 'staff_only' && currentZone?.type === 'staff_only') {
    transition.isCritical = true
    transition.reason = 'Entering staff-only area'
  }
  
  return transition
}

// ============================================
// ZONE VISUALIZATION HELPERS
// ============================================

/**
 * Convert normalized polygon to pixel coordinates
 */
export function polygonToPixels(
  polygon: Point[],
  width: number,
  height: number
): Array<{ x: number; y: number }> {
  return polygon.map(p => ({
    x: Math.round(p.x * width),
    y: Math.round(p.y * height),
  }))
}

/**
 * Convert pixel coordinates to normalized polygon
 */
export function pixelsToPolygon(
  pixels: Array<{ x: number; y: number }>,
  width: number,
  height: number
): Point[] {
  return pixels.map(p => ({
    x: p.x / width,
    y: p.y / height,
  }))
}

/**
 * Generate SVG path string for a polygon
 */
export function polygonToSvgPath(polygon: Point[], width: number, height: number): string {
  if (polygon.length === 0) return ''
  
  const pixels = polygonToPixels(polygon, width, height)
  const first = pixels[0]
  const rest = pixels.slice(1)
  
  return `M ${first.x} ${first.y} ${rest.map(p => `L ${p.x} ${p.y}`).join(' ')} Z`
}

/**
 * Calculate polygon area (normalized, 0-1 range)
 */
export function calculatePolygonArea(polygon: Point[]): number {
  if (polygon.length < 3) return 0
  
  let area = 0
  const n = polygon.length
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += polygon[i].x * polygon[j].y
    area -= polygon[j].x * polygon[i].y
  }
  
  return Math.abs(area / 2)
}

/**
 * Get polygon centroid
 */
export function getPolygonCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0, y: 0 }
  
  let sumX = 0
  let sumY = 0
  
  for (const p of polygon) {
    sumX += p.x
    sumY += p.y
  }
  
  return {
    x: sumX / polygon.length,
    y: sumY / polygon.length,
  }
}
