// prisma/seed.js
// Seeds the database with:
//   1. Admin user
//   2. Two Raqi practitioners with profiles
//   3. Three blog articles
//   4. Two approved forum posts with official replies
//
// Run: node prisma/seed.js
//   or: npm run db:seed

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding database...\n');

  // ── 1. Admin User ─────────────────────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@ruqyah-online.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@Ruqyah2024!';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      name: 'مشرف المنصة',
      role: 'ADMIN',
    },
  });
  console.log(`✅  Admin: ${admin.email}`);

  // ── 2. Raqi Users + Profiles ──────────────────────────────────────────────
  const raqi1User = await prisma.user.upsert({
    where: { email: 'omar.qasim@ruqyah-online.com' },
    update: {},
    create: {
      email: 'omar.qasim@ruqyah-online.com',
      passwordHash: await bcrypt.hash('Raqi@Omar2024!', 12),
      name: 'الشيخ عمر القاسم',
      role: 'RAQI',
    },
  });

  await prisma.raqiProfile.upsert({
    where: { userId: raqi1User.id },
    update: {},
    create: {
      userId: raqi1User.id,
      bio: 'مختص في الرقية الشرعية والطب النبوي مع إجازة في القراءات العشر.',
      certifications: 'إجازة في القراءات العشر — جامعة الأزهر الشريف',
      specialties: ['سحر', 'عين', 'مس', 'تحصين أطفال'],
      isAvailable: true,
      sessionPrice: 150,
    },
  });
  console.log(`✅  Raqi 1: ${raqi1User.email}`);

  const raqi2User = await prisma.user.upsert({
    where: { email: 'yusuf.nablusi@ruqyah-online.com' },
    update: {},
    create: {
      email: 'yusuf.nablusi@ruqyah-online.com',
      passwordHash: await bcrypt.hash('Raqi@Yusuf2024!', 12),
      name: 'د. يوسف النابلسي',
      role: 'RAQI',
    },
  });

  await prisma.raqiProfile.upsert({
    where: { userId: raqi2User.id },
    update: {},
    create: {
      userId: raqi2User.id,
      bio: 'استشاري التوجيه النفسي والأسري مع خبرة في الرقية التشخيصية.',
      certifications: 'دكتوراه في علم النفس الإسلامي — استشاري رقية شرعية معتمد',
      specialties: ['استشارة تشخيصية', 'توجيه أسري', 'علاج وسواس'],
      isAvailable: true,
      sessionPrice: 200,
    },
  });
  console.log(`✅  Raqi 2: ${raqi2User.email}`);

  // ── 3. Blog Articles ──────────────────────────────────────────────────────
  const articles = [
    {
      title: 'الفرق الجوهري بين الرقية الشرعية والكهانة المحرمة',
      excerpt: 'كيف يعرف المسلم الراقي الشرعي الصادق الذي يكتفي بكتاب الله، وما هي علامات الدجالين التي يجب الحذر منها؟',
      content: `<p>الحمد لله والصلاة والسلام على رسول الله. إن الرقية الشرعية عبادة شرعية الأصل فيها كلام الله تعالى، وأسماؤه الحسنى، وصفاته العلى، والأدعية المأثورة عن رسول الله ﷺ.</p>
<p class="font-bold">شروط الرقية الشرعية المتفق عليها:</p>
<ul>
  <li>أن تكون بكلام الله تعالى أو بأسمائه وصفاته.</li>
  <li>أن تكون باللسان العربي وبما يُعرف معناه دون طلاسم.</li>
  <li>أن يُعتقد أن الرقية لا تؤثر بذاتها بل بتقدير الله تعالى والشفاء منه وحده.</li>
</ul>
<p>أما الكهانة والدجل فتتميز بطلب اسم الأم، أو التمتمة بكلام غير مفهوم، أو إعطاء أحجبة وحروز، وكل ذلك محرم شرعاً.</p>`,
      categoryKey: 'sunnah',
      categoryName: 'السنة النبوية',
      author: 'د. عبد الرحمن السعدي',
      readTime: '4 دقائق',
    },
    {
      title: 'أعراض الإصابة بالعين وكيف ترقي نفسك في بيتك',
      excerpt: 'خطوات ميسرة وعملية لرشح النفس بالمعوذات والنفث، وأثر الوضوء والذكر في رد كيد الحاسدين.',
      content: `<p>العين حق كما قال النبي ﷺ: «العينُ حقٌّ ولو كان شيءٌ سابقَ القدَرَ سبقتْهُ العينُ».</p>
<p class="font-bold">طريقة الرقية الذاتية من العين:</p>
<p>1. ضع يدك على رأسك وقل: «بسمِ اللهِ أرقيكَ من كلِّ شيءٍ يُؤذيكَ» ثلاثاً.</p>
<p>2. قراءة سورة الفاتحة والإخلاص والمعوذتين مع النفث في الكفين ومسح الجسد.</p>
<p>3. الإكثار من قول: «ما شاء الله لا قوة إلا بالله».</p>`,
      categoryKey: 'hasad',
      categoryName: 'العين والحسد',
      author: 'الشيخ عمر القاسم',
      readTime: '6 دقائق',
    },
    {
      title: 'حصن المسلم المتين: 5 أذكار تحفظك طوال يومك وليلتك',
      excerpt: 'كنوز نبوية عظيمة تحصنك من كل سوء بكلمات يسيرة لا تستغرق أكثر من خمس دقائق يومياً.',
      content: `<p>قال النبي ﷺ: «مَن قالَ: بسمِ اللهِ الذي لا يَضُرُّ مع اسمِهِ شيءٌ في الأرضِ ولا في السماءِ وهو السميعُ العليمُ، ثلاثَ مراتٍ، لم تُصِبْهُ فجأةُ بلاءٍ حتى يُصبِحَ».</p>
<p class="font-bold">الأوراد الخمسة الجامعة:</p>
<ul>
  <li>قراءة آية الكرسي دبر كل صلاة وعند النوم.</li>
  <li>المعوذتان وقل هو الله أحد ثلاث مرات صباحاً ومساءً.</li>
  <li>قول: «أعوذ بكلمات الله التامات من شر ما خلق» ثلاثاً بالمساء.</li>
  <li>قول: «لا إله إلا الله وحده لا شريك له...» 100 مرة في اليوم.</li>
</ul>`,
      categoryKey: 'adhkar',
      categoryName: 'الأذكار والتحصين',
      author: 'د. يوسف النابلسي',
      readTime: '3 دقائق',
    },
  ];

  for (const article of articles) {
    await prisma.article.upsert({
      where: { id: article.title }, // won't match — will always insert on first run
      update: {},
      create: article,
    }).catch(async () => {
      // On conflict or cuid mismatch just create
      await prisma.article.create({ data: article }).catch(() => {});
    });
  }
  console.log(`✅  Articles: ${articles.length} seeded`);

  // ── 4. Forum Posts ────────────────────────────────────────────────────────
  const post1 = await prisma.forumPost.create({
    data: {
      authorName: 'أبو أنس التونسي',
      title: 'تجربتي مع جلسة الرقية الأونلاين لطفلي بعد كوابيس مستمرة',
      content: 'الحمد لله الذي بنعمته تتم الصالحات. ابني كان يستيقظ باكياً ومذعوراً لشهور. حجزنا جلسة مع الراقي عبر المنصة، علمنا أذكار النوم الصحيحة وقرأ عليه مباشرة. بفضل الله عادت السكينة إلى نومه من الليلة الأولى.',
      badge: 'تجربة شفاء',
      status: 'APPROVED',
      officialReply: 'نحمد الله على شفائه، ونوصيكم بالاستمرار على قراءة المعوذتين في الكفين ومسح رأسه وجسده قبل النوم.',
      likesCount: 34,
    },
  });

  await prisma.forumPost.create({
    data: {
      authorName: 'أخت في الله',
      title: 'هل سماع الرقية المسجلة بالسماعات يكفي أم يجب الحضور المباشر؟',
      content: 'السلام عليكم، أود السؤال: هل تشغيل رقية مسجلة في البيت يكفي لطرد الضيق، أم أن الجلسة التفاعلية الحية لها أثر أقوى من الناحية الشرعية؟',
      badge: 'استفسار شرعي',
      status: 'APPROVED',
      officialReply: 'وعليكم السلام ورحمة الله. الاستماع للمسجل فيه خير وبركة، لكن الجلسة المباشرة تمتاز بحضور القلب، وتوجيه الراقي للآيات بحسب تفاعل المسترقي.',
      likesCount: 19,
    },
  });

  console.log(`✅  Forum posts: 2 seeded`);

  // ── 5. Site Settings ──────────────────────────────────────────────────────
  await prisma.siteSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      bannerActive: true,
      bannerText: 'جميع الرقاة لدينا معتمدون ومجازون في قراءة القرآن الكريم والسنة النبوية الصحيحة بلا بدع',
      heroTitle: 'منصة الرقية الشرعية المعتمدة أونلاين',
      heroSubtitle: 'تواصل مباشرة بالصوت والصورة مع نخبة من الرقاة والمشايخ المعتمدين والمجازين شرعياً في سرية وأمان تام',
      whatsapp: '+966500000000',
      supportEmail: 'support@roqia.com',
      sessionDuration: 45,
      bookingNotice: 'يجب تواجد محرم للنساء أثناء الجلسة المرئية',
    },
  });
  console.log('✅  Site Settings: seeded');

  // ── 6. Audio Tracks ───────────────────────────────────────────────────────
  const audioTracks = [
    {
      title: 'سورة الفاتحة وآية الكرسي',
      reciter: 'تلاوة خاشعة مرتلة بنية الشفاء',
      duration: '04:30',
      category: 'شاملة',
      src: 'https://server8.mp3quran.net/afs/001.mp3',
      orderIndex: 0,
    },
    {
      title: 'أواخر سورة البقرة والمعوذات',
      reciter: 'تلاوة هادئة لرد كيد الشيطان والتحصين',
      duration: '05:15',
      category: 'سكينة ونوم',
      src: 'https://server7.mp3quran.net/basit/002.mp3',
      orderIndex: 1,
    },
    {
      title: 'آيات إبطال السحر والعين',
      reciter: 'تلاوة موجهة من سور يونس وطه والأعراف',
      duration: '06:40',
      category: 'عين وحسد',
      src: 'https://server12.mp3quran.net/maher/001.mp3',
      orderIndex: 2,
    },
  ];

  const existingAudio = await prisma.audioTrack.count();
  if (existingAudio === 0) {
    await prisma.audioTrack.createMany({ data: audioTracks });
    console.log(`✅  Audio tracks: ${audioTracks.length} seeded`);
  } else {
    console.log(`ℹ️  Audio tracks: already populated (${existingAudio} tracks)`);
  }

  console.log('\n🎉  Seeding complete!\n');
  console.log('📋  Credentials:');
  console.log(`    Admin:  ${adminEmail} / ${adminPassword}`);
  console.log(`    Raqi 1: omar.qasim@ruqyah-online.com / Raqi@Omar2024!`);
  console.log(`    Raqi 2: yusuf.nablusi@ruqyah-online.com / Raqi@Yusuf2024!\n`);
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
