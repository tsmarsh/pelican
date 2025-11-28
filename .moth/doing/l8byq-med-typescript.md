Please migrate Pelican from plain JS to a minimal TypeScript + Yarn + GitHub Pages build pipeline.

Goals:
- Use TypeScript for core logic (pelican.ts).
- Use Yarn as the package manager.
- Compile TS + copy static assets into a dist/ directory.
- Deploy dist/ to GitHub Pages using GitHub Actions.

Target structure:
- src/
  - index.html
  - styles.css
  - pelican.ts
- dist/
  - index.html
  - styles.css
  - pelican.js
- package.json
- tsconfig.json
- yarn.lock (created by yarn)
- .github/workflows/pages.yml

Requirements:

1) TypeScript setup
- Create tsconfig.json with:
  - rootDir: src
  - outDir: dist
  - target: ES2019
  - module: ESNext
  - strict mode enabled.
- Create package.json with:
  - "devDependencies": { "typescript": "^5.6.0" }
  - scripts:
      "build:ts": "tsc"
      "build:assets": "mkdir -p dist && cp src/index.html dist/index.html && cp src/styles.css dist/styles.css"
      "build": "yarn build:ts && yarn build:assets"

2) Source move & TS conversion
- Move the existing HTML, CSS, and JS into src/:
  - index.html → src/index.html
  - styles.css → src/styles.css
  - relative-bingo.js or pelican.js → src/pelican.ts
- Convert the current JS file into valid TypeScript:
  - Add appropriate types where reasonable.
  - Keep the public behavior identical.
- Update src/index.html to reference:
  <script type="module" src="./pelican.js"></script>

3) GitHub Actions for Pages
- Add .github/workflows/pages.yml that:
  - Triggers on push to main and workflow_dispatch.
  - Checks out the code.
  - Sets up Node (version 22).
  - Installs dependencies with Yarn.
  - Runs `yarn build`.
  - Uploads dist/ as the Pages artifact.
  - Deploys via actions/deploy-pages@v4.

4) Constraints
- Do NOT add a bundler (no Vite, no Webpack). Just tsc + static copy.
- Keep everything compatible with GitHub Pages as static hosting.
- The app should still start by opening index.html (in dist) and behave exactly as before.

Please:
1. Briefly summarize your migration plan.
2. Provide full contents for:
   - package.json
   - tsconfig.json
   - src/index.html
   - src/pelican.ts (TS version of current JS)
   - src/styles.css (only if changes are needed)
   - .github/workflows/pages.yml
