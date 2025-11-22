const fs = require("fs");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

const SITE_HOST = "https://www.techautohub.com";
const PUBLICATION_NAME = "TechAutoHub";
const PUBLICATION_LANG = "en";
const MAX_RESULTS = 500;

const FEEDS = [
  `${SITE_HOST}/feeds/posts/default?alt=atom&start-index=1&max-results=${MAX_RESULTS}`,
  `${SITE_HOST}/atom.xml?redirect=false&start-index=1&max-results=${MAX_RESULTS}`,
  `${SITE_HOST}/feeds/posts/default?alt=atom`
];

const parseString = require("xml2js").parseString;

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toW3cDate(ts) {
  const d = new Date(ts);
  const pad = (n) => (n < 10 ? "0" + n : n);
  return (
    d.getUTCFullYear() +
    "-" +
    pad(d.getUTCMonth() + 1) +
    "-" +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    ":" +
    pad(d.getUTCMinutes()) +
    ":" +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

async function fetchFeed(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchEntries() {
  for (const url of FEEDS) {
    const xml = await fetchFeed(url);
    if (!xml) continue;
    let parsed;
    try {
      parsed = await new Promise((resolve) => parseString(xml, (e, r) => resolve(r)));
    } catch {
      continue;
    }
    const entries = parsed?.feed?.entry;
    if (entries) return Array.isArray(entries) ? entries : [entries];
  }
  return [];
}

(async function () {
  const entries = await fetchEntries();
  const now = Date.now();
  const cutoff = now - 48 * 60 * 60 * 1000;

  const recent = entries
    .filter((e) => e.published?.[0] && new Date(e.published[0]).getTime() >= cutoff)
    .slice(0, 1000);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n`;

  for (const e of recent) {
    const title = escapeXml(e.title?.[0] || "");
    const published = toW3cDate(e.published?.[0]);
    let link = "";

    const links = e.link || [];
    for (const l of links) {
      if (l.$?.href) {
        link = l.$.href;
        break;
      }
    }
    if (!/^https?:\/\//.test(link)) link = `${SITE_HOST}${link.startsWith("/") ? link : "/" + link}`;

    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(link)}</loc>\n`;
    xml += `    <news:news>\n`;
    xml += `      <news:publication>\n`;
    xml += `        <news:name>${PUBLICATION_NAME}</news:name>\n`;
    xml += `        <news:language>${PUBLICATION_LANG}</news:language>\n`;
    xml += `      </news:publication>\n`;
    xml += `      <news:publication_date>${published}</news:publication_date>\n`;
    xml += `      <news:title>${title}</news:title>\n`;
    xml += `    </news:news>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  fs.writeFileSync("news-sitemap.xml", xml, "utf8");
})();
