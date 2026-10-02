# RukiaOnline Article MCP Server

Model Context Protocol (MCP) server for **الرقية الشرعية أونلاين** to autonomously generate, validate, and publish SEO-optimized articles according to authentic Islamic Ruqyah standards.

## Features
- **`publish_article`**: Publish or draft articles with full SEO metadata, slugs, and categories.
- **`list_categories`**: View approved platform categories (`sunnah`, `hasad`, `adhkar`).
- **`list_articles`**: List existing articles to prevent duplicate topics and cross-link.
- **`get_article`**: Fetch articles by slug or ID.
- **`validate_article_seo`**: Score and audit article drafts for search engine ranking (0-100).
- **Persistent Storage**: Saves to `content/articles/{slug}.md`, updates `content/articles/articles.json`, updates `content/seo_metadata.json`, and seamlessly synchronizes with Prisma PostgreSQL when the DB is running.

## Quick Start
```bash
cd mcp-server
npm install
node index.js
```

## Running Tests
```bash
npm test
```
