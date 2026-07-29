import { readFileSync } from 'fs'
import path from 'path'
import yaml from 'js-yaml'

// practices/ sits next to lib/ in both src/ and the babel output, since
// `babel --copy-files` carries the YAML across
const practicesDir = path.join(__dirname, '../practices')

let aiAppDefinitions = null

function readYamlFile (filename) {
  return yaml.load(readFileSync(path.join(practicesDir, filename), 'utf8'))
}

/**
 * Loads the AI application catalog. Cached after the first read -- the file
 * ships with the app and does not change at runtime.
 */
export function loadAiAppDefinitions () {
  if (!aiAppDefinitions) {
    try {
      const file = readYamlFile('ai-apps.yaml')
      aiAppDefinitions = file.apps || []
    } catch (e) {
      aiAppDefinitions = []
    }
  }

  return aiAppDefinitions
}

export default loadAiAppDefinitions
