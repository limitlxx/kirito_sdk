# Contributing to Kirito SDK

Thank you for your interest in contributing to Kirito SDK! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Cairo 2.6.3+ (for smart contract development)
- Starknet Foundry (for contract testing)
- Git

### Setup Development Environment

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/kirito-sdk.git
   cd kirito-sdk
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Run tests to verify setup:
   ```bash
   npm test
   ```

## Development Workflow

### Branch Naming

- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`
- Performance: `perf/description`

### Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our coding standards

3. Write or update tests for your changes

4. Run tests and linting:
   ```bash
   npm test
   npm run lint
   ```

5. Commit your changes:
   ```bash
   git commit -m "feat: add new feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New features
   - `fix:` Bug fixes
   - `docs:` Documentation changes
   - `test:` Test additions or changes
   - `refactor:` Code refactoring
   - `perf:` Performance improvements
   - `chore:` Build process or auxiliary tool changes

6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

7. Create a Pull Request

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Follow existing code style (enforced by ESLint)
- Add JSDoc comments for public APIs
- Use meaningful variable and function names
- Keep functions small and focused

### Cairo

- Follow Cairo best practices
- Add comments for complex logic
- Use OpenZeppelin contracts where applicable
- Write comprehensive tests for all contracts

### Testing

- Write unit tests for all new functionality
- Add property-based tests for universal properties
- Ensure test coverage remains above 80%
- Test edge cases and error conditions

#### Property-Based Testing

For universal properties, use fast-check:

```typescript
import fc from 'fast-check';

describe('Property: Universal behavior', () => {
  it('should hold for all inputs', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer(),
        (str, num) => {
          // Test property
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Pull Request Process

1. Update documentation for any API changes
2. Add tests for new functionality
3. Ensure all tests pass
4. Update CHANGELOG.md with your changes
5. Request review from maintainers

### PR Checklist

- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Code follows style guidelines
- [ ] Commits follow conventional commits
- [ ] No merge conflicts
- [ ] CI/CD pipeline passes

## Testing Guidelines

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm test -- --testPathIgnorePatterns=properties

# Property-based tests only
npm run test:properties

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Cairo Contract Tests

```bash
cd contracts
snforge test
```

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for all public APIs
- Create examples for new features
- Update API documentation

### Generating Documentation

```bash
npm run docs
```

## Release Process

Releases are handled by maintainers:

1. Update version in package.json
2. Update CHANGELOG.md
3. Create release tag
4. GitHub Actions automatically publishes to NPM

## Getting Help

- Open an issue for bugs or feature requests
- Join our Discord for discussions
- Check existing issues and PRs first

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project README

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
