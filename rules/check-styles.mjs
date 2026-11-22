import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'src/main/webapp';
const PALETTE_FILE = 'src/main/webapp/content/scss/_palette.scss';
const IMPORTANT_ALLOWED_SELECTOR = '.theme-switching';
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;

/**
 * Lists the stylesheets below a directory.
 *
 * @param directory the directory to search
 * @returns the paths of all .scss and .css files in it
 */
function stylesheets(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'generated' ? [] : stylesheets(path);
    }
    return /\.(scss|css)$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Checks one stylesheet for ::ng-deep, !important outside the theme switch, and colours outside the palette.
 *
 * @param path the stylesheet to check
 * @returns one message per problem, with file and line
 */
function check(path) {
  const problems = [];
  const source = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '));
  const selectors = [];
  let statement = '';
  let line = 1;
  for (const character of source) {
    if (character === '{') {
      selectors.push(statement.trim());
      statement = '';
    } else if (character === '}' || character === ';') {
      const declaration = statement.replace(/\/\/.*$/gm, '').trim();
      const selector = selectors.join(' ');
      if (declaration.includes('!important') && !selector.includes(IMPORTANT_ALLOWED_SELECTOR)) {
        problems.push(`${path}:${line} uses !important. The UI kit and Quill sit in lower cascade layers, so a plain rule already wins.`);
      }
      if (declaration.includes(':') && !declaration.startsWith('@') && path !== PALETTE_FILE && COLOUR_LITERAL.test(declaration)) {
        problems.push(`${path}:${line} hard-codes a colour. Use a token from _tokens.scss, or add the value to _palette.scss.`);
      }
      if (character === '}') {
        selectors.pop();
      }
      statement = '';
    } else {
      statement += character;
    }
    if (character === '\n') {
      line++;
    }
    if (statement.endsWith('::ng-deep')) {
      problems.push(`${path}:${line} uses ::ng-deep, which Angular deprecated. Style the element through a class or an input instead.`);
    }
  }
  return problems;
}

const problems = stylesheets(ROOT).flatMap(path => check(relative('.', path)));
for (const problem of problems) {
  console.error(problem);
}
process.exit(problems.length === 0 ? 0 : 1);
