export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-google-key, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lng, niche, radius, prospectName, prospectRating, prospectReviews } = req.body;
  if (!lat || !lng || !niche) return res.status(400).json({ error: 'lat, lng, niche required' });

  const GOOGLE_KEY    = req.headers['x-google-key']    || process.env.GOOGLE_PLACES_KEY;
  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!GOOGLE_KEY || !ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing API keys' });

  // Map niche → Places type
  const typeMap = {
    'Restaurant': 'restaurant', 'Med Spa': 'spa', 'Dental Clinic': 'dentist',
    'Gym': 'gym', 'Law Firm': 'lawyer', 'Real Estate Agency': 'real_estate_agency',
    'Roofing Company': 'roofing_contractor', 'Plumbing Company': 'plumber',
    'Hair Salon': 'hair_salon', 'Chiropractor': 'chiropractor'
  };
  const placeType = typeMap[niche] || 'establishment';
  const searchRadius = Number(radius) || 5000;

  try {
    const nearbyResp = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.formattedAddress,places.nationalPhoneNumber'
      },
      body: JSON.stringify({
        includedTypes: [placeType],
        maxResultCount: 8,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: searchRadius }
        },
        rankPreference: 'POPULARITY'
      })
    });

    const nearbyData = await nearbyResp.json();
    const allPlaces = (nearbyData.places || []).filter(p => p.displayName?.text !== prospectName);
    const top4 = allPlaces.slice(0, 4);

    if (top4.length === 0) return res.status(200).json({ competitors: [], analysis: null });

    const compList = top4.map((p, i) => ({
      name: p.displayName?.text || 'Unknown',
      rating: p.rating || null,
      reviews: p.userRatingCount || 0,
      website: p.websiteUri || null,
      address: p.formattedAddress || ''
    }));

    const rankPrompt = `You are a competitive market analyst for digital marketing agency sales.

Prospect: ${prospectName} | Rating: ${prospectRating || 'unknown'} | Reviews: ${prospectReviews || 0}
Niche: ${niche}

Competitors found nearby:
${compList.map((c, i) => `${i+1}. ${c.name} | Rating: ${c.rating || 'unknown'} | Reviews: ${c.reviews} | Website: ${c.website || 'none'}`).join('\n')}

Rank each competitor as exactly one of: "Market Leader", "Rising Threat", "Similar Level", "Weaker Player"
Assign based on: rating + review count + website presence + overall digital strength.
One per competitor, no duplicates if possible.

Also provide for each:
- seoEstimate: 0-100 score
- socialEstimate: 0-100 score
- websiteQuality: 0-100 score
- adSpend: estimated monthly ad budget range (e.g. "$500-1,200/mo" or "None detected")
- gap: one sentence — what they do better than the prospect

Return ONLY valid JSON array (no markdown):
[
  {
    "name": "...",
    "rank": "Market Leader",
    "seoEstimate": 72,
    "socialEstimate": 65,
    "websiteQuality": 70,
    "adSpend": "$800-1,500/mo",
    "gap": "Has 340 Google reviews and ranks in the local 3-pack for every key search term"
  }
]`;

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: rankPrompt }] })
    });
    const claudeData = await claudeResp.json();
    let raw = claudeData.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const si = raw.indexOf('['), ei = raw.lastIndexOf(']');
    let ranked = [];
    try { if (si !== -1) ranked = JSON.parse(raw.slice(si, ei + 1)); } catch {}

    // Merge Places data with Claude ranking
    const competitors = ranked.map((r, i) => ({
      ...compList.find(c => c.name === r.name) || compList[i] || {},
      ...r
    }));

    return res.status(200).json({ competitors });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
