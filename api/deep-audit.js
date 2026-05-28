const callClaude = async (key, prompt, model = 'claude-sonnet-4-5', maxTokens = 800) => {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'Claude error');
  return d.content?.map(b => b.text || '').join('') || '';
};

const parseJSON = (raw) => {
  const clean = raw.replace(/```json|```/g, '').trim();
  const si = clean.indexOf('{'), ei = clean.lastIndexOf('}');
  try { return si !== -1 ? JSON.parse(clean.slice(si, ei + 1)) : null; } catch { return null; }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const { url, action, content } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL required' });

  const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
  let domain = '';
  try { domain = new URL(cleanUrl).hostname.replace('www.', ''); } catch {}

  // ── ACTION: analyze — extract rich BI from REAL scraped content ───────────
  if (action === 'analyze' && content) {
    const pages = content;
    const pagesFound = pages.pagesFound || 0;
    const totalWords = pages.totalWords || 0;

    // Build content blocks for the prompt
    const pageBlock = (type, label) => {
      const p = pages[type];
      if (!p || !p.success) return `${label.toUpperCase()}: [Page not found or inaccessible]`;
      return `${label.toUpperCase()} (${p.wordCount} words from ${p.url}):\n${p.content?.slice(0, 2000) || ''}`;
    };

    const prompt = `You are a business intelligence analyst. You have REAL scraped content from a live business website. Extract accurate business information based ONLY on what appears in the actual text.

URL: ${cleanUrl}

${pageBlock('homepage', 'Homepage')}

---

${pageBlock('about', 'About Page')}

---

${pageBlock('services', 'Services Page')}

---

${pageBlock('contact', 'Contact Page')}

---

${pageBlock('blog', 'Blog Page')}

---

Based ONLY on the real content above (not assumptions), extract the following. Use null for anything not found in the actual text.

Return ONLY valid JSON, no markdown:
{
  "name": "exact business name as it appears on the site",
  "niche": "ONE of: Restaurant, Med Spa, Dental Clinic, Gym, Law Firm, Real Estate Agency, Roofing Company, Plumbing Company, Hair Salon, Chiropractor, Other",
  "city": "city from actual address or contact page",
  "state": "2-letter state code from actual content",
  "phone": "actual phone number found or null",
  "email": "actual email found or null",
  "address": "full street address from contact page or null",
  "website": "${cleanUrl}",
  "tagline": "actual homepage headline or tagline or null",
  "primaryService": "most prominent service from content",
  "allServices": ["every service actually mentioned"],
  "targetAudience": "who they serve based on actual content",
  "hasBookingSystem": true or false,
  "hasBlog": true or false,
  "blogPostCount": number or null,
  "lastBlogPost": "title of most recent post or null",
  "hasPricing": true or false,
  "hasTestimonials": true or false,
  "primaryCTA": "actual CTA text from homepage or null",
  "facebook": "social URL found in content or null",
  "instagram": "social URL found in content or null",
  "linkedin": "social URL found in content or null",
  "youtube": "social URL found in content or null",
  "tiktok": "social URL found in content or null",
  "twitter": "social URL found in content or null",
  "uniqueSellingPoints": ["direct quotes or paraphrases from real content showing their strengths — max 3"],
  "actualWeaknesses": ["genuine gaps found — pages missing, thin content, no CTA, etc. — max 4"],
  "keywordsFound": ["main keywords from their actual content — max 10"],
  "confidence": "high",
  "dataSource": "real"
}`;

    try {
      const raw = await callClaude(ANTHROPIC_KEY, prompt, 'claude-sonnet-4-5', 1200);
      const data = parseJSON(raw);
      if (!data) throw new Error('JSON parse failed');
      data.website = cleanUrl;
      data.pagesFound = pagesFound;
      data.totalWords = totalWords;
      data.dataSource = 'real';
      return res.status(200).json(data);
    } catch (e) {
      // Fallback: return basic domain-derived data with partial info
      return res.status(200).json({
        name: domain.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        niche: null, city: null, state: null,
        phone: null, email: null, address: null,
        website: cleanUrl, tagline: null,
        primaryService: null, allServices: [],
        hasBookingSystem: false, hasBlog: false,
        hasPricing: false, hasTestimonials: false,
        primaryCTA: null,
        facebook: null, instagram: null, linkedin: null,
        youtube: null, tiktok: null, twitter: null,
        uniqueSellingPoints: [], actualWeaknesses: [],
        keywordsFound: [],
        confidence: 'low', dataSource: 'real',
        pagesFound, totalWords,
        error: e.message
      });
    }
  }

  // ── DEFAULT ACTION: extract — domain-only inference (fallback / fast path) ─
  const prompt = `You are a business intelligence analyst specializing in local US businesses. Analyze this domain and extract as much information as possible ONLY from the domain name and common naming patterns.

Domain: ${domain}
Full URL: ${cleanUrl}

Based on the domain name, infer:
1. Business name (e.g. "joesplumbing.com" → "Joe's Plumbing", "oakandvineny.com" → "Oak & Vine NY")
2. Business niche — must be ONE of: Restaurant, Med Spa, Dental Clinic, Gym, Law Firm, Real Estate Agency, Roofing Company, Plumbing Company, Hair Salon, Chiropractor — or "Other"
3. City and state from domain hints (e.g. "plumberatlanta.com" → Atlanta, GA; "nydentist.com" → New York, NY)
4. Likely social handles (guess realistically from business name — only if highly confident)
5. Brief 1-sentence business description

Be conservative — use null if you cannot confidently infer a value.

Return ONLY valid JSON, no markdown:
{
  "name": "business name string",
  "niche": "one niche from list above or Other",
  "city": "city name or null",
  "state": "2-letter US state code or null",
  "phone": null,
  "email": null,
  "website": "${cleanUrl}",
  "facebook": "https://facebook.com/handle or null",
  "instagram": "https://instagram.com/handle or null",
  "linkedin": null,
  "youtube": null,
  "tiktok": null,
  "twitter": null,
  "description": "one-sentence description of what this business does",
  "confidence": "high or medium or low",
  "dataSource": "estimated"
}`;

  try {
    const raw = await callClaude(ANTHROPIC_KEY, prompt, 'claude-sonnet-4-5', 600);
    const data = parseJSON(raw);
    if (!data) throw new Error('No JSON in response');
    data.website = cleanUrl;
    data.dataSource = 'estimated';
    return res.status(200).json(data);
  } catch (e) {
    const nameFallback = domain
      ? domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1).replace(/[-_]/g, ' ')
      : 'Business';
    return res.status(200).json({
      name: nameFallback, niche: null, city: null, state: null,
      phone: null, email: null, website: cleanUrl,
      facebook: null, instagram: null, linkedin: null,
      youtube: null, tiktok: null, twitter: null,
      description: `A local business at ${domain || 'this domain'}.`,
      confidence: 'low', dataSource: 'estimated'
    });
  }
}
