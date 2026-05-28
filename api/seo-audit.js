// api/seo-audit.js — Deterministic Rule-Based SEO Audit Engine
// AI is used ONLY at the end to convert verified findings into proposal language.
// All scores and issues are computed from real data, never hallucinated.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key, x-google-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, businessName, niche, location } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  const GOOGLE_KEY = req.headers['x-google-key'] || process.env.GOOGLE_PLACES_KEY;

  // Normalize URL
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;
  const urlObj = new URL(targetUrl);
  const origin = urlObj.origin;
  const domain = urlObj.hostname;

  // ─── 1. FETCH ALL DATA SOURCES IN PARALLEL ────────────────────────────────
  const [psResult, cruxResult, htmlResult, robotsResult, sitemapResult, w3cResult, obsResult] =
    await Promise.allSettled([
      fetchPageSpeed(origin, GOOGLE_KEY),
      fetchCrUX(origin, GOOGLE_KEY),
      fetchHtmlContent(targetUrl),
      fetchRobots(origin),
      fetchSitemap(origin),
      fetchW3C(targetUrl),
      fetchObservatory(domain)
    ]);

  const ps     = psResult.status     === 'fulfilled' ? psResult.value     : null;
  const crux   = cruxResult.status   === 'fulfilled' ? cruxResult.value   : null;
  const html   = htmlResult.status   === 'fulfilled' ? htmlResult.value   : null;
  const robots = robotsResult.status === 'fulfilled' ? robotsResult.value : null;
  const sitemap= sitemapResult.status=== 'fulfilled' ? sitemapResult.value: null;
  const w3c    = w3cResult.status    === 'fulfilled' ? w3cResult.value    : null;
  const obs    = obsResult.status    === 'fulfilled' ? obsResult.value    : null;

  // ─── 2. RULE-BASED AUDIT ENGINE ───────────────────────────────────────────
  const findings = runAuditRules({ ps, crux, html, robots, sitemap, w3c, obs, domain });

  // ─── 3. SCORING ENGINE ────────────────────────────────────────────────────
  const scores = computeScores(findings);

  // ─── 4. BUILD RAW DATA SUMMARY (for transparency card) ───────────────────
  const rawData = buildRawDataSummary({ ps, crux, html, robots, sitemap, w3c, obs });

  // ─── 5. AI PROPOSAL LANGUAGE (only converts verified findings to copy) ────
  let proposalSections = null;
  if (ANTHROPIC_KEY) {
    try {
      proposalSections = await generateProposalLanguage({
        businessName, niche, location, domain, scores, findings, rawData, ANTHROPIC_KEY
      });
    } catch (e) {
      console.error('Proposal generation failed:', e.message);
    }
  }

  return res.status(200).json({
    url: targetUrl,
    domain,
    businessName,
    scores,
    findings,
    rawData,
    proposalSections,
    auditedAt: new Date().toISOString()
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA FETCHERS
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPageSpeed(url, apiKey) {
  const key = apiKey ? `&key=${apiKey}` : '';
  const mobileUrl  = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES${key}`;
  const desktopUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=desktop&category=PERFORMANCE${key}`;

  const [mRes, dRes] = await Promise.allSettled([
    fetch(mobileUrl, { signal: AbortSignal.timeout(25000) }).then(r => r.json()),
    fetch(desktopUrl, { signal: AbortSignal.timeout(25000) }).then(r => r.json())
  ]);

  const m = mRes.status === 'fulfilled' ? mRes.value : null;
  const d = dRes.status === 'fulfilled' ? dRes.value : null;

  if (!m) return null;

  const cats = m.lighthouseResult?.categories || {};
  const audits = m.lighthouseResult?.audits || {};
  const dCats = d?.lighthouseResult?.categories || {};

  return {
    mobile: {
      performance:    Math.round((cats.performance?.score    ?? -1) * 100),
      seo:            Math.round((cats.seo?.score            ?? -1) * 100),
      accessibility:  Math.round((cats.accessibility?.score  ?? -1) * 100),
      bestPractices:  Math.round((cats['best-practices']?.score ?? -1) * 100),
    },
    desktop: {
      performance: Math.round((dCats.performance?.score ?? -1) * 100),
    },
    audits: {
      lcp:          audits['largest-contentful-paint']?.numericValue ?? null,
      fid:          audits['max-potential-fid']?.numericValue ?? null,
      cls:          audits['cumulative-layout-shift']?.numericValue ?? null,
      tbt:          audits['total-blocking-time']?.numericValue ?? null,
      ttfb:         audits['server-response-time']?.numericValue ?? null,
      fcp:          audits['first-contentful-paint']?.numericValue ?? null,
      speedIndex:   audits['speed-index']?.numericValue ?? null,
      hasViewport:  audits['viewport']?.score === 1,
      tapTargets:   audits['tap-targets']?.score,
      fontSizes:    audits['font-size']?.score,
      renderBlock:  audits['render-blocking-resources']?.score,
      usesHttps:    audits['is-on-https']?.score === 1,
      noMixedContent: audits['mixed-content']?.score !== 0,
      hasRobots:    audits['robots-txt']?.score === 1,
      hreflang:     audits['hreflang']?.score,
      canonical:    audits['canonical']?.score,
      structData:   audits['structured-data']?.score,
      metaDesc:     audits['meta-description']?.score,
      httpRedirect: audits['redirects-http']?.score,
      linkText:     audits['link-text']?.score,
      imgAlt:       audits['image-alt']?.score,
      docTitle:     audits['document-title']?.score,
      crawlAnchors: audits['crawlable-anchors']?.score,
    }
  };
}

async function fetchCrUX(url, apiKey) {
  const key = apiKey ? `?key=${apiKey}` : '';
  const resp = await fetch(`https://chromeuxreport.googleapis.com/v1/records:queryRecord${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: url, formFactor: 'PHONE' }),
    signal: AbortSignal.timeout(15000)
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.record) return null;

  const m = data.record.metrics || {};
  const p75 = (metric) => metric?.percentiles?.p75 ?? null;
  return {
    lcp:  p75(m.largest_contentful_paint),
    fid:  p75(m.first_input_delay),
    cls:  p75(m.cumulative_layout_shift),
    fcp:  p75(m.first_contentful_paint),
    ttfb: p75(m.experimental_time_to_first_byte),
    inp:  p75(m.interaction_to_next_paint),
  };
}

async function fetchHtmlContent(url) {
  // Use Jina AI reader for clean HTML/text
  const jinaUrl = `https://r.jina.ai/${url}`;
  const resp = await fetch(jinaUrl, {
    headers: { 'Accept': 'text/html', 'X-Return-Format': 'html' },
    signal: AbortSignal.timeout(20000)
  });
  const text = await resp.text();

  // Also try raw HTML fetch for meta analysis
  let rawHtml = '';
  try {
    const rawResp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEO-Audit-Bot/1.0)' },
      signal: AbortSignal.timeout(15000)
    });
    rawHtml = await rawResp.text();
  } catch {}

  return analyzeHtml(rawHtml || text, url);
}

