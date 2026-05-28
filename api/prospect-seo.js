// api/prospect-seo.js — Real-time SEO Audit for a Specific Prospect
// Structure mirrors api/generate.js exactly (proven working template).
// All scores come from real data. AI only generates proposal language at the end.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-google-key, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Diagnostic log — confirms function is being reached
  console.log('[prospect-seo] handler invoked');

  // Top-level guard — ALWAYS return JSON, never let Vercel emit HTML
  try {
    const body = req.body || {};
    const { businessName, niche, city, state, phone, rating, reviews } = body;
    const rawUrl = body.url;

    console.log('[prospect-seo] called with:', { url: rawUrl, businessName, niche, city });

    if (!rawUrl || !String(rawUrl).trim()) {
      return res.status(400).json({
        error: 'No website URL provided',
        userMessage: 'This prospect has no website URL on file. Add their website to run an SEO audit.',
        scores: { overall: 0 }, issues: [], dataSources: {}
      });
    }

    const GOOGLE_KEY    = req.headers['x-google-key']    || process.env.GOOGLE_PLACES_KEY;
    const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;

    if (!GOOGLE_KEY) {
      console.warn('[prospect-seo] GOOGLE_KEY missing — PageSpeed will be skipped');
    }

    // Normalize URL
    let targetUrl = String(rawUrl).trim();
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;

    let origin;
    try {
      origin = new URL(targetUrl).origin;
    } catch {
      return res.status(400).json({
        error: 'Invalid URL: ' + rawUrl,
        userMessage: 'The website URL appears to be invalid. Please check that the URL is correct.',
        scores: { overall: 0 }, issues: [], dataSources: {}
      });
    }

    console.log('[prospect-seo] fetching data sources in parallel for:', targetUrl);

    // ── FETCH ALL DATA IN PARALLEL ──────────────────────────────────────────
    // All timeouts fit within Vercel Hobby's 10s function limit.
    const [psResult, htmlResult, robotsResult, sitemapResult] = await Promise.allSettled([
      fetchPageSpeed(targetUrl, GOOGLE_KEY),   // max 7s
      fetchHtmlData(targetUrl),                 // max 5s
      fetchRobots(origin),                      // max 3s
      fetchSitemap(origin)                      // max 2s (parallel paths)
    ]);

    console.log('[prospect-seo] data fetch done. statuses:', [
      psResult.status, htmlResult.status, robotsResult.status, sitemapResult.status
    ]);

    const ps       = psResult.status     === 'fulfilled' ? psResult.value     : null;
    const htmlData = htmlResult.status   === 'fulfilled' ? htmlResult.value   : null;
    const robots   = robotsResult.status === 'fulfilled' ? robotsResult.value : null;
    const sitemap  = sitemapResult.status === 'fulfilled' ? sitemapResult.value : null;

    if (psResult.status === 'rejected')     console.error('[prospect-seo] PageSpeed failed:', psResult.reason?.message);
    if (htmlResult.status === 'rejected')   console.error('[prospect-seo] HTML fetch failed:', htmlResult.reason?.message);
    if (robotsResult.status === 'rejected') console.error('[prospect-seo] Robots fetch failed:', robotsResult.reason?.message);

    const isHTTPS = targetUrl.startsWith('https://');

    // ── RULE-BASED AUDIT ENGINE ─────────────────────────────────────────────
    const issues = runAuditRules({ ps, htmlData, robots, sitemap, isHTTPS, niche, targetUrl });
    const scores = computeScores(issues);

    console.log('[prospect-seo] audit complete. issues:', issues.length, 'overall score:', scores.overall);

    const dataSources = {
      pagespeed: ps       ? 'available' : 'unavailable',
      html:      htmlData ? 'available' : 'unavailable',
      robots:    robots   ? 'available' : 'unavailable',
      sitemap:   sitemap  ? 'available' : 'unavailable',
      https:     'available'
    };

    // ── AI PROPOSAL LANGUAGE (optional) ────────────────────────────────────
    let proposalLanguage = null;
    if (ANTHROPIC_KEY) {
      try {
        proposalLanguage = await generateProposal({
          businessName, niche, city, state, rating, reviews,
          targetUrl, scores, issues, ANTHROPIC_KEY
        });
        console.log('[prospect-seo] proposal language generated');
      } catch (e) {
        console.error('[prospect-seo] proposal generation failed:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      businessName,
      url: targetUrl,
      niche, city, state,
      realData: { pagespeed: ps, html: htmlData, robots, sitemap, https: { isHTTPS } },
      issues,
      scores,
      dataSources,
      proposalLanguage,
      auditTimestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[prospect-seo] TOP-LEVEL ERROR:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Unknown error',
      userMessage: 'The SEO audit encountered an unexpected error. The website may be blocking automated checks, or a required API timed out.',
      scores: { overall: 0 },
      issues: [],
      dataSources: { pagespeed: 'unavailable', html: 'unavailable', robots: 'unavailable', sitemap: 'unavailable' }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA FETCHERS — all timeouts well under 9s for Vercel Hobby
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPageSpeed(url, apiKey) {
  if (!apiKey) return null; // Skip entirely if no key — don't waste time
  const key  = `&key=${apiKey}`;
  const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
  const cats = 'category=performance&category=seo&category=accessibility&category=best-practices';

  const runOnce = async (strategy) => {
    const resp = await fetch(
      `${base}?url=${encodeURIComponent(url)}&strategy=${strategy}&${cats}${key}`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!resp.ok) throw new Error(`PageSpeed HTTP ${resp.status}`);
    return resp.json();
  };

  // Mobile + desktop in parallel — no retry (no time budget)
  const [mRes, dRes] = await Promise.allSettled([runOnce('mobile'), runOnce('desktop')]);
  const m = mRes.status === 'fulfilled' ? mRes.value : null;
  const d = dRes.status === 'fulfilled' ? dRes.value : null;
  if (!m && !d) return null;

  const mCats  = m?.lighthouseResult?.categories || {};
  const dCats  = d?.lighthouseResult?.categories || {};
  const audits = m?.lighthouseResult?.audits     || {};

  const score = (obj, k) => obj[k]?.score != null ? Math.round(obj[k].score * 100) : null;
  const disp  = (k)      => audits[k]?.displayValue ?? null;

  const failedAudits = Object.entries(audits)
    .filter(([, a]) => typeof a.score === 'number' && a.score < 0.9)
    .map(([id, a]) => ({ id, title: a.title, score: Math.round(a.score * 100) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 15);

  return {
    mobile:  { performance: score(mCats,'performance'), seo: score(mCats,'seo'), accessibility: score(mCats,'accessibility'), bestPractices: score(mCats,'best-practices') },
    desktop: { performance: score(dCats,'performance'), seo: score(dCats,'seo'), bestPractices: score(dCats,'best-practices') },
    vitals: {
      lcp: disp('largest-contentful-paint'), cls: disp('cumulative-layout-shift'),
      fcp: disp('first-contentful-paint'),   tbt: disp('total-blocking-time'),
      speedIndex: disp('speed-index'),
      lcpNum: audits['largest-contentful-paint']?.numericValue ?? null,
      clsNum: audits['cumulative-layout-shift']?.numericValue  ?? null
    },
    issues: {
      renderBlocking: audits['render-blocking-resources']?.details?.items?.length ?? 0,
      unusedJS:       audits['unused-javascript']?.details?.items?.length ?? 0,
      unusedCSS:      audits['unused-css-rules']?.details?.items?.length  ?? 0
    },
    failedAudits
  };
}

async function fetchHtmlData(url) {
  // Raw fetch + Jina in parallel — 5s each
  const [rawRes, jinaRes] = await Promise.allSettled([
    fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEO-Audit/1.0)' }, signal: AbortSignal.timeout(5000) }).then(r => r.text()),
    fetch('https://r.jina.ai/' + url, { headers: { 'Accept': 'text/plain' }, signal: AbortSignal.timeout(5000) }).then(r => r.text())
  ]);

  const html     = rawRes.status  === 'fulfilled' ? rawRes.value  : '';
  const jinaText = jinaRes.status === 'fulfilled' ? jinaRes.value : '';
  if (!html && !jinaText) return null;

  const titleMatch       = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const titleTag         = titleMatch ? titleMatch[1].trim() : null;
  const metaMatch        = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const metaDescription  = metaMatch ? metaMatch[1].trim() : null;
  const h1Matches        = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h2Matches        = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  const h1Text           = h1Matches[0] ? h1Matches[0][1].replace(/<[^>]+>/g, '').trim() : null;
  const canonicalMatch   = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const canonicalUrl     = canonicalMatch ? canonicalMatch[1].trim() : null;
  const robotsMatch      = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
  const metaRobots       = robotsMatch ? robotsMatch[1].trim() : null;
  const hasNoindex       = metaRobots ? metaRobots.toLowerCase().includes('noindex') : false;
  const hasViewport      = /<meta[^>]+name=["']viewport["']/i.test(html);
  const langMatch        = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const htmlLang         = langMatch ? langMatch[1] : null;
  const ogTitle  = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)  || [])[1] || null;
  const ogDesc   = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || null;
  const ogImage  = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)  || [])[1] || null;
  const twitterCard = (html.match(/<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']+)["']/i) || [])[1] || null;

  const imgTags = [...html.matchAll(/<img([^>]*)>/gi)];
  const totalImages = imgTags.length;
  let missingAlt = 0, emptyAlt = 0, noLazyLoad = 0, webpCount = 0;
  for (const m of imgTags) {
    const attrs = m[1] || '';
    if (!/\balt=/i.test(attrs))                missingAlt++;
    else if (/\balt=["']\s*["']/i.test(attrs)) emptyAlt++;
    if (!/\bloading=/i.test(attrs))            noLazyLoad++;
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    if (srcMatch && /\.(webp|avif)/i.test(srcMatch[1])) webpCount++;
  }

  const linkMatches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)];
  let internalLinks = 0, externalLinks = 0, hasContactLink = false;
  const socialLinks = [];
  const SOCIALS = ['facebook.com','instagram.com','twitter.com','x.com','linkedin.com','youtube.com','tiktok.com','yelp.com'];
  try {
    const domain = new URL(url).hostname;
    for (const lm of linkMatches) {
      const href = lm[1];
      if (href.startsWith('/') || href.includes(domain)) {
        internalLinks++;
        if (href.includes('/contact')) hasContactLink = true;
      } else if (href.startsWith('http')) {
        externalLinks++;
        const soc = SOCIALS.find(s => href.includes(s));
        if (soc) socialLinks.push(href);
      }
    }
  } catch {}

  const cleanText = jinaText || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const wordCount = cleanText.split(/\s+/).filter(w => w.length > 2).length;
  const hasCTA    = /\b(book|call|contact|schedule|appointment|order|reserve|get started|sign up|request|free|consult)\b/i.test(cleanText);
  const hasPhone  = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(cleanText);
  const hasEmail  = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(cleanText);
  const trustWords = /\b(reviews?|testimonials?|certified|licensed|award|guarantee|trusted|years? of experience|5.star|insured)\b/i.test(cleanText);

  const schemaMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const schemaTypes = [];
  let hasMalformedSchema = false;
  for (const sm of schemaMatches) {
    try {
      const parsed = JSON.parse(sm[1]);
      const types  = Array.isArray(parsed) ? parsed.map(p => p['@type']).filter(Boolean) : [parsed['@type']].filter(Boolean);
      schemaTypes.push(...types);
    } catch { hasMalformedSchema = true; }
  }
  const jsonLdExists     = schemaMatches.length > 0;
  const hasOrganization  = schemaTypes.some(t => /Organization/i.test(t));
  const hasLocalBusiness = schemaTypes.some(t => /LocalBusiness|Restaurant|Store|Service|MedicalBusiness|LegalService|Dentist|HealthAndBeautyBusiness/i.test(t));
  const hasWebSite       = schemaTypes.some(t => /WebSite/i.test(t));

  return {
    titleTag,    titleLength: titleTag ? titleTag.length : 0,
    metaDescription, metaDescriptionLength: metaDescription ? metaDescription.length : 0,
    h1Count: h1Matches.length, h1Text, h2Count: h2Matches.length,
    canonicalUrl, metaRobots, hasNoindex, hasViewport, htmlLang,
    ogTitle, ogDesc, ogImage, twitterCard,
    totalImages, missingAlt, emptyAlt, noLazyLoad, webpCount,
    internalLinks, externalLinks, socialLinks, hasContactLink,
    wordCount, hasCTA, hasPhone, hasEmail, trustWords,
    jsonLdExists, schemaTypes, hasMalformedSchema,
    hasOrganization, hasLocalBusiness, hasWebSite
  };
}

async function fetchRobots(origin) {
  try {
    const resp = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEO-Audit/1.0)' },
      signal: AbortSignal.timeout(3000)
    });
    if (!resp.ok) return { exists: false, status: resp.status };
    const text = await resp.text();
    return {
      exists: true,
      sitemapInRobots:   text.toLowerCase().includes('sitemap:'),
      homepageBlocked:   /disallow:\s*\/\s*$/im.test(text),
      hasGooglebotBlock: /user-agent:\s*googlebot[\s\S]{0,200}disallow:\s*\//i.test(text),
      snippet: text.slice(0, 500)
    };
  } catch { return { exists: false }; }
}

