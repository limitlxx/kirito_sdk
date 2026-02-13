# NPM Publishing Guide for Kirito SDK

## Quick Start

To publish the Kirito SDK to NPM, follow these steps:

### 1. Prepare Your NPM Account

```bash
# Create account at https://www.npmjs.com/signup
# Then login
npm login
```

### 2. Choose Package Name

The package is currently configured as `@kirito/sdk`. You have three options:

**Option A: Use unscoped name (recommended for first publish)**
```json
// In package.json, change:
"name": "kirito-sdk"
```

**Option B: Use your personal scope**
```json
// In package.json, change:
"name": "@your-username/kirito-sdk"
```

**Option C: Keep @kirito/sdk (requires organization access)**
- You need to create/join the @kirito organization on NPM

### 3. Run Preparation Script

```bash
./scripts/prepare-publish.sh
```

This script will:
- ✅ Check NPM login
- ✅ Check package name availability
- ✅ Clean previous builds
- ✅ Install dependencies
- ✅ Run linter
- ✅ Build TypeScript
- ✅ Run tests
- ✅ Create package tarball

### 4. Test Locally (Recommended)

```bash
# The script creates a .tgz file
# Test it in another directory
cd /tmp
mkdir test-install && cd test-install
npm init -y
npm install /path/to/kirito-sdk/kirito-sdk-1.0.0.tgz

# Test the import
node -e "const { KiritoSDK } = require('kirito-sdk'); console.log('Success!')"
```

### 5. Publish to NPM

```bash
# Go back to your project
cd /path/to/kirito-sdk

# Publish (use --access public for scoped packages)
npm publish --access public
```

### 6. Verify Publication

```bash
# Check on NPM
npm view kirito-sdk

# Or visit in browser
# https://www.npmjs.com/package/kirito-sdk
```

## Manual Steps (Without Script)

If you prefer to run steps manually:

```bash
# 1. Login
npm login

# 2. Clean and build
npm run clean
npm run build

# 3. Run tests
npm test

# 4. Create package
npm pack

# 5. Publish
npm publish --access public
```

## Important Files

- **PUBLISHING.md** - Comprehensive publishing guide with troubleshooting
- **PRE_PUBLISH_CHECKLIST.md** - Complete checklist before publishing
- **scripts/prepare-publish.sh** - Automated preparation script

## Common Issues & Solutions

### Issue: Package name already taken

**Solution**: Change the package name in `package.json`:
```json
{
  "name": "kirito-starknet-sdk",  // or another unique name
  // ...
}
```

### Issue: Not logged in to NPM

**Solution**:
```bash
npm login
# Enter your credentials
```

### Issue: Build fails

**Solution**:
```bash
# Check TypeScript errors
npx tsc --noEmit

# Fix any errors, then rebuild
npm run build
```

### Issue: Tests fail

**Solution**:
```bash
# Run tests with verbose output
npm test -- --verbose

# Fix failing tests, then try again
```

### Issue: 402 Payment Required

**Solution**: You're trying to publish a private scoped package. Use:
```bash
npm publish --access public
```

## After Publishing

1. **Verify Installation**
   ```bash
   npm install kirito-sdk
   ```

2. **Update README Badge**
   Add NPM badge to README.md:
   ```markdown
   [![npm version](https://badge.fury.io/js/kirito-sdk.svg)](https://www.npmjs.com/package/kirito-sdk)
   ```

3. **Create GitHub Release**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **Announce**
   - Share on Twitter/X
   - Post in Discord/Telegram
   - Update project documentation

## Updating the Package

For future updates:

```bash
# 1. Make your changes

# 2. Update version
npm version patch  # 1.0.0 -> 1.0.1
# or
npm version minor  # 1.0.0 -> 1.1.0
# or
npm version major  # 1.0.0 -> 2.0.0

# 3. Build and test
npm run build
npm test

# 4. Publish
npm publish --access public

# 5. Push to git
git push && git push --tags
```

## Automated Publishing (CI/CD)

The project includes GitHub Actions for automated publishing:

1. Add NPM token to GitHub Secrets:
   - Generate token: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Add to GitHub: Settings → Secrets → `NPM_TOKEN`

2. Create a release:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. GitHub Actions will automatically publish

## Need Help?

- **NPM Documentation**: https://docs.npmjs.com/
- **Publishing Guide**: https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry
- **Semantic Versioning**: https://semver.org/

## Summary

```bash
# Quick publish (after preparation)
npm login
./scripts/prepare-publish.sh
npm publish --access public
```

That's it! Your package will be live on NPM and installable via:
```bash
npm install kirito-sdk
```

---

**Note**: The first publish is permanent (after 72 hours). Take your time to verify everything is correct!