function analyzeHtml(html, url) {
  const lower = html.toLowerCase();

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]{0,200})<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Meta description
  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,500})["']/i)
    || html.match(/<meta[^>]+content=["']([^"']{0,500})["'][^>]+name=["']description["']/i);
  const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : '';

  // Canonical
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : '';

  // H1, H2 counts
  const h1Matches = html.match(/<h1[^>]*>/gi) || [];
  const h2Matches = html.match(/<h2[^>]*>/gi) || [];

  // Images without alt
  const imgAll = html.match(/<img[^>]*>/gi) || [];
  const imgNoAlt = imgAll.filter(t => !/alt=["'][^"']+["']/i.test(t));

  // Schema.org detection
  const hasSchema = lower.includes('schema.org') || lower.includes('"@type"') || lower.includes("'@type'");
  const schemaTypes = [];
  const schemaTypeMatches = html.match(/"@type"\s*:\s*"([^"]+)"/gi) || [];
  schemaTypeMatches.forEach(m => {
    const t = m.match(/"([^"]+)"\s*$/)?.[1];
    if (t) schemaTypes.push(t);
  });

  // Open Graph
  const hasOG = lower.includes('property="og:') || lower.includes("property='og:");
  const hasTwitterCard = lower.includes('name="twitter:card"') || lower.includes("name='twitter:card'");

  // Viewport
  const hasViewport = lower.includes('name="viewport"') || lower.includes("name='viewport'");

  // HTTPS
  const hasHttpsLinks = (url || '').startsWith('https');

  // Word count estimate
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 2).length;

  // Internal/external link count
  const linkMatches = html.match(/<a[^>]+href=["'][^"']+["']/gi) || [];
  let internalLinks = 0, externalLinks = 0;
  if (url) {
    const urlHost = new URL(url).hostname;
    linkMatches.forEach(l => {
      const hrefMatch = l.match(/href=["']([^"']+)["']/i);
      if (!hrefMatch) return;
      const href = hrefMatch[1];
      if (href.startsWith('/') || href.includes(urlHost)) internalLinks++;
      else if (href.startsWith('http')) externalLinks++;
    });
  }

  // Inline styles / style tags (performance)
  const styleTagCount = (html.match(/<style[^>]*>/gi) || []).length;

  // iframes
  const iframeCount = (html.match(/<iframe[^>]*>/gi) || []).length;

  return {
    title,
    titleLen: title.length,
    metaDesc,
    metaDescLen: metaDesc.length,
    canonical,
    h1Count: h1Matches.length,
    h2Count: h2Matches.length,
    imgTotal: imgAll.length,
    imgNoAlt: imgNoAlt.length,
    hasSchema,
    schemaTypes: [...new Set(schemaTypes)],
    hasOG,
    hasTwitterCard,
    hasViewport,
    wordCount,
    internalLinks,
    externalLinks,
    styleTagCount,
    iframeCount,
  };
}

