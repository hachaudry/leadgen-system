export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lead, niche, city, revenueLoss, reportData } = req.body;
  if (!lead) return res.status(400).json({ error: 'lead data required' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const loss = revenueLoss || 3500;
  const reportContext = reportData ? `\nReport findings: ${JSON.stringify(reportData).slice(0, 800)}` : '';

  const prompt = `You are a world-class digital marketing sales consultant creating a premium pitch deck for a prospect.

Business: ${lead.name}
Type: ${niche}
City: ${city}
Rating: ${lead.rating || 'unknown'} stars (${lead.reviews || 0} reviews)
Website: ${lead.website || 'none — no website'}
Revenue Loss: $${loss.toLocaleString()}/month estimated${reportContext}

Create a comprehensive, structured sales pitch. Return ONLY valid JSON:
{
  "headline": "This business is losing an estimated $${loss.toLocaleString()}/month in digital revenue",
  "subheadline": "<1 sentence urgency statement>",
  "painPoints": [
    {"rank":1,"problem":"<specific biggest gap>","cost":"$<X,XXX>/mo","detail":"<1 sentence impact>"},
    {"rank":2,"problem":"<second gap>","cost":"$<X,XXX>/mo","detail":"<1 sentence impact>"},
    {"rank":3,"problem":"<third gap>","cost":"$<X,XXX>/mo","detail":"<1 sentence impact>"}
  ],
  "keyFindings": [
    "<finding 1 — specific and damning>",
    "<finding 2>",
    "<finding 3>",
    "<finding 4>"
  ],
  "industryScores": [
    {"name":"Local SEO","yours":<0-100>,"average":68},
    {"name":"Social Media","yours":<0-100>,"average":62},
    {"name":"Website","yours":<0-100>,"average":71},
    {"name":"Google Ads","yours":<0-100>,"average":55},
    {"name":"Reviews","yours":<0-100>,"average":74}
  ],
  "pricingTiers": [
    {"name":"Starter","price":"$799/mo","tagline":"Get found online","includes":["GMB Optimization","Review Generation","Monthly Report"]},
    {"name":"Growth","price":"$1,499/mo","tagline":"Dominate local search","includes":["Everything in Starter","Local SEO + Content","Social Media Management","Google Ads Setup"]},
    {"name":"Premium","price":"$2,499/mo","tagline":"Full market domination","includes":["Everything in Growth","Meta Ads Campaign","Website Redesign","Weekly Strategy Calls","Competitor Monitoring"]}
  ],
  "roi": {
    "currentState": "<specific problem description — e.g. losing $${loss.toLocaleString()}/mo, ranking page 3, 0 new leads from search>",
    "projectedState": "<what success looks like in 90 days — specific numbers>"
  },
  "timeline": [
    {"month":1,"milestone":"<specific deliverable and early win>"},
    {"month":2,"milestone":"<visible results — rankings, reviews, traffic>"},
    {"month":3,"milestone":"<measurable ROI — leads, calls, bookings>"}
  ],
  "nextSteps": [
    "Book a free 15-minute discovery call this week",
    "We send you a custom audit report within 24 hours",
    "You choose a plan and we start in 48 hours"
  ],
  "closingLine": "<1 strong closing sentence referencing the revenue loss and their top competitor advantage>"
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await resp.json();
    let raw = data.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const si = raw.indexOf('{'), ei = raw.lastIndexOf('}');
    let pitch = null;
    try { if (si !== -1) pitch = JSON.parse(raw.slice(si, ei + 1)); } catch {}
    if (!pitch) return res.status(500).json({ error: 'Failed to parse pitch response' });
    return res.status(200).json(pitch);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate pitch', detail: err.message });
  }
}
