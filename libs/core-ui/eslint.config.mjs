import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'lib',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'lib',
          style: 'kebab-case',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apis/**', 'apis/**'],
              message: 'core-ui must not import from apis/**.',
            },
            {
              group: ['**/libs/**', 'libs/**'],
              message: 'core-ui must not import from libs/**.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    rules: {},
  },
];
