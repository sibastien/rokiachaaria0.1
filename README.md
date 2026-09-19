# الرقية الشرعية أونلاين (Ruqyah Online)

منصة متكاملة لخدمات الرقية الشرعية والاستشارات الروحية، تضم واجهة مستخدم حديثة وتطبيق خادم (Backend API) مبني باستخدام Node.js و Express و Prisma ORM.

## هيكل المشروع (Project Structure)

```text
projet/
├── index.html            # الواجهة الأمامية للموقع (Frontend)
├── server/               # خادم الـ API (Backend)
│   ├── prisma/           # مخطط وقاعدة بيانات Prisma
│   ├── src/              # شيفرة الخادم (Controllers, Routes, Middlewares, etc.)
│   ├── .env.example      # نموذج متغيرات البيئة
│   └── package.json
└── README.md
```

## المتطلبات (Prerequisites)

- Node.js (v18+)
- npm أو yarn
- قاعدة بيانات PostgreSQL (أو SQLite حسب الإعدادات في Prisma)

## تشغيل الخادم (Server Setup)

```bash
# الانتقال لمجلد الخادم
cd server

# تثبيت الحزم
npm install

# إعداد متغيرات البيئة
cp .env.example .env

# توليد Prisma Client وتشغيل الترحيلات
npm run db:generate
npm run db:push

# تشغيل الخادم في وضع التطوير
npm run dev
```
