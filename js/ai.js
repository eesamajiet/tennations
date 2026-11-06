import { GEMINI_API_KEY, GEMINI_MODEL } from './config.js';
export class Commentator {
  static last = 0;
  static fallback(g, b) {
    const A = g.nm(b.from), D = g.nm(b.to);
    if (b.outcome === 'conquered') return `${A} storms ${D}! The flag changes hands.`;
    if (b.outcome === 'failed') return `${A} runs out of steam against ${D}.`;
    return `${A} rolls ${b.A.join(',')} into ${D}'s ${b.B.join(',')}. ${b.dLoss > b.aLoss ? 'Advantage attacker.' : b.dLoss < b.aLoss ? 'The defenders hold firm.' : 'Honours even.'}`;
  }
  static async say(g, b) {
    const fb = Commentator.fallback(g, b);
    if (GEMINI_API_KEY.startsWith('YOUR') || Date.now() - Commentator.last < 3500) return fb; // stay inside free-tier rate limits
    Commentator.last = Date.now();
    const prompt = `You are a lively war-game commentator. In ONE or TWO short sentences, narrate this battle. Attacker ${g.nm(b.from)} dice ${b.A}; defender ${g.nm(b.to)} dice ${b.B}; attacker lost ${b.aLoss}, defender lost ${b.dLoss}; outcome: ${b.outcome}.`;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 300 } }) });
      const j = await r.json();
      return j.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim() || fb;
    } catch { return fb; }
  }
}
