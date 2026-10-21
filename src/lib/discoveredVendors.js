/**
 * Turns the installed application list into the records reported to Sprinto.
 *
 * The agent does no classification: it reports the applications it found and Sprinto decides
 * whether each is an AI application and which vendor domain it belongs to. That keeps the
 * catalog server-side, so it can grow without shipping a new desktop release. The server only
 * reads the name, so nothing else is sent.
 */
export function buildDiscoveredVendors (installedApplications = []) {
  const names = installedApplications.map((app) => ((app && app.name) || '').trim())
  return [...new Set(names.filter(Boolean))].map((applicationName) => ({ applicationName }))
}

export default buildDiscoveredVendors
