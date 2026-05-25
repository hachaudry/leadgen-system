export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-google-key, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let { lat, lng, niche, radius, prospectName, prospectRating, prospectReviews, city, state } = req.body;
  if (!niche) return res.status(400).json({ error: 'niche required' });

  const GOOGLE_KEY    = req.headers['x-google-key']    || process.env.GOOGLE_PLACES_KEY;
  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!GOOGLE_KEY || !ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing API keys' });

  const locationLabel = [city, state].filter(Boolean).join(', ') || 'local area';

  // ── FIX 1: Geocode city+state → lat/lng if coordinates are missing ─────────
  if ((!lat || !lng) && (city || state)) {
    try {
      const addr = encodeURIComponent([city, state].filter(Boolean).join(', '));
      const geoResp = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${addr}&key=${GOOGLE_KEY}`
      );
      const geoData = await geoResp.json();
      if (geoData.results && geoData.results.length > 0) {
        lat = geoData.results[0].geometry.location.lat;
        lng = geoData.results[0].geometry.location.lng;
      }
    } catch (e) {
      console.error('Geocoding failed:', e.message);
    }
  }

  // ── Map niche → Places type ─────────────────────────────────────────────────
  const typeMap = {
    'Restaurant': 'restaurant', 'Med Spa': 'spa', 'Dental Clinic': 'dentist',
    'Gym': 'gym', 'Law Firm': 'lawyer', 'Real Estate Agency': 'real_estate_agency',
    'Roofing Company': 'roofing_contractor', 'Plumbing Company': 'plumber',
    'Hair Salon': 'hair_salon', 'Chiropractor': 'chiropractor'
  };
  const placeType = typeMap[niche] || 'establishment';
  const searchRadius = Number(radius) || 5000;

  const isProspect = name =>
    prospectName && name && name.toLowerCase().includes(prospectName.toLowerCase().split(' ')[0]);

  let allPlaces = [];

  // ── Step 2: Nearby search (radius-based) ───────────────────────────────────
  if (lat && lng) {
    try {
      const nearbyResp = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.formattedAddress,places.nationalPhoneNumber,places.location'
        },
        body: JSON.stringify({
          includedTypes: [placeType],
          maxResultCount: 10,
          locationRestriction: {
            circle: { center: { latitude: lat, longitude: lng }, radius: searchRadius }
          },
          rankPreference: 'POPULARITY'
        })
      });
      const nearbyData = await nearbyResp.json();
      allPlaces = (nearbyData.places || []).filter(p => !isProspect(p.displayName?.text));
    } catch (e) {
      console.error('nearbySearch failed:', e.message);
    }
  }

  // ── FIX 2: Fallback to text search if nearby returned nothing ──────────────
  if (allPlaces.length === 0) {
    try {
      const textResp = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.formattedAddress,places.nationalPhoneNumber,places.location'
        },
        body: JSON.stringify({
          textQuery: `${niche} in ${locationLabel}`,
          pageSize: 10
        })
      });
      const textData = await textResp.json();
      allPlaces = (textData.places || []).filter(p => !isProspect(p.displayName?.text));
    } catch (e) {
      console.error('textSearch fallback failed:', e.message);
    }
  }

  const top4 = allPlaces.slice(0, 4);

  // ── No results after both strategies ───────────────────────────────────────
  if (top4.length === 0) {
    return res.status(200).json({ competitors: [], fallback: true, niche, city, state });
  }

  const compList = top4.map(p => ({
    name:    p.displayName?.text    || 'Unknown',
    rating:  p.rating               || null,
    reviews: p.userRatingCount      || 0,
    website: p.websiteUri           || null,
    address: p.formattedAddress     || '',
    lat:     p.location?.latitude   || null,
    lng:     p.location?.longitude  || null
  }));

  // ── FIX 3: Claude ranking with explicit criteria ───────────────────────────
  const rankPrompt = `You are a competitive market analyst for a digital marketing agency.

Prospect: ${prospectName || 'Unknown'} | Rating: ${prospectRating || 'unknown'} | Reviews: ${prospectReviews || 0}
Niche: ${niche}
Location: ${locationLabel}

Competitors found:
${compList.map((c, i) => `${i+1}. ${c.name} | Rating: ${c.rating ?? 'unknown'} | Reviews: ${c.reviews} | Website: ${c.website || 'none'}`).join('\n')}

Rank each competitor using EXACTLY these rules:
- "Market Leader": highest combined (rating × reviews) — the dominant player the prospect must beat
- "Rising Threat": highest raw review count relative to rating — growing fast, actively building reviews
- "Similar Level": closest overall profile to the prospect (nearest rating + review count combo)
- "Weaker Player": lowest combined score — prospect already matches or beats them

Assign one label per competitor. Use all 4 labels if 4 competitors exist; otherwise use the most fitting subset.

For each also provide:
- seoEstimate (0-100): estimated organic SEO strength
- socialEstimate (0-100): estimated social media presence strength
- websiteQuality (0-100): estimated website quality
- adSpend: estimated monthly ad budget e.g. "$500-1,200/mo" or "None detected"
- gap: one sentence — their specific advantage over the prospect

Return ONLY a valid JSON array, no markdown:
[{"name":"...","rank":"Market Leader","seoEstimate":72,"socialEstimate":65,"websiteQuality":70,"adSpend":"$800-1,500/mo","gap":"Has 340+ reviews and dominates the local 3-pack for all key search terms"}]`;

  try {
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 900, messages: [{ role: 'user', content: rankPrompt }] })
    });
    const claudeData = await claudeResp.json();
    const raw = claudeData.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const si = raw.indexOf('['), ei = raw.lastIndexOf(']');
    let ranked = [];
    try { if (si !== -1) ranked = JSON.parse(raw.slice(si, ei + 1)); } catch {}

    // Merge Places data with Claude ranking
    const competitors = ranked.length > 0
      ? ranked.map((r, i) => ({ ...compList.find(c => c.name === r.name) || compList[i] || {}, ...r }))
      : compList.map(c => ({ ...c, rank: 'Competitor' }));

    return res.status(200).json({ competitors, niche, city, state });
  } catch (err) {
    // Claude failed — return raw data without ranking
    return res.status(200).json({
      competitors: compList.map(c => ({ ...c, rank: 'Competitor' })),
      niche, city, state
    });
  }
}
