"use client"

import { useEffect, useState } from 'react'
import type { Zone, Point } from '@/lib/grocery/types'
import { polygonToSvgPath, getPolygonCentroid } from '@/lib/grocery/zones'

interface ZoneOverlayProps {
  zones: Zone[]
  width: number
  height: number
  showLabels?: boolean
  highlightZoneId?: string
  onZoneClick?: (zone: Zone) => void
  opacity?: number
}

/**
 * Zone Overlay Component
 * 
 * Renders zone polygons as an SVG overlay on a video feed or image.
 * Zones are clickable and can be highlighted.
 */
export function ZoneOverlay({
  zones,
  width,
  height,
  showLabels = true,
  highlightZoneId,
  onZoneClick,
  opacity = 0.3,
}: ZoneOverlayProps) {
  if (width === 0 || height === 0) return null

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {zones.filter(z => z.enabled).map((zone) => {
        const isHighlighted = zone.id === highlightZoneId
        const centroid = getPolygonCentroid(zone.polygon)
        const path = polygonToSvgPath(zone.polygon, width, height)
        
        return (
          <g key={zone.id}>
            {/* Zone polygon */}
            <path
              d={path}
              fill={zone.color}
              fillOpacity={isHighlighted ? opacity * 1.5 : opacity}
              stroke={zone.color}
              strokeWidth={isHighlighted ? 3 : 2}
              strokeOpacity={0.8}
              className={onZoneClick ? 'pointer-events-auto cursor-pointer hover:stroke-white' : ''}
              onClick={() => onZoneClick?.(zone)}
            />
            
            {/* Zone label */}
            {showLabels && (
              <g>
                {/* Background for text */}
                <rect
                  x={centroid.x * width - 40}
                  y={centroid.y * height - 12}
                  width={80}
                  height={24}
                  rx={4}
                  fill="black"
                  fillOpacity={0.6}
                />
                <text
                  x={centroid.x * width}
                  y={centroid.y * height + 4}
                  textAnchor="middle"
                  className="fill-white text-xs font-medium"
                  style={{ fontSize: '11px' }}
                >
                  {zone.name}
                </text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Zone Legend Component
 * 
 * Shows a legend of all zones with their colors and risk multipliers.
 */
export function ZoneLegend({
  zones,
  onZoneToggle,
}: {
  zones: Zone[]
  onZoneToggle?: (zoneId: string, enabled: boolean) => void
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-white">Zones</h4>
      <div className="space-y-1">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            {onZoneToggle && (
              <input
                type="checkbox"
                checked={zone.enabled}
                onChange={(e) => onZoneToggle(zone.id, e.target.checked)}
                className="rounded"
              />
            )}
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: zone.color }}
            />
            <span className="text-sm text-white flex-1">{zone.name}</span>
            <span className="text-xs text-gray">
              {zone.riskMultiplier}x
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Mini Zone Map Component
 * 
 * A small preview of zone layout, useful for dashboards.
 */
export function ZoneMiniMap({
  zones,
  width = 200,
  height = 120,
  activeZoneId,
}: {
  zones: Zone[]
  width?: number
  height?: number
  activeZoneId?: string
}) {
  return (
    <div 
      className="relative bg-gray-dark rounded-lg overflow-hidden border border-white/10"
      style={{ width, height }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {zones.filter(z => z.enabled).map((zone) => {
          const isActive = zone.id === activeZoneId
          const path = polygonToSvgPath(zone.polygon, width, height)
          
          return (
            <path
              key={zone.id}
              d={path}
              fill={zone.color}
              fillOpacity={isActive ? 0.5 : 0.2}
              stroke={zone.color}
              strokeWidth={isActive ? 2 : 1}
            />
          )
        })}
      </svg>
      {activeZoneId && (
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-xs text-white">
          {zones.find(z => z.id === activeZoneId)?.name || 'Unknown'}
        </div>
      )}
    </div>
  )
}

/**
 * Suspicion Score Badge Component
 */
export function SuspicionScoreBadge({
  score,
  size = 'md',
}: {
  score: number
  size?: 'sm' | 'md' | 'lg'
}) {
  const getColor = (s: number) => {
    if (s >= 90) return '#DC2626'
    if (s >= 75) return '#EF4444'
    if (s >= 50) return '#F59E0B'
    if (s >= 30) return '#FBBF24'
    return '#22C55E'
  }

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
  }

  const color = getColor(score)

  return (
    <div
      className={`${sizeClasses[size]} rounded-xl flex flex-col items-center justify-center font-bold`}
      style={{
        backgroundColor: `${color}20`,
        borderColor: `${color}40`,
        borderWidth: 1,
        color,
      }}
    >
      <span>{score}</span>
      {size !== 'sm' && <span className="text-[8px] opacity-70">SCORE</span>}
    </div>
  )
}

/**
 * Incident Type Badge Component
 */
export function IncidentTypeBadge({
  type,
  severity,
}: {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}) {
  const severityColors = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-coral/20 text-coral border-coral/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-gray/20 text-gray border-gray/30',
  }

  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${severityColors[severity]}`}>
      {type.replace(/_/g, ' ')}
    </span>
  )
}
