// Values in the /scan policy come from the caller, not from Sprinto alone,
// so they are treated as data: never as a regex, never spliced into a shell
// command unchecked (V8-2212).

// case-insensitive "contains" match; the old code compiled the policy's app
// name as a regex, which let a caller send a catastrophic pattern (ReDoS)
export function appNameMatches(policyName, installedName) {
  if (typeof policyName !== "string" || typeof installedName !== "string") {
    return false;
  }
  return installedName.toLowerCase().includes(policyName.toLowerCase());
}

// registry keys the apps script may query: HKLM/HKCU paths made of key-name
// characters only. No quotes, so the value can't break out of the script's
// '...' quoting
const REGISTRY_PATH = /^(HKLM|HKCU|HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER)(\\{1,2}[A-Za-z0-9 _.()-]+)+$/;

export function isSafeRegistryPath(value) {
  return typeof value === "string" && value.length <= 260 && REGISTRY_PATH.test(value);
}