async function fetchSitemap(origin) {
  // All 3 paths in PARALLEL with 2s each — avoids the old 24s sequential worst-case
  const paths   = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap/sitemap.xml'];
  const results = await Promise.allSettled(paths.map(async (path) => {
    const resp = await fetch(`${origin}${path}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEO-Audit/1.0)' },
      signal: AbortSignal.timeout(2000)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text     = await resp.text();
    const urlCount = (text.match(/<url>/gi) || []).length || (text.match(/<loc>/gi) || []).length;
    return { exists: true, url: origin + path, urlCount, isIndex: text.includes('<sitemapindex') };
  }));
  for (const r of results) { if (r.status === 'fulfilled') return r.value; }
  return { exists: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE-BASED AUDIT ENGINE — deterministic, no AI
// ─────────────────────────────────────────────────────────────────────────────

function runAuditRules({ ps, htmlData: h, robots, sitemap, isHTTPS, niche, targetUrl }) {
  const issues = [];

  function issue(severity, category, title, finding, evidence, recommendation, proposalAngle) {
    issues.push({ severity, category, title, finding, evidence, recommendation, proposalAngle });
  }

  // ── HTTPS
  if (!isHTTPS) {
    issue('Critical','Security','Site Not Using HTTPS','The website is served over insecure HTTP.',`URL starts with http://`,'Install an SSL certificate and redirect all HTTP traffic to HTTPS immediately.','Security issues destroy consumer trust and trigger Google ranking penalties — this is an urgent fix.');
  }

  // ── PERFORMANCE
  if (ps) {
    const mob  = ps.mobile.performance;
    const desk = ps.desktop.performance;
    if (mob !== null) {
      if (mob < 50)       issue('Critical','Performance',`Mobile Performance Score: ${mob}/100`,`Google PageSpeed rated this site's mobile performance as critically poor.`,`Google PageSpeed Insights returned a mobile score of ${mob}/100`,'Optimize images, eliminate render-blocking resources, and enable browser caching.',`A ${mob}/100 mobile score means potential customers wait seconds for the page — most leave before it loads.`);
      else if (mob < 70)  issue('High','Performance',`Mobile Performance Needs Work: ${mob}/100`,'Mobile performance score is below the acceptable threshold.',`Google PageSpeed returned mobile score: ${mob}/100`,'Compress images, defer non-critical JavaScript, and use a CDN.',`With a ${mob}/100 mobile score, this site is losing customers on phones — which is 60%+ of local search traffic.`);
      else if (mob < 90)  issue('Medium','Performance',`Mobile Performance Below Optimal: ${mob}/100`,'Mobile performance has room for improvement.',`Google PageSpeed returned mobile score: ${mob}/100`,'Minor optimizations to images and scripts could push this to 90+.','Competitors with 90+ scores rank higher in mobile search results.');
    }
    if (desk !== null && desk < 60) issue('High','Performance',`Desktop Performance Needs Work: ${desk}/100`,'Desktop performance is below acceptable levels.',`Google PageSpeed returned desktop score: ${desk}/100`,'Optimize server response time, enable caching, and compress assets.','Even desktop users experience slow loads — this impacts all visitors, not just mobile.');

    const lcpNum = ps.vitals.lcpNum;
    if (lcpNum !== null) {
      if (lcpNum > 4000) issue('Critical','Performance',`Largest Contentful Paint (LCP): ${ps.vitals.lcp}`,'Main page content takes over 4 seconds to load — Google marks this as "Poor".',`Real LCP measurement: ${ps.vitals.lcp} (threshold for "Poor": >4s)`,'Optimize your largest above-the-fold image or hero element. Use WebP format and preload.',`Google uses LCP as a ranking factor. A ${ps.vitals.lcp} LCP directly suppresses search rankings.`);
      else if (lcpNum > 2500) issue('High','Performance',`LCP Needs Improvement: ${ps.vitals.lcp}`,'Main page content loads in 2.5–4 seconds — Google marks this as "Needs Improvement".',`Real LCP measurement: ${ps.vitals.lcp} (Google threshold for "Good": <2.5s)`,'Optimize the hero image size and delivery. Consider a CDN.','LCP above 2.5s is a known ranking suppressor in Google\'s algorithm.');
    }
    const clsNum = ps.vitals.clsNum;
    if (clsNum !== null && clsNum > 0.25) issue('High','Performance',`High Layout Shift (CLS): ${ps.vitals.cls}`,'Page elements shift significantly as the page loads, creating a poor user experience.',`Real CLS measurement: ${ps.vitals.cls} (Google threshold for "Poor": >0.25)`,'Add explicit width/height to images and ads. Avoid inserting content above existing content.','High layout shift makes the page feel broken — users leave and don\'t come back.');

    if (ps.issues.renderBlocking > 0) issue('Medium','Performance',`${ps.issues.renderBlocking} Render-Blocking Resource${ps.issues.renderBlocking>1?'s':''}`, 'CSS or JavaScript files are blocking the page from rendering.',`PageSpeed found ${ps.issues.renderBlocking} render-blocking resource(s)`,'Add async or defer attributes to JavaScript files. Move critical CSS inline.','Every render-blocking resource adds hundreds of milliseconds to the first paint.');
    if (ps.issues.unusedJS  > 3) issue('Medium','Performance',`${ps.issues.unusedJS} Unused JavaScript Files`,'JavaScript files are loaded but never used on this page.',`PageSpeed found ${ps.issues.unusedJS} unused JavaScript files`,'Remove or lazy-load JavaScript that is not needed on page load.','Unused code bloats page weight — slowing loads and wasting visitor bandwidth.');
    if (ps.issues.unusedCSS > 3) issue('Medium','Performance',`${ps.issues.unusedCSS} Unused CSS Files`,'CSS files are loaded but contain rules not applied to this page.',`PageSpeed found ${ps.issues.unusedCSS} unused CSS file(s)`,'Purge unused CSS rules or split stylesheets to load only what is needed.','Unused CSS slows the browser\'s rendering pipeline unnecessarily.');
  }

  // ── ON-PAGE SEO
  if (h) {
    if (!h.titleTag)           issue('Critical','On-Page SEO','Missing Title Tag','No title tag was found on the homepage.','No <title> tag detected in page HTML','Add a keyword-rich title tag between 50–60 characters.','The title tag is the single most important on-page ranking factor — without it, Google has nothing to rank.');
    else if (h.titleLength < 20) issue('Medium','On-Page SEO',`Title Tag Too Short (${h.titleLength} characters)`,'The title tag is too short to effectively target keywords.',`Actual title: "${h.titleTag}" (${h.titleLength} chars — recommended 50–60)`,'Expand the title to include business type, primary keyword, and location.',`A ${h.titleLength}-character title wastes prime real estate Google uses to understand the page.`);
    else if (h.titleLength > 65) issue('Medium','On-Page SEO',`Title Tag Too Long (${h.titleLength} characters)`,'The title tag is truncated in Google search results.',`Actual title: "${h.titleTag.slice(0,80)}${h.titleTag.length>80?'…':''}" (${h.titleLength} chars — Google cuts at ~60)`,'Shorten the title to under 60 characters, keeping the most important keywords first.','Truncated titles in SERPs reduce click-through rates — you\'re paying for visibility but losing clicks.');

    if (!h.metaDescription)              issue('High','On-Page SEO','Missing Meta Description','No meta description was found on the homepage.','No <meta name="description"> tag found in page HTML','Add a compelling 120–160 character meta description that includes a call-to-action.','Google shows meta descriptions in search results — without one, Google auto-generates an often-poor snippet.');
    else if (h.metaDescriptionLength < 70)  issue('Medium','On-Page SEO',`Meta Description Too Short (${h.metaDescriptionLength} characters)`,'The meta description is too short to communicate value to searchers.',`Actual meta description: "${h.metaDescription}" (${h.metaDescriptionLength} chars — recommended 120–160)`,'Expand the meta description to 120–160 characters with a clear benefit and CTA.','A thin meta description wastes the opportunity to convert searchers into clicks.');
    else if (h.metaDescriptionLength > 165) issue('Medium','On-Page SEO',`Meta Description Too Long (${h.metaDescriptionLength} characters)`,'The meta description is cut off in Google search results.',`Meta description is ${h.metaDescriptionLength} chars — Google truncates at ~160`,'Trim the meta description to under 160 characters.','Truncated snippets look incomplete in search results and reduce click-through rates.');

    if (h.h1Count === 0)      issue('High','On-Page SEO','Missing H1 Tag','No H1 heading was found on the homepage.','No <h1> element detected in page HTML','Add a single H1 tag containing the primary keyword and business name.','The H1 is a critical on-page signal — without it, Google relies solely on the title tag to understand page topic.');
    else if (h.h1Count > 1)   issue('Medium','On-Page SEO',`Multiple H1 Tags Found (${h.h1Count})`,`${h.h1Count} H1 tags were found — only one is recommended.`,`Found ${h.h1Count} <h1> elements on the page`,'Consolidate to a single H1 that targets the primary keyword.','Multiple H1s dilute the page\'s topical focus and confuse search engine crawlers.');

    if (!h.canonicalUrl)      issue('Medium','On-Page SEO','Missing Canonical Tag','No canonical URL tag was found on the homepage.','No <link rel="canonical"> found in page HTML','Add a canonical tag pointing to the preferred URL of the page.','Without a canonical, Google may index duplicate versions of the page and split ranking signals.');
    if (!h.hasViewport)       issue('High','On-Page SEO','Missing Viewport Meta Tag','No viewport meta tag was found.','No <meta name="viewport"> found in page HTML','Add <meta name="viewport" content="width=device-width, initial-scale=1">.','Missing viewport means the site doesn\'t render correctly on mobile — Google\'s primary index is mobile-first.');
    if (!h.htmlLang)          issue('Low','On-Page SEO','Missing HTML Language Attribute','The HTML tag does not specify a language.','No lang attribute on <html> element','Add lang="en" (or appropriate language code) to the <html> tag.','A missing lang attribute can affect how Google indexes the content.');
    if (!h.ogTitle)           issue('Medium','On-Page SEO','Missing Open Graph Tags','No Open Graph meta tags were found.','No og:title, og:description, or og:image found in page HTML','Add Open Graph tags to control how the page appears when shared on social media.','Without OG tags, social shares generate poor previews — reducing brand impressions and referral traffic.');
    if (h.hasNoindex)         issue('Critical','On-Page SEO','Noindex Tag Found on Homepage','The homepage has a robots meta tag telling search engines not to index it.',`Found: <meta name="robots" content="${h.metaRobots}">`,'Remove the noindex directive immediately unless this is intentional.','A noindex on the homepage removes the entire site from Google — this is catastrophic for search visibility.');
  }

  // ── CONTENT
  if (h) {
    if (h.wordCount < 250)      issue('High','Content',`Thin Homepage Content (~${h.wordCount} words)`,'The homepage has very little text content.',`Approximately ${h.wordCount} words found on the page (recommended: 400+)`,'Add substantial content: describe services, list benefits, include an FAQ, add customer testimonials.','Thin pages rarely rank — Google needs content to understand what you offer and who you serve.');
    else if (h.wordCount < 400) issue('Medium','Content',`Homepage Content Could Be Stronger (~${h.wordCount} words)`,'The homepage has limited text content for competitive ranking.',`Approximately ${h.wordCount} words found on the page (recommended: 400+)`,'Expand content with service descriptions, process explanations, and local relevance.','Competitors with 600+ words of relevant content often outrank sites with thin content.');
    if (!h.hasCTA)              issue('Medium','Content','No Clear Call-to-Action Detected','The page does not appear to contain a clear call-to-action.','Checked page for booking/call/contact/schedule/appointment/order/reserve keywords — none found','Add prominent CTAs: "Book Now", "Call Today", "Get a Free Quote", "Schedule Your Appointment".','Without a clear CTA, visitors don\'t know what to do next — leading to lost leads even from motivated buyers.');
    if (!h.hasPhone && !h.hasEmail && !h.hasContactLink) issue('High','Content','No Contact Information Found','No phone number, email address, or contact page link was detected on the homepage.','Checked page for phone pattern, email pattern, and /contact links — none found','Add phone number, email, and a contact page link prominently on the homepage.','Customers ready to buy can\'t reach you — this directly converts visitors into lost revenue.');
    if (!h.trustWords)          issue('Medium','Content','No Trust Signals Detected','No reviews, certifications, licenses, or guarantees were found on the homepage.','Checked for: reviews, testimonials, certified, licensed, award, guarantee, insured — none found','Add customer reviews, certifications, years in business, and guarantee statements.','Trust signals are the #1 factor converting website visitors into paying customers.');
  }

  // ── SCHEMA
  if (h) {
    if (!h.jsonLdExists) {
      issue('Medium','Schema','No Structured Data Found','No JSON-LD structured data was found on the page.','No <script type="application/ld+json"> blocks found in page HTML','Add LocalBusiness schema at minimum. Include name, address, phone, hours, and rating.','Structured data enables rich results in Google (star ratings, hours, FAQs) — competitors with schema occupy more SERP space.');
    } else {
      if (h.hasMalformedSchema) issue('High','Schema','Malformed Structured Data Found','One or more JSON-LD blocks contain invalid JSON that search engines cannot parse.','JSON.parse() failed on at least one application/ld+json script block','Validate all structured data at schema.org/validator and fix syntax errors.','Broken schema is worse than none — it signals technical neglect to Google.');
      if (!h.hasOrganization && !h.hasLocalBusiness) issue('Medium','Schema','Missing Organization/LocalBusiness Schema','No Organization or LocalBusiness schema type was found.',`Schema types found: ${h.schemaTypes.length ? h.schemaTypes.join(', ') : 'none'}`,'Add LocalBusiness schema with full NAP (name, address, phone) and business hours.','Without LocalBusiness schema, Google\'s Knowledge Panel and local pack features won\'t activate.');
      const localNiches = ['Restaurant','Dental Clinic','Med Spa','Gym','Hair Salon','Chiropractor','Roofing Company','Plumbing Company','Law Firm'];
      if (niche && localNiches.some(n => n.toLowerCase() === (niche||'').toLowerCase()) && !h.hasLocalBusiness) {
        issue('High','Schema',`Missing ${niche}-Specific LocalBusiness Schema`,`A ${niche} should have specific LocalBusiness schema to appear in Google's local results.`,`Schema types found on page: ${h.schemaTypes.length ? h.schemaTypes.join(', ') : 'none'}`,`Add ${niche}-specific schema type (e.g., Restaurant, Dentist, MedSpa) with full details.`,`Local businesses with niche-specific schema appear in rich results that competitors without it can never access.`);
      }
    }
  }

  // ── CRAWLABILITY
  if (robots) {
    if (!robots.exists) {
      issue('Low','Crawlability','Robots.txt Not Found','No robots.txt file was found at the expected location.',robots.status ? `${targetUrl}/robots.txt returned HTTP ${robots.status}` : 'Request to /robots.txt failed or timed out','Create a robots.txt file to guide search engine crawlers.','A missing robots.txt is a minor technical signal that professional sites always have in place.');
    } else if (robots.homepageBlocked) {
      issue('Critical','Crawlability','Homepage Blocked by Robots.txt','The robots.txt file contains Disallow: / which prevents all search engines from indexing this site.','robots.txt contains "Disallow: /"','Remove or correct the Disallow: / directive immediately.','This is a showstopper — the entire site is invisible to Google until this is fixed.');
    }
  }
  if (sitemap && !sitemap.exists) {
    issue('Medium','Crawlability','No XML Sitemap Found','No sitemap.xml or sitemap_index.xml was found.','Checked /sitemap.xml and /sitemap_index.xml — neither returned HTTP 200','Generate and submit an XML sitemap to Google Search Console.','Without a sitemap, Google may miss pages entirely — especially important for sites with more than 10 pages.');
  }

  // ── IMAGES
  if (h && h.totalImages > 0) {
    const missingRatio = h.missingAlt / h.totalImages;
    if (missingRatio > 0.5)       issue('High','Images',`${h.missingAlt} of ${h.totalImages} Images Missing Alt Text`,'More than half of images are missing alt text — hurting accessibility and image SEO.',`Found ${h.totalImages} images total; ${h.missingAlt} have no alt attribute`,'Add descriptive alt text to every image. Include relevant keywords naturally.','Missing alt text means Google can\'t understand or index your images — you\'re invisible in Google Image search.');
    else if (missingRatio > 0.25) issue('Medium','Images',`${h.missingAlt} Images Missing Alt Text`,'A significant portion of images are missing alt text.',`Found ${h.totalImages} images; ${h.missingAlt} missing alt attribute`,'Add descriptive alt text to all images, especially product and service photos.','Alt text is a quick win that improves both accessibility compliance and image search visibility.');
    if (h.totalImages > 5 && h.noLazyLoad / h.totalImages > 0.5) issue('Medium','Images',`${h.noLazyLoad} Images Without Lazy Loading`,'Most images load immediately even if they are below the fold.',`${h.noLazyLoad} of ${h.totalImages} images missing loading="lazy"`,'Add loading="lazy" to all below-the-fold images to improve page load speed.','Every millisecond counts on mobile — lazy loading is a simple 15-minute fix with measurable speed impact.');
    if (h.webpCount === 0 && h.totalImages > 3) issue('Low','Images','No Modern Image Formats (WebP/AVIF)','All images appear to be in legacy formats (JPG/PNG) rather than efficient WebP or AVIF.',`${h.totalImages} images found — none using .webp or .avif format`,'Convert images to WebP format to reduce file size by 25–35% with no quality loss.','Modern image formats are a PageSpeed quick win that directly improves the mobile performance score.');
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const DEDUCTIONS  = { Critical: 25, High: 15, Medium: 7, Low: 3 };
const CAT_WEIGHTS = { Performance: 0.20, 'On-Page SEO': 0.20, Content: 0.15, Crawlability: 0.15, Schema: 0.10, Images: 0.10, Security: 0.05, Technical: 0.05 };

function computeScores(issues) {
  const catScores = {};
  for (const cat of Object.keys(CAT_WEIGHTS)) {
    let score = 100;
    for (const i of issues.filter(x => x.category === cat)) score -= DEDUCTIONS[i.severity] || 0;
    catScores[cat] = Math.max(0, score);
  }
  let overall = 0;
  for (const [cat, weight] of Object.entries(CAT_WEIGHTS)) overall += (catScores[cat] ?? 100) * weight;
  return {
    overall: Math.round(overall),
    ...Object.fromEntries(Object.entries(catScores).map(([k, v]) => [k.replace(/[^a-zA-Z]/g, ''), v]))
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI PROPOSAL LANGUAGE — converts verified findings into sales copy
// ─────────────────────────────────────────────────────────────────────────────

async function generateProposal({ businessName, niche, city, state, rating, reviews, targetUrl, scores, issues, ANTHROPIC_KEY }) {
  const critHigh   = issues.filter(i => i.severity === 'Critical' || i.severity === 'High');
  const location   = [city, state].filter(Boolean).join(', ') || 'their local market';

  const prompt = `You are writing proposal language for a sales presentation. Use ONLY the verified real SEO audit findings below. Do NOT invent issues. Do NOT claim guaranteed rankings or traffic numbers.

Business: ${businessName || 'Local Business'}
Type: ${niche || 'Local Business'}
Location: ${location}
Website: ${targetUrl}
Google Rating: ${rating || 'N/A'} stars (${reviews || 0} reviews)

REAL AUDIT SCORES (computed from live data):
Overall: ${scores.overall}/100
Performance: ${scores.Performance ?? 'N/A'}/100
On-Page SEO: ${scores.OnPageSEO ?? 'N/A'}/100
Content: ${scores.Content ?? 'N/A'}/100

TOP VERIFIED ISSUES (evidence-based):
${critHigh.slice(0, 6).map(i => `- ${i.severity}: ${i.title} | Evidence: ${i.evidence}`).join('\n')}

Return ONLY valid JSON, no markdown:
{
  "salesSummary": "<2-3 sentence non-technical summary of what these findings mean for the business — max 80 words>",
  "topPains": [
    { "issue": "<issue title>", "businessImpact": "<plain-English explanation of what this costs them>", "urgency": "High|Medium|Low" },
    { "issue": "<issue title>", "businessImpact": "<explanation>", "urgency": "High|Medium|Low" },
    { "issue": "<issue title>", "businessImpact": "<explanation>", "urgency": "High|Medium|Low" }
  ],
  "quickWins": ["<specific fix achievable in 1-2 weeks>", "<second quick win>", "<third quick win>"],
  "pitchAngle": "<best sales angle based on the most critical real finding — max 40 words>",
  "nextBestStep": "<single recommended action for this prospect — max 25 words>"
}`;

  // 4s timeout — minimal budget remains after main fetches
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(4000)
  });

  const data = await resp.json();
  const raw  = (data.content || []).map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
  const si = raw.indexOf('{'), ei = raw.lastIndexOf('}');
  if (si === -1) return null;
  return JSON.parse(raw.slice(si, ei + 1));
}
