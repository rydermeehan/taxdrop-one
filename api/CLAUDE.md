# api/ — Instructions for Claude Code

- **ESM import extensions are mandatory.** `video-studio` is `"type": "module"`,
  so every relative import in an `api/*.ts` file must end in `.js` (e.g.
  `from './_tx-cads.js'`) even though the source file is `.ts`. Omitting it
  deploys fine and then dies at runtime with `FUNCTION_INVOCATION_FAILED` /
  `ERR_MODULE_NOT_FOUND`.

- **The `_` prefix is load-bearing.** Vercel builds every non-`_`-prefixed
  `api/*.ts` as a serverless function. Helper modules must be `_`-prefixed or
  they become broken endpoints. This is also why `api/*.test.ts` and
  `vitest.config.ts` are listed in `.vercelignore` — without those globs Vercel
  tries to build the test files as functions.
