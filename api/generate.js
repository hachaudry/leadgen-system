export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-google-key, x-hunter-key, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { niche, city, limit = 10 } = req.body;
  if (!niche || !city) return res.status(400).json({ error: 'niche and city are required' });

  const GOOGLE_KEY    = req.headers['x-google-key']    || process.env.GOOGLE_PLACES_KEY;
  const HUNTER_KEY    = req.headers['x-hunter-key']    || process.env.HUNTER_API_KEY;
  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!GOOGLE_KEY || !HUNTER_KEY || !ANTHROPIC_KEY)
    return res.status(400).json({ error: 'Missing API keys. Please add them in Settings.' });

  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 50);

  try {
    const placesResp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.location'
      },
      body: JSON.stringify({ textQuery: `${niche} in ${city}`, pageSize })
    });

    const placesData = await placesResp.json();
    if (!placesData.places || placesData.places.length === 0)
      return res.status(404).json({ error: 'No businesses found. Try a different niche or city.' });

    const places = placesData.places.slice(0, pageSize);

    const emailPromises = places.map(async (place) => {
      const website = place.websiteUri;
      if (!website) return { ...place, ownerEmail: null, ownerName: null, domain: null };
      try {
        const domain = new URL(website).hostname.replace('www.', '');
        const hunterResp = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_KEY}&limit=1`);
        const hunterData = await hunterResp.json();
        const emails    = hunterData.data?.emails || [];
        const email     = emails[0]?.value || null;
        const firstName = emails[0]?.first_name || null;
        const lastName  = emails[0]?.last_name  || null;
        return { ...place, ownerEmail: email, ownerName: firstName && lastName ? `${firstName} ${lastName}` : null, domain };
      } catch {
        return { ...place, ownerEmail: null, ownerName: null, domain: null };
      }
    });

    const withEmails = await Promise.all(emailPromises);

    const scoringPrompt = `You are a lead scoring expert for a digital marketing agency selling services to ${niche} businesses.

Score these ${withEmails.length} businesses as leads. Lower Google rating = higher score. Fewer reviews = higher score. No website = highest urgency.

Return ONLY a valid JSON array, no markdown. Each object:
- "index": 0-based integer
- "score": integer 1-10
- "pain": specific pain point max 15 words

Businesses:
${withEmails.map((p, i) => `${i}. ${p.displayName?.text || 'Unknown'} | Rating: ${p.rating || 'none'} | Reviews: ${p.userRatingCount || 0} | Website: ${p.websiteUri || 'NONE'}`).join('\n')}`;

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1500, messages: [{ role: 'user', content: scoringPrompt }] })
    });
    const claudeData = await claudeResp.json();
    let rawScores = claudeData.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const si = rawScores.indexOf('['), ei = rawScores.lastIndexOf(']');
    let scores = [];
    try { if (si !== -1) scores = JSON.parse(rawScores.slice(si, ei + 1)); } catch {}

    const scoreMap = {};
    scores.forEach(s => { scoreMap[s.index] = s; });

    const leads = withEmails.map((place, i) => ({
      name:      place.displayName?.text || 'Unknown',
      address:   place.formattedAddress  || '',
      phone:     place.nationalPhoneNumber || null,
      website:   place.websiteUri        || null,
      email:     place.ownerEmail        || null,
      ownerName: place.ownerName         || null,
      domain:    place.domain            || null,
      rating:    place.rating            || null,
      reviews:   place.userRatingCount   || 0,
      score:     scoreMap[i]?.score      || 5,
      pain:      scoreMap[i]?.pain       || 'Needs stronger digital marketing presence',
      lat:       place.location?.latitude  || null,
      lng:       place.location?.longitude || null
    }));

    leads.sort((a, b) => b.score - a.score);
    return res.status(200).json({ leads, niche, city });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
