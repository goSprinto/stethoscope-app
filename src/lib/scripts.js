import { compile, run, setKmdEnv } from "kmd-script/src";
import path from "path";
import extend from "extend";
import { readdirSync, readFileSync } from "fs";

const development = process.env.STETHOSCOPE_ENV === "development";

let checks = false;

setKmdEnv({
  FILE_BASE_PATH: !development
    ? process.resourcesPath + path.sep
    : process.cwd(),
  NODE_ENV: process.env.STETHOSCOPE_ENV,
  NODE_PATH: process.execPath,
});

export async function precompile() {
  // list the folder rather than glob it: ( ) in the install path is glob
  // syntax and made the pattern match nothing (see server.js)
  const dir = path.resolve(__dirname, `../sources/${process.platform}`);
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".sh"))
    .map((file) => path.join(dir, file));

  return files.reduce((out, file) => {
    const { name } = path.parse(file);
    return {
      ...out,
      [name]: compile(readFileSync(file, "utf8")),
    };
  }, {});
}

export async function compileAndRun(kmd, variables = {}) {
  const filePath = path.resolve(
    __dirname,
    `../sources/${process.platform}/${kmd}.sh`
  );
  try {
    const fn = compile(readFileSync(filePath, "utf8"), variables);
    const results = await run(fn);
    return results;
  } catch (e) {
    console.error(filePath, e);
    return true;
  }
}

/**
 * @deprecated
 */
export async function runAll() {
  const promises = Object.entries(checks).map(async ([name, script]) => {
    try {
      return await run(script);
    } catch (e) {
      return "";
    }
  });
  const checkData = await Promise.all(promises);
  return extend(true, {}, ...checkData);
}

/**
 * @deprecated
 */
export async function init() {
  checks = await precompile();
  return checks;
}

/**
 * @deprecated
 */
export async function evaluate(scriptName) {
  try {
    return await run(checks[scriptName]);
  } catch (e) {
    return "";
  }
}

export function safeParseInt(value, defaultValue = -1) {
  try {
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
      throw new Error("Value is not a valid number");
    }
    return parsedValue;
  } catch (error) {
    console.error(error.message);
    return defaultValue;
  }
}
