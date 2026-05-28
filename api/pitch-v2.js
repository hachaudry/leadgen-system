export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lead, niche, city, revenueLoss, reportData, nextBestStep, mode } = req.body;

  // ── VIDEO PITCH mode (routed from /api/video-pitch) ───────────────────────
  if (mode === 'video' || nextBestStep !== undefined) {
    if (!lead) return res.status(400).json({ error: 'lead data required' });
    const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });
    const loss = revenueLoss || 3500;
    const nbs  = nextBestStep || 'Book a free 15-minute call this week';
    const vpPrompt = `You are a professional video sales script writer for a digital marketing agency.

Business: ${lead.name}
Type: ${niche}
City: ${city}
Monthly Revenue Loss: $${loss.toLocaleString()}
Next Best Step: ${nbs}

Write 5 video pitch scripts. Each must:
- START with the revenue loss number as the hook
- END with the exact next best step
- Sound natural and spoken — no bullet points inside scripts
- Be direct, urgent, and personalized

Return ONLY valid JSON:
{
  "hook": "<15-second video hook script — opens with '$${loss.toLocaleString()}/month', grabs attention in 15 seconds, ends with curiosity hook to keep watching>",
  "short45": "<45-second script — intro with revenue loss, 2 specific problems, 1 solution, CTA>",
  "standard60": "<60-second standard script — revenue loss opener, 3 specific gaps, your agency's solution, proof point, CTA>",
  "loom": "<Detailed Loom walkthrough script with [screen share instructions in brackets]. Covers: revenue loss intro, screen share of their Google search presence, screen share gap analysis, screen share competitor comparison, solution overview, pricing teaser, CTA. ~90-120 seconds narrated.>",
  "ctas": [
    "<CTA version 1 — soft close: asking for 15 minutes>",
    "<CTA version 2 — urgency close: competitor is already moving>",
    "<CTA version 3 — value close: free audit offer>"
  ]
}`;
    try {
      const vResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 2400, messages: [{ role: 'user', content: vpPrompt }] })
      });
      const vData = await vResp.json();
      let vRaw = vData.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
      const vsi = vRaw.indexOf('{'), vei = vRaw.lastIndexOf('}');
      let scripts = null;
      try { if (vsi !== -1) scripts = JSON.parse(vRaw.slice(vsi, vei + 1)); } catch {}
      if (!scripts) return res.status(500).json({ error: 'Failed to parse scripts' });
      return res.status(200).json(scripts);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to generate video pitch', detail: err.message });
    }
  }

  // ── TEXT PITCH DECK mode (default) ────────────────────────────────────────
  if (!lead) return res.status(400).json({ error: 'lead data required' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const loss = revenueLoss || 3500;
  const reportContext = reportData ? `\nReport findings: ${JSON.stringify(reportData).slice(0, 800)}` : '';

  const prompt = `You are a world-class digital marketing sales consultant creating a premium pitch deck for a prospect. The agency uses Google Veo 3 — Google's cinematic AI video model — to produce professional short-form videos for clients at scale. This is a major competitive differentiator and should be woven throughout the pitch.

Business: ${lead.name}
Type: ${niche}
City: ${city}
Rating: ${lead.rating || 'unknown'} stars (${lead.reviews || 0} reviews)
Website: ${lead.website || 'none — no website'}
Revenue Loss: $${loss.toLocaleString()}/month estimated${reportContext}

Create a comprehensive, structured sales pitch. Return ONLY valid JSON:
{
  "headline": "This business is losing an estimated $${loss.toLocaleString()}/month in digital revenue",
  "subheadline": "<1 sentence urgency statement specific to ${niche} in ${city}>",
  "painPoints": [
    {"rank":1,"problem":"<specific biggest gap for this business type>","cost":"$<X,XXX>/mo","detail":"<1 sentence impact>"},
    {"rank":2,"problem":"<second gap>","cost":"$<X,XXX>/mo","detail":"<1 sentence impact>"},
    {"rank":3,"problem":"<third gap — should reference lack of video content if relevant>","cost":"$<X,XXX>/mo","detail":"<1 sentence impact>"}
  ],
  "keyFindings": [
    "<finding 1 — specific and damning, referencing their digital gaps>",
    "<finding 2 — competitor advantage they're losing to>",
    "<finding 3 — content/video gap>",
    "<finding 4 — missed revenue opportunity>"
  ],
  "industryScores": [
    {"name":"Local SEO","yours":<0-100>,"average":68},
    {"name":"Social Media","yours":<0-100>,"average":62},
    {"name":"Website","yours":<0-100>,"average":71},
    {"name":"Google Ads","yours":<0-100>,"average":55},
    {"name":"Video Content","yours":<0-100>,"average":41}
  ],
  "pricingTiers": [
    {"name":"Starter","price":"$799/mo","tagline":"Get found online","includes":["GMB Full Optimization","Review Generation (target: 20+ reviews/60 days)","Monthly Performance Report","1 AI Promo Video/month (Google Veo 3, 30-sec, branded, posted to YouTube Shorts + TikTok)"]},
    {"name":"Growth","price":"$1,499/mo","tagline":"Dominate local search + video","includes":["Everything in Starter","Local SEO + Location-Specific Content","Social Media Management (3x posts/week)","Google Ads Setup + Management","4 AI Videos/month (Veo 3 — scripted, produced, posted to YouTube, TikTok & Reels)"]},
    {"name":"Premium","price":"$2,499/mo","tagline":"Full market domination","includes":["Everything in Growth","Meta Ads Campaign (Facebook + Instagram)","Website Landing Page Redesign","Weekly Strategy Calls","Real-Time Competitor Monitoring","8 AI Videos/month (Veo 3 — YouTube, TikTok, Reels, Google Business — scripted, produced, captioned & scheduled)"]}
  ],
  "videoService": {
    "hook": "<1 punchy sentence — e.g. Your competitors are posting videos every week. You have zero. That gap is costing you customers.>",
    "whyVideo": "<2 sentences on why short-form video (YouTube Shorts + TikTok) is critical for ${niche} businesses in ${city} right now>",
    "whyVeo3": "We use Google Veo 3 — Google's most advanced AI video model — to produce cinematic, branded videos with realistic motion, voiceover, and sound. Traditional video production costs $500–$3,000 per video. With Veo 3, we deliver the same professional quality at a fraction of the cost, consistently every month.",
    "costComparison": [
      {"label":"Traditional Video Agency","perVideo":"$800–$3,000","monthly4Videos":"$3,200–$12,000","turnaround":"2–4 weeks per video"},
      {"label":"Freelance Videographer","perVideo":"$300–$800","monthly4Videos":"$1,200–$3,200","turnaround":"1–2 weeks per video"},
      {"label":"Our AI Video Service (Veo 3)","perVideo":"Included in plan","monthly4Videos":"From $1,499/mo","turnaround":"48 hours per video"}
    ],
    "videoPackages": [
      {"name":"Video Starter","price":"$599/mo","addOnPrice":"$299/mo add-on","includes":["4 short-form videos/month","YouTube Shorts + TikTok","Custom script per video","Brand colours & logo overlay","Captions & hashtag strategy","Posted for you"]},
      {"name":"Video Growth","price":"$999/mo","addOnPrice":"$499/mo add-on","includes":["8 videos/month","YouTube + TikTok + Instagram Reels","Custom scripts & storyboard","A/B thumbnail testing","Analytics report","Full posting & scheduling"]},
      {"name":"Video Pro","price":"$1,699/mo","addOnPrice":"$799/mo add-on","includes":["16 videos/month","All platforms including Google Business","Dedicated content calendar","Trend-jacking content","Channel growth strategy","Priority 24hr turnaround"]}
    ],
    "roi": "<2 sentences — specific ROI for ${niche}: e.g. Restaurants with weekly TikTok presence see 3x more walk-ins within 90 days. One viral video can generate more leads than 6 months of traditional ads.>",
    "cta": "<1 strong CTA specific to ${niche} — e.g. Let us create your first AI video free so you can see the quality before committing.>"
  },
  "roi": {
    "currentState": "<specific problem description — losing $${loss.toLocaleString()}/mo, ranking position, 0 video content, 0 new leads from search>",
    "projectedState": "<what success looks like in 90 days with both digital marketing AND video content — specific numbers>"
  },
  "timeline": [
    {"month":1,"milestone":"<specific deliverable + first AI video produced and posted>"},
    {"month":2,"milestone":"<visible results — rankings, reviews, traffic + video views growing>"},
    {"month":3,"milestone":"<measurable ROI — leads, calls, bookings + channel momentum>"}
  ],
  "nextSteps": [
    "Book a free 15-minute discovery call this week",
    "We send you a custom audit + your first AI video concept within 24 hours",
    "You choose a plan and your first video goes live within 48 hours of starting"
  ],
  "closingLine": "<1 strong closing sentence referencing the revenue loss, their competitor's video advantage, and how Veo 3 levels the playing field>"
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 2800, messages: [{ role: 'user', content: prompt }] })
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
