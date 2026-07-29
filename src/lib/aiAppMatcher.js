const normalize = (value = '') => String(value).trim().toLowerCase()

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Match app names against AI catalog patterns.
 * - `/regex/` patterns use RegExp
 * - plain patterns use exact or token-boundary match (not raw substring)
 *   so short names like "Poe" do not match "Poetry"
 */
const matchesPattern = (appName, pattern) => {
  const normalizedName = normalize(appName)
  const normalizedPattern = normalize(pattern)

  if (!normalizedPattern) {
    return false
  }

  if (normalizedPattern.startsWith('/') && normalizedPattern.endsWith('/')) {
    const regexBody = normalizedPattern.slice(1, -1)
    try {
      return new RegExp(regexBody, 'i').test(appName)
    } catch (e) {
      return false
    }
  }

  if (normalizedName === normalizedPattern) {
    return true
  }

  const tokenPattern = new RegExp(
    `(?:^|[^a-z0-9])${escapeRegExp(normalizedPattern)}(?:$|[^a-z0-9])`,
    'i'
  )
  return tokenPattern.test(normalizedName)
}

const matchesDefinition = (appName) => ({ name, patterns = [] }) => {
  if (matchesPattern(appName, name)) {
    return true
  }

  return patterns.some((pattern) => matchesPattern(appName, pattern))
}

export const isAiApp = (appName, aiAppDefinitions = []) => {
  if (!appName) {
    return false
  }

  return aiAppDefinitions.some(matchesDefinition(appName))
}

export const getAiAppMatch = (appName, aiAppDefinitions = []) => {
  if (!appName) {
    return null
  }

  return aiAppDefinitions.find(matchesDefinition(appName)) || null
}

export default isAiApp
