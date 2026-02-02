/**
 * Run Store Optimizer
 *
 * Analyzes incident data and updates store configuration.
 * Run with: npx ts-node scripts/run-store-optimizer.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import Database from "better-sqlite3";

const DB_PATH = path.join(process.cwd(), "data", "agent_conversations.db");
const CONFIG_PATH = path.join(process.cwd(), "data", "store-configuration.md");

interface IncidentSummary {
  location: string;
  cameraId: string;
  verdict: string;
  confidence: number;
  audioFindings: string[];
  visualFindings: string[];
  timestamp: Date;
}

interface ZoneAnalysis {
  zoneId: string;
  zoneName: string;
  incidentCount: number;
  confirmedThreats: number;
  falsePositives: number;
  commonPatterns: string[];
  riskScore: number;
}

interface StoreRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  location: string;
  recommendation: string;
  rationale: string;
  estimatedImpact: string;
}

function gatherIncidentData(db: Database.Database): IncidentSummary[] {
  const conversations = db
    .prepare(
      "SELECT * FROM conversations ORDER BY started_at DESC LIMIT 100"
    )
    .all() as any[];

  const incidents: IncidentSummary[] = [];

  for (const conv of conversations) {
    const conclusion = db
      .prepare("SELECT * FROM conclusions WHERE conversation_id = ?")
      .get(conv.id) as any;
    if (!conclusion) continue;

    const analyses = db
      .prepare("SELECT * FROM analyses WHERE conversation_id = ?")
      .all(conv.id) as any[];

    const audioAnalysis = analyses.find((a) => a.agent_id === "audio_agent");
    const visionAnalysis = analyses.find((a) => a.agent_id === "vision_agent");

    incidents.push({
      location: conv.location,
      cameraId: conv.camera_id,
      verdict: conclusion.final_verdict,
      confidence: conclusion.combined_confidence,
      audioFindings: audioAnalysis
        ? JSON.parse(audioAnalysis.evidence_points)
        : [],
      visualFindings: visionAnalysis
        ? JSON.parse(visionAnalysis.evidence_points)
        : [],
      timestamp: new Date(conv.started_at),
    });
  }

  return incidents;
}

function analyzeByZone(incidents: IncidentSummary[]): ZoneAnalysis[] {
  const zoneMap = new Map<string, IncidentSummary[]>();

  for (const incident of incidents) {
    const zone = incident.location.split(" - ")[0] || incident.location;
    if (!zoneMap.has(zone)) {
      zoneMap.set(zone, []);
    }
    zoneMap.get(zone)!.push(incident);
  }

  const analyses: ZoneAnalysis[] = [];

  for (const [zoneName, zoneIncidents] of zoneMap) {
    const confirmedThreats = zoneIncidents.filter(
      (i) => i.verdict === "confirmed_threat"
    ).length;
    const falsePositives = zoneIncidents.filter(
      (i) => i.verdict === "false_positive"
    ).length;

    const allFindings = [
      ...zoneIncidents.flatMap((i) => i.audioFindings),
      ...zoneIncidents.flatMap((i) => i.visualFindings),
    ];
    const patternCounts = new Map<string, number>();
    for (const finding of allFindings) {
      const normalized = finding.toLowerCase();
      patternCounts.set(normalized, (patternCounts.get(normalized) || 0) + 1);
    }
    const commonPatterns = [...patternCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);

    const confidences = zoneIncidents.map((i) => i.confidence);
    const threatRatio =
      zoneIncidents.length > 0 ? confirmedThreats / zoneIncidents.length : 0;
    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0.5;
    const riskScore = threatRatio * 0.6 + avgConfidence * 0.4;

    analyses.push({
      zoneId: `zone-${zoneName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      zoneName,
      incidentCount: zoneIncidents.length,
      confirmedThreats,
      falsePositives,
      commonPatterns,
      riskScore,
    });
  }

  return analyses.sort((a, b) => b.riskScore - a.riskScore);
}

function generateRecommendations(
  zoneAnalysis: ZoneAnalysis[]
): StoreRecommendation[] {
  const recommendations: StoreRecommendation[] = [];

  for (const zone of zoneAnalysis) {
    if (zone.riskScore >= 0.6) {
      recommendations.push({
        priority: "critical",
        category: "camera",
        location: zone.zoneName,
        recommendation: `Add additional camera coverage to ${zone.zoneName} with overlapping fields of view`,
        rationale: `High risk score (${(zone.riskScore * 100).toFixed(0)}%) with ${zone.confirmedThreats} confirmed incidents out of ${zone.incidentCount} total`,
        estimatedImpact: "30-40% reduction in successful theft attempts",
      });

      recommendations.push({
        priority: "high",
        category: "staffing",
        location: zone.zoneName,
        recommendation: `Increase dedicated staff presence in ${zone.zoneName} during peak hours (3pm-7pm)`,
        rationale: `${zone.confirmedThreats} confirmed theft incidents indicate need for visible deterrence`,
        estimatedImpact: "Improved deterrence and 50% faster response time",
      });
    }

    if (zone.riskScore >= 0.4 && zone.riskScore < 0.6) {
      recommendations.push({
        priority: "medium",
        category: "signage",
        location: zone.zoneName,
        recommendation: `Install visible loss prevention signage and mirrors in ${zone.zoneName}`,
        rationale: `Moderate risk (${(zone.riskScore * 100).toFixed(0)}%) suggests deterrence approach before escalating to staffing`,
        estimatedImpact: "15-20% reduction through psychological deterrence",
      });
    }

    if (
      zone.commonPatterns.some(
        (p) => p.includes("camera") && p.includes("obstruction")
      )
    ) {
      recommendations.push({
        priority: "high",
        category: "layout",
        location: zone.zoneName,
        recommendation: `Reconfigure product displays in ${zone.zoneName} to eliminate camera blind spots`,
        rationale:
          "Incident analysis detected deliberate camera obstruction patterns",
        estimatedImpact: "Eliminate concealment opportunities in blind spots",
      });
    }

    if (zone.commonPatterns.some((p) => p.includes("coordination"))) {
      recommendations.push({
        priority: "high",
        category: "training",
        location: zone.zoneName,
        recommendation: `Conduct staff training on recognizing coordinated theft patterns in ${zone.zoneName}`,
        rationale:
          "Multiple incidents show organized retail theft with accomplice coordination",
        estimatedImpact: "Improved early detection of organized theft teams",
      });
    }
  }

  // Add general recommendations based on patterns
  const hasExcessiveItems = zoneAnalysis.some((z) =>
    z.commonPatterns.some((p) => p.includes("exceeded item limit"))
  );
  if (hasExcessiveItems) {
    recommendations.push({
      priority: "medium",
      category: "technology",
      location: "Fitting Rooms",
      recommendation:
        "Implement automated item counting system at fitting room entrance",
      rationale: "Incidents show item limit violations as common theft tactic",
      estimatedImpact: "Automated enforcement of item limits",
    });
  }

  const hasScoFraud = zoneAnalysis.some(
    (z) =>
      z.zoneName.toLowerCase().includes("checkout") &&
      z.confirmedThreats > 0
  );
  if (hasScoFraud) {
    recommendations.push({
      priority: "critical",
      category: "technology",
      location: "Self-Checkout Area",
      recommendation:
        "Upgrade to AI-assisted self-checkout monitoring with weight verification alerts",
      rationale:
        "Self-checkout fraud detected through weight discrepancy patterns",
      estimatedImpact: "Real-time alert for pass-around and scan avoidance",
    });
  }

  return recommendations.slice(0, 10);
}

function updateConfigFile(
  incidents: IncidentSummary[],
  zoneAnalysis: ZoneAnalysis[],
  recommendations: StoreRecommendation[]
): void {
  const currentConfig = readFileSync(CONFIG_PATH, "utf-8");
  const now = new Date();

  const confirmedThreats = incidents.filter(
    (i) => i.verdict === "confirmed_threat"
  ).length;
  const highRiskZones = zoneAnalysis.filter((z) => z.riskScore >= 0.6);
  const criticalRecs = recommendations.filter(
    (r) => r.priority === "critical"
  ).length;

  const summary = `Analysis of ${incidents.length} incidents identified ${confirmedThreats} confirmed threats across ${zoneAnalysis.length} zones. ${highRiskZones.length} zone(s) rated high-risk requiring immediate attention. ${criticalRecs} critical and ${recommendations.filter((r) => r.priority === "high").length} high-priority recommendations generated.`;

  const zoneTable = `| Zone | Incidents | Confirmed | False Pos | Risk Score |
|------|-----------|-----------|-----------|------------|
${zoneAnalysis.map((z) => `| ${z.zoneName} | ${z.incidentCount} | ${z.confirmedThreats} | ${z.falsePositives} | ${(z.riskScore * 100).toFixed(0)}% |`).join("\n")}`;

  const recsMarkdown = recommendations
    .map(
      (r, i) =>
        `### ${i + 1}. [${r.priority.toUpperCase()}] ${r.recommendation}
- **Category:** ${r.category}
- **Location:** ${r.location}
- **Rationale:** ${r.rationale}
- **Expected Impact:** ${r.estimatedImpact}
`
    )
    .join("\n");

  const timestamps = incidents.map((i) => i.timestamp.getTime());
  const startDate = new Date(Math.min(...timestamps))
    .toISOString()
    .split("T")[0];
  const endDate = new Date(Math.max(...timestamps)).toISOString().split("T")[0];

  const confidenceScore =
    incidents.length < 5
      ? 30
      : incidents.length < 10
        ? 50
        : incidents.length < 20
          ? 70
          : 85;

  let updatedConfig = currentConfig.replace(
    /## Recommendations History[\s\S]*?(?=---\s*\n\s*## Analysis Metadata|$)/,
    `## Recommendations History

### Analysis Report - ${now.toISOString().split("T")[0]}

${summary}

---

## Zone Risk Assessment

${zoneTable}

---

## Recommended Actions

${recsMarkdown}

---

`
  );

  updatedConfig = updatedConfig.replace(
    /## Analysis Metadata[\s\S]*$/,
    `## Analysis Metadata
- **Last Analysis:** ${now.toISOString()}
- **Incidents Analyzed:** ${incidents.length}
- **Confidence Score:** ${confidenceScore}%
- **Time Range:** ${startDate} to ${endDate}
`
  );

  writeFileSync(CONFIG_PATH, updatedConfig);
}

function main() {
  console.log("Running Store Configuration Optimizer...\n");

  const db = new Database(DB_PATH);

  try {
    const incidents = gatherIncidentData(db);
    console.log(`Gathered ${incidents.length} incidents from database`);

    if (incidents.length === 0) {
      console.log("No incidents to analyze. Run seed script first.");
      return;
    }

    const zoneAnalysis = analyzeByZone(incidents);
    console.log(`Analyzed ${zoneAnalysis.length} zones`);

    for (const zone of zoneAnalysis) {
      console.log(
        `  - ${zone.zoneName}: ${zone.incidentCount} incidents, ${(zone.riskScore * 100).toFixed(0)}% risk`
      );
    }

    const recommendations = generateRecommendations(zoneAnalysis);
    console.log(`\nGenerated ${recommendations.length} recommendations:`);

    for (const rec of recommendations) {
      console.log(`  [${rec.priority.toUpperCase()}] ${rec.location}: ${rec.recommendation.slice(0, 60)}...`);
    }

    updateConfigFile(incidents, zoneAnalysis, recommendations);
    console.log(`\nConfiguration file updated: ${CONFIG_PATH}`);
  } finally {
    db.close();
  }
}

main();
