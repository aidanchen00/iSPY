/**
 * Grocery Store Theft Detection - Default Configuration
 */

import type {
  StoreConfig,
  ScoringThresholds,
  BehaviorWeights,
  StoreCalibration,
  AlertConfig,
  PrivacySettings,
  Zone,
  GroceryCamera,
} from './types'

// ============================================
// DEFAULT THRESHOLDS
// ============================================

export const DEFAULT_THRESHOLDS: ScoringThresholds = {
  logOnly: 30,           // Below 30: silent logging only
  dashboardMark: 50,     // 50+: visible on dashboard
  alertSecurity: 75,     // 75+: alert security team
  critical: 90,          // 90+: immediate priority alert
}

// ============================================
// BEHAVIOR SCORING WEIGHTS
// ============================================

/**
 * Base scores for different theft behaviors
 * These are multiplied by zone multipliers and sensitivity settings
 */
export const DEFAULT_BEHAVIOR_WEIGHTS: BehaviorWeights = {
  // High severity behaviors
  grab_and_run: 85,
  cart_walkout: 80,
  employee_theft: 75,
  
  // Medium-high severity
  concealment: 70,
  checkout_bypass: 65,
  tag_removal: 65,
  distraction_theft: 60,
  
  // Medium severity
  ticket_switching: 55,
  self_checkout_fraud: 55,
  fitting_room_theft: 50,
  receipt_fraud: 50,
  
  // Lower severity (may need more context)
  suspicious_loitering: 40,
  unknown: 35,
}

// ============================================
// DEFAULT STORE CALIBRATION
// ============================================

export const DEFAULT_CALIBRATION: StoreCalibration = {
  sensitivityLevel: 50,  // Balanced default
  zoneMultipliers: {},   // Per-store configuration
  ignoredPatterns: [
    {
      id: 'employee-uniform',
      name: 'Store Employees',
      type: 'uniform',
      description: 'Ignore alerts for people wearing store uniforms/badges',
      enabled: true,
      config: {
        colors: ['#2563eb', '#1e40af'],  // Example: blue uniforms
      },
    },
    {
      id: 'restocking',
      name: 'Restocking Activity',
      type: 'schedule',
      description: 'Reduce sensitivity during scheduled restocking',
      enabled: true,
      config: {
        schedules: ['06:00-08:00', '22:00-23:00'],
      },
    },
    {
      id: 'cleaning-staff',
      name: 'Cleaning Staff',
      type: 'behavior',
      description: 'Ignore cleaning/maintenance patterns',
      enabled: true,
      config: {},
    },
  ],
  activeHours: {
    start: '06:00',
    end: '23:00',
  },
  peakHours: [
    {
      start: '17:00',
      end: '19:00',
      multiplier: 1.2,  // 20% more sensitive during evening rush
    },
    {
      start: '11:00',
      end: '13:00',
      multiplier: 1.1,  // 10% more sensitive during lunch rush
    },
  ],
}

// ============================================
// DEFAULT PRIVACY SETTINGS
// ============================================

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  blurFaces: true,
  blurInStoredMedia: true,
  retentionDays: 30,
  excludeFromTraining: false,
}

// ============================================
// DEFAULT ALERT CONFIG
// ============================================

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  email: {
    enabled: true,
    recipients: [],
    minSeverity: 'medium',
  },
  sms: {
    enabled: false,
    phoneNumbers: [],
    minSeverity: 'high',
  },
  phone: {
    enabled: false,
    phoneNumber: '',
    minSeverity: 'critical',
  },
  webhook: {
    enabled: false,
    url: '',
    minSeverity: 'medium',
  },
}

// ============================================
// SAMPLE GROCERY STORE ZONES
// ============================================

/**
 * Sample zone layout for a typical grocery store camera
 */
