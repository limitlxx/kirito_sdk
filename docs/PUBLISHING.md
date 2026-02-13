# Publishing Kirito SDK to NPM

This guide walks you through publishing the Kirito SDK to NPM.

## Prerequisites

1. **NPM Account**: Create an account at https://www.npmjs.com/signup
2. **NPM CLI**: Ensure npm is installed (`npm --version`)
3. **Package Scope**: Decide on package name:
   - `@kirito/sdk` (requires organization access)
   - `kirito-sdk` (public, unscoped)
   - `@your-username/kirito-sdk` (your personal scope)

## Step 1: Update Package Name (if needed)

If you don't have access to the `@kirito` scope, update `package.json`:

```json
{
  "name": "kirito-sdk",  // or "@your-username/kirito-sdk"
  // ... rest of config
}
```

## Step 2: Login to NPM

```bash
npm login
```

Enter your NPM credentials when prompted.

## Step 3: Verify Package Configuration

Check that package.json has correct settings:

```bash
cat package.json | grep -A 5 '"name"'
```

Ensure these fields are set:
- `name`: Package name
- `version`: Current version (1.0.0)
- `main`: Entry point (dist/index.js)
- `types`: TypeScript definitions (dist/index.d.ts)
- `files`: Files to include in package

## Step 4: Run Pre-Publish Checks

The package has a `prepublishOnly` script that runs automatically:

```bash
# This runs: clean, build, and test
npm run prepublishOnly
```

Or run steps manually:

```bash
# Clean previous builds
npm run clean

# Build TypeScript
npm run build

# Run tests
npm test
```

## Step 5: Test Package Locally

Before publishing, test the package locally:

```bash
# Create a tarball
npm pack

# This creates: kirito-sdk-1.0.0.tgz (or your package name)

# Test in another project
cd /path/to/test-project
npm install /path/to/kirito-sdk/kirito-sdk-1.0.0.tgz

# Test the import
node -e "const sdk = require('kirito-sdk'); console.log(sdk)"
```

## Step 6: Publish to NPM

### For Public Package (Free)

```bash
npm publish --access public
```

### For Scoped Package

```bash
# Public scoped package
npm publish --access public

# Private scoped package (requires paid plan)
npm publish --access restricted
```

## Step 7: Verify Publication

After publishing:

```bash
# Check on NPM
npm view kirito-sdk

# Or visit
# https://www.npmjs.com/package/kirito-sdk
```

## Step 8: Install and Test

Test installation from NPM:

```bash
# In a new directory
mkdir test-install && cd test-install
npm init -y
npm install kirito-sdk

# Test import
node -e "const { KiritoSDK } = require('kirito-sdk'); console.log('Success!')"
```

## Troubleshooting

### Error: Package name already exists

Choose a different name or add your username scope:
```bash
# Update package.json name to:
"name": "@your-username/kirito-sdk"
```

### Error: You must be logged in

```bash
npm login
# Or check current user
npm whoami
```

### Error: 402 Payment Required

You're trying to publish a private scoped package. Either:
- Make it public: `npm publish --access public`
- Upgrade to NPM Pro: https://www.npmjs.com/products

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try building again
npm run build
```

### Test Failures

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test
npm test -- tests/properties/nft-generation-consistency.test.ts
```

## Version Management

### Updating Version

Use npm version commands:

```bash
# Patch release (1.0.0 -> 1.0.1)
npm version patch

# Minor release (1.0.0 -> 1.1.0)
npm version minor

# Major release (1.0.0 -> 2.0.0)
npm version major
```

This automatically:
- Updates package.json version
- Creates a git commit
- Creates a git tag

Then publish:

```bash
npm publish --access public
```

### Publishing Updates

```bash
# 1. Make changes
# 2. Update version
npm version patch

# 3. Publish
npm publish --access public

# 4. Push to git
git push && git push --tags
```

## Automated Publishing with GitHub Actions

The package includes a CI/CD workflow (`.github/workflows/ci.yml`) that automatically publishes on release.

### Setup:

1. Add NPM token to GitHub secrets:
   - Generate token: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Add to GitHub: Settings → Secrets → New repository secret
   - Name: `NPM_TOKEN`
   - Value: Your NPM token

2. Create a release on GitHub:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. GitHub Actions will automatically:
   - Run tests
   - Build package
   - Publish to NPM

## Package Maintenance

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update dependencies
npm update

# Update to latest (breaking changes)
npm install package-name@latest
```

### Deprecating a Version

```bash
npm deprecate kirito-sdk@1.0.0 "Please upgrade to 1.0.1"
```

### Unpublishing (within 72 hours)

```bash
# Unpublish specific version
npm unpublish kirito-sdk@1.0.0

# Unpublish entire package (use with caution!)
npm unpublish kirito-sdk --force
```

## Best Practices

1. **Always test locally** before publishing
2. **Use semantic versioning** (MAJOR.MINOR.PATCH)
3. **Update CHANGELOG.md** with each release
4. **Tag releases** in git
5. **Keep README.md** up to date
6. **Monitor downloads** and issues
7. **Respond to issues** and PRs promptly

## Support

- NPM Documentation: https://docs.npmjs.com/
- Package Publishing Guide: https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry
- Semantic Versioning: https://semver.org/

## Quick Reference

```bash
# Login
npm login

# Build
npm run build

# Test
npm test

# Pack (test locally)
npm pack

# Publish
npm publish --access public

# Check published package
npm view kirito-sdk

# Install from NPM
npm install kirito-sdk
```

## Next Steps After Publishing

1. **Announce**: Share on social media, Discord, Twitter
2. **Documentation**: Ensure docs are comprehensive
3. **Examples**: Add more examples to help users
4. **Monitor**: Watch for issues and feedback
5. **Iterate**: Release updates based on feedback

---

**Note**: The first publish is always the most important. Take your time to verify everything is correct before running `npm publish`.
