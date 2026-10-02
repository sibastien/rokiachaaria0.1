const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.resolve(__dirname, 'index.js');
const proc = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let buffer = '';

proc.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1) {
        // Send call tool
        const callReq = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'publish_article',
            arguments: {
              title: 'الرقية الشرعية للعين والحسد: الأعراض وطريقة العلاج بالسنة النبوية',
              slug: 'ruqyah-al-ayn-wal-hasad-symptoms-treatment',
              category_id: 'hasad',
              status: 'published',
              focus_keyword: 'رقية العين والحسد',
              meta_title: 'رقية العين والحسد: الأعراض والعلاج الشرعي | مدونة الشفاء',
              meta_description: 'دليل شرعي شامل يوضح أعراض الإصابة بالعين والحسد، وطريقة العلاج بالرقية الشرعية الصحيحة من القرآن والسنة النبوية دون بدع.',
              excerpt: 'تعرف على الأعراض الحقيقية للإصابة بالعين والحسد وطريقة الرقية الشرعية المعتمدة بالقرآن الكريم والأدعية النبوية الصحيحة لتحقيق الشفاء بإذن الله.',
              tags: ['العين والحسد', 'الرقية الشرعية', 'أعراض العين', 'علاج الحسد', 'الطب النبوي'],
              author: 'هيئة الرقاة الشرعية المعتمدة',
              content: `## مقدمة في حقيقة العين والحسد\n\nالعين والحسد ثابتان بالكتاب والسنة الصحيحة، قال النبي ﷺ: «العَيْنُ حَقٌّ، ولو كانَ شيءٌ سابَقَ القَدَرَ سَبَقَتْهُ العَيْنُ» (صحيح مسلم). والشفاء منها يكون باللجوء إلى الله تعالى والاعتماد على الرقية الشرعية الخالصة من القرآن الكريم والأدعية النبوية الثابتة.\n\n## أبرز أعراض الإصابة بالعين والحسد\n\nتتفاوت أعراض الإصابة بحسب قوة أثر العين وحال الشخص، ومن أبرزها وفق الاستقراء الشرعي:\n1. خمول وكسل غير معتاد مع ثقل في مؤخرة الرأس والأكتاف.\n2. التثاؤب المستمر المصحوب بالدموع عند سماع القرآن أو الأذان.\n3. ضيق في الصدر وتغير مفاجئ في المزاج والنفور من العبادات.\n4. ظهور كدمات زرقاء أو خضراء في الجسد دون سبب طبي.\n\n## طريقة الرقية الشرعية للعين والحسد خطوة بخطوة\n\n1. **استحضار النية واليقين:** اليقين بأن الشفاء بيد الله وحده والرقية مجرد سبب شرعي.\n2. **الوضوء والطهارة:** أن يكون الراقي والمسترقي على طهارة تامة.\n3. **قراءة الفاتحة والمعوذتين:** تكرار سورة الفاتحة وآية الكرسي وسورة الإخلاص والفلق والناس ثلاث مرات مع النفث الخفيف.\n4. **الدعاء النبوي المأثور:** قول «أعوذ بكلمات الله التامات من شر ما خلق»، و«بسم الله أرقيك من كل شيء يؤذيك».\n\n## الخاتمة\n\nالمحافظة على أذكار الصباح والمساء هي الحصن الحصين من كل شر، فإذا أصيب المسلم بالعين فليثق بربه وليتبع هدي نبيه ﷺ.`
            }
          }
        };
        proc.stdin.write(JSON.stringify(callReq) + '\n');
      } else if (msg.id === 2) {
        console.log('CALL TOOL RESULT:', JSON.stringify(msg, null, 2));
        proc.kill();
        process.exit(0);
      }
    } catch (e) {
    }
  }
});

// Send Initialize request
proc.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' }
  }
}) + '\n');
