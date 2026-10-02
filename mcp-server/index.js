#!/usr/bin/env node

/**
 * MCP Server for "الرقية الشرعية أونلاين" (Ruqyah Online Platform)
 * 
 * Provides tools for AI agents to generate, validate, and publish
 * SEO-optimized articles according to authentic Islamic Ruqyah standards.
 */

const fs = require('fs');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

// Paths
const ROOT_DIR = path.resolve(__dirname, '..');
const CONTENT_DIR = path.resolve(ROOT_DIR, 'content', 'articles');
const ARTICLES_INDEX_FILE = path.resolve(CONTENT_DIR, 'articles.json');
const SEO_META_FILE = path.resolve(ROOT_DIR, 'content', 'seo_metadata.json');

// Ensure directories exist
if (!fs.existsSync(CONTENT_DIR)) {
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
}

// Approved Categories mapped to DB Schema
const CATEGORIES = {
  sunnah: {
    key: 'sunnah',
    name: 'السنة النبوية',
    description: 'مقالات في الهدي النبوي الشريف، الطب النبوي، وضوابط الرقية الشرعية المعتمدة ومحاربة البدع.',
    icon: '📖'
  },
  hasad: {
    key: 'hasad',
    name: 'العين والحسد',
    description: 'أعراض الإصابة بالعين والحسد، الفروق التشخيصية، وطرق العلاج والرقية الشرعية الصحيحة.',
    icon: '🧿'
  },
  adhkar: {
    key: 'adhkar',
    name: 'الأذكار والتحصين',
    description: 'أذكار الصباح والمساء، أوراد التحصين اليومي، تحصين الأطفال والبيوت، وأدعية تفريج الكرب.',
    icon: '🌙'
  }
};

// Helper: Read stored articles
function loadArticlesIndex() {
  if (!fs.existsSync(ARTICLES_INDEX_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(ARTICLES_INDEX_FILE, 'utf-8'));
  } catch (_) {
    return [];
  }
}

// Helper: Save articles index
function saveArticlesIndex(articles) {
  fs.writeFileSync(ARTICLES_INDEX_FILE, JSON.stringify(articles, null, 2), 'utf-8');
}

// Helper: Calculate reading time
function calculateReadingTime(text) {
  if (!text) return '3 دقائق';
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 180));
  return `${minutes} دقائق`;
}

// Helper: Try Prisma database insertion if database is reachable
async function tryPrismaInsert(articleData, seoData) {
  try {
    const prismaClientPath = path.resolve(ROOT_DIR, 'server', 'node_modules', '@prisma/client');
    if (!fs.existsSync(prismaClientPath)) return { dbSaved: false, reason: 'Prisma client not found' };
    
    // Check if env has DATABASE_URL
    require('dotenv').config({ path: path.resolve(ROOT_DIR, 'server', '.env') });
    if (!process.env.DATABASE_URL) return { dbSaved: false, reason: 'No DATABASE_URL configured' };

    const { PrismaClient } = require(prismaClientPath);
    const prisma = new PrismaClient();

    try {
      const created = await prisma.article.create({
        data: {
          title: articleData.title,
          excerpt: articleData.excerpt,
          content: articleData.content,
          categoryKey: articleData.category_id,
          categoryName: CATEGORIES[articleData.category_id]?.name || 'عام',
          author: articleData.author,
          readTime: articleData.read_time,
          coverImage: articleData.cover_image_url || null,
          publishedAt: articleData.status === 'published' ? new Date() : new Date('2099-01-01'),
        }
      });

      // Save SEO Meta if table exists
      try {
        await prisma.seoPageMeta.upsert({
          where: { pageKey: `article:${articleData.slug}` },
          create: {
            pageKey: `article:${articleData.slug}`,
            pageUrl: `/articles?slug=${encodeURIComponent(articleData.slug)}`,
            metaTitle: seoData.meta_title,
            metaDesc: seoData.meta_description,
            focusKeyword: seoData.focus_keyword,
            customSlug: articleData.slug,
            ogTitle: seoData.meta_title,
            ogDesc: seoData.meta_description,
            ogImage: articleData.cover_image_url || null,
            altText: articleData.cover_image_alt || null,
            keywords: Array.isArray(articleData.tags) ? articleData.tags.join(', ') : '',
          },
          update: {
            metaTitle: seoData.meta_title,
            metaDesc: seoData.meta_description,
            focusKeyword: seoData.focus_keyword,
            ogTitle: seoData.meta_title,
            ogDesc: seoData.meta_description,
            updatedAt: new Date()
          }
        });
      } catch (seoErr) {
        // SEO table might not be migrated yet, non-fatal
      }

      await prisma.$disconnect();
      return { dbSaved: true, dbId: created.id };
    } catch (dbErr) {
      await prisma.$disconnect();
      return { dbSaved: false, reason: dbErr.message };
    }
  } catch (err) {
    return { dbSaved: false, reason: err.message };
  }
}

