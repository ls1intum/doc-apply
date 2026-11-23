/**
 * This script is executed before the Angular CLI's build script is executed.
 * It adds environment variables to the environment file and merges the i18n files.
 * This way, we don't need a webpack configuration file: It replaces
 * - webpack.DefinePlugin and
 * - MergeJsonWebpackPlugin
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Hashes the names and contents of all JSON files below a directory, so the client reloads its translations when they change.
 * @param {string} directory the directory to hash
 * @returns {string} the MD5 hash in hex encoding
 */
function hashJsonFiles(directory) {
  const hash = crypto.createHash('md5');
  const files = fs
    .readdirSync(directory, { recursive: true })
    .filter(file => file.endsWith('.json'))
    .sort();
  for (const file of files) {
    hash.update(file);
    hash.update(fs.readFileSync(path.resolve(directory, file)));
  }
  return hash.digest('hex');
}

const languagesHash = hashJsonFiles(path.resolve(__dirname, 'src', 'main', 'webapp', 'i18n'));

// =====================
// Environment variables
// =====================

/*
 * Needed for client compilations with docker compose, where the 'APP_VERSION' property isn't injected by gradle.
 *
 * Returns the inferred APP_VERSION from 'build.gradle', or 'DEV' if this couldn't be retrieved
 */
function inferVersion() {
  let version = 'DEV';

  try {
    let data = fs.readFileSync('build.gradle', 'UTF-8');

    // Try to match devVersion first (new format), then fall back to version (old format)
    let match = data.match(/\bdevVersion\s*=\s*"([^"]+)"/) || data.match(/\nversion\s*=\s*"([^"]+)"/);

    version = match?.[1] ?? 'DEV';
  } catch (error) {
    console.log("Error while retrieving 'APP_VERSION' property", error);
  }

  return version;
}

// --develop flag is used to enable debug mode
const args = process.argv.slice(2);
const developFlag = args.includes('--develop');
const keycloakConfig = {
  enableLogging: developFlag,
};
const environmentConfig = `// Don't change this file manually, it will be overwritten by the build process!
export const __DEBUG_INFO_ENABLED__ = ${developFlag};
export const __VERSION__ = '${process.env.APP_VERSION || inferVersion()}';
export const I18N_HASH = '${languagesHash}';
export const environment = {
  production: ${!developFlag},
  keycloak: {
    enableLogging: ${keycloakConfig.enableLogging},
  },
};
`;
fs.writeFileSync(path.resolve(__dirname, 'src', 'main', 'webapp', 'app', 'environments', 'environment.override.ts'), environmentConfig);

// =====================
// i18n merging
// =====================

const groups = [
  { folder: './src/main/webapp/i18n/en', output: './src/main/webapp/i18n/en.json' },
  { folder: './src/main/webapp/i18n/de', output: './src/main/webapp/i18n/de.json' },
];

const isObject = obj => obj && typeof obj === 'object';

function deepMerge(target, source) {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  for (const key in source) {
    // prevent prototype pollution
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    if (key === '__proto__' || key === 'constructor') continue;

    const targetValue = target[key];
    const sourceValue = source[key];

    if (isObject(sourceValue)) {
      target[key] = deepMerge(targetValue || {}, sourceValue);
    } else {
      target[key] = sourceValue;
    }
  }

  return target;
}

for (const group of groups) {
  try {
    // create output folder if it doesn't exist
    fs.mkdirSync(path.dirname(group.output), { recursive: true });

    const files = fs.readdirSync(group.folder).filter(file => file.endsWith('.json'));

    const mergedContent = files.reduce((acc, file) => {
      const content = JSON.parse(fs.readFileSync(path.resolve(group.folder, file)).toString());
      return deepMerge(acc, content);
    }, {});

    await fs.promises.writeFile(group.output, JSON.stringify(mergedContent));
  } catch (error) {
    console.error(`Error merging JSON files for ${group.output}:`, error);
  }
}
