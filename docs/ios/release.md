# Releasing the iOS app

Releases are manual. There is no macOS CI job, no signing in GitHub Actions, and no TestFlight upload from this repo. Web deploys stay automatic on Vercel. An iOS release is a tag plus a build you start on the Mac.

Tags:

- Candidate: `ios-v1.0.0-rc.1`, then `ios-v1.0.0-rc.2` for the next fix. Do not move a tag that TestFlight already installed.
- Approved build: `ios-v1.0.0`, pointing at the commit that was tested, which may be the same commit as the last release candidate.

Nothing below was executed. The `xcodebuild` lines are examples for the Mac. UNVERIFIED.

## 1. Version numbers

On the commit you will tag, set both configurations in `ios/App/App.xcodeproj/project.pbxproj`:

- `MARKETING_VERSION` — the user-visible version, such as `1.0` or `1.0.0`. `npm run ios:check` requires digits and dots (`1.0` or `1.0.0`).
- `CURRENT_PROJECT_VERSION` — an integer build number. Increase it for every upload. Apple rejects a reused build number.

`VITE_APP_VERSION` for that mobile build should be the same marketing version. It is sent as `X-Client-Version`.

- [ ] UNVERIFIED: Confirm both Xcode configurations (Debug and Release) carry the same pair.

## 2. Tag the candidate

Merge tested work to the default branch first. The website deploy is the early feedback. Shared API changes hit installed apps immediately. Freezing the mobile UI does not freeze the API.

```bash
git tag ios-v1.0.0-rc.1 <commit>
git push origin ios-v1.0.0-rc.1
```

- [ ] UNVERIFIED: Push the tag only when you mean to. Pushing tags was not done from this worktree.

## 3. Build on the Mac

Use a dedicated checkout so the laptop's day-to-day tree is not the release tree. The machine has to be awake and reachable. Confirm SSH, Xcode, and signing before you depend on them.

- [ ] UNVERIFIED: Record the Mac's SSH user and hostname. They are not stored in this repo.
- [ ] UNVERIFIED: Confirm the Apple ID signed into Xcode can sign `app.receiptsplitter.ios`.

```bash
ssh USER@MAC_HOSTNAME
cd ~/receipt-splitter-ios-build
git fetch origin
git checkout ios-v1.0.0-rc.1
npm ci
npm run ios:sync
```

`npm run ios:sync` is the mobile script that builds `dist-mobile` and runs `npx cap sync ios`. If that script is not on the tag yet, run `npm run mobile:build` and then `npx cap sync ios`.

Example archive and export. UNVERIFIED. These commands were not run. The shared scheme name `App` is the Capacitor target name. If Xcode has not shared a scheme, create and share it once, then re-run. Replace the team id. `ExportOptions.plist` is a file you create on the Mac (method `app-store-connect`, team id, upload symbols). Do not commit a file that contains a provisioning profile or a certificate.

```bash
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$HOME/receipt-splitter-ios-build/build/App.xcarchive" \
  archive

xcodebuild \
  -exportArchive \
  -archivePath "$HOME/receipt-splitter-ios-build/build/App.xcarchive" \
  -exportPath "$HOME/receipt-splitter-ios-build/build/export" \
  -exportOptionsPlist "$HOME/receipt-splitter-ios-build/ExportOptions.plist"
```

- [ ] UNVERIFIED: Archive, export, and upload to App Store Connect.
- [ ] UNVERIFIED: Install the build from TestFlight and run [manual-verification.md](manual-verification.md).
- [ ] UNVERIFIED: Fixes get a new candidate tag and a new `CURRENT_PROJECT_VERSION`. Do not move `ios-v1.0.0-rc.1`.

## 4. Record the release, then tag the final build

Open a draft GitHub Release. Do not publish it yet. Record:

- the commit SHA
- `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`
- the Xcode and macOS versions on the build machine
- the TestFlight build number
- notes a future you will need (API origin, tip product IDs, anything reviewers asked for)

When the build is approved and you release it manually in App Store Connect:

```bash
git tag ios-v1.0.0 <tested-commit>
git push origin ios-v1.0.0
```

Publish the GitHub Release on that tag. The release does not build or submit anything.

- [ ] UNVERIFIED: Draft the GitHub Release, then publish it only after App Store approval.
- [ ] UNVERIFIED: Install the live App Store build once.

## 5. API compatibility and rollback

Keep v1 API changes additive. Deploy the backend before the mobile build that needs it. Before a backend deploy, hit staging with the oldest app version you still expect people to run (the oldest TestFlight or App Store build you have not forced off).

A bad website deploy can be rolled back if the previous deployment still serves that oldest app. A bad binary cannot. Ship a new build. Do not break saved on-device sessions or existing share links. Deprecate a field only when an offline split from the oldest supported app still opens.

- [ ] UNVERIFIED: Run the oldest supported app against staging before the production API deploy that accompanies a release.

## 6. After launch

Even in a quiet month, keep reminders for:

- Apple Developer Program renewal
- certificates, the distribution profile, and the API keys the Mac build uses
- App Store SDK and privacy-manifest deadlines
- a new iOS version that drops the deployment target or breaks a plugin

Parsing failures, cost, native crashes, and the 90-day cleanup job still need someone watching them. Those can require a maintenance release with no product change.

- [ ] UNVERIFIED: Put those reminders on a calendar the account holder actually sees.
