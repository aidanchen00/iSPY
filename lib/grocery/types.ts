/**
 * Grocery Store Theft Detection - Type Definitions
 * 
 * This module defines all types for the retail theft detection system,
 * including zones, events, scoring, and store configuration.
 */

// ============================================
// ZONE DEFINITIONS
// ============================================

/**
 * Types of zones in a grocery store for theft monitoring
 */
export type ZoneType = 
  | 'entrance'        // Store entrance/exit points
  | 'exit'            // Dedicated exit (may differ from entrance)
  | 'checkout'        // Checkout lanes/registers
  | 'high_theft'      // High-value or high-theft aisles (electronics, cosmetics, alcohol)
  | 'staff_only'      // Restricted areas
  | 'general'         // General shopping floor

/**
 * A point in 2D space (normalized 0-1 coordinates relative to frame)
 */
export interface Point {
  x: number  // 0-1, left to right
  y: number  // 0-1, top to bottom
}

/**
 * A polygon zone defined by vertices
 */
export interface Zone {
  id: string
  name: string
  type: ZoneType
  polygon: Point[]           // Vertices of the polygon (normalized coords)
  color: string              // Display color (hex)
  riskMultiplier: number     // Scoring multiplier for this zone (1.0 = normal)
  enabled: boolean           // Whether detection is active in this zone
  description?: string       // Optional zone description
}

/**
 * Camera with associated zones
 */
export interface GroceryCamera {
  id: string
  name: string
  storeId: string
  location: string           // Physical location description
  zones: Zone[]              // Zones visible in this camera
  streamUrl?: string         // RTSP or HTTP stream URL (future)
  enabled: boolean
  resolution?: {
    width: number
    height: number
  }
}

// ============================================
// THEFT EVENT DEFINITIONS
// ============================================

/**
 * Types of suspicious/theft behaviors
 */
export type TheftBehaviorType =
  | 'concealment'            // Hiding items in clothing/bag
  | 'grab_and_run'           // Taking items and rushing to exit
  | 'ticket_switching'       // Swapping price tags
  | 'cart_walkout'           // Walking out with unpaid cart
  | 'checkout_bypass'        // Avoiding checkout entirely
  | 'receipt_fraud'          // Fake receipt or return fraud
  | 'employee_theft'         // Internal theft
  | 'suspicious_loitering'   // Prolonged presence in high-theft area
  | 'tag_removal'            // Removing security tags
  | 'distraction_theft'      // Working with accomplice
  | 'fitting_room_theft'     // Concealment in fitting rooms
  | 'self_checkout_fraud'    // Not scanning items at self-checkout
  | 'unknown'                // Unclassified suspicious behavior

/**
 * Severity levels for theft events
 */
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'

/**
 * A detected theft/suspicious event
 */
export interface TheftEvent {
  id: string
  timestamp: Date
  cameraId: string
  storeId: string
  zoneId?: string
  behaviorType: TheftBehaviorType
  suspicionScore: number     // 0-100
  severity: SeverityLevel
  description: string        // Human-readable description
  reasoning: string          // Why this was flagged (model explanation)
  
  // Evidence
  keyframes: string[]        // Base64 or URLs of key frames
  clipUrl?: string           // URL to evidence clip
  clipDurationSeconds?: number
  
  // Tracking
  personTrackingId?: string  // ID for tracking same person across frames
  itemsInvolved?: string[]   // Detected items involved
  
  // Operator feedback
  operatorLabel?: 'true_positive' | 'false_positive' | 'uncertain'
  operatorNotes?: string
  labeledAt?: Date
  labeledBy?: string
  
  // Alert status
  alertSent: boolean
  alertChannels?: ('email' | 'sms' | 'phone' | 'webhook')[]
}

/**
 * A keyframe with metadata
 */
export interface Keyframe {
  id: string
  eventId: string
  timestamp: Date
  frameNumber: number
  imageData: string          // Base64 encoded
  detections?: BoundingBox[]
  zones?: string[]           // Zone IDs visible in frame
}

/**
 * Bounding box for detected objects
 */
export interface BoundingBox {
  x1: number  // normalized 0-1
  y1: number
  x2: number
  y2: number
  label: string              // 'person', 'bag', 'cart', 'item', etc.
  confidence: number         // 0-1
  trackingId?: string
}

// ============================================
// SCORING CONFIGURATION
// ============================================

/**
 * Threshold configuration for alerts
 */
export interface ScoringThresholds {
  logOnly: number            // Score below this: just log, no UI highlight (default: 30)
  dashboardMark: number      // Score >= this: show on dashboard (default: 50)
  alertSecurity: number      // Score >= this: send alert to security (default: 75)
  critical: number           // Score >= this: immediate priority alert (default: 90)
}

/**
 * Behavior-specific scoring weights
 */
export interface BehaviorWeights {
  [key: string]: number      // TheftBehaviorType -> base score contribution
}

/**
 * Store calibration settings
 */
