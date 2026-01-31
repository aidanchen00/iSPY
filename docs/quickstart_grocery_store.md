# Quick Start Guide: Grocery Store Theft Detection

This guide will help you set up iSPY's retail theft detection system for your grocery store.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Setup](#quick-setup)
3. [Environment Configuration](#environment-configuration)
4. [Configuring Zones](#configuring-zones)
5. [Testing with Sample Video](#testing-with-sample-video)
6. [Using the Dashboard](#using-the-dashboard)
7. [Calibration Tips](#calibration-tips)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ installed
- OpenAI API key with GPT-4o access
- Modern web browser with webcam access (for live detection)
- Optional: Vapi AI account (for phone alerts)
- Optional: Resend account (for email alerts)

## Quick Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd iSPY

# Install dependencies
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Required: OpenAI API key for VLM analysis
OPENAI_API_KEY=sk-your-openai-api-key

# Optional: Email alerts via Resend
RESEND_API_KEY=your-resend-api-key

# Optional: Phone call alerts via Vapi
VAPI_API_KEY=your-vapi-api-key
VAPI_PHONE_NUMBER_ID=your-vapi-phone-number-id
```

### 3. Start the Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and navigate to **Retail Theft** in the sidebar.

---

## Environment Configuration

### Required Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `OPENAI_API_KEY` | API key for GPT-4o vision analysis | [OpenAI Platform](https://platform.openai.com/api-keys) |

### Optional Alert Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `RESEND_API_KEY` | Email notification service | [Resend](https://resend.com) |
| `VAPI_API_KEY` | Voice AI for phone alerts | [Vapi AI](https://vapi.ai) |
| `VAPI_PHONE_NUMBER_ID` | Your Vapi phone number ID | Vapi Dashboard |

---

## Configuring Zones

Zones define areas in your camera view with different risk levels. The system uses these to adjust suspicion scores.

### Zone Types

| Type | Description | Default Multiplier |
|------|-------------|-------------------|
| `entrance` | Store entry points | 1.3x |
| `exit` | Store exit points (critical for walkouts) | 1.5x |
| `checkout` | Register and self-checkout areas | 1.2x |
| `high_theft` | High-value merchandise areas | 1.8x |
| `staff_only` | Employee-only areas | 2.5x |
| `general` | Regular shopping floor | 1.0x |

### Creating a Zone Configuration

1. **Start with the sample config:**
   ```bash
   cp config/grocery-store-sample.json config/my-store.json
   ```

2. **Edit the zone polygons:**
   
   Zones are defined using normalized coordinates (0-1), where:
   - `x: 0` = left edge of frame
   - `x: 1` = right edge of frame
   - `y: 0` = top edge of frame
   - `y: 1` = bottom edge of frame

   Example zone (top-left quarter of frame):
   ```json
   {
     "id": "entrance-zone",
     "name": "Main Entrance",
     "type": "entrance",
     "polygon": [
       { "x": 0.0, "y": 0.0 },
       { "x": 0.5, "y": 0.0 },
       { "x": 0.5, "y": 0.5 },
       { "x": 0.0, "y": 0.5 }
     ],
     "color": "#3B82F6",
     "riskMultiplier": 1.3,
     "enabled": true
   }
   ```

3. **Pro Tip: Use an image editor**
   
   Open a screenshot of your camera view in an image editor. Note the pixel coordinates of zone corners, then divide by the image dimensions to get normalized coordinates.

### Recommended Zone Layout for Grocery Stores

```
+------------------+------------------+------------------+
|    ENTRANCE      |    CHECKOUT      |      EXIT        |
|   (entrance)     |   (checkout)     |     (exit)       |
|   Risk: 1.3x     |   Risk: 1.2x     |    Risk: 1.5x    |
+------------------+------------------+------------------+
|                                                        |
|              MAIN SHOPPING FLOOR                       |
|                  (general)                             |
|                                                        |
+------------------+------------------+------------------+
|   COSMETICS      |    ALCOHOL       |  ELECTRONICS     |
|  (high_theft)    |  (high_theft)    |  (high_theft)    |
|   Risk: 1.8x     |   Risk: 1.7x     |   Risk: 2.0x     |
+------------------+------------------+------------------+
|                  |
|   STAFF ONLY     |
|  (staff_only)    |
|   Risk: 2.5x     |
+------------------+
```

---

## Testing with Sample Video

### Using the Built-in Shoplifting Videos

The repository includes sample shoplifting videos in `public/videos/`:

- `Shoplifting0.mp4` - Jewelry store concealment
- `Shoplifting1.mp4` - Motorsports store theft
- `Shoplifting2.mp4` - Coordinated jewelry theft

### Testing with Your Own Video

1. **Upload a video:**
   - Go to **Upload** in the sidebar
   - Select a video file from your security camera
   - Click **Analyze** to run detection

2. **Use live stream with webcam:**
   - Go to **Live Stream** in the sidebar
   - Allow camera permissions
   - Click **Start Recording**
   - The system will analyze frames every 3 seconds

### Testing the API Directly

```bash
# Test the grocery detection API
curl -X POST http://localhost:3000/api/grocery/detect \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "data:image/jpeg;base64,...",
    "cameraId": "cam-test",
    "storeId": "store-test"
  }'
```

---

## Using the Dashboard

### Retail Theft Tab

Navigate to **Retail Theft** in the sidebar to access:

1. **Live Incidents Feed**
   - Filters by severity, zone, and time range
   - Real-time updates as events are detected
   - Color-coded by severity level

2. **Incident Details**
   - Click any incident to see full details
   - View suspicion score, behavior type, and reasoning
   - Access keyframes and evidence clips

3. **Operator Feedback**
   - Label incidents as True Positive, False Positive, or Uncertain
   - Helps improve system accuracy over time
   - View accuracy statistics and trends

### Alert Thresholds

| Threshold | Score Range | Action |
|-----------|-------------|--------|
| Log Only | 0-29 | Silent logging |
| Dashboard | 30-49 | Visible on dashboard |
| Alert | 50-74 | Notify security (if configured) |
| Critical | 75-100 | Immediate priority alert |

---

## Calibration Tips

### Reducing False Positives

1. **Adjust sensitivity:**
   - Go to your config file
   - Lower `sensitivityLevel` (default: 50)
   - Range: 0-100, lower = less sensitive

2. **Add ignore patterns for employees:**
   ```json
   {
     "id": "employee-vest",
     "name": "Store Employees",
     "type": "uniform",
     "description": "Ignore people wearing store uniforms",
     "enabled": true
   }
   ```

3. **Set active hours:**
   - Disable detection during restocking/cleaning
   - Configure in `calibration.activeHours`

### High-Value Areas

For electronics, cosmetics, and alcohol sections:

1. Set zone type to `high_theft`
2. Use higher `riskMultiplier` (1.5-2.0)
3. Consider adding additional camera coverage

### Peak Hours

Configure increased sensitivity during busy times:

```json
{
  "peakHours": [
    {
      "start": "17:00",
      "end": "19:00",
      "multiplier": 1.2
    }
  ]
}
```

---

## Troubleshooting

### "OpenAI API key not configured"

- Ensure `OPENAI_API_KEY` is set in `.env`
- Verify the key is valid and has GPT-4o access
- Restart the dev server after changing `.env`

### Low Detection Rate

- Check that zones are correctly configured
- Ensure camera provides clear view of the areas
- Try increasing `sensitivityLevel`
- Verify lighting conditions are adequate

### High False Positive Rate

- Review the feedback statistics in the dashboard
- Add ignore patterns for known staff
- Lower sensitivity in problematic zones
- Adjust behavior weights for frequently false-positive behaviors

### Phone/Email Alerts Not Sending

- Verify API keys are configured correctly
- Check that `enabled: true` in alert config
- Ensure `minSeverity` threshold is appropriate
- Check server logs for error messages

---

## API Reference

### Detection Endpoint

```
POST /api/grocery/detect
```

**Request Body:**
```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "cameraId": "cam-1",
  "storeId": "store-1",
  "zones": [...],
  "usePreFilter": false
}
```

**Response:**
```json
{
  "events": [
    {
      "id": "evt-123",
      "behaviorType": "concealment",
      "suspicionScore": 72,
      "severity": "medium",
      "description": "...",
      "reasoning": "..."
    }
  ],
  "analysisTimeMs": 1234,
  "frameAnalyzed": true
}
```

### Feedback Endpoint

```
POST /api/grocery/feedback
```

**Request Body:**
```json
{
  "eventId": "evt-123",
  "label": "true_positive",
  "notes": "Confirmed theft"
}
```

---

## Next Steps

1. **Configure your cameras** - Set up zone configurations for each camera
2. **Test with sample videos** - Verify detection is working correctly
3. **Set up alerts** - Configure email/phone notifications
4. **Train your team** - Show security staff how to use the dashboard
5. **Monitor and calibrate** - Use operator feedback to improve accuracy

For additional help, see the main [README.md](../README.md) or open an issue on GitHub.
