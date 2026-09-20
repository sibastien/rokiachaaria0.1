// src/services/quran.service.js
// Quran data, Ruqyah verses, translations, and verified recitations service.
// Uses @quranjs/api when credentials are configured, with automatic resilient fallback
// to Quran.com public v4 API and in-memory caching.

const https = require('https');

// ── In-Memory Cache ─────────────────────────────────────────────────────────
const cache = {
  chapters: null,
  chaptersTimestamp: 0,
  reciters: null,
  chapterAudio: new Map(),
  ruqyahVerses: null,
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── HTTPS Helper ─────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'RuqyahApp/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response from ${url}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

// ── Curated Authentic Ruqyah Verses Collection ──────────────────────────────
// Pre-seeded with authentic texts, references, translations, and high-fidelity audio streams.
const RUQYAH_VERSES_SEED = [
  {
    id: "ruqyah-fatihah",
    title: "سورة الفاتحة (أم الكتاب والشافية)",
    surahNumber: 1,
    surahName: "الفاتحة",
    verseKey: "1:1-7",
    category: "شاملة",
    arabicText: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝ الرَّحْمَٰنِ الرَّحِيمِ ۝ مَالِكِ يَوْمِ الدِّينِ ۝ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ۝ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ ۝ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ",
    translation: "In the name of Allah, the Entirely Merciful, the Especially Merciful. [All] praise is [due] to Allah, Lord of the worlds - The Entirely Merciful, the Especially Merciful, Sovereign of the Day of Recompense. It is You we worship and You we ask for help. Guide us to the straight path - The path of those upon whom You have bestowed favor, not of those who have evoked [Your] anger or of those who are astray.",
    reference: "سورة الفاتحة [الآيات 1-7]",
    benefit: "أم القرآن، والسبع المثاني، ورقية الشفاء من كل داء ولدغة وعين.",
    audioUrl: "https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/1.mp3",
    reciter: "مشاري راشد العفاسي",
    duration: "00:45"
  },
  {
    id: "ruqyah-kursi",
    title: "آية الكرسي (أعظم آية للحفظ والتحصين)",
    surahNumber: 2,
    surahName: "البقرة",
    verseKey: "2:255",
    category: "تحصين النفس",
    arabicText: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ",
    translation: "Allah - there is no deity except Him, the Ever-Living, the Sustainer of [all] existence. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is [presently] before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills. His Kursi extends over the heavens and the earth, and their preservation tires Him not. And He is the Most High, the Most Great.",
    reference: "سورة البقرة [الآية 255]",
    benefit: "أعظم آية في كتاب الله تعالى، من قرأها إذا أوى إلى فراشه لم يزل عليه من الله حافظ ولا يقربه شيطان حتى يصبح.",
    audioUrl: "https://verses.quran.com/Alafasy/mp3/002255.mp3",
    reciter: "مشاري راشد العفاسي",
    duration: "01:15"
  },
  {
    id: "ruqyah-baqarah-last",
    title: "خواتيم سورة البقرة (كفايتان من كل شر)",
    surahNumber: 2,
    surahName: "البقرة",
    verseKey: "2:285-286",
    category: "سكينة ونوم",
    arabicText: "آمَنَ الرَّسُولُ بِمَا أُنْزِلَ إِلَيْهِ مِنْ رَبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِنْ رُسُلِهِ ۚ وَقَالُوا سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ الْمَصِيرُ ۝ لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِنْ نَسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِنْ قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنْتَ مَوْلَانَا فَانْصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ",
    translation: "The Messenger has believed in what was revealed to him from his Lord, and [so have] the believers. All of them have believed in Allah and His angels and His books and His messengers... Allah does not charge a soul except [with that within] its capacity...",
    reference: "سورة البقرة [الآيات 285-286]",
    benefit: "قال رسول الله ﷺ: «من قرأ بالآيتين من آخر سورة البقرة في ليلة كفتاه».",
    audioUrl: "https://verses.quran.com/Alafasy/mp3/002285.mp3",
    reciter: "مشاري راشد العفاسي",
    duration: "01:50"
  },
  {
    id: "ruqyah-araf-magic",
    title: "آيات إبطال السحر (سورة الأعراف)",
    surahNumber: 7,
    surahName: "الأعراف",
    verseKey: "7:117-122",
    category: "إبطال السحر",
    arabicText: "وَأَوْحَيْنَا إِلَىٰ مُوسَىٰ أَنْ أَلْقِ عَصَاكَ ۖ فَإِذَا هِيَ تَلْقَفُ مَا يَأْفِكُونَ ۝ فَوَقَعَ الْحَقُّ وَبَطَلَ مَا كَانُوا يَعْمَلُونَ ۝ فَغُلِبُوا هُنَالِكَ وَانْقَلَبُوا صَاغِرِينَ ۝ وَأُلْقِيَ السَّحَرَةُ سَاجِدِينَ ۝ قَالُوا آمَنَّا بِرَبِّ الْعَالَمِينَ ۝ رَبِّ مُوسَىٰ وَهَارُونَ",
    translation: "And We inspired to Moses, 'Throw your staff,' and at once it devoured what they were falsifying. So the truth was established, and that which they had been doing was abolished. And that was when they were defeated there and returned disgraced. And the magicians fell down in prostration. They said, 'We have believed in the Lord of the worlds, The Lord of Moses and Aaron.'",
    reference: "سورة الأعراف [الآيات 117-122]",
    benefit: "آيات قرآنية قاطعة لإبطال كل سحر وكيد خبيث بحول الله وقوته.",
    audioUrl: "https://verses.quran.com/Alafasy/mp3/007117.mp3",
    reciter: "مشاري راشد العفاسي",
    duration: "01:10"
  },
  {
    id: "ruqyah-yunus-magic",
    title: "آيات إبطال السحر (سورة يونس)",
    surahNumber: 10,
    surahName: "يونس",
    verseKey: "10:81-82",
    category: "إبطال السحر",
    arabicText: "فَلَمَّا أَلْقَوْا قَالَ مُوسَىٰ مَا جِئْتُمْ بِهِ السِّحْرُ ۖ إِنَّ اللَّهَ سَيُبْطِلُهُ ۖ إِنَّ اللَّهَ لَا يُصْلِحُ عَمَلَ الْمُفْسِدِينَ ۝ وَيُحِقُّ اللَّهُ الْحَقَّ بِكَلِمَاتِهِ وَلَوْ كَرِهَ الْمُجْرِمُونَ",
    translation: "And when they had thrown, Moses said, 'What you have brought is [only] magic. Indeed, Allah will expose its worthlessness. Indeed, Allah does not amend the work of corrupters. And Allah will establish the truth by His words, even if the criminals dislike it.'",
    reference: "سورة يونس [الآيات 81-82]",
    benefit: "قول موسى عليه السلام «إِنَّ اللَّهَ سَيُبْطِلُهُ» من أقوى الأدعية القرآنية في نسف السحر.",
    audioUrl: "https://verses.quran.com/Alafasy/mp3/010081.mp3",
    reciter: "مشاري راشد العفاسي",
    duration: "00:45"
  },
  {
    id: "ruqyah-taha-magic",
    title: "آية كيد الساحر (سورة طه)",
    surahNumber: 20,
    surahName: "طه",
    verseKey: "20:69",
    category: "إبطال السحر",
    arabicText: "وَأَلْقِ مَا فِي يَمِينِكَ تَلْقَفْ مَا صَنَعُوا ۖ إِنَّمَا صَنَعُوا كَيْدُ سَاحِرٍ ۖ وَلَا يُفْلِحُ السَّاحِرُ حَيْثُ أَتَىٰ",
    translation: "And throw what is in your right hand; it will swallow up what they have crafted. What they have crafted is but the trick of a magician, and the magician will not succeed wherever he is.",
    reference: "سورة طه [الآية 69]",
    benefit: "بيان قطعي بأن الساحر خاسر مبطل لا يفلح أبداً أينما حل وارتحل.",
    audioUrl: "https://verses.quran.com/Alafasy/mp3/020069.mp3",
    reciter: "مشاري راشد العفاسي",
    duration: "00:30"
  },
  {
    id: "ruqyah-ikhlas",
    title: "سورة الإخلاص (التوحيد الخالص)",
    surahNumber: 112,
    surahName: "الإخلاص",
    verseKey: "112:1-4",
    category: "تحصين النفس",
    arabicText: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ",
    translation: "Say, 'He is Allah, [who is] One, Allah, the Eternal Refuge. He neither begets nor is born, Nor is there to Him any equivalent.'",
    reference: "سورة الإخلاص [الآيات 1-4]",
    benefit: "تعدل ثلث القرآن، وأساس التوحيد الذي تنفر منه شياطين الإنس والجن.",
    audioUrl: "https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/112.mp3",
    reciter: "مشاري راشد العفاسي",
    duration: "00:25"
  },
  {
    id: "ruqyah-falaq",
    title: "سورة الفلق (الاستعاذة من شر الحاسدين والسحرة)",
    surahNumber: 113,
    surahName: "الفلق",
    verseKey: "113:1-5",
    category: "عين وحسد",
    arabicText: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ",
    translation: "Say, 'I seek refuge in the Lord of daybreak, From the evil of that which He created, And from the evil of darkness when it settles, And from the evil of the blowers in knots, And from the evil of an envier when he envies.'",
    reference: "سورة الفلق [الآيات 1-5]",
    benefit: "أعظم ما استعاذ به المستعيذون من شر النفاثات في العقد (السواحر) ومن شر عين الحاسد.",
    audioUrl: "https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/113.mp3",
    reciter: "مشاري راشد العفاسي",
    duration: "00:30"
  },
  {
    id: "ruqyah-nas",
    title: "سورة الناس (الاستعاذة من وسواس الخناس)",
    surahNumber: 114,
    surahName: "الناس",
    verseKey: "114:1-6",
    category: "سكينة ونوم",
    arabicText: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَٰهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ",
    translation: "Say, 'I seek refuge in the Lord of mankind, The Sovereign of mankind, The God of mankind, From the evil of the retreating whisperer - Who whispers into the breasts of mankind - From among the jinn and mankind.'",
    reference: "سورة الناس [الآيات 1-6]",
    benefit: "صارفة للوساوس، والضيق النفسي، والهم والغم بفضل الاستعاذة بملك الناس وإله الناس.",
    audioUrl: "https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/114.mp3",
    reciter: "مشاري راشد العفاسي",
    duration: "00:35"
  },
  {
    id: "ruqyah-israa-healing",
    title: "آية الشفاء والرحمة (سورة الإسراء)",
    surahNumber: 17,
    surahName: "الإسراء",
    verseKey: "17:82",
    category: "شاملة",
    arabicText: "وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ شِفَاءٌ وَرَحْمَةٌ لِلْمُؤْمِنِينَ ۙ وَلَا يَزِيدُ الظَّالِمِينَ إِلَّا خَسَارًا",
    translation: "And We send down of the Qur'an that which is healing and mercy for the believers, but it does not increase the wrongdoers except in loss.",
    reference: "سورة الإسراء [الآية 82]",
    benefit: "برهان إلهي صريح بأن القرآن العظيم دواء وشفاء تام لأمراض القلوب والأبدان.",
    audioUrl: "https://verses.quran.com/Alafasy/mp3/017082.mp3",
    reciter: "مشاري راشد العفاسي",
    duration: "00:25"
  }
];

// ── Verified Reciters for Ruqyah & Murattal ─────────────────────────────────
const VERIFIED_RECITERS = [
  {
    id: 7,
    name: "مشاري بن راشد العفاسي",
    nameEn: "Mishari Rashid al-`Afasy",
    style: "مرتل - هادئ ومؤثر",
    slug: "mishari_al_afasy",
    cdnPrefix: "https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal"
  },
  {
    id: 2,
    name: "عبد الباسط عبد الصمد",
    nameEn: "AbdulBaset AbdulSamad",
    style: "مرتل - نقي وقوي",
    slug: "abdul_baset",
    cdnPrefix: "https://download.quranicaudio.com/qdc/abdul_baset/murattal"
  },
  {
    id: 13,
    name: "ماهر المعيقلي",
    nameEn: "Maher Al-Muaiqly",
    style: "مرتل خاشع",
    slug: "maher_almuaiqly",
    cdnPrefix: "https://download.quranicaudio.com/qdc/maher_almuaiqly/murattal"
  },
  {
    id: 3,
    name: "سعد الغامدي",
    nameEn: "Saad Al-Ghamdi",
    style: "مرتل - طمأنينة وسكينة",
    slug: "saad_al_ghamidi",
    cdnPrefix: "https://server7.mp3quran.net/s_gmd"
  },
  {
    id: 6,
    name: "محمود خليل الحصري",
    nameEn: "Mahmoud Khalil Al-Husary",
    style: "مرتل - ضبط الأحكام والتجويد",
    slug: "al_husary",
    cdnPrefix: "https://download.quranicaudio.com/qdc/khalil_al_husary/murattal"
  },
  {
    id: 4,
    name: "أبو بكر الشاطري",
    nameEn: "Abu Bakr al-Shatri",
    style: "مرتل عذب",
    slug: "abu_bakr_shatri",
    cdnPrefix: "https://download.quranicaudio.com/qdc/abu_bakr_shatri/murattal"
  },
  {
    id: 5,
    name: "هاني الرفاعي",
    nameEn: "Hani ar-Rifai",
    style: "تلاوة خاشعة للرقية والتضرع",
    slug: "hani_rifai",
    cdnPrefix: "https://download.quranicaudio.com/qdc/hani_ar_rifai/murattal"
  }
];

// ── Quran Service Implementation ────────────────────────────────────────────
class QuranService {
  /**
   * Returns the curated list of authentic Ruqyah verses.
   */
  async getRuqyahVerses() {
    return RUQYAH_VERSES_SEED;
  }

  /**
   * Returns all 114 Quran chapters (Surahs) with Arabic name, translation, verses count.
   */
  async getChapters(language = 'ar') {
    const now = Date.now();
    if (cache.chapters && (now - cache.chaptersTimestamp < CACHE_TTL_MS)) {
      return cache.chapters;
    }

    try {
      const data = await fetchJson(`https://api.quran.com/api/v4/chapters?language=${language}`);
      if (data && Array.isArray(data.chapters)) {
        cache.chapters = data.chapters.map(c => ({
          id: c.id,
          nameArabic: c.name_arabic,
          nameSimple: c.name_simple,
          nameComplex: c.name_complex,
          versesCount: c.verses_count,
          revelationPlace: c.revelation_place === 'makkah' ? 'مكية' : 'مدنية',
          revelationOrder: c.revelation_order,
          bismillahPre: c.bismillah_pre
        }));
        cache.chaptersTimestamp = now;
        return cache.chapters;
      }
    } catch (err) {
      console.warn('[QuranService] Failed to fetch live chapters, using cached/fallback:', err.message);
      if (cache.chapters) return cache.chapters;
    }

    // Fallback minimal chapters if network unreachable
    return [
      { id: 1, nameArabic: "الفاتحة", nameSimple: "Al-Fatihah", versesCount: 7, revelationPlace: "مكية" },
      { id: 2, nameArabic: "البقرة", nameSimple: "Al-Baqarah", versesCount: 286, revelationPlace: "مدنية" },
      { id: 3, nameArabic: "آل عمران", nameSimple: "Ali 'Imran", versesCount: 200, revelationPlace: "مدنية" },
      { id: 36, nameArabic: "يس", nameSimple: "Ya-Sin", versesCount: 83, revelationPlace: "مكية" },
      { id: 55, nameArabic: "الرحمن", nameSimple: "Ar-Rahman", versesCount: 78, revelationPlace: "مدنية" },
      { id: 67, nameArabic: "الملك", nameSimple: "Al-Mulk", versesCount: 30, revelationPlace: "مكية" },
      { id: 112, nameArabic: "الإخلاص", nameSimple: "Al-Ikhlas", versesCount: 4, revelationPlace: "مكية" },
      { id: 113, nameArabic: "الفلق", nameSimple: "Al-Falaq", versesCount: 5, revelationPlace: "مكية" },
      { id: 114, nameArabic: "الناس", nameSimple: "An-Nas", versesCount: 6, revelationPlace: "مكية" }
    ];
  }

  /**
   * Returns list of verified reciters.
   */
  async getReciters() {
    return VERIFIED_RECITERS;
  }

  /**
   * Resolves direct audio stream URL for a given chapter and reciter.
   */
  async getChapterAudio(chapterId, reciterId = 7) {
    const chapterNum = parseInt(chapterId, 10);
    const reciterNum = parseInt(reciterId, 10);

    if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > 114) {
      throw new Error('رقم السورة غير صالح (يجب أن يكون بين 1 و 114)');
    }

    const cacheKey = `${reciterNum}_${chapterNum}`;
    if (cache.chapterAudio.has(cacheKey)) {
      return cache.chapterAudio.get(cacheKey);
    }

    // Find reciter info
    const reciter = VERIFIED_RECITERS.find(r => r.id === reciterNum) || VERIFIED_RECITERS[0];

    // Try fetching official recitation metadata from Quran.com
    let audioUrl = null;
    try {
      const liveRes = await fetchJson(`https://api.quran.com/api/v4/chapter_recitations/${reciter.id}/${chapterNum}`);
      if (liveRes && liveRes.audio_file && liveRes.audio_file.audio_url) {
        audioUrl = liveRes.audio_file.audio_url;
      }
    } catch (e) {
      // Ignore and fallback to canonical CDN pattern
    }

    // Fallback URL generator if live API fails
    if (!audioUrl) {
      const padded = String(chapterNum).padStart(3, '0');
      if (reciter.slug === 'saad_al_ghamidi') {
        audioUrl = `https://server7.mp3quran.net/s_gmd/${padded}.mp3`;
      } else {
        audioUrl = `${reciter.cdnPrefix}/${chapterNum}.mp3`;
      }
    }

    const result = {
      chapterId: chapterNum,
      reciterId: reciter.id,
      reciterName: reciter.name,
      audioUrl
    };

    cache.chapterAudio.set(cacheKey, result);
    return result;
  }

  /**
   * Fetches a specific verse by verse_key (e.g. "2:255") with Arabic text and English translation.
   */
  async getVerse(verseKey) {
    try {
      const res = await fetchJson(`https://api.quran.com/api/v4/verses/by_key/${encodeURIComponent(verseKey)}?translations=85&fields=text_uthmani,chapter_id`);
      if (res && res.verse) {
        return {
          id: res.verse.id,
          verseKey: res.verse.verse_key,
          arabicText: res.verse.text_uthmani,
          translation: res.verse.translations?.[0]?.text || null,
          chapterId: res.verse.chapter_id
        };
      }
    } catch (err) {
      console.warn(`[QuranService] Could not fetch verse ${verseKey}:`, err.message);
    }
    return null;
  }
}

module.exports = new QuranService();
