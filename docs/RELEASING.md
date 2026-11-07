# Releasing

1. Update the desktop version in `package.json`, the root entry in `package-lock.json`, `public/index.html` and the user guide. Update `CHANGELOG.md`.
2. Run `npm run sync:mobile` when shared assets or code change. The mobile package has its own runtime version; update it only for a mobile release.
3. Run checks/tests and build mobile as described in the README.
4. Run `npm run opensource:prepare` from a private development checkout when producing a public source export. The command creates a new folder under `work/open-source/`, excludes accounts/runtime state/private captures and replaces the full downloaded directory with the 22-symbol starter directory. It never deletes or overwrites an existing export.
5. Inspect the export before committing it. The original Sites checkout may be a nested Git repository; publish the clean export as a normal single repository instead of accidentally committing a Git submodule.
6. Publish or push `main` yourself, then wait for the Checks workflow.
7. Create the version tag `v<package.json version>` on the intended commit. The Windows release workflow tests, packages, self-checks and uploads an installer plus `SHA256SUMS.txt` to the GitHub Release.

A manually dispatched Windows workflow produces downloadable build artifacts without publishing a Release. Workflow execution depends on GitHub availability and the repository owner's settings; local preparation does not mean a workflow has already run remotely.

Never upload the original development directory, accounts, captured provider responses, `.env` files, access tokens or `.openai/hosting.json`. Build outputs belong in Release assets, not the source history. Retain all license notices in source and binary distributions.