async function fetchRobots(origin) {
  try {
    const resp = await fetch(`${origin}/robots.txt`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEO-Audit-Bot/1.0)' }
    });
    if (!resp.ok) return { exists: false, status: resp.status };
    const text = await resp.text();
    return {
      exists: true,
      hasDisallowAll: /disallow:\s*\//i.test(text),
      hasSitemapRef: /sitemap:/i.test(text),
      hasGooglebotBlock: /user-agent:\s*googlebot[\s\S]*?disallow:\s*\//i.test(text),
      text: text.slice(0, 2000)
    };
  } catch {
    return { exists: false };
  }
}

async function fetchSitemap(origin) {
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap/sitemap.xml`
  ];
  for (const candidate of candidates) {
    try {
      const resp = await fetch(candidate, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEO-Audit-Bot/1.0)' }
      });
      if (resp.ok) {
        const text = await resp.text();
        const urlCount = (text.match(/<url>/gi) || []).length;
        const locCount = (text.match(/<loc>/gi) || []).length;
        const isIndex = text.includes('<sitemapindex');
        return {
          exists: true,
          url: candidate,
          isIndex,
          urlCount: urlCount || locCount,
          hasLastmod: text.includes('<lastmod>'),
          hasImages: text.includes('<image:'),
        };
      }
    } catch {}
  }
  return { exists: false };
}

async function fetchW3C(url) {
  try {
    const resp = await fetch(
      `https://validator.w3.org/nu/?doc=${encodeURIComponent(url)}&out=json`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEO-Audit-Bot/1.0)' },
        signal: AbortSignal.timeout(20000)
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const messages = data.messages || [];
    const errors   = messages.filter(m => m.type === 'error');
    const warnings = messages.filter(m => m.type === 'info' && m.subType === 'warning');
    return {
      errorCount:   errors.length,
      warningCount: warnings.length,
      topErrors:    errors.slice(0, 5).map(e => e.message?.slice(0, 100)),
    };
  } catch {
    return null;
  }
}

