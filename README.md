This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Type checking and tests

`tsconfig.json` is the only TypeScript configuration. It covers application code,
tests, scripts, Next.js generated types and the `@/*` alias with strict checking.

- `npm run typecheck` checks the whole project without emitting JavaScript.
- `npm test` compiles and runs all suites with Node's built-in test runner.
- Existing `test:seed`, `test:db`, `test:repositories`, `test:query`, `test:pipeline`,
  `test:reviews`, `test:simulation` and `test:keyboard` commands run individual suites.
- `npm run validate:seed` validates the fictional snapshot and its relationships.

Tests and the seed validator share `test:compile`, which reads the root config and
applies Node module-resolution and emission overrides on the command line. CommonJS output is
needed for the existing extensionless imports, JSON imports and TSX-based rendering
tests. Next.js retains its ES module/bundler settings and `noEmit`; strictness is
unchanged. Compiled Node files live under ignored `node_modules/.cache/dealpatch-node`.
Incremental `*.tsbuildinfo` files are generated caches and are ignored by Git.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
