// Display sleep timer in minutes for the screen lock check, from
// `pmset -g custom`, which lists every power source. Using only the active
// source (`pmset -g`) let a laptop pass on AC and fail on battery between two
// scans. Takes the longest timer: 0 ("never") on any source means never.
// Returns -1 when no value is available.
export default function displaySleepMinutes(custom, active) {
  const values = [];
  const pattern = /displaysleep\s+(\d+)/g;
  let match;
  while ((match = pattern.exec(String(custom || ""))) !== null) {
    values.push(parseInt(match[1], 10));
  }
  if (!values.length) {
    const fallback = parseInt(active, 10);
    return Number.isNaN(fallback) ? -1 : fallback;
  }
  if (values.includes(0)) return 0;
  return Math.max(...values);
}
