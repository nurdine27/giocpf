import tseslint from 'typescript-eslint';
export default tseslint.config(...tseslint.configs.recommended, {
  files: ['src/**/*.ts', 'prisma/**/*.ts', 'scripts/**/*.ts'],
  rules: { '@typescript-eslint/no-explicit-any': 'error' },
});