export const SAMPLE_GROCERY_ZONES: Zone[] = [
  {
    id: 'entrance-main',
    name: 'Main Entrance',
    type: 'entrance',
    polygon: [
      { x: 0.0, y: 0.0 },
      { x: 0.25, y: 0.0 },
      { x: 0.25, y: 0.4 },
      { x: 0.0, y: 0.4 },
    ],
    color: '#3B82F6',  // Blue
    riskMultiplier: 1.3,
    enabled: true,
    description: 'Primary store entrance with foot traffic monitoring',
  },
  {
    id: 'exit-main',
    name: 'Main Exit',
    type: 'exit',
    polygon: [
      { x: 0.75, y: 0.0 },
      { x: 1.0, y: 0.0 },
      { x: 1.0, y: 0.4 },
      { x: 0.75, y: 0.4 },
    ],
    color: '#EF4444',  // Red
    riskMultiplier: 1.5,  // Higher risk at exit
    enabled: true,
    description: 'Store exit - critical for detecting walkouts',
  },
  {
    id: 'checkout-1',
    name: 'Checkout Lane 1-4',
    type: 'checkout',
    polygon: [
      { x: 0.3, y: 0.0 },
      { x: 0.7, y: 0.0 },
      { x: 0.7, y: 0.3 },
      { x: 0.3, y: 0.3 },
    ],
    color: '#22C55E',  // Green
    riskMultiplier: 1.2,
    enabled: true,
    description: 'Checkout lanes - monitor for bypass and self-checkout fraud',
  },
  {
    id: 'high-theft-cosmetics',
    name: 'Cosmetics Aisle',
    type: 'high_theft',
    polygon: [
      { x: 0.0, y: 0.5 },
      { x: 0.3, y: 0.5 },
      { x: 0.3, y: 0.8 },
      { x: 0.0, y: 0.8 },
    ],
    color: '#F59E0B',  // Amber
    riskMultiplier: 1.8,  // High-value area
    enabled: true,
    description: 'High-value cosmetics and health products',
  },
  {
    id: 'high-theft-electronics',
    name: 'Electronics Section',
    type: 'high_theft',
    polygon: [
      { x: 0.7, y: 0.5 },
      { x: 1.0, y: 0.5 },
      { x: 1.0, y: 0.8 },
      { x: 0.7, y: 0.8 },
    ],
    color: '#F59E0B',  // Amber
    riskMultiplier: 2.0,  // Highest value
    enabled: true,
    description: 'Electronics, phone accessories, batteries',
  },
  {
    id: 'high-theft-alcohol',
    name: 'Wine & Spirits',
    type: 'high_theft',
    polygon: [
      { x: 0.35, y: 0.6 },
      { x: 0.65, y: 0.6 },
      { x: 0.65, y: 0.9 },
      { x: 0.35, y: 0.9 },
    ],
    color: '#F59E0B',  // Amber
    riskMultiplier: 1.7,
    enabled: true,
    description: 'Alcoholic beverages section',
  },
  {
    id: 'staff-only-backroom',
    name: 'Staff Backroom',
    type: 'staff_only',
    polygon: [
      { x: 0.0, y: 0.85 },
      { x: 0.25, y: 0.85 },
      { x: 0.25, y: 1.0 },
      { x: 0.0, y: 1.0 },
    ],
    color: '#8B5CF6',  // Purple
    riskMultiplier: 2.5,  // Restricted area
    enabled: true,
    description: 'Staff-only access - unauthorized entry is critical',
  },
]

// ============================================
// SAMPLE GROCERY CAMERA
// ============================================

export const SAMPLE_GROCERY_CAMERA: GroceryCamera = {
  id: 'grocery-cam-1',
  name: 'Main Floor Overview',
  storeId: 'store-1',
  location: 'Main sales floor, ceiling mounted',
  zones: SAMPLE_GROCERY_ZONES,
  enabled: true,
  resolution: {
    width: 1920,
    height: 1080,
  },
}

// ============================================
// SAMPLE STORE CONFIGURATION
// ============================================

export const SAMPLE_STORE_CONFIG: StoreConfig = {
  id: 'sample-grocery-1',
  name: 'Sample Grocery Store',
  address: '123 Main Street, City, State 12345',
  timezone: 'America/Los_Angeles',
  
  detectionMode: 'retail_theft',
  deploymentMode: 'cloud',
  
  cameras: [SAMPLE_GROCERY_CAMERA],
  
  thresholds: DEFAULT_THRESHOLDS,
  behaviorWeights: DEFAULT_BEHAVIOR_WEIGHTS,
  calibration: DEFAULT_CALIBRATION,
  
  privacy: DEFAULT_PRIVACY_SETTINGS,
  alertConfig: DEFAULT_ALERT_CONFIG,
  
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a new store config with defaults
 */
export function createStoreConfig(
  partial: Partial<StoreConfig> & { id: string; name: string }
): StoreConfig {
  return {
    ...SAMPLE_STORE_CONFIG,
    ...partial,
    cameras: partial.cameras || [],
    thresholds: partial.thresholds || DEFAULT_THRESHOLDS,
    behaviorWeights: partial.behaviorWeights || DEFAULT_BEHAVIOR_WEIGHTS,
    calibration: partial.calibration || DEFAULT_CALIBRATION,
    privacy: partial.privacy || DEFAULT_PRIVACY_SETTINGS,
    alertConfig: partial.alertConfig || DEFAULT_ALERT_CONFIG,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * Create a zone with defaults
 */
export function createZone(
  partial: Partial<Zone> & { id: string; name: string; type: Zone['type']; polygon: Zone['polygon'] }
): Zone {
  const defaultColors: Record<Zone['type'], string> = {
    entrance: '#3B82F6',
    exit: '#EF4444',
    checkout: '#22C55E',
    high_theft: '#F59E0B',
    staff_only: '#8B5CF6',
    general: '#6B7280',
  }
  
  const defaultMultipliers: Record<Zone['type'], number> = {
    entrance: 1.3,
    exit: 1.5,
    checkout: 1.2,
    high_theft: 1.8,
    staff_only: 2.5,
    general: 1.0,
  }
  
  return {
    color: defaultColors[partial.type],
    riskMultiplier: defaultMultipliers[partial.type],
    enabled: true,
    ...partial,
  }
}

/**
 * Merge user calibration with defaults
 */
export function mergeCalibration(
  userCalibration: Partial<StoreCalibration>
): StoreCalibration {
  return {
    ...DEFAULT_CALIBRATION,
    ...userCalibration,
    ignoredPatterns: [
      ...DEFAULT_CALIBRATION.ignoredPatterns,
      ...(userCalibration.ignoredPatterns || []),
    ],
    peakHours: userCalibration.peakHours || DEFAULT_CALIBRATION.peakHours,
  }
}
