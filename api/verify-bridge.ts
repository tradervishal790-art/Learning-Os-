import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyBridgeConnection, type ConnectorFacts } from './_lib/bridgeVerify.js';

// ============================================================
// api/verify-bridge.ts
//
// POST body: { previous: ConnectorFacts, next: ConnectorFacts, fallbackConnectText: string }
//
// Both fact-lists are ALREADY on the client (see conceptVideoPool.ts's
// getCachedConnectorFacts()) — extracted for free as part of each video's
// original analyze-video.ts call. This endpoint does NOT fetch or send
// either video's transcript again; it only compares the two small
// fact-lists already sitting in the browser, in one minimal-token Gemini
// call. See api/_lib/bridgeVerify.ts for the full design rationale.
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !minimaxApiKey) {
    res.status(500).json({ error: 'No AI provider configured on server (VITE_GEMINI_API_KEY / MINIMAX_API_KEY both missing)' });
    return;
  }

  const body = (req.body ?? {}) as {
    previous?: ConnectorFacts;
    next?: ConnectorFacts;
    fallbackConnectText?: string;
  };

  if (!body.previous || !body.next || !body.fallbackConnectText) {
    res.status(400).json({ error: 'previous, next, and fallbackConnectText are all required' });
    return;
  }

  const result = await verifyBridgeConnection(body.previous, body.next, body.fallbackConnectText, apiKey, minimaxApiKey);
  res.status(200).json(result);
}