async function fetchObservatory(domain) {
  try {
    // Trigger scan
    const triggerResp = await fetch(
      `https://http-observatory.security.mozilla.org/api/v1/analyze?host=${domain}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'hidden=true',
        signal: AbortSignal.timeout(10000)
      }
    );
    if (!triggerResp.ok) return null;

    // Poll for result (max 3 attempts)
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const pollResp = await fetch(
        `https://http-observatory.security.mozilla.org/api/v1/analyze?host=${domain}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!pollResp.ok) continue;
      const data = await pollResp.json();
      if (data.state === 'FINISHED' || data.grade) {
        return {
          grade:  data.grade || 'F',
          score:  data.score ?? 0,
          state:  data.state,
          tests:  data.tests_passed,
          total:  data.tests_quantity,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE-BASED AUDIT ENGINE
// Severity deductions: Critical -25, High -15, Medium -7, Low -3
// ─────────────────────────────────────────────────────────────────────────────

function runAuditRules({ ps, crux, html, robots, sitemap, w3c, obs, domain }) {
  const issues   = {}; // category -> array of {severity, message, detail, source}
  const passes   = {}; // category -> array of {message}

  function addIssue(cat, severity, message, detail = '', source = '') {
    if (!issues[cat]) issues[cat] = [];
    issues[cat].push({ severity, message, detail, source });
  }
  function addPass(cat, message) {
    if (!passes[cat]) passes[cat] = [];
    passes[cat].push({ message });
  }

  // ── TECHNICAL PERFORMANCE ──────────────────────────────────────────────────
  const CAT_TECH = 'Technical Performance';

  if (ps) {
    const mob = ps.mobile;
    const aud = ps.audits;

    // Mobile Performance Score
    if (mob.performance >= 0) {
      if (mob.performance < 50)       addIssue(CAT_TECH, 'Critical', `Mobile performance score: ${mob.performance}/100 (poor)`, 'Google recommends 90+', 'PageSpeed');
      else if (mob.performance < 70)  addIssue(CAT_TECH, 'High',     `Mobile performance score: ${mob.performance}/100 (needs improvement)`, '', 'PageSpeed');
      else if (mob.performance < 90)  addIssue(CAT_TECH, 'Low',      `Mobile performance score: ${mob.performance}/100 (could be better)`, '', 'PageSpeed');
      else                            addPass(CAT_TECH, `Mobile performance score: ${mob.performance}/100`);
    }

    if (ps.desktop.performance >= 0) {
      if (ps.desktop.performance < 70) addIssue(CAT_TECH, 'Medium', `Desktop performance score: ${ps.desktop.performance}/100`, '', 'PageSpeed');
      else addPass(CAT_TECH, `Desktop performance score: ${ps.desktop.performance}/100`);
    }

    // LCP
    if (aud.lcp !== null) {
      if (aud.lcp > 4000)       addIssue(CAT_TECH, 'Critical', `LCP ${(aud.lcp/1000).toFixed(1)}s — very slow (>4s)`, 'Target: under 2.5s', 'PageSpeed');
      else if (aud.lcp > 2500)  addIssue(CAT_TECH, 'High',     `LCP ${(aud.lcp/1000).toFixed(1)}s — needs improvement (2.5–4s)`, 'Target: under 2.5s', 'PageSpeed');
      else                      addPass(CAT_TECH, `LCP ${(aud.lcp/1000).toFixed(1)}s — good`);
    }

    // TBT (proxy for FID)
    if (aud.tbt !== null) {
      if (aud.tbt > 600)       addIssue(CAT_TECH, 'Critical', `Total Blocking Time ${Math.round(aud.tbt)}ms (very poor)`, 'Target: under 200ms', 'PageSpeed');
      else if (aud.tbt > 200)  addIssue(CAT_TECH, 'High',     `Total Blocking Time ${Math.round(aud.tbt)}ms (needs improvement)`, 'Target: under 200ms', 'PageSpeed');
      else                     addPass(CAT_TECH, `Total Blocking Time ${Math.round(aud.tbt)}ms — good`);
    }

    // CLS
    if (aud.cls !== null) {
      if (aud.cls > 0.25)      addIssue(CAT_TECH, 'Critical', `CLS ${aud.cls.toFixed(3)} — very poor layout stability`, 'Target: under 0.1', 'PageSpeed');
      else if (aud.cls > 0.1)  addIssue(CAT_TECH, 'High',     `CLS ${aud.cls.toFixed(3)} — needs improvement`, 'Target: under 0.1', 'PageSpeed');
      else if (aud.cls >= 0)   addPass(CAT_TECH, `CLS ${aud.cls.toFixed(3)} — good`);
    }

    // TTFB
    if (aud.ttfb !== null) {
      if (aud.ttfb > 1800)      addIssue(CAT_TECH, 'High',   `TTFB ${Math.round(aud.ttfb)}ms — slow server response`, 'Target: under 800ms. Consider CDN or faster hosting.', 'PageSpeed');
      else if (aud.ttfb > 800)  addIssue(CAT_TECH, 'Medium', `TTFB ${Math.round(aud.ttfb)}ms — server response could be faster`, 'Target: under 800ms', 'PageSpeed');
      else if (aud.ttfb >= 0)   addPass(CAT_TECH, `TTFB ${Math.round(aud.ttfb)}ms — good`);
    }

    // HTTPS
    if (!aud.usesHttps)        addIssue(CAT_TECH, 'Critical', 'Site not fully served over HTTPS', 'Google flags insecure sites; major ranking penalty', 'PageSpeed');
    else                       addPass(CAT_TECH, 'HTTPS enabled');

    // Render-blocking
    if (aud.renderBlock === 0) addIssue(CAT_TECH, 'Medium', 'Render-blocking resources detected', 'CSS/JS delaying page paint; defer or async these files', 'PageSpeed');

    // Viewport
    if (!aud.hasViewport)      addIssue(CAT_TECH, 'Critical', 'Missing viewport meta tag', 'Site will not render correctly on mobile', 'PageSpeed');

    // Tap targets
    if (aud.tapTargets === 0)  addIssue(CAT_TECH, 'Medium', 'Tap targets too small for mobile users', 'Buttons/links too close together on mobile', 'PageSpeed');

  } else {
    addIssue(CAT_TECH, 'Medium', 'PageSpeed data unavailable', 'Could not fetch PageSpeed Insights data', 'PageSpeed');
  }

  // CrUX real-user data
  const CAT_CWV = 'Core Web Vitals (Real Users)';
  if (crux) {
    if (crux.lcp !== null) {
      if (crux.lcp > 4000)       addIssue(CAT_CWV, 'Critical', `Real-user LCP p75: ${(crux.lcp/1000).toFixed(1)}s (poor)`, 'Based on Chrome UX Report field data', 'CrUX');
      else if (crux.lcp > 2500)  addIssue(CAT_CWV, 'High',     `Real-user LCP p75: ${(crux.lcp/1000).toFixed(1)}s (needs improvement)`, 'Based on Chrome UX Report field data', 'CrUX');
      else                       addPass(CAT_CWV, `Real-user LCP p75: ${(crux.lcp/1000).toFixed(1)}s — good`);
    }
    if (crux.cls !== null) {
      if (crux.cls > 0.25)       addIssue(CAT_CWV, 'Critical', `Real-user CLS p75: ${crux.cls} (poor layout shift)`, 'Based on Chrome UX Report field data', 'CrUX');
      else if (crux.cls > 0.1)   addIssue(CAT_CWV, 'High',     `Real-user CLS p75: ${crux.cls} (moderate layout shift)`, '', 'CrUX');
      else                       addPass(CAT_CWV, `Real-user CLS p75: ${crux.cls} — stable`);
    }
    if (crux.inp !== null) {
      if (crux.inp > 500)        addIssue(CAT_CWV, 'Critical', `Real-user INP p75: ${crux.inp}ms (very slow interactions)`, 'Target: under 200ms', 'CrUX');
      else if (crux.inp > 200)   addIssue(CAT_CWV, 'High',     `Real-user INP p75: ${crux.inp}ms (needs improvement)`, 'Target: under 200ms', 'CrUX');
      else                       addPass(CAT_CWV, `Real-user INP p75: ${crux.inp}ms — good`);
    }
    if (crux.ttfb !== null) {
      if (crux.ttfb > 1800)      addIssue(CAT_CWV, 'High',   `Real-user TTFB p75: ${crux.ttfb}ms`, '', 'CrUX');
      else                       addPass(CAT_CWV, `Real-user TTFB p75: ${crux.ttfb}ms — good`);
    }
  } else {
    addIssue(CAT_CWV, 'Low', 'Real-user Chrome UX data not available', 'Site may have insufficient traffic for CrUX data, or CrUX API unavailable', 'CrUX');
  }

  // ── ON-PAGE SEO ────────────────────────────────────────────────────────────
  const CAT_ONPAGE = 'On-Page SEO';

  if (html) {
    // Title
    if (!html.title) {
      addIssue(CAT_ONPAGE, 'Critical', 'Missing page title tag', 'Title is the #1 on-page ranking factor', 'HTML Audit');
    } else if (html.titleLen < 30) {
      addIssue(CAT_ONPAGE, 'High',   `Title too short: ${html.titleLen} chars ("${html.title.slice(0,50)}")`, 'Target: 50–60 chars', 'HTML Audit');
    } else if (html.titleLen > 65) {
      addIssue(CAT_ONPAGE, 'Medium', `Title too long: ${html.titleLen} chars (truncated in SERPs)`, 'Target: 50–60 chars', 'HTML Audit');
    } else {
      addPass(CAT_ONPAGE, `Title tag good: ${html.titleLen} chars`);
    }

    // Meta description
    if (!html.metaDesc) {
      addIssue(CAT_ONPAGE, 'High',   'Missing meta description', 'Google uses meta description for SERP snippets', 'HTML Audit');
    } else if (html.metaDescLen < 80) {
      addIssue(CAT_ONPAGE, 'Medium', `Meta description too short: ${html.metaDescLen} chars`, 'Target: 120–160 chars', 'HTML Audit');
    } else if (html.metaDescLen > 165) {
      addIssue(CAT_ONPAGE, 'Low',    `Meta description too long: ${html.metaDescLen} chars`, 'Target: 120–160 chars', 'HTML Audit');
    } else {
      addPass(CAT_ONPAGE, `Meta description good: ${html.metaDescLen} chars`);
    }

    // H1
    if (html.h1Count === 0) {
      addIssue(CAT_ONPAGE, 'High',   'No H1 tag found on page', 'H1 is a primary on-page ranking signal', 'HTML Audit');
    } else if (html.h1Count > 1) {
      addIssue(CAT_ONPAGE, 'Medium', `Multiple H1 tags: ${html.h1Count} found`, 'Best practice: one H1 per page', 'HTML Audit');
    } else {
      addPass(CAT_ONPAGE, 'Single H1 tag present');
    }

    // H2s
    if (html.h2Count === 0) {
      addIssue(CAT_ONPAGE, 'Low',    'No H2 tags found', 'H2 tags help structure content for search engines', 'HTML Audit');
    } else {
      addPass(CAT_ONPAGE, `${html.h2Count} H2 tag(s) found`);
    }

    // Canonical
    if (!html.canonical) {
      addIssue(CAT_ONPAGE, 'Medium', 'No canonical URL tag', 'Without canonical, search engines may index duplicate URLs', 'HTML Audit');
    } else {
      addPass(CAT_ONPAGE, 'Canonical tag present');
    }

    // Images
    if (html.imgNoAlt > 0) {
      const sev = html.imgNoAlt > 5 ? 'High' : 'Medium';
      addIssue(CAT_ONPAGE, sev,      `${html.imgNoAlt}/${html.imgTotal} images missing alt text`, 'Alt text impacts accessibility and image SEO', 'HTML Audit');
    } else if (html.imgTotal > 0) {
      addPass(CAT_ONPAGE, 'All images have alt text');
    }

    // Open Graph
    if (!html.hasOG) {
      addIssue(CAT_ONPAGE, 'Low',    'No Open Graph tags', 'OG tags control how content appears when shared on social media', 'HTML Audit');
    } else {
      addPass(CAT_ONPAGE, 'Open Graph tags present');
    }

    // Word count
    if (html.wordCount < 300) {
      addIssue(CAT_ONPAGE, 'High',   `Thin content: only ~${html.wordCount} words on page`, 'Google favors pages with substantial content (500+ words)', 'HTML Audit');
    } else if (html.wordCount < 500) {
      addIssue(CAT_ONPAGE, 'Medium', `Limited content: ~${html.wordCount} words`, 'Target: 500+ words for competitive terms', 'HTML Audit');
    } else {
      addPass(CAT_ONPAGE, `Content volume: ~${html.wordCount} words`);
    }

    // Schema
    if (!html.hasSchema) {
      addIssue(CAT_ONPAGE, 'High',   'No structured data (Schema.org) detected', 'Schema markup enables rich results in Google SERPs', 'HTML Audit');
    } else {
      const types = html.schemaTypes.length ? ` (${html.schemaTypes.slice(0,3).join(', ')})` : '';
      addPass(CAT_ONPAGE, `Schema markup detected${types}`);
    }

  } else {
    addIssue(CAT_ONPAGE, 'Medium', 'Could not fetch page HTML for analysis', '', 'HTML Audit');
  }

  // ── CRAWLABILITY & INDEXING ────────────────────────────────────────────────
  const CAT_CRAWL = 'Crawlability & Indexing';

  if (robots.exists) {
    if (robots.hasDisallowAll) {
      addIssue(CAT_CRAWL, 'Critical', 'robots.txt blocks all search engine crawlers (Disallow: /)', 'Site cannot be indexed if robots.txt blocks all crawlers', 'robots.txt');
    } else if (robots.hasGooglebotBlock) {
      addIssue(CAT_CRAWL, 'Critical', 'Googlebot specifically blocked in robots.txt', 'Site invisible to Google', 'robots.txt');
    } else {
      addPass(CAT_CRAWL, 'robots.txt exists and allows crawling');
    }
    if (!robots.hasSitemapRef) {
      addIssue(CAT_CRAWL, 'Low',    'robots.txt does not reference sitemap', 'Add Sitemap: directive to robots.txt', 'robots.txt');
    }
  } else {
    addIssue(CAT_CRAWL, 'Medium',  'No robots.txt file found', 'robots.txt helps guide search engine crawlers', 'robots.txt');
  }

  if (sitemap.exists) {
    addPass(CAT_CRAWL, `XML sitemap found at ${sitemap.url} (${sitemap.urlCount} URLs)`);
    if (!sitemap.hasLastmod) {
      addIssue(CAT_CRAWL, 'Low',   'Sitemap missing <lastmod> dates', 'Last-modified dates help Google prioritize crawling', 'Sitemap');
    }
  } else {
    addIssue(CAT_CRAWL, 'High',    'No XML sitemap found', 'Sitemap helps Google discover and index all pages', 'Sitemap');
  }

  // PageSpeed crawl signals
  if (ps) {
    if (ps.audits.canonical === 0) {
      addIssue(CAT_CRAWL, 'Medium', 'Canonical URL issue detected', 'Canonical points away from this URL or is misconfigured', 'PageSpeed');
    }
    if (ps.audits.crawlAnchors === 0) {
      addIssue(CAT_CRAWL, 'Medium', 'Some links are not crawlable by search engines', 'Use <a href> links instead of JS-only navigation', 'PageSpeed');
    }
    if (ps.audits.httpRedirect === 0) {
      addIssue(CAT_CRAWL, 'Low',    'HTTP does not redirect to HTTPS', 'Ensure http:// URLs redirect to https://', 'PageSpeed');
    }
  }

  // ── MOBILE & ACCESSIBILITY ─────────────────────────────────────────────────
  const CAT_MOBILE = 'Mobile & Accessibility';

  if (ps) {
    const mob = ps.mobile;
    if (mob.accessibility >= 0) {
      if (mob.accessibility < 70)       addIssue(CAT_MOBILE, 'High',   `Accessibility score: ${mob.accessibility}/100`, 'Affects user experience and SEO', 'PageSpeed');
      else if (mob.accessibility < 90)  addIssue(CAT_MOBILE, 'Medium', `Accessibility score: ${mob.accessibility}/100 — could be improved`, '', 'PageSpeed');
      else                              addPass(CAT_MOBILE,  `Accessibility score: ${mob.accessibility}/100`);
    }
    if (!ps.audits.hasViewport)         addIssue(CAT_MOBILE, 'Critical', 'Missing viewport meta tag — site breaks on mobile', '', 'PageSpeed');
    if (ps.audits.tapTargets === 0)     addIssue(CAT_MOBILE, 'Medium',  'Tap targets too small or too close together', 'Bad UX on mobile devices', 'PageSpeed');
    if (ps.audits.fontSizes === 0)      addIssue(CAT_MOBILE, 'Medium',  'Font sizes too small for mobile reading', 'Target: 16px minimum base font', 'PageSpeed');
    if (ps.audits.imgAlt === 0)         addIssue(CAT_MOBILE, 'Medium',  'Images missing alt text (accessibility)', '', 'PageSpeed');
    if (ps.audits.linkText === 0)       addIssue(CAT_MOBILE, 'Low',     'Non-descriptive link text detected ("click here", "read more")', '', 'PageSpeed');
  } else if (html) {
    if (!html.hasViewport)              addIssue(CAT_MOBILE, 'Critical', 'No viewport meta tag found', 'Critical for mobile rendering', 'HTML Audit');
  }

  // ── SECURITY ───────────────────────────────────────────────────────────────
  const CAT_SEC = 'Security & HTTPS';

  if (ps) {
    if (!ps.audits.usesHttps) {
      addIssue(CAT_SEC, 'Critical', 'Site not served over HTTPS', 'Major Google ranking penalty; users see "Not Secure" warning', 'PageSpeed');
    } else {
      addPass(CAT_SEC, 'HTTPS enabled');
    }
    if (!ps.audits.noMixedContent) {
      addIssue(CAT_SEC, 'High',   'Mixed content detected (HTTP resources on HTTPS page)', 'Browser blocks mixed content; triggers "Not Secure" warning', 'PageSpeed');
    }
    if (ps.mobile.bestPractices >= 0 && ps.mobile.bestPractices < 75) {
      addIssue(CAT_SEC, 'Medium', `Best Practices score: ${ps.mobile.bestPractices}/100`, 'Includes security headers, HTTPS, console errors', 'PageSpeed');
    }
  }

  if (obs) {
    if (obs.grade === 'F' || obs.grade === 'D') {
      addIssue(CAT_SEC, 'High',   `Mozilla Observatory security grade: ${obs.grade} (${obs.score}/100)`, 'Missing HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)', 'Observatory');
    } else if (obs.grade === 'C') {
      addIssue(CAT_SEC, 'Medium', `Mozilla Observatory security grade: ${obs.grade} (${obs.score}/100)`, 'Some security headers missing', 'Observatory');
    } else {
      addPass(CAT_SEC, `Mozilla Observatory grade: ${obs.grade} (${obs.score}/100)`);
    }
  }

  // ── HTML VALIDITY ─────────────────────────────────────────────────────────
  const CAT_HTML = 'HTML Validity';

  if (w3c) {
    if (w3c.errorCount > 20) {
      addIssue(CAT_HTML, 'High',   `${w3c.errorCount} HTML validation errors`, 'Errors may cause rendering or parsing issues', 'W3C Validator');
    } else if (w3c.errorCount > 5) {
      addIssue(CAT_HTML, 'Medium', `${w3c.errorCount} HTML validation errors`, '', 'W3C Validator');
    } else if (w3c.errorCount > 0) {
      addIssue(CAT_HTML, 'Low',    `${w3c.errorCount} minor HTML validation errors`, '', 'W3C Validator');
    } else {
      addPass(CAT_HTML, 'No HTML validation errors');
    }
    if (w3c.warningCount > 10) {
      addIssue(CAT_HTML, 'Low',    `${w3c.warningCount} HTML validation warnings`, '', 'W3C Validator');
    }
  } else {
    addIssue(CAT_HTML, 'Low',    'W3C validation check unavailable', '', 'W3C Validator');
  }

  // ── SCHEMA & STRUCTURED DATA ───────────────────────────────────────────────
  const CAT_SCHEMA = 'Structured Data';

  if (html) {
    if (!html.hasSchema) {
      addIssue(CAT_SCHEMA, 'High',   'No Schema.org structured data found', 'Schema enables rich results: stars, prices, hours, FAQs in Google SERPs', 'HTML Audit');
      addIssue(CAT_SCHEMA, 'Medium', 'Missing LocalBusiness schema (critical for local SEO)', 'LocalBusiness schema shows address, hours, phone in Google Knowledge Panel', 'HTML Audit');
    } else {
      const types = html.schemaTypes;
      addPass(CAT_SCHEMA, `Schema types found: ${types.join(', ') || 'detected'}`);
      if (!types.some(t => /LocalBusiness|Restaurant|Store|Service|Organization/i.test(t))) {
        addIssue(CAT_SCHEMA, 'Medium', 'LocalBusiness-type schema not found', 'Add LocalBusiness or specific business type schema', 'HTML Audit');
      }
      if (!types.some(t => /Review|AggregateRating/i.test(t))) {
        addIssue(CAT_SCHEMA, 'Low',    'No Review/AggregateRating schema', 'Enables star ratings in Google search results', 'HTML Audit');
      }
      if (!types.some(t => /FAQPage|Question/i.test(t))) {
        addIssue(CAT_SCHEMA, 'Low',    'No FAQ schema found', 'FAQ schema can capture additional SERP real estate', 'HTML Audit');
      }
    }
  }

  if (ps && ps.audits.structData === 0) {
    addIssue(CAT_SCHEMA, 'Medium', 'Google flagged structured data errors', 'Errors prevent rich results from appearing in SERPs', 'PageSpeed');
  }

  return { issues, passes };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_DEDUCTIONS = { Critical: 25, High: 15, Medium: 7, Low: 3 };

const CATEGORY_WEIGHTS = {
  'Technical Performance':       0.20,
  'Core Web Vitals (Real Users)':0.15,
  'On-Page SEO':                 0.25,
  'Crawlability & Indexing':     0.15,
  'Mobile & Accessibility':      0.10,
  'Security & HTTPS':            0.08,
  'Structured Data':             0.07,
  // HTML Validity contributes to overall but has no weight in the 8 UI cards
};

function computeScores(findings) {
  const { issues, passes } = findings;
  const catScores = {};

  // Score each category
  const allCats = [
    'Technical Performance', 'Core Web Vitals (Real Users)',
    'On-Page SEO', 'Crawlability & Indexing',
    'Mobile & Accessibility', 'Security & HTTPS',
    'Structured Data', 'HTML Validity'
  ];

  for (const cat of allCats) {
    const catIssues = issues[cat] || [];
    let score = 100;
    for (const issue of catIssues) {
      score -= SEVERITY_DEDUCTIONS[issue.severity] || 0;
    }
    score = Math.max(0, score);
    catScores[cat] = {
      score,
      grade: scoreToGrade(score),
      issueCount: catIssues.length,
      criticalCount: catIssues.filter(i => i.severity === 'Critical').length,
      passCount: (passes[cat] || []).length
    };
  }

  // Weighted overall
  let overall = 0;
  let totalWeight = 0;
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    if (catScores[cat]) {
      overall += catScores[cat].score * weight;
      totalWeight += weight;
    }
  }
  overall = totalWeight > 0 ? Math.round(overall / totalWeight) : 0;

  // Count totals
  let totalIssues = 0, criticalIssues = 0;
  for (const catIssues of Object.values(issues)) {
    totalIssues += catIssues.length;
    criticalIssues += catIssues.filter(i => i.severity === 'Critical').length;
  }

  return {
    overall,
    grade: scoreToGrade(overall),
    categories: catScores,
    totalIssues,
    criticalIssues,
  };
}

function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ─────────────────────────────────────────────────────────────────────────────
// RAW DATA SUMMARY (for transparency card)
// ─────────────────────────────────────────────────────────────────────────────

function buildRawDataSummary({ ps, crux, html, robots, sitemap, w3c, obs }) {
  return {
    pageSpeed: ps ? {
      mobilePerformance: ps.mobile.performance,
      desktopPerformance: ps.desktop.performance,
      mobileSeo: ps.mobile.seo,
      mobileAccessibility: ps.mobile.accessibility,
      lcp: ps.audits.lcp,
      cls: ps.audits.cls,
      tbt: ps.audits.tbt,
      ttfb: ps.audits.ttfb,
      usesHttps: ps.audits.usesHttps,
    } : null,
    crux: crux ? {
      realUserLcp: crux.lcp,
      realUserCls: crux.cls,
      realUserInp: crux.inp,
      realUserTtfb: crux.ttfb,
    } : null,
    html: html ? {
      titleLen: html.titleLen,
      metaDescLen: html.metaDescLen,
      h1Count: html.h1Count,
      h2Count: html.h2Count,
      imgTotal: html.imgTotal,
      imgNoAlt: html.imgNoAlt,
      wordCount: html.wordCount,
      hasSchema: html.hasSchema,
      schemaTypes: html.schemaTypes,
      hasOG: html.hasOG,
      canonical: !!html.canonical,
    } : null,
    robots: robots ? { exists: robots.exists, hasDisallowAll: robots.hasDisallowAll, hasSitemapRef: robots.hasSitemapRef } : null,
    sitemap: sitemap ? { exists: sitemap.exists, urlCount: sitemap.urlCount, url: sitemap.url } : null,
    w3c: w3c ? { errors: w3c.errorCount, warnings: w3c.warningCount } : null,
    observatory: obs ? { grade: obs.grade, score: obs.score } : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI PROPOSAL LANGUAGE GENERATOR
// Converts verified findings into persuasive proposal copy — never invents data
// ─────────────────────────────────────────────────────────────────────────────

async function generateProposalLanguage({ businessName, niche, location, domain, scores, findings, rawData, ANTHROPIC_KEY }) {
  const issuesSummary = [];
  for (const [cat, catIssues] of Object.entries(findings.issues)) {
    for (const issue of catIssues.filter(i => i.severity === 'Critical' || i.severity === 'High')) {
      issuesSummary.push(`[${cat}] ${issue.severity}: ${issue.message}`);
    }
  }

  const prompt = `You are a senior SEO consultant. Convert the following VERIFIED technical SEO audit findings (from real data tools — not estimated) into compelling proposal language for a sales presentation to ${businessName || 'the business owner'} (${niche || 'local business'} in ${location || 'their market'}).

VERIFIED DATA FROM AUDIT OF ${domain}:
- Overall SEO Score: ${scores.overall}/100 (Grade: ${scores.grade})
- Critical Issues: ${scores.criticalIssues}
- Total Issues: ${scores.totalIssues}
- Category Scores: ${Object.entries(scores.categories).map(([k,v]) => `${k}: ${v.score}/100`).join(', ')}

TOP CRITICAL/HIGH ISSUES FOUND:
${issuesSummary.slice(0, 10).join('\n')}

Write ONLY a JSON object with these exact keys. Do not invent new issues or scores — only use the data above:

{
  "executiveSummary": "<2-3 sentence business-impact summary using the real scores above — max 80 words>",
  "urgencyStatement": "<1 sentence that creates urgency based on the real critical issue count — max 30 words>",
  "topOpportunities": [
    "<opportunity 1 derived from real findings — max 20 words>",
    "<opportunity 2 — max 20 words>",
    "<opportunity 3 — max 20 words>"
  ],
  "competitorContext": "<1-2 sentences about how competitors with better scores rank higher — generic, not invented competitor data — max 50 words>",
  "investmentJustification": "<2 sentences on ROI from fixing these specific issues — max 50 words>"
}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    }),
    signal: AbortSignal.timeout(25000)
  });

  const data = await resp.json();
  let raw = (data.content || []).map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
  const si = raw.indexOf('{'), ei = raw.lastIndexOf('}');
  if (si === -1) return null;
  return JSON.parse(raw.slice(si, ei + 1));
}
