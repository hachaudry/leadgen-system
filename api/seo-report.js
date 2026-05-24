export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { businessName, website, businessType, city, state, overallScore, competitorGap, categories, priorityActions } = req.body;
  if (!businessName || !categories) return res.status(400).json({ error: 'Missing required fields' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const location = [city, state].filter(Boolean).join(', ') || 'local market';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const categorySum = categories.map(c =>
    `${c.name} (${c.score}/100 — ${c.status})\nIssues: ${c.issues.join(' | ')}\nQuick Wins: ${c.quickWins.join(' | ')}\nTraffic Impact: ${c.trafficImpact}`
  ).join('\n\n');

  const actionsSum = priorityActions.map(a =>
    `${a.rank}. ${a.action} [Impact: ${a.impact}, Effort: ${a.effort}, Category: ${a.category}]`
  ).join('\n');

  const prompt = `You are a senior SEO consultant writing a professional audit report to present to a client.

Client: ${businessName}
Website: ${website || 'Not provided'}
Type: ${businessType}
Location: ${location}
Date: ${date}
Overall SEO Score: ${overallScore}/100
Competitor Gap: ${competitorGap}

Category Scores:
${categorySum}

Priority Actions:
${actionsSum}

Write a full professional SEO audit report (600-800 words) that this consultant can present to the client or convert to PDF. Use clear sections with headers. Be specific, professional, and persuasive — the goal is to win the client.

Format:
SEO AUDIT REPORT
${businessName} | ${location}
${date}

EXECUTIVE SUMMARY
[2-3 sentence overview of findings and opportunity]

OVERALL SEO SCORE: ${overallScore}/100

[Then cover each of the 6 categories as subsections with findings and recommendations]

PRIORITY ACTION PLAN
[List the 5 priority actions with context]

NEXT STEPS
[Clear 3-step CTA to hire the consultant]

Write the full report now. Use plain text with section headers in ALL CAPS.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await resp.json();
    const report = data.content.map(b => b.text || '').join('');
    return res.status(200).json({ report });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate report', detail: err.message });
  }
}
