#!/bin/bash

# Kirito SDK - Prepare for Publishing Script
# This script helps prepare the package for NPM publishing

set -e  # Exit on error

echo "🚀 Kirito SDK - Prepare for Publishing"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} npm is installed"

# Check if logged in to npm
if ! npm whoami &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  Not logged in to NPM"
    echo "Run: npm login"
    exit 1
fi

echo -e "${GREEN}✓${NC} Logged in to NPM as: $(npm whoami)"

# Check package name
PACKAGE_NAME=$(node -p "require('./package.json').name")
echo ""
echo "Package name: $PACKAGE_NAME"
echo "Checking if name is available..."

if npm view "$PACKAGE_NAME" &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  Package name '$PACKAGE_NAME' already exists on NPM"
    echo "You may need to:"
    echo "  1. Choose a different name"
    echo "  2. Use a scoped name: @your-username/kirito-sdk"
    echo "  3. If you own this package, you can publish an update"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} Package name is available"
fi

# Clean previous builds
echo ""
echo "🧹 Cleaning previous builds..."
npm run clean || true
echo -e "${GREEN}✓${NC} Clean complete"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install
echo -e "${GREEN}✓${NC} Dependencies installed"

# Run linter
echo ""
echo "🔍 Running linter..."
if npm run lint; then
    echo -e "${GREEN}✓${NC} Linting passed"
else
    echo -e "${RED}❌ Linting failed${NC}"
    echo "Fix linting errors before publishing"
    exit 1
fi

# Build TypeScript
echo ""
echo "🔨 Building TypeScript..."
if npm run build; then
    echo -e "${GREEN}✓${NC} Build successful"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} dist directory created"

# Run tests
echo ""
echo "🧪 Running tests..."
if npm test; then
    echo -e "${GREEN}✓${NC} All tests passed"
else
    echo -e "${RED}❌ Tests failed${NC}"
    echo "Fix failing tests before publishing"
    exit 1
fi

# Create package tarball
echo ""
echo "📦 Creating package tarball..."
npm pack
TARBALL=$(ls -t *.tgz | head -1)
TARBALL_SIZE=$(du -h "$TARBALL" | cut -f1)
echo -e "${GREEN}✓${NC} Package created: $TARBALL ($TARBALL_SIZE)"

# Show package contents
echo ""
echo "📋 Package contents:"
tar -tzf "$TARBALL" | head -20
echo "..."
echo ""

# Summary
echo "======================================"
echo "✅ Package is ready for publishing!"
echo "======================================"
echo ""
echo "Package: $PACKAGE_NAME"
echo "Version: $(node -p "require('./package.json').version")"
echo "Size: $TARBALL_SIZE"
echo "Tarball: $TARBALL"
echo ""
echo "Next steps:"
echo "  1. Review the checklist: PRE_PUBLISH_CHECKLIST.md"
echo "  2. Test locally: npm install ./$TARBALL"
echo "  3. Publish: npm publish --access public"
echo ""
echo "To publish now, run:"
echo -e "${GREEN}npm publish --access public${NC}"
echo ""
