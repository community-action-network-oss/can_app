# can_app

The universal Expo app (web, iOS, Android from one codebase) for the Community Action Network.
Currently the app is a shell: router, providers, civic component foundation, i18n, design tokens, and a
home screen that shows whether `can_server` is reachable.

## Web first

Development and verification happen on Expo web only. No simulator or device is needed or used.
Native bundling is checked with a JS-only export (`npx expo export --platform ios`).

## Quick start

Needs Node 24 or newer and `can_server` running on port 4000.

```sh
npm i
cp .env.example .env.local   # optional, defaults to http://localhost:4000
npx expo start --web --port 8081
```

## Scripts

| Script                | What it does                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run verify`      | Typecheck, lint, prettier, logical-properties check, tests, web export. Run it before every commit. |
| `npm test`            | Jest (jest-expo, Testing Library)                                                                   |
| `npm run sync:tokens` | Copy `../docs/design/ux/tokens.json` into `src/theme/tokens.json`                                   |
| `npm run gen:api`     | Regenerate `src/api/schema.d.ts` from `../can_server/openapi/openapi.json`                          |
| `npm run format`      | Prettier write                                                                                      |

## Rules

- **Civic components only.** Feature code in `app/` and `src/` imports UI from
  `src/components/civic`. ESLint blocks `@gluestack-ui/*` and `src/components/ui` elsewhere.
  Civic components are wrappers over React Native primitives styled from design tokens
  (gluestack-ui v5 is still alpha; it can be adopted behind the civic layer later).
- **Every string through intl.** Add the message to `src/i18n/en.json`, use `useT()`.
  ICU placeholders, no concatenation, no em or en dashes.
- **Logical properties only.** Use start and end, never left and right (checked in `verify`).
- **Accessibility.** Buttons require `accessibilityLabel`. Targets are at least 44 points.

## Contract flow

`can_server` owns the OpenAPI contract. This app never edits it. After the contract changes, run
`npm run gen:api` and commit the regenerated `src/api/schema.d.ts`. API calls go through the
typed `openapi-fetch` client in `src/api/client.ts`.

## Contributing

See [../CONTRIBUTING.md](../CONTRIBUTING.md).
