# SEO and AI Engine Optimization (AEO/GEO) Master Plan

## 1. AI Search & Generative Engine Optimization (AEO)
- Create an `llms.txt` file in the root public directory pointing to our core text content, FAQs, and key documentation in clean markdown.
- Update `robots.txt` to explicitly allow AI search crawlers (`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, and `Google-Extended`).
- Implement JSON-LD Schema Markup across templates: Organization/WebSite on homepage, Article/BlogPosting on content pages, and FAQPage where applicable.

## 2. Traditional Google Indexing & Core SEO
- Build a dynamic `sitemap.xml` that automatically updates `<lastmod>` timestamps accurately whenever content changes.
- Implement self-referencing `<link rel="canonical">` tags on all pages to prevent duplicate content issues.
- Ensure unique `<title>` and `<meta name="description">` tags, plus Open Graph (`og:`) tags, on all templates.
- Enforce strict semantic HTML tag hierarchies (`<h1>` for title, `<h2>` for main sections, `<h3>` for subsections).

## 3. Technical Performance & Instant Indexing
- Integrate the **IndexNow API** protocol to instantly ping search engines when a page is published or updated.
- Verify that all meta tags, structured data, and content are properly Server-Side Rendered (SSR) so bots don't need to execute client-side JS to read them.
