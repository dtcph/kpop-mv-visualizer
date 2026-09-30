// Loads and parses data/videos.csv into a per-year grouped structure.
// CSV header (verified): Date,Artist,Song Name,Korean Name,Director,Video,Type,Release

const MIN_YEAR = 1995;
const MAX_YEAR = 2020;

function isValidLink(link) {
  return !!link && /^https?:\/\//i.test(link.trim());
}

function rowToVideo(row) {
  const dateStr = (row['Date'] || '').trim();
  const year = parseInt(dateStr.slice(0, 4), 10);
  const link = (row['Video'] || '').trim();
  return {
    date: dateStr,
    year,
    artist: (row['Artist'] || '').trim(),
    song: (row['Song Name'] || '').trim(),
    korean: (row['Korean Name'] || '').trim(),
    director: (row['Director'] || '').trim(),
    link,
    hasLink: isValidLink(link),
    groupType: (row['Type'] || '').trim(),
    release: (row['Release'] || '').trim(),
  };
}

// Fetches and parses the CSV, returning years grouped array (sorted ascending)
// of { year, count, videos } for years with at least one video, restricted to
// MIN_YEAR..MAX_YEAR.
export async function loadVideos() {
  const res = await fetch('data/videos.csv');
  let text = await res.text();
  text = text.replace(/^﻿/, ''); // strip BOM

  const rows = d3.csvParse(text);
  const videos = rows
    .map(rowToVideo)
    .filter((v) => Number.isFinite(v.year) && v.year >= MIN_YEAR && v.year <= MAX_YEAR);

  const byYear = new Map();
  for (const v of videos) {
    if (!byYear.has(v.year)) byYear.set(v.year, []);
    byYear.get(v.year).push(v);
  }

  const years = Array.from(byYear.entries())
    .map(([year, list]) => ({ year, count: list.length, videos: list }))
    .sort((a, b) => a.year - b.year);

  return { years, minYear: MIN_YEAR, maxYear: MAX_YEAR };
}
