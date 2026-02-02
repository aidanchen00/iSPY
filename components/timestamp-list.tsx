"use client"

import { Shield, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react"
import type { Timestamp } from "@/types"
import { useState, useEffect, useRef } from "react"

interface TimestampListProps {
  timestamps: Timestamp[]
  onTimestampClick: (timestamp: string) => void
}

export default function TimestampList({ timestamps, onTimestampClick }: TimestampListProps) {
  const [expandedItems, setExpandedItems] = useState<number[]>([])
  const [longDescriptions, setLongDescriptions] = useState<number[]>([])
  const textRefs = useRef<(HTMLParagraphElement | null)[]>([])

  useEffect(() => {
    const checkTextOverflow = () => {
      const longItems = timestamps
        .map((_, index) => {
          const textElement = textRefs.current[index]
          if (!textElement) return { index, hasOverflow: false }
          const hasOverflow = textElement.offsetWidth < textElement.scrollWidth || textElement.offsetHeight < textElement.scrollHeight
          return { index, hasOverflow }
        })
        .filter(({ hasOverflow }) => hasOverflow)
        .map(({ index }) => index)
      setLongDescriptions(longItems)
    }

    const timeoutId = setTimeout(checkTextOverflow, 100)
    const handleResize = () => { clearTimeout(timeoutId); setTimeout(checkTextOverflow, 100) }
    window.addEventListener('resize', handleResize)
    return () => { clearTimeout(timeoutId); window.removeEventListener('resize', handleResize) }
  }, [timestamps])

  const toggleExpand = (index: number, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    setExpandedItems(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index])
  }

  if (timestamps.length === 0) return null

  return (
    <div className="bg-[#111] rounded-xl border border-white/5 p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white font-medium">Key Moments</h2>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-mint" />
            <span className="text-gray">Safe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-3 w-3 text-coral" />
            <span className="text-gray">Alert</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {timestamps.map((item, index) => (
          <button
            key={index}
            className={`group w-full text-left p-3 rounded-lg transition-colors ${
              item.isDangerous 
                ? 'bg-coral/5 border border-coral/10 hover:bg-coral/10' 
                : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]'
            }`}
            onClick={() => onTimestampClick(item.timestamp)}
          >
            <div className="flex items-start gap-3">
              {item.isDangerous ? (
                <ShieldAlert className="h-4 w-4 shrink-0 text-coral mt-0.5" />
              ) : (
                <Shield className="h-4 w-4 shrink-0 text-mint mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-white text-sm">{item.timestamp}</span>
                  {item.isDangerous && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-coral/10 text-coral">
                      Alert
                    </span>
                  )}
                </div>
                <div 
                  className={`relative ${longDescriptions.includes(index) ? 'cursor-pointer' : ''}`}
                  onClick={(e: React.MouseEvent) => longDescriptions.includes(index) && toggleExpand(index, e)}
                >
                  <p 
                    ref={(el) => { textRefs.current[index] = el }}
                    className={`text-sm ${expandedItems.includes(index) ? '' : 'line-clamp-1'} ${
                      item.isDangerous ? 'text-coral/80' : 'text-gray'
                    }`}
                  >
                    {item.description}
                  </p>
                  {longDescriptions.includes(index) && (
                    <div 
                      role="button"
                      tabIndex={0}
                      onClick={(e: React.MouseEvent) => toggleExpand(index, e)}
                      onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && toggleExpand(index, e)}
                      className={`flex items-center gap-1 text-xs mt-1 ${
                        item.isDangerous ? 'text-coral/60 hover:text-coral' : 'text-gray/50 hover:text-gray'
                      } transition-colors`}
                    >
                      {expandedItems.includes(index) ? (
                        <><ChevronUp className="h-3 w-3" /> Less</>
                      ) : (
                        <><ChevronDown className="h-3 w-3" /> More</>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
