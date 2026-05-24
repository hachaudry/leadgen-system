export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { businessName, website, businessType, city, state } = req.body;
  if (!businessName || !businessType) return res.status(400).json({ error: 'businessName and businessType are required' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const location = [city, state].filter(Boolean).join(', ') || 'their local market';

  const prompt = `You are a senior SEO consultant creating a detailed audit for a sales presentation.

Business: ${businessName}
Website: ${website || 'Not provided'}
Type: ${businessType}
Location: ${location}

Evaluate across 6 SEO categories. Be specific, realistic, and actionable. Most small local businesses score 25-55 overall. Return ONLY valid JSON, no markdown:

{
  "overallScore": <integer 0-100>,
  "competitorGap": "<e.g. '18-28 points behind top 3 local competitors'>",
  "categories": [
    {
      "name": "Local SEO",
      "score": <0-100>,
      "status": "Strong|Needs Work|Critical",
      "issues": [
        "<specific issue about GBP, NAP, citations, local rankings, Maps, or reviews — max 15 words>",
        "<second issue — max 15 words>",
        "<third issue — max 15 words>"
      ],
      "quickWins": [
        "<actionable fix achievable in 1-2 weeks — max 15 words>",
        "<second quick win — max 15 words>"
      ],
      "trafficImpact": "<e.g. 'High — local pack drives 35% of new customer discovery'>"
    },
    {
      "name": "Technical SEO",
      "score": <0-100>,
      "status": "Strong|Needs Work|Critical",
      "issues": ["<page speed/mobile/SSL/Core Web Vitals/crawl/schema issue>", "<issue>", "<issue>"],
      "quickWins": ["<win>", "<win>"],
      "trafficImpact": "<impact>"
    },
    {
      "name": "On-Page SEO",
      "score": <0-100>,
      "status": "Strong|Needs Work|Critical",
      "issues": ["<title/meta/headers/keywords/alts/linking/content issue>", "<issue>", "<issue>"],
      "quickWins": ["<win>", "<win>"],
      "trafficImpact": "<impact>"
    },
    {
      "name": "AIO — AI Optimization",
      "score": <0-100>,
      "status": "Strong|Needs Work|Critical",
      "issues": ["<ChatGPT/Claude/Gemini visibility, structured data, FAQ, brand mention issue>", "<issue>", "<issue>"],
      "quickWins": ["<win>", "<win>"],
      "trafficImpact": "<impact>"
    },
    {
      "name": "GEO — Generative Engine Optimization",
      "score": <0-100>,
      "status": "Strong|Needs Work|Critical",
      "issues": ["<featured snippet/PAA/Knowledge panel/entity/authority issue>", "<issue>", "<issue>"],
      "quickWins": ["<win>", "<win>"],
      "trafficImpact": "<impact>"
    },
    {
      "name": "AEO — Answer Engine Optimization",
      "score": <0-100>,
      "status": "Strong|Needs Work|Critical",
      "issues": ["<voice search/question content/direct answer/long-tail/zero-click issue>", "<issue>", "<issue>"],
      "quickWins": ["<win>", "<win>"],
      "trafficImpact": "<impact>"
    }
  ],
  "priorityActions": [
    { "rank": 1, "action": "<specific highest-ROI action — max 18 words>", "impact": "High|Medium|Low", "effort": "Low|Medium|High", "category": "<category name>" },
    { "rank": 2, "action": "<action>", "impact": "High|Medium|Low", "effort": "Low|Medium|High", "category": "<category name>" },
    { "rank": 3, "action": "<action>", "impact": "High|Medium|Low", "effort": "Low|Medium|High", "category": "<category name>" },
    { "rank": 4, "action": "<action>", "impact": "High|Medium|Low", "effort": "Low|Medium|High", "category": "<category name>" },
    { "rank": 5, "action": "<action>", "impact": "High|Medium|Low", "effort": "Low|Medium|High", "category": "<category name>" }
  ]
}

Rank priority actions by impact-to-effort ratio (high impact + low effort = rank #1). Be specific to ${businessType} businesses in ${location}.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2800, messages: [{ role: 'user', content: prompt }] })
    });

    const data = await resp.json();
    let raw = data.content.map(b => b.text || '').join('');
    raw = raw.replace(/```json|```/g, '').trim();
    const si = raw.indexOf('{'), ei = raw.lastIndexOf('}');
    let scorecard = null;
    try { if (si !== -1) scorecard = JSON.parse(raw.slice(si, ei + 1)); } catch {}
    if (!scorecard) return res.status(500).json({ error: 'Failed to parse AI response' });
    return res.status(200).json(scorecard);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
