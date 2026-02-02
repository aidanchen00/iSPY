/**
 * Seed Agent Conversations Database
 *
 * Populates the database with historical conversation data.
 * Run with: npx ts-node scripts/seed-agent-conversations.ts
 */

import Database from "better-sqlite3";
import path from "path";
import { mkdirSync } from "fs";

const DB_PATH = path.join(process.cwd(), "data", "agent_conversations.db");

mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    camera_id TEXT NOT NULL,
    location TEXT NOT NULL,
    started_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'analyzing',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    content TEXT NOT NULL,
    reply_to TEXT,
    confidence REAL,
    evidence_type TEXT,
    timestamp TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    is_suspicious INTEGER NOT NULL,
    confidence REAL NOT NULL,
    reasoning TEXT NOT NULL,
    evidence_points TEXT NOT NULL,
    false_positive_risks TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS conclusions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT UNIQUE NOT NULL,
    incident_id TEXT NOT NULL,
    final_verdict TEXT NOT NULL,
    combined_confidence REAL NOT NULL,
    summary TEXT NOT NULL,
    consensus_reached INTEGER NOT NULL,
    decided_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_analyses_conversation ON analyses(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_incident ON conversations(incident_id);
  CREATE INDEX IF NOT EXISTS idx_conclusions_verdict ON conclusions(final_verdict);
`);

interface Scenario {
  location: string;
  cameraId: string;
  audioAnalysis: {
    isSuspicious: boolean;
    confidence: number;
    reasoning: string;
    evidencePoints: string[];
    falsePositiveRisks: string[];
    recommendedAction: string;
  };
  visionAnalysis: {
    isSuspicious: boolean;
    confidence: number;
    reasoning: string;
    evidencePoints: string[];
    falsePositiveRisks: string[];
    recommendedAction: string;
  };
  messages: Array<{ agent: string; content: string }>;
  verdict: string;
  summary: string;
}

const scenarios: Scenario[] = [
  {
    location: "Produce Section - Aisle 3",
    cameraId: "cam-produce-01",
    audioAnalysis: {
      isSuspicious: true,
      confidence: 0.72,
      reasoning:
        "Detected whispered coordination between two individuals. Phrases included 'you block the camera' and 'I'll grab the expensive ones.'",
      evidencePoints: [
        "Whispered speech detected",
        "Coordination language ('you' and 'I'll')",
        "Reference to blocking camera",
      ],
      falsePositiveRisks: [
        "Could be innocent conversation about photography",
        "Accent may have affected transcription",
      ],
      recommendedAction: "alert",
    },
    visionAnalysis: {
      isSuspicious: true,
      confidence: 0.85,
      reasoning:
        "Two individuals positioned to obstruct camera view. One person holding reusable bag open while the other handles premium fruit display.",
      evidencePoints: [
        "Camera obstruction positioning",
        "Open bag near merchandise",
        "Premium display interaction",
        "No shopping cart present",
      ],
      falsePositiveRisks: [
        "May be legitimate shoppers using eco bags",
        "Store layout forces this positioning",
      ],
      recommendedAction: "alert",
    },
    messages: [
      {
        agent: "audio_agent",
        content:
          "Initial Analysis: I'm picking up coordinated whispered speech between two subjects. The phrase 'you block the camera' is concerning. Confidence: 72%.",
      },
      {
        agent: "vision_agent",
        content:
          "Initial Analysis: Visual confirms suspicious positioning. Subject A is positioned to obstruct cam-produce-01's field of view. Subject B has an open reusable bag near the organic fruit display. Confidence: 85%.",
      },
      {
        agent: "audio_agent",
        content:
          "Interesting that you mention the organic section. The audio reference to 'expensive ones' aligns with that. Did you observe any actual concealment behavior?",
      },
      {
        agent: "vision_agent",
        content:
          "Not yet definitive concealment. Subject B made three reaches toward display, but items may have been placed in bag. The bag's position blocks clear view. I'd rate concealment probability at 65%.",
      },
      {
        agent: "audio_agent",
        content:
          "The verbal planning combined with your positioning observations suggests coordinated activity. I agree with escalation to alert status.",
      },
      {
        agent: "vision_agent",
        content:
          "Consensus reached. Both audio and visual evidence point to organized retail theft preparation. Recommending immediate staff notification.",
      },
    ],
    verdict: "confirmed_threat",
    summary:
      "Coordinated theft attempt detected. Audio captured planning language; visual confirmed tactical positioning and potential concealment.",
  },
  {
    location: "Electronics - Display Wall",
    cameraId: "cam-electronics-02",
    audioAnalysis: {
      isSuspicious: false,
      confidence: 0.25,
      reasoning:
        "Normal customer conversation about product features. Discussion of prices and comparisons with online retailers.",
      evidencePoints: [
        "Price comparison discussion",
        "Technical specifications mentioned",
      ],
      falsePositiveRisks: ["Could mistake enthusiasm for nervousness"],
      recommendedAction: "dismiss",
    },
    visionAnalysis: {
      isSuspicious: true,
      confidence: 0.58,
      reasoning:
        "Extended handling of security-tagged items. Subject spent 4+ minutes with same headphone display, checking multiple angles.",
      evidencePoints: [
        "Extended item handling (4+ min)",
        "Multiple angle examination",
        "Security tag inspection movements",
      ],
      falsePositiveRisks: [
        "High-consideration purchase behavior",
        "Audiophile examining build quality",
      ],
      recommendedAction: "monitor",
    },
    messages: [
      {
        agent: "audio_agent",
        content:
          "Initial Analysis: I'm hearing standard retail conversation. Subject discussing frequency response and comparing to models they researched online. Confidence in threat: 25%.",
      },
      {
        agent: "vision_agent",
        content:
          "Initial Analysis: Extended handling duration is flagged by my metrics. Subject has been examining the same $299 headphones for 4 minutes with what appears to be security tag inspection. Confidence: 58%.",
      },
      {
        agent: "audio_agent",
        content:
          "The audio context explains the visual. They're discussing impedance and driver size - this is an informed consumer, not a thief. The 'tag inspection' you're seeing is likely checking the connectivity ports.",
      },
      {
        agent: "vision_agent",
        content:
          "I can recalibrate based on your audio context. The handling pattern does match informed consumer behavior when I factor in the technical discussion. Reducing my suspicion score to 28%.",
      },
      {
        agent: "audio_agent",
        content:
          "Agreed. This appears to be a legitimate high-consideration purchase evaluation. No coordinated activity, no stress indicators in voice.",
      },
      {
        agent: "vision_agent",
        content:
          "Consensus: False positive. Behavior consistent with audiophile consumer research. No further monitoring recommended.",
      },
    ],
    verdict: "false_positive",
    summary:
      "Initial visual suspicion was explained by audio context. Subject is an informed consumer evaluating premium audio equipment. No theft indicators.",
  },
  {
    location: "Self-Checkout Area",
    cameraId: "cam-sco-03",
    audioAnalysis: {
      isSuspicious: true,
      confidence: 0.45,
      reasoning:
        "Detected frustration in voice, several muttered complaints about 'stupid machine.' Also heard 'just scan the cheap one' which could be innocent or indicate pass-around.",
      evidencePoints: [
        "Frustration indicators",
        "'Scan the cheap one' phrase",
        "Muttered complaints",
      ],
      falsePositiveRisks: [
        "Common self-checkout frustration",
        "May refer to coupon or loyalty discount",
      ],
      recommendedAction: "monitor",
    },
    visionAnalysis: {
      isSuspicious: true,
      confidence: 0.67,
      reasoning:
        "Subject scanned 12 items but bagging area weight suggests 15-17 items. Three pass-arounds observed - items moved from cart to bag without clear scanning motion.",
      evidencePoints: [
        "Weight discrepancy (12 scanned vs 15-17 bagged)",
        "Three unscanned item movements",
        "Cart-to-bag transfers without scanner interaction",
      ],
      falsePositiveRisks: [
        "Scale calibration issues",
        "Lightweight items may not register",
        "Subject may have rescanned items",
      ],
      recommendedAction: "alert",
    },
    messages: [
      {
        agent: "audio_agent",
        content:
          "Initial Analysis: Subject is clearly frustrated with the self-checkout. I heard 'scan the cheap one' but context is unclear - could be about price matching or could be pass-around intent. Confidence: 45%.",
      },
      {
        agent: "vision_agent",
        content:
          "Initial Analysis: My count shows definite discrepancy. 12 clear scanning motions observed, but weight and volume in bags suggests 15-17 items. I flagged three specific transfers that bypassed the scanner. Confidence: 67%.",
      },
      {
        agent: "audio_agent",
        content:
          "The 'cheap one' comment concerns me more now. Can you identify what items were potentially passed around?",
      },
      {
        agent: "vision_agent",
        content:
          "Two appeared to be produce items - possibly switching expensive organic for conventional. Third was a small boxed item, possibly electronics or health & beauty.",
      },
      {
        agent: "audio_agent",
        content:
          "That aligns with the switching behavior. The frustration could be performance anxiety. I'm raising my confidence to 55%. Recommend staff intervention under guise of assistance.",
      },
      {
        agent: "vision_agent",
        content:
          "Agreed. Soft intervention recommended. If innocent, appears as helpful customer service. If guilty, may prevent loss without confrontation.",
      },
    ],
    verdict: "confirmed_threat",
    summary:
      "Self-checkout fraud detected through weight discrepancy and observed pass-arounds. Audio captured potential switching reference. Staff intervention recommended.",
  },
  {
    location: "Pharmacy - OTC Medicines",
    cameraId: "cam-pharmacy-01",
    audioAnalysis: {
      isSuspicious: false,
      confidence: 0.15,
      reasoning:
        "Subject on phone discussing symptoms with what appears to be family member. Asking about dosage recommendations and alternatives.",
      evidencePoints: [
        "Medical symptom discussion",
        "Family consultation evident",
        "Dosage questions",
      ],
      falsePositiveRisks: [
        "Personal health discussion unrelated to theft",
      ],
      recommendedAction: "dismiss",
    },
    visionAnalysis: {
      isSuspicious: false,
      confidence: 0.22,
      reasoning:
        "Subject examining multiple medicine packages but placing back on shelf. Reading labels carefully. Picked up basket at entrance.",
      evidencePoints: [
        "Multiple package examination",
        "Label reading behavior",
        "Has shopping basket",
      ],
      falsePositiveRisks: [
        "Careful consumer making informed purchase",
      ],
      recommendedAction: "dismiss",
    },
    messages: [
      {
        agent: "audio_agent",
        content:
          "Initial Analysis: Clear phone conversation about cold symptoms and medication options. Subject asking 'should I get the regular or extra strength?' - typical consumer behavior. Confidence: 15%.",
      },
      {
        agent: "vision_agent",
        content:
          "Initial Analysis: Subject handling multiple packages but all returns to shelf or basket. Classic comparison shopping pattern. Has legitimate shopping basket. Confidence: 22%.",
      },
      {
        agent: "audio_agent",
        content:
          "No concerning audio patterns. The phone conversation provides context for the extended time in the aisle.",
      },
      {
        agent: "vision_agent",
        content:
          "Agreed. Visual behavior fully consistent with informed consumer comparison. No concealment attempts observed. Recommend clearing this incident.",
      },
    ],
    verdict: "false_positive",
    summary:
      "Normal consumer comparison shopping in pharmacy section. Phone call confirms legitimate medical consultation. No suspicious behavior detected.",
  },
  {
    location: "Clothing - Fitting Room Entrance",
    cameraId: "cam-fitting-01",
    audioAnalysis: {
      isSuspicious: true,
      confidence: 0.68,
      reasoning:
        "Overheard exchange: 'How many can we bring in?' followed by 'They only check on the way out.' Indicative of potential fitting room fraud planning.",
      evidencePoints: [
        "Quantity discussion",
        "Reference to exit checking",
        "Planning language detected",
      ],
      falsePositiveRisks: [
        "Could be discussing store policy legitimately",
        "May be planning multiple outfit tries",
      ],
      recommendedAction: "alert",
    },
    visionAnalysis: {
      isSuspicious: true,
      confidence: 0.74,
      reasoning:
        "Two subjects entering with 8+ garments each, exceeding typical 6-item limit. Large shopping bags brought from outside store visible. No tags visible on some items being carried.",
      evidencePoints: [
        "Exceeded item limit (8+ per person)",
        "External bags present",
        "Tag visibility concerns on some items",
        "Coordinated entry",
      ],
      falsePositiveRisks: [
        "Attendant may have allowed extra items",
        "Bags could be for personal belongings",
      ],
      recommendedAction: "alert",
    },
    messages: [
      {
        agent: "audio_agent",
        content:
          "Initial Analysis: Captured concerning dialogue about checking procedures. The phrasing 'they only check on the way out' suggests awareness of loss prevention methods. Confidence: 68%.",
      },
      {
        agent: "vision_agent",
        content:
          "Initial Analysis: Visual supports audio findings. Both subjects carrying excessive items and have external bags. Some items appear to have no visible tags - possible indicator of previous concealment or tag removal. Confidence: 74%.",
      },
      {
        agent: "audio_agent",
        content:
          "The combination of their conversation and your visual observations is compelling. Did you track them from entry?",
      },
      {
        agent: "vision_agent",
        content:
          "Partial tracking available. They separated at entrance, collected items independently, then reunited at fitting rooms. This pattern is consistent with organized retail theft methodology.",
      },
      {
        agent: "audio_agent",
        content:
          "Classic split-and-converge technique. With the verbal evidence of policy awareness and visual confirmation of suspicious patterns, I recommend immediate fitting room attendant notification.",
      },
      {
        agent: "vision_agent",
        content:
          "Agreed. High confidence in organized theft attempt. Recommend count verification upon exit and potential bag inspection if store policy allows.",
      },
    ],
    verdict: "confirmed_threat",
    summary:
      "Organized retail theft attempt at fitting rooms. Audio captured planning dialogue; visual confirmed excessive items, external bags, and coordinated behavior patterns.",
  },
  {
    location: "Wine & Spirits",
    cameraId: "cam-spirits-01",
    audioAnalysis: {
      isSuspicious: false,
      confidence: 0.31,
      reasoning:
        "Group discussing wine selections for upcoming dinner party. Mentions of food pairings and budget constraints. Normal social shopping conversation.",
      evidencePoints: [
        "Social event planning discussion",
        "Food pairing mentions",
        "Budget discussion",
      ],
      falsePositiveRisks: [
        "Extended time in section due to decision making",
      ],
      recommendedAction: "dismiss",
    },
    visionAnalysis: {
      isSuspicious: true,
      confidence: 0.52,
      reasoning:
        "One member of group positioned blocking camera angle while others browse. High-value bottles being handled repeatedly without placement in cart.",
      evidencePoints: [
        "Camera angle obstruction",
        "Repeated handling without purchase intent",
        "High-value item focus",
      ],
      falsePositiveRisks: [
        "Group shopping dynamics naturally create camera blocks",
        "Wine selection often requires handling multiple bottles",
      ],
      recommendedAction: "monitor",
    },
    messages: [
      {
        agent: "audio_agent",
        content:
          "Initial Analysis: This appears to be friends planning a dinner party. I'm hearing genuine discussion about whether to serve red or white with the main course. No suspicious patterns. Confidence: 31%.",
      },
      {
        agent: "vision_agent",
        content:
          "Initial Analysis: Visual shows some concerning patterns - camera blocking and high-value focus. However, group shopping in wine sections often creates these patterns organically. Confidence: 52%.",
      },
      {
        agent: "audio_agent",
        content:
          "The audio provides strong context here. They're debating a $40 vs $60 bottle - not concealment prices. Can you confirm if anyone has bags or oversized clothing?",
      },
      {
        agent: "vision_agent",
        content:
          "Negative on concealment indicators. All subjects in normal attire, no oversized jackets or bags. One has a shopping cart with other groceries already. Revising my assessment downward.",
      },
      {
        agent: "audio_agent",
        content:
          "Combined with the legitimate social discussion, I believe this is a false positive. The visual patterns are explained by normal group shopping behavior.",
      },
      {
        agent: "vision_agent",
        content:
          "I concur. Reclassifying as normal consumer behavior. No further action required.",
      },
    ],
    verdict: "false_positive",
    summary:
      "Initial visual concerns explained by audio context. Group is legitimately shopping for dinner party. Camera blocking was incidental to group dynamics, not intentional.",
  },
];

function seedDatabase() {
  console.log("Seeding agent conversations database...\n");

  const insertConversation = db.prepare(`
    INSERT OR REPLACE INTO conversations (id, incident_id, camera_id, location, started_at, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMessage = db.prepare(`
    INSERT INTO messages (id, conversation_id, agent_id, content, reply_to, confidence, evidence_type, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAnalysis = db.prepare(`
    INSERT INTO analyses (conversation_id, agent_id, is_suspicious, confidence, reasoning, evidence_points, false_positive_risks, recommended_action)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertConclusion = db.prepare(`
    INSERT INTO conclusions (conversation_id, incident_id, final_verdict, combined_confidence, summary, consensus_reached, decided_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const baseTime = new Date();
    baseTime.setHours(baseTime.getHours() - (scenarios.length - i) * 3);
    baseTime.setMinutes(Math.floor(Math.random() * 60));

    const conversationId = `conv-${baseTime.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    const incidentId = `inc-${baseTime.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

    insertConversation.run(
      conversationId,
      incidentId,
      scenario.cameraId,
      scenario.location,
      baseTime.toISOString(),
      "concluded"
    );

    scenario.messages.forEach((msg, idx) => {
      const msgTime = new Date(baseTime.getTime() + idx * 18000);
      const msgId = `msg-${msgTime.getTime()}-${msg.agent.split("_")[0]}`;
      const replyTo = idx > 0 ? `msg-${new Date(baseTime.getTime() + (idx - 1) * 18000).getTime()}-${scenario.messages[idx - 1].agent.split("_")[0]}` : null;
      const confidence =
        msg.agent === "audio_agent"
          ? scenario.audioAnalysis.confidence
          : scenario.visionAnalysis.confidence;
      const evidenceType = msg.agent === "audio_agent" ? "audio" : "visual";

      insertMessage.run(
        msgId,
        conversationId,
        msg.agent,
        msg.content,
        replyTo,
        confidence,
        evidenceType,
        msgTime.toISOString()
      );
    });

    insertAnalysis.run(
      conversationId,
      "audio_agent",
      scenario.audioAnalysis.isSuspicious ? 1 : 0,
      scenario.audioAnalysis.confidence,
      scenario.audioAnalysis.reasoning,
      JSON.stringify(scenario.audioAnalysis.evidencePoints),
      JSON.stringify(scenario.audioAnalysis.falsePositiveRisks),
      scenario.audioAnalysis.recommendedAction
    );

    insertAnalysis.run(
      conversationId,
      "vision_agent",
      scenario.visionAnalysis.isSuspicious ? 1 : 0,
      scenario.visionAnalysis.confidence,
      scenario.visionAnalysis.reasoning,
      JSON.stringify(scenario.visionAnalysis.evidencePoints),
      JSON.stringify(scenario.visionAnalysis.falsePositiveRisks),
      scenario.visionAnalysis.recommendedAction
    );

    const combinedConfidence =
      (scenario.audioAnalysis.confidence + scenario.visionAnalysis.confidence) /
      2;
    const consensusReached =
      scenario.audioAnalysis.isSuspicious === scenario.visionAnalysis.isSuspicious
        ? 1
        : 0;
    const decidedAt = new Date(
      baseTime.getTime() + scenario.messages.length * 18000
    );

    insertConclusion.run(
      conversationId,
      incidentId,
      scenario.verdict,
      combinedConfidence,
      scenario.summary,
      consensusReached,
      decidedAt.toISOString()
    );

    console.log(
      `  [${scenario.verdict.toUpperCase()}] ${scenario.location} (${scenario.cameraId})`
    );
  }

  const stats = {
    total: (
      db.prepare("SELECT COUNT(*) as c FROM conversations").get() as any
    ).c,
    threats: (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM conclusions WHERE final_verdict = 'confirmed_threat'"
        )
        .get() as any
    ).c,
    falsePositives: (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM conclusions WHERE final_verdict = 'false_positive'"
        )
        .get() as any
    ).c,
    messages: (db.prepare("SELECT COUNT(*) as c FROM messages").get() as any).c,
  };

  console.log("\nDatabase Statistics:");
  console.log(`  Total Conversations: ${stats.total}`);
  console.log(`  Confirmed Threats: ${stats.threats}`);
  console.log(`  False Positives: ${stats.falsePositives}`);
  console.log(`  Total Messages: ${stats.messages}`);

  db.close();
  console.log("\nDatabase seeded successfully!");
  console.log(`Location: ${DB_PATH}`);
}

seedDatabase();
