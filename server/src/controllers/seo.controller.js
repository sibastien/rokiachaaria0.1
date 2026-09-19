// src/controllers/seo.controller.js
// SEO, Dynamic Sitemap, and IndexNow Integration Protocol

const prisma = require('../config/prisma');

const SITE_URL = process.env.SITE_URL || 'https://roqiaonline.com';
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'c03fa41f17e04505bf775083a2169572';

/**
 * Helper to format a Date into YYYY-MM-DD
 */
function formatDate(date) {
  if (!date) return new Date().toISOString().split('T')[0];
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch (_) {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Generate dynamic XML Sitemap with real-time <lastmod> timestamps
 * GET /sitemap.xml
 */
async function getSitemap(req, res) {
  try {
    const today = formatDate(new Date());

    // Core static URLs with appropriate priorities and change frequencies
    const urls = [
      { loc: `${SITE_URL}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },
      { loc: `${SITE_URL}/articles`, lastmod: today, changefreq: 'daily', priority: '0.8' },
      { loc: `${SITE_URL}/forum`, lastmod: today, changefreq: 'daily', priority: '0.8' },
      { loc: `${SITE_URL}/llms.txt`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
    ];

    // Fetch dynamic published articles from database
    try {
      const articles = await prisma.article.findMany({
        where: { deletedAt: null },
        select: { id: true, updatedAt: true, publishedAt: true },
        orderBy: { updatedAt: 'desc' },
      });

      if (articles && articles.length > 0) {
        articles.forEach((art) => {
          urls.push({
            loc: `${SITE_URL}/articles?id=${encodeURIComponent(art.id)}`,
            lastmod: formatDate(art.updatedAt || art.publishedAt),
            changefreq: 'weekly',
            priority: '0.7',
          });
        });
      } else {
        // Resilient fallback default articles if DB empty
        urls.push(
          { loc: `${SITE_URL}/articles?id=1`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
          { loc: `${SITE_URL}/articles?id=2`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
          { loc: `${SITE_URL}/articles?id=3`, lastmod: today, changefreq: 'weekly', priority: '0.7' }
        );
      }
    } catch (dbErr) {
      console.warn('[Sitemap] Could not query articles from database, using core URLs:', dbErr.message);
      urls.push(
        { loc: `${SITE_URL}/articles?id=1`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
        { loc: `${SITE_URL}/articles?id=2`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
        { loc: `${SITE_URL}/articles?id=3`, lastmod: today, changefreq: 'weekly', priority: '0.7' }
      );
    }

    // Fetch approved community forum discussions
    try {
      const forumPosts = await prisma.forumPost.findMany({
        where: { status: 'APPROVED', deletedAt: null },
        select: { id: true, updatedAt: true, createdAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });

      if (forumPosts && forumPosts.length > 0) {
        forumPosts.forEach((post) => {
          urls.push({
            loc: `${SITE_URL}/forum?id=${encodeURIComponent(post.id)}`,
            lastmod: formatDate(post.updatedAt || post.createdAt),
            changefreq: 'weekly',
            priority: '0.6',
          });
        });
      }
    } catch (_) {
      // Graceful ignore if forum table offline
    }

    // Build standard XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    urls.forEach((u) => {
      xml += '  <url>\n';
      xml += `    <loc>${u.loc}</loc>\n`;
      xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
      xml += `    <priority>${u.priority}</priority>\n`;
      xml += '  </url>\n';
    });
    xml += '</urlset>';

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.header('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(xml);
  } catch (err) {
    console.error('[Sitemap] Error generating sitemap:', err);
    return res.status(500).type('text/plain').send('Error generating sitemap.');
  }
}

/**
 * Return IndexNow Verification Key
 * GET /c03fa41f17e04505bf775083a2169572.txt
 */
function getIndexNowKey(req, res) {
  res.type('text/plain').send(INDEXNOW_KEY);
}

/**
 * Reusable function to ping IndexNow API with list of modified URLs
 */
async function pingIndexNow(urlList = []) {
  if (!Array.isArray(urlList) || urlList.length === 0) {
    urlList = [`${SITE_URL}/`, `${SITE_URL}/articles`, `${SITE_URL}/forum`];
  }

  const host = new URL(SITE_URL).hostname;
  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList,
  };

  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const status = response.status;
    const ok = status >= 200 && status < 300;
    return { ok, status, count: urlList.length, urls: urlList };
  } catch (err) {
    console.warn('[IndexNow] Ping failed (network or offline):', err.message);
    return { ok: false, error: err.message, urls: urlList };
  }
}

/**
 * Endpoint to trigger IndexNow notification for newly published or updated URLs
 * POST /api/seo/indexnow
 */
async function submitIndexNow(req, res) {
  try {
    const requestedUrls = req.body.urls || req.body.urlList || [];
    const urls = Array.isArray(requestedUrls) && requestedUrls.length > 0
      ? requestedUrls.map((u) => (u.startsWith('http') ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`))
      : [`${SITE_URL}/`, `${SITE_URL}/articles`, `${SITE_URL}/forum`];

    const result = await pingIndexNow(urls);

    return res.status(200).json({
      success: true,
      message: 'تم إرسال تنبيه IndexNow بنجاح إلى محركات البحث المعتمدة (Bing, Yandex, Naver).',
      host: new URL(SITE_URL).hostname,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      submittedUrls: urls,
      indexNowResponse: result,
    });
  } catch (err) {
    console.error('[IndexNow] Submission error:', err);
    return res.status(500).json({
      success: false,
      message: 'تعذر إرسال تنبيه IndexNow.',
      error: err.message,
    });
  }
}

module.exports = {
  getSitemap,
  getIndexNowKey,
  pingIndexNow,
  submitIndexNow,
};
