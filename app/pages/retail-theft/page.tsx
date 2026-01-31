"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import {
  AlertTriangle,
  Shield,
  ShoppingCart,
  Eye,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Filter,
  Clock,
  MapPin,
  TrendingDown,
  TrendingUp,
  Activity,
  RefreshCw,
  ChevronDown,
  Play,
  X,
} from "lucide-react"
import type {
  TheftEvent,
  SeverityLevel,
  TheftBehaviorType,
} from "@/lib/grocery/types"
import {
  getBehaviorDisplayName,
  getScoreSeverity,
  getSeverityColor,
} from "@/lib/grocery/prompts"
import {
  getScoreColor,
  getScoreBadgeText,
} from "@/lib/grocery/scoring"
import {
  submitFeedback,
  getAllFeedback,
  calculateFeedbackStatistics,
  generateCalibrationSuggestions,
  type FeedbackRecord,
} from "@/lib/grocery/feedback"
import { DEFAULT_THRESHOLDS } from "@/lib/grocery/config"

// ============================================
// MOCK DATA FOR DEMO
// ============================================

const MOCK_INCIDENTS: TheftEvent[] = [
  {
    id: "evt-1",
    timestamp: new Date(Date.now() - 2 * 60000),
    cameraId: "cam-main-entrance",
    storeId: "store-1",
    zoneId: "exit-main",
    behaviorType: "checkout_bypass",
    suspicionScore: 82,
    severity: "high",
    description: "Individual exiting store with unpaid items in hand, bypassing checkout area",
    reasoning: "Person walked directly from high-theft cosmetics section to exit without stopping at any register. Carrying multiple items that were visible on shelf moments before.",
    keyframes: [],
    alertSent: true,
    alertChannels: ["email", "phone"],
  },
  {
    id: "evt-2",
    timestamp: new Date(Date.now() - 8 * 60000),
    cameraId: "cam-aisle-3",
    storeId: "store-1",
    zoneId: "high-theft-cosmetics",
    behaviorType: "concealment",
    suspicionScore: 68,
    severity: "medium",
    description: "Person placing items inside jacket pocket while blocking camera view",
    reasoning: "Subject repeatedly checked surroundings before quickly placing small items in jacket. Body positioned to obscure view.",
    keyframes: [],
    alertSent: true,
    alertChannels: ["email"],
  },
  {
    id: "evt-3",
    timestamp: new Date(Date.now() - 15 * 60000),
    cameraId: "cam-checkout-1",
    storeId: "store-1",
    zoneId: "checkout-1",
    behaviorType: "self_checkout_fraud",
    suspicionScore: 55,
    severity: "medium",
    description: "Customer appearing to skip scanning some items at self-checkout",
    reasoning: "Several items placed directly in bag without visible scan motion. Item count in bag appears higher than scanned items.",
    keyframes: [],
    alertSent: false,
  },
  {
    id: "evt-4",
    timestamp: new Date(Date.now() - 25 * 60000),
    cameraId: "cam-electronics",
    storeId: "store-1",
    zoneId: "high-theft-electronics",
    behaviorType: "suspicious_loitering",
    suspicionScore: 42,
    severity: "low",
    description: "Individual spending extended time near high-value electronics display",
    reasoning: "Person has been in electronics section for 8+ minutes. Repeatedly picking up and examining same items without shopping pattern.",
    keyframes: [],
    alertSent: false,
  },
]

// ============================================
// COMPONENT
// ============================================

