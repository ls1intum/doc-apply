// @ts-check

import globals from 'globals';
import prettier from 'eslint-plugin-prettier/recommended';
import prettierPlugin from 'eslint-plugin-prettier';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import angularPlugin from '@angular-eslint/eslint-plugin';
import angularTemplateParser from '@angular-eslint/template-parser';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import unusedImports from 'eslint-plugin-unused-imports';
import importPlugin from 'eslint-plugin-import';
import localRulesPlugin from './rules/index.mjs';

// jhipster-needle-eslint-add-import - JHipster will add additional import here

export default [
  // 🔒 Completely ignore all generated files BEFORE any other config runs
  {
    ignores: [
      'src/main/webapp/app/generated/**',
      'docs/**',
      'gradle/**',
      'src/test/webapp/**',
      'vitest.config.ts',
      'build/',
      '**/build/**',
      'out-tsc/**',
      'supporting_scripts/local-pr-coverage/local-pr-coverage.mjs',
      'eslint.config.mjs',
    ],
  },
  // 🌐 Base ignore and global config
  ...tseslint.config(
    {
      ignores: [
        'src/main/docker/',
        '.cache/',
        '.git/',
        '.github/',
        '.gradle/',
        '.idea/',
        '.jhipster/',
        'build/',
        'coverage/',
        'docker/',
        'docs/',
        'gradle/',
        'node/',
        'node_modules/',
        'out/',
        'out-tsc/',
        'repos/',
        'repos-download/',
        'src/main/resources/',
        'target/',
        'uploads/',
        'supporting_scripts/',
        'stub.js',
        'rules/**/*.js',
        'build/resources/main/static/',
        'prebuild.mjs',
        'src/main/webapp/app/generated/',
      ],
      languageOptions: {
        globals: {
          ...globals.node,
        },
      },
    },

    {
      files: ['**/*.{js,cjs,mjs}'],
      rules: {
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
    },

    {
      files: ['src/main/webapp/**/*.ts'],
      extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylistic, ...angular.configs.tsRecommended],
      languageOptions: {
        parser: typescriptParser,
        parserOptions: {
          project: ['./tsconfig.app.json', './tsconfig.spec.json', './tsconfig.json'],
        },
        globals: {
          ...globals.browser,
          NodeJS: 'readonly',
          navigator: 'readonly',
          document: 'readonly',
          window: 'readonly',
          setTimeout: 'readonly',
          setInterval: 'readonly',
          clearTimeout: 'readonly',
          clearInterval: 'readonly',
          sessionStorage: 'readonly',
          localStorage: 'readonly',
          addEventListener: 'readonly',
          Image: 'readonly',
          module: 'readonly',
          require: 'readonly',
          process: 'readonly',
          location: 'readonly',
          self: 'readonly',
          history: 'readonly',
          confirm: 'readonly',
          plugin: 'readonly',
          requestAnimationFrame: 'readonly',
          alert: 'readonly',
          Buffer: 'readonly',
          getComputedStyle: 'readonly',
          MarkdownIt: 'readonly',
        },
      },
      plugins: {
        '@typescript-eslint': tsPlugin,
        prettier: prettierPlugin,
        'unused-imports': unusedImports,
        localRules: localRulesPlugin,
      },
      processor: angular.processInlineTemplates,
      rules: {
        ...prettierPlugin.configs.recommended.rules,
        ...tsPlugin.configs.recommended.rules,
        ...angularPlugin.configs.recommended.rules,

        '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'jhi', style: 'kebab-case' }],
        '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'jhi', style: 'camelCase' }],
        '@angular-eslint/relative-url-prefix': 'error',
        '@angular-eslint/directive-class-suffix': ['error', { suffixes: ['Directive'] }],
        '@typescript-eslint/consistent-type-definitions': 'off',
        '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
        '@typescript-eslint/member-ordering': [
          'error',
          {
            default: [
              'public-static-field',
              'protected-static-field',
              'private-static-field',
              'public-instance-field',
              'protected-instance-field',
              'private-instance-field',
              'constructor',
              'public-static-method',
              'protected-static-method',
              'private-static-method',
              'public-instance-method',
              'protected-instance-method',
              'private-instance-method',
            ],
          },
        ],
        '@typescript-eslint/no-confusing-void-expression': 'off',
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-extraneous-class': 'off',
        '@typescript-eslint/no-misused-spread': 'off',
        '@typescript-eslint/no-floating-promises': 'warn',
        '@typescript-eslint/no-shadow': ['error'],
        '@typescript-eslint/no-unnecessary-condition': 'error',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/prefer-nullish-coalescing': 'error',
        '@typescript-eslint/prefer-optional-chain': 'error',
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/strict-boolean-expressions': 'warn',
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        '@typescript-eslint/no-deprecated': 'warn',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/ban-ts-comment': 'warn',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',

        'arrow-body-style': 'error',
        curly: 'error',
        eqeqeq: ['error', 'always', { null: 'ignore' }],
        'guard-for-in': 'error',
        'no-bitwise': 'error',
        'no-caller': 'error',
        'no-console': ['error', { allow: ['warn', 'error'] }],
        'no-eval': 'error',
        'no-labels': 'error',
        'no-new': 'error',
        'no-new-wrappers': 'error',
        'object-shorthand': ['error', 'always', { avoidExplicitReturnArrows: true }],
        radix: 'error',
        'spaced-comment': ['warn', 'always'],
        'no-unused-private-class-members': 'error',
        'no-case-declarations': 'off',
        'prefer-const': 'warn',
        'prefer-spread': 'warn',
        'no-var': 'error',
        'no-prototype-builtins': 'off',
        'sort-imports': [
          'error',
          {
            ignoreDeclarationSort: true,
          },
        ],
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'dayjs',
                message: "Please import from 'dayjs/esm' instead.",
              },
            ],
          },
        ],
        'no-restricted-syntax': [
          'error',
          {
            selector: 'ForInStatement',
            message: 'for-in loops are not allowed. Use Object.keys or Object.entries instead.',
          },
        ],
        'unused-imports/no-unused-imports': 'warn',
        'unused-imports/no-unused-vars': [
          'warn',
          {
            vars: 'all',
            varsIgnorePattern: '^_',
            args: 'after-used',
            argsIgnorePattern: '^_',
          },
        ],
        'localRules/enforce-signal-apis': 'error',
      },
    },

    {
      files: ['src/test/**/mock-*.ts'],
      languageOptions: {
        parser: typescriptParser,
      },
      plugins: {
        '@typescript-eslint': tsPlugin,
      },
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },

    {
      files: ['src/main/webapp/**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-empty-function': 'off',
      },
    },

    {
      files: ['src/main/webapp/**/*.html'], // only Angular html files
      languageOptions: {
        parser: angularTemplateParser,
      },
      extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
      plugins: {
        prettier: prettierPlugin,
      },
      rules: {
        'prettier/prettier': ['error', { parser: 'angular' }],
        '@angular-eslint/template/alt-text': 'error',
        '@angular-eslint/template/button-has-type': 'error',
        '@angular-eslint/template/click-events-have-key-events': ['error', { ignoreWithDirectives: ['jhiClickable'] }],
        '@angular-eslint/template/elements-content': 'off',
        '@angular-eslint/template/interactive-supports-focus': 'error',
        '@angular-eslint/template/label-has-associated-control': 'error',
        '@angular-eslint/template/mouse-events-have-key-events': 'error',
        '@angular-eslint/template/no-autofocus': 'error',
        '@angular-eslint/template/no-distracting-elements': 'error',
        '@angular-eslint/template/no-positive-tabindex': 'error',
        '@angular-eslint/template/role-has-required-aria': 'error',
        '@angular-eslint/template/table-scope': 'error',
        '@angular-eslint/template/valid-aria': 'error',
        '@angular-eslint/template/prefer-control-flow': 'error',
        '@angular-eslint/template/prefer-self-closing-tags': 'error',
      },
    },

    {
      files: ['**/*.{ts,js}'],
      plugins: {
        import: importPlugin,
      },
      rules: {
        'import/order': [
          'error',
          {
            groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
            'newlines-between': 'always',
          },
        ],
      },
    },

    // jhipster-needle-eslint-add-config - JHipster will add additional config here

    prettier,
  ),
];
