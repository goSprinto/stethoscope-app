import { compileAndRun } from './scripts'
import { WIN32_BATCHED_SCRIPTS, runBatched } from './win32Batch'

const serializeVariables = (vars = {}) => (Object.keys(vars).length > 0 ? JSON.stringify(vars) : '')

const IS_WIN = process.platform === 'win32'

// on Windows, a few scripts are served from one shared PowerShell run
// (see win32Batch.js); the .sh script is still used if that run fails
const run = async (file, context, variables) => {
  if (IS_WIN && WIN32_BATCHED_SCRIPTS.includes(file) && !serializeVariables(variables)) {
    const result = await runBatched(file, context)
    if (result) return result
  }
  return compileAndRun(file, variables)
}

// cache the pending promise rather than the result: GraphQL resolves fields
// concurrently, so caching only after the await let every resolver that asked
// for the same script before the first run finished spawn its own copy
// (e.g. ~6 simultaneous runs of hardware.sh per scan on Windows)
export default function kmd (file, context = {}, variables = {}) {
  const contextKey = `${file}${serializeVariables(variables)}`
  if (!context[contextKey]) {
    context[contextKey] = run(file, context, variables)
  }
  return context[contextKey]
}
