/**
 * Theft Detection System — Unified API
 *
 * This module consolidates three detection subsystems:
 *
 * 1. ZONES (lib/grocery/)
 *    Zone-based theft detection using visual analysis.
 *    Detects suspicious behavior in defined store zones.
 *
 * 2. TRACKING (lib/grocery-shoplift/)
 *    Person tracking and concealment detection.
 *    Tracks individuals and detects concealment of items.
 *
 * 3. ALERTS (lib/shoplift-alerts/)
 *    Alert system with TTS voice announcements.
 *    Handles alert gating, incident logging, and audio playback.
 *
 * Usage:
 *   // Import everything from a subsystem:
 *   import * as Zones from '@/lib/theft-detection/zones'
 *   import * as Tracking from '@/lib/theft-detection/tracking'
 *   import * as Alerts from '@/lib/theft-detection/alerts'
 *
 *   // Or import specific items:
 *   import { detectGroceryTheft } from '@/lib/theft-detection'
 */

// ============================================================================
// ZONES - Zone-based detection (lib/grocery/)
// ============================================================================
export * from "../grocery";

// ============================================================================
// TRACKING - Person tracking & concealment (lib/grocery-shoplift/)
// Namespaced to avoid conflicts with zone exports
// ============================================================================
import * as Tracking from "../grocery-shoplift";
export { Tracking };

// ============================================================================
// ALERTS - Alert system with TTS (lib/shoplift-alerts/)
// Namespaced to avoid conflicts
// ============================================================================
import * as Alerts from "../shoplift-alerts";
export { Alerts };
