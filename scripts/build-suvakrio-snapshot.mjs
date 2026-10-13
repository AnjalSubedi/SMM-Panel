import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inputFiles = process.argv.slice(2);

if (inputFiles.length === 0) {
  throw new Error("Pass the downloaded Suvakrio services HTML files as arguments.");
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function inferPlatform(category, name) {
  const value = `${category} ${name}`.toLowerCase();
  const knownPlatforms = [
    ["Facebook", /facebook/],
    ["TikTok", /tiktok/],
    ["YouTube", /youtube/],
    ["Instagram", /instagram/],
    ["Telegram", /telegram/],
    ["Twitter", /twitter|\bx\b/],
    ["Spotify", /spotify/],
    ["Discord", /discord/],
    ["Twitch", /twitch/],
  ];

  return knownPlatforms.find(([, pattern]) => pattern.test(value))?.[0] ?? "Other";
}

const services = [];

for (const inputFile of inputFiles) {
  const html = await readFile(inputFile, "utf8");
  const rows = html.matchAll(
    /<tr class="border-b hairline align-top[\s\S]*?wire:key="svc-(\d+)">([\s\S]*?)<\/tr>/g,
  );

  for (const row of rows) {
    const body = row[2];
    const name = body.match(/<div class="font-medium leading-snug">([\s\S]*?)<\/div>/)?.[1];
    const category = body.match(/<div class="mt-1[^"]*">[\s\S]*?<span>([\s\S]*?)<\/span>/)?.[1];
    const rate = body.match(/accent-text whitespace-nowrap">[^0-9]*([0-9,.]+)<\/td>/)?.[1];
    const limits = [...body.matchAll(/text-right text-muted">([0-9,]+)<\/td>/g)].map(
      (match) => Number(match[1].replaceAll(",", "")),
    );

    if (!name || !category || !rate || limits.length < 2) continue;

    const decodedName = decodeHtml(name);
    const decodedCategory = decodeHtml(category);

    services.push({
      service: Number(row[1]),
      name: decodedName,
      type: "Default",
      category: decodedCategory,
      platform: inferPlatform(decodedCategory, decodedName),
      rate: Number(rate.replaceAll(",", "")),
      min: limits[0],
      max: limits[1],
      refill: />REFILL<\/span>/.test(body),
      cancel: />CANCEL<\/span>/.test(body),
    });
  }
}

const uniqueServices = [...new Map(services.map((service) => [service.service, service])).values()];
const outputPath = resolve("data/suvakrio-services.json");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(uniqueServices, null, 2)}\n`, "utf8");
console.log(`Wrote ${uniqueServices.length} services to ${outputPath}`);