export default function RetailTheftPage() {
  const [incidents, setIncidents] = useState<TheftEvent[]>([])
  const [selectedIncident, setSelectedIncident] = useState<TheftEvent | null>(null)
  const [filter, setFilter] = useState<{
    severity: SeverityLevel | 'all'
    zone: string | 'all'
    timeRange: '1h' | '24h' | '7d' | 'all'
  }>({
    severity: 'all',
    zone: 'all',
    timeRange: '24h',
  })
  const [feedbackStats, setFeedbackStats] = useState(calculateFeedbackStatistics([]))
  const [suggestions, setSuggestions] = useState(generateCalibrationSuggestions(feedbackStats))
  const [isLoading, setIsLoading] = useState(false)

  // Load incidents and feedback on mount (merge live theft incidents from CCTV + mock)
  useEffect(() => {
    const liveRaw: unknown[] = JSON.parse(typeof window !== "undefined" ? localStorage.getItem("retailTheftLiveIncidents") || "[]" : "[]")
    const live: TheftEvent[] = (Array.isArray(liveRaw) ? liveRaw : []).map((item: unknown) => {
      const o = item as Record<string, unknown>
      return {
        id: String(o.id ?? ""),
        timestamp: o.timestamp ? new Date(o.timestamp as string) : new Date(),
        cameraId: String(o.cameraId ?? "your-camera"),
        storeId: String(o.storeId ?? "store-1"),
        zoneId: o.zoneId != null ? String(o.zoneId) : undefined,
        behaviorType: (o.behaviorType as TheftEvent["behaviorType"]) ?? "concealment",
        suspicionScore: Number(o.suspicionScore ?? 75),
        severity: (o.severity as TheftEvent["severity"]) ?? "high",
        description: String(o.description ?? "Live theft detection"),
        reasoning: String(o.reasoning ?? "Live AI detection."),
        keyframes: Array.isArray(o.keyframes) ? o.keyframes as string[] : [],
        clipUrl: o.clipUrl != null ? String(o.clipUrl) : undefined,
        alertSent: Boolean(o.alertSent ?? true),
        alertChannels: Array.isArray(o.alertChannels) ? o.alertChannels as ("email" | "sms" | "phone" | "webhook")[] : ["voice"],
      } as TheftEvent
    })
    setIncidents([...live, ...MOCK_INCIDENTS])

    const feedback = getAllFeedback()
    const stats = calculateFeedbackStatistics(feedback)
    setFeedbackStats(stats)
    setSuggestions(generateCalibrationSuggestions(stats))
  }, [])

  // Filter incidents
  const filteredIncidents = incidents.filter(incident => {
    if (filter.severity !== 'all' && incident.severity !== filter.severity) return false
    if (filter.zone !== 'all' && incident.zoneId !== filter.zone) return false
    
    // Time filter
    const now = Date.now()
    const incidentTime = incident.timestamp.getTime()
    switch (filter.timeRange) {
      case '1h':
        if (now - incidentTime > 60 * 60 * 1000) return false
        break
      case '24h':
        if (now - incidentTime > 24 * 60 * 60 * 1000) return false
        break
      case '7d':
        if (now - incidentTime > 7 * 24 * 60 * 60 * 1000) return false
        break
    }
    
    return true
  })

  // Handle feedback submission
  const handleFeedback = (
    eventId: string,
    label: 'true_positive' | 'false_positive' | 'uncertain'
  ) => {
    const event = incidents.find(i => i.id === eventId)
    if (!event) return

    submitFeedback(eventId, label, undefined, undefined, event)
    
    // Update event with label
    setIncidents(prev => prev.map(i => 
      i.id === eventId ? { ...i, operatorLabel: label } : i
    ))

    // Refresh stats
    const feedback = getAllFeedback()
    const stats = calculateFeedbackStatistics(feedback)
    setFeedbackStats(stats)
    setSuggestions(generateCalibrationSuggestions(stats))
  }

  // Stats summary
  const stats = {
    total: filteredIncidents.length,
    critical: filteredIncidents.filter(i => i.severity === 'critical').length,
    high: filteredIncidents.filter(i => i.severity === 'high').length,
    medium: filteredIncidents.filter(i => i.severity === 'medium').length,
    low: filteredIncidents.filter(i => i.severity === 'low').length,
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-mint" />
              Retail Theft Detection
            </h1>
            <p className="text-gray text-sm">
              Real-time monitoring for shoplifting and suspicious behavior
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIncidents(MOCK_INCIDENTS)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray text-xs uppercase tracking-wide">Total</span>
              <Activity className="w-4 h-4 text-gray" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          
          <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 rounded-xl p-4 border border-red-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-400 text-xs uppercase tracking-wide">Critical</span>
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
          </div>
          
          <div className="bg-gradient-to-br from-coral/10 to-coral/5 rounded-xl p-4 border border-coral/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-coral text-xs uppercase tracking-wide">High</span>
              <AlertTriangle className="w-4 h-4 text-coral" />
            </div>
            <div className="text-2xl font-bold text-coral">{stats.high}</div>
          </div>
          
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl p-4 border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-400 text-xs uppercase tracking-wide">Medium</span>
              <Eye className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">{stats.medium}</div>
          </div>
          
          <div className="bg-gradient-to-br from-gray/10 to-gray/5 rounded-xl p-4 border border-gray/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray text-xs uppercase tracking-wide">Low</span>
              <Shield className="w-4 h-4 text-gray" />
            </div>
            <div className="text-2xl font-bold text-gray">{stats.low}</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Incidents Feed */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray" />
                <span className="text-sm text-gray">Filters:</span>
              </div>
              
              <select
                value={filter.severity}
                onChange={(e) => setFilter({ ...filter, severity: e.target.value as any })}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              
              <select
                value={filter.timeRange}
                onChange={(e) => setFilter({ ...filter, timeRange: e.target.value as any })}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Incident List */}
            <div className="space-y-3">
              {filteredIncidents.length === 0 ? (
                <div className="bg-[#111] rounded-xl border border-white/5 p-8 text-center">
                  <Shield className="w-12 h-12 text-mint/30 mx-auto mb-3" />
                  <p className="text-gray">No incidents match your filters</p>
                </div>
              ) : (
                filteredIncidents.map((incident) => (
                  <IncidentCard
                    key={incident.id}
                    incident={incident}
                    isSelected={selectedIncident?.id === incident.id}
                    onSelect={() => setSelectedIncident(incident)}
                    onFeedback={handleFeedback}
                  />
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selected Incident Detail */}
            {selectedIncident && (
              <div className="bg-[#111] rounded-xl border border-white/5 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-medium">Incident Details</h3>
                  <button
                    onClick={() => setSelectedIncident(null)}
                    className="p-1 hover:bg-white/5 rounded"
                  >
                    <X className="w-4 h-4 text-gray" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  {/* Score */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray text-sm">Suspicion Score</span>
                    <div 
                      className="px-3 py-1 rounded-full text-sm font-bold"
                      style={{ 
                        backgroundColor: `${getScoreColor(selectedIncident.suspicionScore)}20`,
                        color: getScoreColor(selectedIncident.suspicionScore),
                      }}
                    >
                      {selectedIncident.suspicionScore}/100
                    </div>
                  </div>
                  
                  {/* Type */}
                  <div>
                    <span className="text-gray text-xs uppercase tracking-wide block mb-1">Behavior Type</span>
                    <span className="text-white">{getBehaviorDisplayName(selectedIncident.behaviorType)}</span>
                  </div>
                  
                  {/* Description */}
                  <div>
                    <span className="text-gray text-xs uppercase tracking-wide block mb-1">Description</span>
                    <p className="text-white text-sm">{selectedIncident.description}</p>
                  </div>
                  
                  {/* Reasoning */}
                  <div>
                    <span className="text-gray text-xs uppercase tracking-wide block mb-1">Why Flagged</span>
                    <p className="text-white/80 text-sm">{selectedIncident.reasoning}</p>
                  </div>
                  
                  {/* Evidence */}
                  <div>
                    <span className="text-gray text-xs uppercase tracking-wide block mb-1">Evidence</span>
                    <div className="bg-black rounded-lg aspect-video flex items-center justify-center">
                      <Play className="w-8 h-8 text-gray/50" />
                    </div>
                    <p className="text-gray/50 text-xs mt-1 text-center">Video clip unavailable in demo</p>
                  </div>
                  
                  {/* Feedback Buttons */}
                  <div className="pt-2 border-t border-white/5">
                    <span className="text-gray text-xs uppercase tracking-wide block mb-2">Operator Feedback</span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleFeedback(selectedIncident.id, 'true_positive')}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                          selectedIncident.operatorLabel === 'true_positive'
                            ? 'bg-mint/10 border-mint/30 text-mint'
                            : 'border-white/10 text-gray hover:bg-white/5'
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                        <span className="text-xs">Correct</span>
                      </button>
                      <button
                        onClick={() => handleFeedback(selectedIncident.id, 'false_positive')}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                          selectedIncident.operatorLabel === 'false_positive'
                            ? 'bg-coral/10 border-coral/30 text-coral'
                            : 'border-white/10 text-gray hover:bg-white/5'
                        }`}
                      >
                        <ThumbsDown className="w-4 h-4" />
                        <span className="text-xs">False</span>
                      </button>
                      <button
                        onClick={() => handleFeedback(selectedIncident.id, 'uncertain')}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                          selectedIncident.operatorLabel === 'uncertain'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'border-white/10 text-gray hover:bg-white/5'
                        }`}
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span className="text-xs">Unsure</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Accuracy Stats */}
            <div className="bg-[#111] rounded-xl border border-white/5 p-5">
              <h3 className="text-white font-medium mb-4">Detection Accuracy</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray text-sm">Total Labeled</span>
                  <span className="text-white font-medium">{feedbackStats.totalFeedback}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray text-sm">True Positives</span>
                  <span className="text-mint font-medium">{feedbackStats.truePositives}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray text-sm">False Positives</span>
                  <span className="text-coral font-medium">{feedbackStats.falsePositives}</span>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-gray text-sm">FP Rate</span>
                  <span className={`font-medium ${
                    feedbackStats.falsePositiveRate > 0.3 ? 'text-coral' :
                    feedbackStats.falsePositiveRate > 0.15 ? 'text-amber-400' :
                    'text-mint'
                  }`}>
                    {(feedbackStats.falsePositiveRate * 100).toFixed(0)}%
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray text-sm">Trend</span>
                  <span className={`flex items-center gap-1 font-medium ${
                    feedbackStats.recentTrend === 'improving' ? 'text-mint' :
                    feedbackStats.recentTrend === 'degrading' ? 'text-coral' :
                    'text-gray'
                  }`}>
                    {feedbackStats.recentTrend === 'improving' && <TrendingDown className="w-3 h-3" />}
                    {feedbackStats.recentTrend === 'degrading' && <TrendingUp className="w-3 h-3" />}
                    {feedbackStats.recentTrend.charAt(0).toUpperCase() + feedbackStats.recentTrend.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Calibration Suggestions */}
            {suggestions.length > 0 && (
              <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-5">
                <h3 className="text-amber-400 font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Calibration Suggestions
                </h3>
                <div className="space-y-2">
                  {suggestions.slice(0, 3).map((suggestion, i) => (
                    <div key={i} className="text-sm">
                      <p className="text-white">{suggestion.description}</p>
                      <p className="text-gray/70 text-xs mt-0.5">{suggestion.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

// ============================================
// INCIDENT CARD COMPONENT
// ============================================

function IncidentCard({
  incident,
  isSelected,
  onSelect,
  onFeedback,
}: {
  incident: TheftEvent
  isSelected: boolean
  onSelect: () => void
  onFeedback: (eventId: string, label: 'true_positive' | 'false_positive' | 'uncertain') => void
}) {
  const severityColors = {
    critical: 'bg-red-500/10 border-red-500/30 text-red-400',
    high: 'bg-coral/10 border-coral/30 text-coral',
    medium: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    low: 'bg-gray/10 border-gray/30 text-gray',
  }

  const timeAgo = getTimeAgo(incident.timestamp)

  return (
    <div
      onClick={onSelect}
      className={`bg-[#111] rounded-xl border p-4 cursor-pointer transition-all ${
        isSelected 
          ? 'border-mint/50 ring-1 ring-mint/20' 
          : 'border-white/5 hover:border-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[incident.severity]}`}>
              {incident.severity.toUpperCase()}
            </span>
            <span className="text-white font-medium">
              {getBehaviorDisplayName(incident.behaviorType)}
            </span>
            {incident.operatorLabel && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                incident.operatorLabel === 'true_positive' ? 'bg-mint/20 text-mint' :
                incident.operatorLabel === 'false_positive' ? 'bg-coral/20 text-coral' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {incident.operatorLabel === 'true_positive' ? 'TP' :
                 incident.operatorLabel === 'false_positive' ? 'FP' : '?'}
              </span>
            )}
          </div>
          
          {/* Description */}
          <p className="text-gray text-sm line-clamp-2 mb-2">
            {incident.description}
          </p>
          
          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-gray/70">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {incident.zoneId || 'Unknown Zone'}
            </span>
            {incident.alertSent && (
              <span className="flex items-center gap-1 text-mint">
                <AlertTriangle className="w-3 h-3" />
                Alert Sent
              </span>
            )}
          </div>
        </div>
        
        {/* Score */}
        <div 
          className="flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center"
          style={{ 
            backgroundColor: `${getScoreColor(incident.suspicionScore)}15`,
            borderColor: `${getScoreColor(incident.suspicionScore)}30`,
            borderWidth: 1,
          }}
        >
          <span 
            className="text-lg font-bold"
            style={{ color: getScoreColor(incident.suspicionScore) }}
          >
            {incident.suspicionScore}
          </span>
          <span className="text-[10px] text-gray">SCORE</span>
        </div>
      </div>
      
      {/* Quick Feedback */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
        <span className="text-xs text-gray mr-2">Quick label:</span>
        <button
          onClick={(e) => { e.stopPropagation(); onFeedback(incident.id, 'true_positive') }}
          className={`p-1.5 rounded transition-colors ${
            incident.operatorLabel === 'true_positive' ? 'bg-mint/20 text-mint' : 'hover:bg-white/5 text-gray'
          }`}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onFeedback(incident.id, 'false_positive') }}
          className={`p-1.5 rounded transition-colors ${
            incident.operatorLabel === 'false_positive' ? 'bg-coral/20 text-coral' : 'hover:bg-white/5 text-gray'
          }`}
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ============================================
// HELPERS
// ============================================

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
