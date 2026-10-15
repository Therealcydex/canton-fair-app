// Turns the text read on a business card (OCR, D37) into contact and company fields. The text is
// noisy (stray spaces, wrong letters), so every rule is a guess: the buyer checks and corrects
// the fields before saving, and the server validates them as usual.

export interface CardFields {
  name: string;
  company: string;
  phone: string;
  email: string;
  wechat: string;
  website: string;
}

const COMPANY = /\b(co\.?,?\s*ltd|co\.?|ltd\.?|limited|company|corp(oration)?|inc\.?|factory|industr(y|ial)|trading|technolog(y|ies)|group|manufactur\w*|enterprises?|electric(al)?|import|export|imp\s*&\s*exp)\b/i;
const TITLE = /\b(manager|sales|director|ceo|cfo|coo|president|chairman|engineer|representative|assistant|executive|supervisor|marketing|purchas\w*|export|import|business|account|general|international|department|dept\.?|vice|senior|team\s*leader|leader|owner|boss|founder|designer|merchandiser|specialist|officer)\b/i;
// A field label at the start of a line ("Tel:", "Mob.", "微信："). One-letter labels (M, T, F, E, W)
// need their ":" — otherwise "Mr. Li" or "Ms Zhang" would lose their first letter.
const LABEL = /^((tel|telephone|phone|mob(ile)?|cell|fax|e-?mail|email|web(site)?|add(ress)?|wechat|we\s*chat|whatsapp|skype|qq)\s*[:：.]?|[mtfew]\s*[:：]|(手机|电话|传真|邮箱|地址|微信)\s*[:：]?)\s*/i;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

// "+86 138-0000 1111" -> "+86 138 0000 1111": digits grouped by single spaces, the + kept.
const tidyPhone = (s: string) => clean(s.replace(/[().]/g, ' ').replace(/-/g, ' ')).replace(/^\+\s+/, '+');

function findEmail(text: string): string {
  // OCR often puts spaces around "@" and "." in an address.
  const joined = text.replace(/\s*@\s*/g, '@').replace(/(\S)\s*\.\s*(com|cn|net|org|hk|co)\b/gi, '$1.$2');
  const m = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)*\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : '';
}

function findWebsite(lines: string[], email: string): string {
  const emailDomain = email.split('@')[1] || '';
  for (const line of lines) {
    if (line.includes('@')) continue;
    const m = line.match(/\b((https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|cn|net|org|hk|com\.cn|co)(\/\S*)?)\b/i);
    if (!m) continue;
    const site = m[1].toLowerCase();
    if (/www\.|https?:/.test(site) || /^(web|w)\b/i.test(line) || site !== emailDomain) return site;
  }
  return emailDomain && !/^(gmail|163|126|qq|hotmail|outlook|yahoo|sina|foxmail|aliyun)\./.test(emailDomain) ? `www.${emailDomain}` : '';
}

function findWechat(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/(we\s*chat|weixin|wx|微信)\s*(id|no\.?|号)?\s*[:：]?\s*([A-Za-z][-_A-Za-z0-9]{5,19}|\+?\d[\d\s-]{6,}\d)/i);
    if (m) return m[3].replace(/\s+/g, '');
  }
  return '';
}

// The phone to keep: a mobile first (Mob/Cell/手机, or a Chinese mobile number), never a fax.
function findPhone(lines: string[]): string {
  const found: { value: string; score: number }[] = [];
  for (const line of lines) {
    if (/\b(fax|f)\s*[:：.]/i.test(line) || /传真/.test(line)) continue;
    if (line.includes('@')) continue;
    const numbers = line.match(/\+?\d[\d\s\-().]{6,}\d/g) || [];
    for (const n of numbers) {
      const digits = n.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) continue;
      let score = 1;
      if (/\b(mob(ile)?|cell|m)\s*[:：.]?/i.test(line) || /手机/.test(line)) score += 3;
      if (/^(86)?1[3-9]\d{9}$/.test(digits)) score += 2; // Chinese mobile
      if (/\b(tel|phone|t)\s*[:：.]?/i.test(line) || /电话/.test(line)) score += 1;
      found.push({ value: tidyPhone(n), score });
    }
  }
  found.sort((a, b) => b.score - a.score);
  return found[0]?.value || '';
}

function findCompany(lines: string[]): string {
  const candidates = lines
    .map((l) => clean(l.replace(LABEL, '')))
    .filter((l) => COMPANY.test(l) && !l.includes('@') && !/www\.|http/i.test(l) && /[a-z]{3}/i.test(l));
  // The longest one is usually the full company name ("Ningbo HomeStar Kitchenware Co., Ltd.").
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] || '';
}

// A person's name: 2 to 4 words of letters, no digits, not the company, not a job title.
// "Mr/Ms" helps; so does a job title on the line just below or above.
function findName(lines: string[], company: string): string {
  let best = '';
  let bestScore = 0;
  lines.forEach((raw, i) => {
    const line = clean(raw.replace(LABEL, ''));
    if (!line || line === company || /\d|@|www\.|http/i.test(line)) return;
    if (COMPANY.test(line)) return;
    const withoutTitle = clean(line.replace(/\b(mr|mrs|ms|miss|dr)\.?\s+/i, ''));
    const words = withoutTitle.split(' ');
    if (words.length < 1 || words.length > 4) return;
    if (!words.every((w) => /^[A-Za-z][A-Za-z'.-]*$/.test(w))) return;
    if (TITLE.test(withoutTitle) && !/\b(mr|mrs|ms|miss)\b/i.test(line)) return;
    let score = 1;
    if (/\b(mr|mrs|ms|miss)\b\.?/i.test(line)) score += 4;
    if (words.length >= 2 && words.length <= 3) score += 2;
    if (words.every((w) => /^[A-Z]/.test(w))) score += 1;
    const near = [lines[i - 1], lines[i + 1]].filter(Boolean).join(' ');
    if (TITLE.test(near)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = line.replace(/\b(mr|mrs|ms|miss|dr)\.?\s+/i, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase().replace(/\.?\s+$/, ' '));
    }
  });
  return clean(best);
}

export function parseCard(text: string): CardFields {
  const lines = text.split(/\r?\n/).map(clean).filter((l) => l.length > 1);
  const email = findEmail(text);
  const company = findCompany(lines);
  return {
    name: findName(lines, company),
    company,
    phone: findPhone(lines),
    email,
    wechat: findWechat(lines),
    website: findWebsite(lines, email),
  };
}
