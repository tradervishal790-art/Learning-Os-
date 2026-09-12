// api/_lib/bridgeVerify.ts
//
// Verifies that a Roadmap "bridge" (see types.ts TopicBridge) is actually
// backed by the two videos' real content — WITHOUT ever re-sending either
// video's transcript.
//
// MINIMUM-TOKEN DESIGN: the "connector facts" (3-6 short factual anchors
// per video) are piggybacked onto the SAME Gemini call analyze-video.ts
// already makes for teaching-style scoring — see DIMENSION_PROMPT in
// teachingStyle.ts's `connector_facts` field. That means both videos'
// facts are already sitting in the client-side analysis cache
// (conceptVideoPool.ts's getCachedConnectorFacts()) by the time a bridge
// needs checking — zero extra API calls, zero extra transcript tokens.
//
// The ONLY new call this file makes is comparing two SMALL fact-lists
// (a few short phrases each) — not transcripts — to judge whether the
// next video really builds on the previous one.

import { generateAIText } from './aiFallback.js';

export interface ConnectorFacts {
  topicTitle: string;
  facts: string[];
}

export interface BridgeVerification {
  connected: boolean;
  /** Only meaningful when connected === true — caller uses this INSTEAD
   *  OF the pre-written connectText when verified. */
  verifiedConnectText: string | null;
  reasoning: string;
}

/** Tiny call: compares two already-extracted fact-lists, never transcripts. */
export async function verifyBridgeConnection(
  previous: ConnectorFacts,
  next: ConnectorFacts,
  fallbackConnectText: string,
  apiKey: string | undefined,
  minimaxApiKey: string | undefined
): Promise<BridgeVerification> {
  const prompt = `
Pichhle topic "${previous.topicTitle}" ke facts:
${previous.facts.map((f) => `- ${f}`).join('\n')}

Agle topic "${next.topicTitle}" ke facts:
${next.facts.map((f) => `- ${f}`).join('\n')}

Sawaal: kya agla topic sach mein pichhle topic ke content par build karta hai?

Sirf JSON return karo, koi extra text nahi:
{"connected": true/false, "connect_text": "1 line on how they connect if connected, else null", "reasoning": "1 line"}
`.trim();

  try {
    const { text: rawText } = await generateAIText({
      geminiApiKey: apiKey,
      minimaxApiKey,
      contents: [{ parts: [{ text: prompt }] }],
      minimaxJsonMode: true,
      keyGroup: 'notes',
    });

    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as { connected?: boolean; connect_text?: string | null; reasoning?: string };

    return {
      connected: !!parsed.connected,
      verifiedConnectText: parsed.connected ? (parsed.connect_text ?? fallbackConnectText) : null,
      reasoning: parsed.reasoning ?? '',
    };
  } catch {
    return { connected: false, verifiedConnectText: null, reasoning: 'verification-call-failed' };
  }
}
