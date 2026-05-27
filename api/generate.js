export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-google-key, x-hunter-key, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    niche, city,
    neighborhood = null,
    zip = null,
    county = null,
    countyId = null,
    locationLabel = null,
    limit = 10
  } = req.body || {};

  if (!niche || !city) {
    return res.status(400).json({ error: 'niche and city are required', leads: [] });
  }

  const GOOGLE_KEY = req.headers['x-google-key'] || process.env.GOOGLE_PLACES_KEY;
  const HUNTER_KEY = req.headers['x-hunter-key'] || process.env.HUNTER_API_KEY;

  if (!GOOGLE_KEY) {
    return res.status(400).json({ error: 'Google Places API key is missing. Please add it in Settings.', leads: [] });
  }
  if (!HUNTER_KEY) {
    return res.status(400).json({ error: 'Hunter.io API key is missing. Please add it in Settings.', leads: [] });
  }
  // Anthropic key is no longer used during lead extraction — scoring is deferred
  // to when the user manually runs an analysis report on a specific prospect.

  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 50);

  // Build the most precise search query possible from available location data
  let searchQuery;
  if (neighborhood) {
    searchQuery = `${niche} in ${neighborhood} ${city} California`;
  } else if (zip) {
    searchQuery = `${niche} in ${city} California near ${zip}`;
  } else if (county) {
    searchQuery = `${niche} in ${city} ${county} California`;
  } else {
    searchQuery = `${niche} in ${city} California`;
  }

  try {
    const placesResp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.location'
      },
      body: JSON.stringify({ textQuery: searchQuery, pageSize })
    });

    if (!placesResp.ok) {
      const errText = await placesResp.text().catch(() => '');
      return res.status(502).json({
        error: `Google Places API error (${placesResp.status}). Check your Google API key.`,
        detail: errText.slice(0, 300),
        leads: []
      });
    }

    const placesData = await placesResp.json();
    if (!placesData.places || placesData.places.length === 0) {
      return res.status(404).json({
        error: `No businesses found for "${searchQuery}". Try a different niche, city, or neighborhood.`,
        leads: []
      });
    }

    const places = placesData.places.slice(0, pageSize);

    const emailPromises = places.map(async (place) => {
      const website = place.websiteUri;
      if (!website) return { ...place, ownerEmail: null, ownerName: null, domain: null };
      try {
        const domain = new URL(website).hostname.replace('www.', '');
        const hunterResp = await fetch(
          `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_KEY}&limit=1`
        );
        const hunterData = await hunterResp.json();
        const emails    = hunterData.data?.emails || [];
        const email     = emails[0]?.value || null;
        const firstName = emails[0]?.first_name || null;
        const lastName  = emails[0]?.last_name  || null;
        return {
          ...place,
          ownerEmail: email,
          ownerName: firstName && lastName ? `${firstName} ${lastName}` : null,
          domain
        };
      } catch {
        return { ...place, ownerEmail: null, ownerName: null, domain: null };
      }
    });

    const withEmails = await Promise.all(emailPromises);

    const leads = withEmails.map((place) => ({
      name:        place.displayName?.text   || 'Unknown',
      address:     place.formattedAddress    || '',
      phone:       place.nationalPhoneNumber || null,
      website:     place.websiteUri          || null,
      email:       place.ownerEmail          || null,
      ownerName:   place.ownerName           || null,
      domain:      place.domain              || null,
      rating:      place.rating              || null,
      reviews:     place.userRatingCount     || 0,
      score:       null,
      pain:        null,
      revenueLoss: null,
      scoreStatus: 'pending',
      lat:         place.location?.latitude  || null,
      lng:         place.location?.longitude || null
    }));

    // Sort by review count ascending — fewer reviews = more opportunity
    leads.sort((a, b) => (a.reviews || 0) - (b.reviews || 0));

    return res.status(200).json({
      leads,
      niche,
      city,
      neighborhood: neighborhood || null,
      zip: zip || null,
      county: county || null,
      locationLabel: locationLabel || city,
      searchQuery
    });

  } catch (err) {
    console.error('generate.js error:', err);
    return res.status(500).json({
      error: 'Internal server error: ' + (err.message || 'Unknown error'),
      leads: []
    });
  }
}