export interface StoreCalibration {
  sensitivityLevel: number   // 0-100, overall sensitivity slider
  zoneMultipliers: {         // Per-zone score multipliers
    [zoneId: string]: number
  }
  ignoredPatterns: IgnorePattern[]  // Patterns to ignore (reduce false positives)
  activeHours: {             // When detection is active
    start: string            // HH:MM format
    end: string
  }
  peakHours: {               // Higher sensitivity during peak hours
    start: string
    end: string
    multiplier: number
  }[]
}

/**
 * Patterns to ignore (reduce false positives)
 */
export interface IgnorePattern {
  id: string
  name: string
  type: 'uniform' | 'badge' | 'behavior' | 'schedule' | 'location'
  description: string
  enabled: boolean
  // Pattern-specific config
  config: {
    colors?: string[]        // For uniform detection
    schedules?: string[]     // For scheduled activities (restocking)
    zoneExclusions?: string[] // Zones where this doesn't apply
  }
}

// ============================================
// STORE CONFIGURATION
// ============================================

/**
 * Detection mode
 */
export type DetectionMode = 'standard' | 'retail_theft' | 'safety' | 'custom'

/**
 * Deployment mode
 */
export type DeploymentMode = 'edge' | 'cloud'

/**
 * Privacy settings
 */
export interface PrivacySettings {
  blurFaces: boolean
  blurInStoredMedia: boolean
  retentionDays: number      // Auto-delete after N days
  excludeFromTraining: boolean
}

/**
 * Complete store configuration
 */
export interface StoreConfig {
  id: string
  name: string
  address: string
  timezone: string
  
  // Detection settings
  detectionMode: DetectionMode
  deploymentMode: DeploymentMode
  
  // Cameras and zones
  cameras: GroceryCamera[]
  
  // Scoring
  thresholds: ScoringThresholds
  behaviorWeights: BehaviorWeights
  calibration: StoreCalibration
  
  // Privacy
  privacy: PrivacySettings
  
  // Alert destinations
  alertConfig: AlertConfig
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  email: {
    enabled: boolean
    recipients: string[]
    minSeverity: SeverityLevel
  }
  sms: {
    enabled: boolean
    phoneNumbers: string[]
    minSeverity: SeverityLevel
  }
  phone: {
    enabled: boolean
    phoneNumber: string        // Primary security phone
    minSeverity: SeverityLevel
    vapiPhoneNumberId?: string
  }
  webhook: {
    enabled: boolean
    url: string
    headers?: { [key: string]: string }
    minSeverity: SeverityLevel
  }
}

// ============================================
// API TYPES
// ============================================

/**
 * Request to analyze a frame for theft
 */
export interface TheftDetectionRequest {
  imageBase64: string
  cameraId: string
  storeId: string
  timestamp: Date
  previousContext?: {
    recentEvents: TheftEvent[]
    personTracks: PersonTrack[]
  }
}

/**
 * Person tracking info
 */
export interface PersonTrack {
  id: string
  firstSeen: Date
  lastSeen: Date
  trajectory: Point[]        // Movement path
  zonesVisited: string[]
  dwellTimes: { [zoneId: string]: number }  // Seconds spent in each zone
  suspicionAccumulator: number  // Running suspicion score
}

/**
 * Response from theft detection
 */
export interface TheftDetectionResponse {
  events: TheftEvent[]
  personTracks: PersonTrack[]
  analysisTimeMs: number
  modelUsed: string
  frameAnalyzed: boolean     // False if skipped due to optimization
}

/**
 * Operator feedback submission
 */
export interface FeedbackSubmission {
  eventId: string
  label: 'true_positive' | 'false_positive' | 'uncertain'
  notes?: string
  operatorId?: string
}

// ============================================
// DASHBOARD TYPES
// ============================================

/**
 * Incident for dashboard display
 */
export interface DashboardIncident {
  id: string
  event: TheftEvent
  camera: GroceryCamera
  store: { id: string; name: string }
  status: 'new' | 'reviewing' | 'resolved' | 'escalated'
  priority: number           // Computed from severity and recency
}

/**
 * Filter options for incident feed
 */
export interface IncidentFilters {
  storeIds?: string[]
  cameraIds?: string[]
  zoneTypes?: ZoneType[]
  severities?: SeverityLevel[]
  behaviorTypes?: TheftBehaviorType[]
  dateRange?: {
    start: Date
    end: Date
  }
  labelStatus?: 'unlabeled' | 'labeled' | 'all'
  minScore?: number
}

/**
 * Statistics for dashboard
 */
export interface TheftStatistics {
  period: 'day' | 'week' | 'month'
  totalIncidents: number
  byBehaviorType: { [key: string]: number }
  byZone: { [zoneId: string]: number }
  bySeverity: { [key: string]: number }
  falsePositiveRate: number
  avgResponseTime: number
  trendsVsPrevious: {
    incidents: number        // Percentage change
    falsePositives: number
  }
}
