export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL required' });

  // Normalise URL
  const base = (() => {
    try {
      const u = url.startsWith('http') ? url : `https://${url}`;
      const p = new URL(u);
      return `${p.protocol}//${p.host}`.replace(/\/$/, '');
    } catch { return null; }
  })();

  if (!base) return res.status(400).json({ error: 'Invalid URL' });

  // URL variants to try per page type (first successful wins)
  const PAGE_VARIANTS = {
    homepage: [base],
    about:    [`${base}/about`, `${base}/about-us`, `${base}/our-story`, `${base}/who-we-are`],
    services: [`${base}/services`, `${base}/menu`, `${base}/treatments`, `${base}/what-we-do`, `${base}/our-services`, `${base}/offerings`],
    contact:  [`${base}/contact`, `${base}/contact-us`, `${base}/location`, `${base}/find-us`],
    blog:     [`${base}/blog`, `${base}/blogs`, `${base}/news`, `${base}/articles`, `${base}/resources`, `${base}/insights`]
  };

  // Fetch via Jina AI with timeout
  async function fetchViaJina(pageUrl, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(`https://r.jina.ai/${pageUrl}`, {
        signal: controller.signal,
        headers: { 'Accept': 'text/plain' }
      });
      clearTimeout(timer);
      if (!resp.ok) return null;
      const text = await resp.text();
      if (!text || text.length < 80) return null;
      // Check for 404 / error pages in Jina response
      if (/^\s*(404|page not found|error)\s*$/im.test(text.slice(0, 200))) return null;
      // Limit to 3000 words
      const words = text.split(/\s+/);
      return words.length > 3000 ? words.slice(0, 3000).join(' ') + ' [truncated]' : text;
    } catch {
      clearTimeout(timer);
      return null;
    }
  }

  // Scrape each page type, try variants until one works
  async function scrapePageType(type) {
    const variants = PAGE_VARIANTS[type] || [];
    for (const pageUrl of variants) {
      const content = await fetchViaJina(pageUrl);
      if (content) {
        const wordCount = content.split(/\s+/).length;
        return { url: pageUrl, content, success: true, wordCount };
      }
    }
    return { url: variants[0] || '', content: '', success: false, wordCount: 0 };
  }

  // Run all page scrapes in parallel
  const [homepage, about, services, contact, blog] = await Promise.all([
    scrapePageType('homepage'),
    scrapePageType('about'),
    scrapePageType('services'),
    scrapePageType('contact'),
    scrapePageType('blog')
  ]);

  const pages = { homepage, about, services, contact, blog };
  const pagesFound = Object.values(pages).filter(p => p.success).length;
  const totalWords = Object.values(pages).reduce((s, p) => s + (p.wordCount || 0), 0);

  // Build combined content string for Claude analysis
  const totalContent = Object.entries(pages)
    .filter(([, p]) => p.success)
    .map(([type, p]) => `=== ${type.toUpperCase()} (${p.wordCount} words) ===\n${p.content}`)
    .join('\n\n');

  return res.status(200).json({
    homepage, about, services, contact, blog,
    totalContent,
    pagesFound,
    totalWords,
    baseUrl: base,
    scrapedAt: new Date().toISOString()
  });
}