// Create MCP Server instance
const server = new McpServer({
  name: 'rukiaonline-article-server',
  version: '1.0.0',
});

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 1: list_categories
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'list_categories',
  'Returns all approved platform article categories with their IDs, Arabic names, and Islamic topical boundaries.',
  {},
  async () => {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(CATEGORIES, null, 2),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 2: publish_article
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'publish_article',
  'Generates, validates, and stores a complete SEO-optimized Islamic Ruqyah article with all required metadata.',
  {
    title: z.string().min(10).max(200).describe('Catchy, authoritative Arabic headline (e.g. "أعراض العين والحسد وكيفية الرقية الشرعية الصحيحة من الكتاب والسنة"). Max 200 chars.'),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).describe('SEO-friendly lowercase hyphenated URL slug in English or transliterated Arabic (e.g. "symptoms-of-evil-eye-and-proper-ruqyah").'),
    category_id: z.enum(['sunnah', 'hasad', 'adhkar']).describe('Category ID: "sunnah" (السنة النبوية), "hasad" (العين والحسد), or "adhkar" (الأذكار والتحصين).'),
    status: z.enum(['published', 'draft']).default('published').describe('Publishing state: "published" (live immediately) or "draft" (saved for editorial review).'),
    content: z.string().min(200).describe('Full article body in Markdown. Must include H2/H3 headers, authentic Quranic verses, Sahih Hadith citations, practical steps, and conclusion.'),
    excerpt: z.string().min(50).max(500).describe('Engaging short teaser summary (150-250 characters) displayed on blog preview cards and social shares.'),
    meta_title: z.string().min(20).max(65).describe('SEO title tag (50-60 chars optimal), containing the focus keyword near the front followed by platform branding ("| مدونة الشفاء").'),
    meta_description: z.string().min(70).max(165).describe('Compelling search meta description (140-160 chars) highlighting the benefits and encouraging click-through.'),
    focus_keyword: z.string().min(3).max(80).describe('Primary target SEO search query (e.g. "رقية العين والحسد مكتوبة" or "علاج المس والسحر بالقرآن").'),
    tags: z.array(z.string()).min(1).max(10).describe('List of 3-7 relevant keywords or tags for internal linking and topical clustering.'),
    author: z.string().default('هيئة الرقاة الشرعية المعتمدة').describe('Author or scholarly byline.'),
    read_time: z.string().optional().describe('Reading time in Arabic (e.g. "5 دقائق"). If omitted, it will be automatically calculated.'),
    cover_image_url: z.string().url().optional().describe('URL to the featured cover image.'),
    cover_image_alt: z.string().optional().describe('Descriptive alt text in Arabic for accessibility and Google Image search.'),
    faq: z.array(
      z.object({
        question: z.string().describe('Frequently asked question in Arabic'),
        answer: z.string().describe('Concise, evidence-based answer')
      })
    ).optional().describe('Optional FAQ items to generate Schema.org FAQPage structured data for Google rich snippets.'),
  },
  async (args) => {
    const readTime = args.read_time || calculateReadingTime(args.content);
    const categoryInfo = CATEGORIES[args.category_id] || { name: args.category_id };
    const createdAt = new Date().toISOString();

    // 1. Prepare Article Object
    const articleRecord = {
      id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: args.title.trim(),
      slug: args.slug.trim(),
      category_id: args.category_id,
      category_name: categoryInfo.name,
      status: args.status,
      excerpt: args.excerpt.trim(),
      content: args.content.trim(),
      meta_title: args.meta_title.trim(),
      meta_description: args.meta_description.trim(),
      focus_keyword: args.focus_keyword.trim(),
      tags: args.tags || [],
      author: args.author || 'هيئة الرقاة الشرعية المعتمدة',
      read_time: readTime,
      cover_image_url: args.cover_image_url || null,
      cover_image_alt: args.cover_image_alt || null,
      faq: args.faq || [],
      published_at: args.status === 'published' ? createdAt : null,
      created_at: createdAt,
      updated_at: createdAt,
    };

    // 2. Generate Markdown file with YAML Frontmatter
    const mdFrontmatter = [
      '---',
      `title: "${articleRecord.title.replace(/"/g, '\\"')}"`,
      `slug: "${articleRecord.slug}"`,
      `category_id: "${articleRecord.category_id}"`,
      `category_name: "${articleRecord.category_name}"`,
      `status: "${articleRecord.status}"`,
      `author: "${articleRecord.author}"`,
      `read_time: "${articleRecord.read_time}"`,
      `published_at: "${articleRecord.published_at || ''}"`,
      `focus_keyword: "${articleRecord.focus_keyword}"`,
      `meta_title: "${articleRecord.meta_title.replace(/"/g, '\\"')}"`,
      `meta_description: "${articleRecord.meta_description.replace(/"/g, '\\"')}"`,
      `tags: [${articleRecord.tags.map(t => `"${t}"`).join(', ')}]`,
      articleRecord.cover_image_url ? `cover_image_url: "${articleRecord.cover_image_url}"` : null,
      articleRecord.cover_image_alt ? `cover_image_alt: "${articleRecord.cover_image_alt.replace(/"/g, '\\"')}"` : null,
      '---',
      '',
      `> **الملخص:** ${articleRecord.excerpt}`,
      '',
      articleRecord.content,
      ''
    ].filter(Boolean).join('\n');

    const mdFilePath = path.resolve(CONTENT_DIR, `${articleRecord.slug}.md`);
    fs.writeFileSync(mdFilePath, mdFrontmatter, 'utf-8');

    // 3. Update articles.json index
    const indexList = loadArticlesIndex();
    const existingIdx = indexList.findIndex(a => a.slug === articleRecord.slug);
    if (existingIdx >= 0) {
      indexList[existingIdx] = articleRecord;
    } else {
      indexList.unshift(articleRecord);
    }
    saveArticlesIndex(indexList);

    // 4. Update SEO metadata store
    let seoStore = {};
    if (fs.existsSync(SEO_META_FILE)) {
      try { seoStore = JSON.parse(fs.readFileSync(SEO_META_FILE, 'utf-8')); } catch (_) {}
    }
    seoStore[`article:${articleRecord.slug}`] = {
      pageKey: `article:${articleRecord.slug}`,
      pageUrl: `/articles?slug=${encodeURIComponent(articleRecord.slug)}`,
      metaTitle: articleRecord.meta_title,
      metaDesc: articleRecord.meta_description,
      focusKeyword: articleRecord.focus_keyword,
      canonical: `https://roqiaonline.com/articles?slug=${encodeURIComponent(articleRecord.slug)}`,
      ogTitle: articleRecord.meta_title,
      ogDesc: articleRecord.meta_description,
      ogImage: articleRecord.cover_image_url,
      updatedAt: createdAt,
    };
    fs.writeFileSync(SEO_META_FILE, JSON.stringify(seoStore, null, 2), 'utf-8');

    // 5. Try syncing to PostgreSQL Prisma if available
    const dbResult = await tryPrismaInsert(articleRecord, {
      meta_title: articleRecord.meta_title,
      meta_description: articleRecord.meta_description,
      focus_keyword: articleRecord.focus_keyword,
    });

    const responseSummary = {
      success: true,
      message: args.status === 'published' ? 'تم نشر المقال بنجاح وتحديث الفهارس وسجلات الـ SEO.' : 'تم حفظ مسودة المقال بنجاح.',
      article: {
        id: articleRecord.id,
        title: articleRecord.title,
        slug: articleRecord.slug,
        category: articleRecord.category_name,
        status: articleRecord.status,
        read_time: articleRecord.read_time,
        focus_keyword: articleRecord.focus_keyword,
        files: {
          markdown: mdFilePath,
          indexed_in: ARTICLES_INDEX_FILE,
          seo_store: SEO_META_FILE,
        },
        database_sync: dbResult.dbSaved ? 'Connected & saved to PostgreSQL' : `Offline fallback mode (${dbResult.reason})`,
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(responseSummary, null, 2),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 3: list_articles
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'list_articles',
  'Lists existing articles so the agent can check previous publications, avoid duplication, and build internal links.',
  {
    category_id: z.enum(['all', 'sunnah', 'hasad', 'adhkar']).default('all').describe('Filter by category or "all"'),
    limit: z.number().min(1).max(50).default(20).describe('Maximum articles to return'),
  },
  async (args) => {
    const articles = loadArticlesIndex();
    let filtered = articles;
    if (args.category_id && args.category_id !== 'all') {
      filtered = filtered.filter(a => a.category_id === args.category_id);
    }
    const sliced = filtered.slice(0, args.limit).map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      category_id: a.category_id,
      category_name: a.category_name,
      status: a.status,
      excerpt: a.excerpt,
      focus_keyword: a.focus_keyword,
      read_time: a.read_time,
      published_at: a.published_at,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ total: filtered.length, returned: sliced.length, articles: sliced }, null, 2),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 4: get_article
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'get_article',
  'Retrieves a complete article by its slug or ID.',
  {
    identifier: z.string().describe('The article slug (e.g. "signs-of-evil-eye") or ID.'),
  },
  async (args) => {
    const articles = loadArticlesIndex();
    const article = articles.find(a => a.slug === args.identifier || a.id === args.identifier);
    if (!article) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Article with identifier "${args.identifier}" not found.` }],
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(article, null, 2) }],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 5: validate_article_seo
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  'validate_article_seo',
  'Audits an article draft for SEO/AEO search optimization and returns a score with specific recommendations.',
  {
    title: z.string().describe('The proposed article title'),
    meta_title: z.string().describe('The proposed SEO meta title'),
    meta_description: z.string().describe('The proposed SEO meta description'),
    focus_keyword: z.string().describe('The target search query/keyword'),
    content: z.string().describe('The full article content in Markdown'),
  },
  async (args) => {
    const checks = [];
    let score = 100;

    // 1. Title Length
    const titleLen = args.title.trim().length;
    if (titleLen >= 30 && titleLen <= 70) {
      checks.push({ test: 'Title length', status: 'PASS', score: 10, note: `${titleLen} chars (ideal: 30-70)` });
    } else {
      score -= 10;
      checks.push({ test: 'Title length', status: 'FAIL', score: 0, note: `${titleLen} chars (ideal is 30-70 characters)` });
    }

    // 2. Meta Title
    const metaTitleLen = args.meta_title.trim().length;
    if (metaTitleLen >= 45 && metaTitleLen <= 65) {
      checks.push({ test: 'Meta title length', status: 'PASS', score: 15, note: `${metaTitleLen} chars (ideal: 45-65)` });
    } else {
      score -= 10;
      checks.push({ test: 'Meta title length', status: 'WARN', score: 5, note: `${metaTitleLen} chars (ideal: 45-65)` });
    }

    // 3. Meta Description
    const metaDescLen = args.meta_description.trim().length;
    if (metaDescLen >= 130 && metaDescLen <= 165) {
      checks.push({ test: 'Meta description length', status: 'PASS', score: 20, note: `${metaDescLen} chars (ideal: 130-165)` });
    } else {
      score -= 15;
      checks.push({ test: 'Meta description length', status: 'FAIL', score: 5, note: `${metaDescLen} chars (recommended: 130-165)` });
    }

    // 4. Focus keyword in Title
    const keywordLower = args.focus_keyword.trim().toLowerCase();
    if (args.title.toLowerCase().includes(keywordLower)) {
      checks.push({ test: 'Focus keyword in title', status: 'PASS', score: 15, note: 'Found in H1 title' });
    } else {
      score -= 15;
      checks.push({ test: 'Focus keyword in title', status: 'FAIL', score: 0, note: `Keyword "${args.focus_keyword}" not found in title` });
    }

    // 5. Focus keyword in Meta Description
    if (args.meta_description.toLowerCase().includes(keywordLower)) {
      checks.push({ test: 'Focus keyword in meta description', status: 'PASS', score: 15, note: 'Found in meta description' });
    } else {
      score -= 15;
      checks.push({ test: 'Focus keyword in meta description', status: 'FAIL', score: 0, note: `Keyword "${args.focus_keyword}" not found in meta description` });
    }

    // 6. Content length & structure
    const wordCount = args.content.trim().split(/\s+/).length;
    if (wordCount >= 600) {
      checks.push({ test: 'Word count depth', status: 'PASS', score: 15, note: `${wordCount} words (good authoritative depth >= 600 words)` });
    } else {
      score -= 15;
      checks.push({ test: 'Word count depth', status: 'WARN', score: 5, note: `${wordCount} words (recommend >= 600 words for competitive ranking)` });
    }

    // 7. Subheadings
    const hasH2 = /^##\s+/m.test(args.content);
    if (hasH2) {
      checks.push({ test: 'Heading hierarchy (H2)', status: 'PASS', score: 10, note: 'Found proper H2 subheadings' });
    } else {
      score -= 10;
      checks.push({ test: 'Heading hierarchy (H2)', status: 'FAIL', score: 0, note: 'Missing H2 subheadings in content' });
    }

    const finalScore = Math.max(0, score);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            seo_score: finalScore,
            grade: finalScore >= 90 ? 'A+ (Excellent)' : finalScore >= 75 ? 'B (Good)' : 'C (Needs Improvement)',
            focus_keyword: args.focus_keyword,
            checks,
          }, null, 2),
        },
      ],
    };
  }
);

// Start MCP Server on stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('RukiaOnline Article MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});
