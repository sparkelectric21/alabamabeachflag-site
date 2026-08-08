export const SCRIPTURES = Object.freeze([
  { reference: "Genesis 1:20", text: "Then God said, “Let the waters abound with an abundance of living creatures, and let birds fly above the earth across the face of the firmament of the heavens.”", url: "https://www.bible.com/bible/114/GEN.1.20.NKJV", translation: "NKJV" },
  { reference: "Psalm 95:5", text: "The sea is His, for He made it; And His hands formed the dry land.", url: "https://www.bible.com/bible/114/PSA.95.5.NKJV", translation: "NKJV" },
  { reference: "Mark 4:39", text: "Then He arose and rebuked the wind, and said to the sea, “Peace, be still!” And the wind ceased and there was a great calm.", url: "https://www.bible.com/bible/114/MRK.4.39.NKJV", translation: "NKJV" },
  { reference: "Jeremiah 5:22", text: "‘Do you not fear Me?’ says the LORD. ‘Will you not tremble at My presence, Who have placed the sand as the bound of the sea, By a perpetual decree, that it cannot pass beyond it? And though its waves toss to and fro, Yet they cannot prevail; Though they roar, yet they cannot pass over it.", url: "https://www.bible.com/bible/114/JER.5.22.NKJV", translation: "NKJV" },
  { reference: "Psalm 113:3", text: "From the rising of the sun to its going down The LORD’s name is to be praised.", url: "https://www.bible.com/bible/114/PSA.113.3.NKJV", translation: "NKJV" },
  { reference: "Job 38:11", text: "When I said, ‘This far you may come, but no farther, And here your proud waves must stop!’", url: "https://www.bible.com/bible/114/JOB.38.11.NKJV", translation: "NKJV" },
  { reference: "Genesis 1:10", text: "And God called the dry land Earth, and the gathering together of the waters He called Seas. And God saw that it was good.", url: "https://www.bible.com/bible/114/GEN.1.10.NKJV", translation: "NKJV" },
  { reference: "Genesis 22:17", text: "blessing I will bless you, and multiplying I will multiply your descendants as the stars of the heaven and as the sand which is on the seashore; and your descendants shall possess the gate of their enemies.", url: "https://www.bible.com/bible/114/GEN.22.17.NKJV", translation: "NKJV" },
  { reference: "Matthew 13:1", text: "On the same day Jesus went out of the house and sat by the sea.", url: "https://www.bible.com/bible/114/MAT.13.1.NKJV", translation: "NKJV" },
  { reference: "Psalm 19:1", text: "The heavens declare the glory of God; And the firmament shows His handiwork.", url: "https://www.bible.com/bible/114/PSA.19.1.NKJV", translation: "NKJV" },
  { reference: "Job 38:12", text: "“Have you commanded the morning since your days began, And caused the dawn to know its place,", url: "https://www.bible.com/bible/114/JOB.38.12.NKJV", translation: "NKJV" },
  { reference: "Genesis 1:21", text: "So God created great sea creatures and every living thing that moves, with which the waters abounded, according to their kind, and every winged bird according to its kind. And God saw that it was good.", url: "https://www.bible.com/bible/114/GEN.1.21.NKJV", translation: "NKJV" },
  { reference: "Ecclesiastes 1:5", text: "The sun also rises, and the sun goes down, And hastens to the place where it arose.", url: "https://www.bible.com/bible/114/ECC.1.5.NKJV", translation: "NKJV" },
  { reference: "Habakkuk 2:14", text: "For the earth will be filled With the knowledge of the glory of the Lord, As the waters cover the sea.", url: "https://www.bible.com/bible/114/HAB.2.14.NKJV", translation: "NKJV" },
  { reference: "Matthew 4:19", text: "Then He said to them, “Follow Me, and I will make you fishers of men.”", url: "https://www.bible.com/bible/114/MAT.4.19.NKJV", translation: "NKJV" },
]);

const CHICAGO_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const ROTATION_EPOCH_DAY = Date.UTC(2026, 0, 1) / 86_400_000;

export function getChicagoDateKey(date = new Date()) {
  const parts = Object.fromEntries(
    CHICAGO_DATE_FORMATTER.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function selectScriptureForDate(date = new Date()) {
  const [year, month, day] = getChicagoDateKey(date).split("-").map(Number);
  const calendarDay = Date.UTC(year, month - 1, day) / 86_400_000;
  const index = ((calendarDay - ROTATION_EPOCH_DAY) % SCRIPTURES.length + SCRIPTURES.length) % SCRIPTURES.length;
  return SCRIPTURES[index];
}

export function renderDailyScripture(date = new Date(), root = document.querySelector("[data-scripture-by-the-sea]")) {
  if (!root) return;
  const scripture = selectScriptureForDate(date);
  const text = root.querySelector("[data-scripture-text]");
  const link = root.querySelector("[data-scripture-link]");
  const translation = root.querySelector("[data-scripture-translation]");
  text.textContent = scripture.text;
  link.textContent = scripture.reference;
  link.href = scripture.url;
  link.setAttribute("aria-label", `Read ${scripture.reference} on Bible.com (opens in a new tab)`);
  translation.textContent = scripture.translation;
}

if (typeof document !== "undefined") renderDailyScripture();
