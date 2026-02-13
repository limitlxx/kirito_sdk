# Pre-Publish Checklist for Kirito SDK

Complete this checklist before publishing to NPM.

## ✅ Package Configuration

- [ ] Package name is available on NPM (check at https://www.npmjs.com/package/YOUR_PACKAGE_NAME)
- [ ] `package.json` has correct name
- [ ] `package.json` has correct version (1.0.0 for first release)
- [ ] `package.json` has correct `main` field (dist/index.js)
- [ ] `package.json` has correct `types` field (dist/index.d.ts)
- [ ] `package.json` has correct `files` array
- [ ] `package.json` has proper keywords for discoverability
- [ ] `package.json` has repository URL
- [ ] `package.json` has license (MIT)

## ✅ Documentation

- [ ] README.md is comprehensive and up-to-date
- [ ] README.md has installation instructions
- [ ] README.md has usage examples
- [ ] README.md has API documentation
- [ ] CONTRIBUTING.md exists
- [ ] LICENSE file exists
- [ ] CHANGELOG.md exists (or create one)

## ✅ Code Quality

- [ ] All TypeScript errors are fixed (`npx tsc --noEmit`)
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] No console.log statements in production code
- [ ] No TODO comments that should be addressed

## ✅ Build

- [ ] Clean build works (`npm run clean && npm run build`)
- [ ] `dist/` directory is created
- [ ] `dist/index.js` exists
- [ ] `dist/index.d.ts` exists
- [ ] Source maps are generated
- [ ] Cairo contracts build (`npm run build:contracts`)

## ✅ Testing

- [ ] All unit tests pass
- [ ] All property-based tests pass
- [ ] Integration tests pass
- [ ] Test coverage is adequate (>80%)
- [ ] No failing tests

## ✅ Dependencies

- [ ] All dependencies are in `dependencies` (not devDependencies)
- [ ] Dev dependencies are in `devDependencies`
- [ ] Optional dependencies are in `optionalDependencies`
- [ ] No unused dependencies
- [ ] Dependency versions are specified correctly

## ✅ Files

- [ ] `.npmignore` is configured correctly
- [ ] Source files are excluded from package
- [ ] Test files are excluded from package
- [ ] Only necessary files are included
- [ ] Package size is reasonable (`npm pack` and check size)

## ✅ Local Testing

- [ ] Package builds successfully
- [ ] Created tarball with `npm pack`
- [ ] Tested tarball installation in separate project
- [ ] Imports work correctly from installed package
- [ ] TypeScript types work correctly

## ✅ NPM Account

- [ ] NPM account created
- [ ] Logged in to NPM (`npm whoami`)
- [ ] Have access to publish under chosen scope/name
- [ ] 2FA is enabled (recommended)

## ✅ Git

- [ ] All changes are committed
- [ ] Working directory is clean
- [ ] On correct branch (main/master)
- [ ] Pushed to remote repository
- [ ] Tagged with version (`git tag v1.0.0`)

## ✅ CI/CD (Optional)

- [ ] GitHub Actions workflow is configured
- [ ] NPM_TOKEN secret is added to GitHub
- [ ] CI/CD pipeline passes

## ✅ Final Checks

- [ ] Reviewed package.json one more time
- [ ] Reviewed README.md one more time
- [ ] Double-checked package name availability
- [ ] Ready to publish!

## Publishing Commands

Once all checks pass:

```bash
# 1. Final build
npm run clean
npm run build

# 2. Run tests
npm test

# 3. Create package
npm pack

# 4. Test locally (optional but recommended)
cd /tmp
mkdir test-kirito-sdk
cd test-kirito-sdk
npm init -y
npm install /path/to/kirito-sdk/kirito-sdk-1.0.0.tgz
node -e "const { KiritoSDK } = require('kirito-sdk'); console.log('Works!')"

# 5. Publish
cd /path/to/kirito-sdk
npm publish --access public

# 6. Verify
npm view kirito-sdk
```

## Post-Publish

- [ ] Verify package appears on NPM
- [ ] Test installation from NPM (`npm install kirito-sdk`)
- [ ] Update documentation with NPM badge
- [ ] Announce release
- [ ] Create GitHub release
- [ ] Update project status

## Notes

- First publish cannot be undone after 72 hours
- Take your time and verify everything
- When in doubt, test with `npm pack` first
- You can always publish a patch version if something is wrong

## Common Issues

**Package name taken**: Choose different name or add scope
**Not logged in**: Run `npm login`
**Build fails**: Check TypeScript errors with `npx tsc --noEmit`
**Tests fail**: Fix tests before publishing
**Large package size**: Check `.npmignore` and `files` in package.json

---

**Ready to publish?** Run: `npm publish --access public`
