import { ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(() => '');

const FORBIDDEN_DECORATORS = new Set(['Input', 'Output', 'ViewChild', 'ViewChildren', 'ContentChild', 'ContentChildren']);

const SIGNAL_REPLACEMENTS = {
  Input: 'input() / input.required()',
  Output: 'output()',
  ViewChild: 'viewChild() / viewChild.required()',
  ViewChildren: 'viewChildren()',
  ContentChild: 'contentChild() / contentChild.required()',
  ContentChildren: 'contentChildren()',
};

const enforceSignalApis = createRule({
  name: 'enforce-signal-apis',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid legacy Angular decorators (@Input, @Output, @ViewChild, @ViewChildren, @ContentChild, @ContentChildren). Use signal-based APIs instead.',
    },
    messages: {
      forbiddenDecorator: "Legacy decorator '@{{decoratorName}}' is not allowed. Use {{replacement}} instead.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename ?? context.getFilename();

    // Skip test/spec files
    if (filename.endsWith('.spec.ts')) {
      return {};
    }

    return {
      Decorator(node) {
        let decoratorName;
        const expr = node.expression;

        if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
          decoratorName = expr.callee.name;
        } else if (expr.type === 'Identifier') {
          decoratorName = expr.name;
        }

        if (decoratorName && FORBIDDEN_DECORATORS.has(decoratorName)) {
          context.report({
            node,
            messageId: 'forbiddenDecorator',
            data: {
              decoratorName,
              replacement: SIGNAL_REPLACEMENTS[decoratorName],
            },
          });
        }
      },
    };
  },
});

const TAILWIND_COLOUR_UTILITIES =
  'bg|text|border(?:-[xytrblse])?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|divide|shadow|placeholder|caret|accent';
const TAILWIND_PALETTES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const PALETTE_COLOUR_CLASS = new RegExp(
  `^(?:[^\\s:]+:)*!?(?:${TAILWIND_COLOUR_UTILITIES})-(?:(?:${TAILWIND_PALETTES})-\\d{2,3}|white|black)(?:\\/\\d+)?!?$`,
);
const ARBITRARY_COLOUR_CLASS = new RegExp(
  `^(?:[^\\s:]+:)*!?(?:${TAILWIND_COLOUR_UTILITIES})-\\[(?:#|rgba?\\(|hsla?\\(|var\\(--(?:palette|color)-)`,
);
const COLOUR_IN_ARBITRARY_VALUE = /\[[^\]]*(?:#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()/;
const IMPORTANT_CLASS = /^(?:[^\s:]+:)*![a-z[]\S*$|^[a-z[][^\s'"`]*-[^\s'"`]*!$/;

/**
 * Finds the class names in a string that hard-code a colour or use Tailwind's important modifier.
 *
 * @param text a class list, or any string or expression source that may contain one
 * @returns the offending class names with the reason each one is reported
 */
function findForbiddenClasses(text) {
  const findings = [];
  for (const token of text.split(/[\s'"`{}?]+/)) {
    if (PALETTE_COLOUR_CLASS.test(token) || ARBITRARY_COLOUR_CLASS.test(token) || COLOUR_IN_ARBITRARY_VALUE.test(token)) {
      findings.push({ token, messageId: 'hardCodedColour' });
    } else if (IMPORTANT_CLASS.test(token)) {
      findings.push({ token, messageId: 'importantModifier' });
    }
  }
  return findings;
}

const CLASS_RULE_MESSAGES = {
  hardCodedColour: "'{{token}}' hard-codes a colour. Use a semantic token from content/scss/_tokens.scss, such as text-negative-default.",
  importantModifier:
    "'{{token}}' uses Tailwind's important modifier. The UI kit sits in a lower cascade layer, so the plain class already wins.",
  ngClass: 'Use [class.name] or a computed() class string instead of [ngClass].',
};

const noHardCodedClassesInCode = createRule({
  name: 'no-hard-coded-classes',
  meta: {
    type: 'problem',
    docs: { description: 'Forbid Tailwind palette colours, arbitrary colour values and important modifiers in class strings.' },
    messages: CLASS_RULE_MESSAGES,
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const check = (node, text) => {
      for (const { token, messageId } of findForbiddenClasses(text)) {
        context.report({ node, messageId, data: { token } });
      }
    };
    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          check(node, node.value);
        }
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
});

const noHardCodedClassesInTemplates = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid [ngClass], Tailwind palette colours, arbitrary colour values and important modifiers in templates.' },
    messages: CLASS_RULE_MESSAGES,
    schema: [],
  },
  create(context) {
    const report = (span, messageId, token) => {
      const loc = context.sourceCode.parserServices.convertNodeSourceSpanToLoc(span);
      context.report({ loc, messageId, data: { token } });
    };
    return {
      Element(node) {
        for (const attribute of node.attributes) {
          if (/class|styling/i.test(attribute.name)) {
            for (const { token, messageId } of findForbiddenClasses(attribute.value)) {
              report(attribute.sourceSpan, messageId, token);
            }
          }
        }
        for (const input of node.inputs) {
          if (input.name === 'ngClass') {
            report(input.sourceSpan, 'ngClass', input.name);
            continue;
          }
          const text = /class|styling/i.test(input.name) ? `${input.value.source ?? ''}` : input.name;
          for (const { token, messageId } of findForbiddenClasses(text)) {
            report(input.sourceSpan, messageId, token);
          }
        }
      },
    };
  },
};

const ALLOWED_LINE_COMMENT = /^\s*(?:\d+\)\s|eslint-|@ts-|prettier-ignore|istanbul )/;
const ALLOWED_BLOCK_COMMENT = /^\*|^\s*(?:eslint|istanbul|prettier-ignore)/;

const commentShape = createRule({
  name: 'comment-shape',
  meta: {
    type: 'suggestion',
    docs: { description: 'Allow only JSDoc comments and numbered step comments such as // 1).' },
    messages: {
      looseComment: 'Comments are either JSDoc above a declaration or numbered steps such as // 1) inside a method. See AGENTS.md.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const allowed = comment.type === 'Line' ? ALLOWED_LINE_COMMENT.test(comment.value) : ALLOWED_BLOCK_COMMENT.test(comment.value);
          if (!allowed) {
            context.report({ loc: comment.loc, messageId: 'looseComment' });
          }
        }
      },
    };
  },
});

export default {
  rules: {
    'enforce-signal-apis': enforceSignalApis,
    'no-hard-coded-classes': noHardCodedClassesInCode,
    'no-hard-coded-classes-in-templates': noHardCodedClassesInTemplates,
    'comment-shape': commentShape,
  },
};
