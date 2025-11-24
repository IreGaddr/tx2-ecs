# Contributing to WECS

Thank you for your interest in contributing to WECS! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/wecs.git
   cd wecs
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run tests to ensure everything works:
   ```bash
   npm test
   ```

## Development Workflow

### Running Tests

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Building

```bash
# Build all packages
npm run build

# Build and watch for changes
npm run dev

# Type check
npm run typecheck
```

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

### Running Examples

```bash
# Build the example app
npm run example:build

# Run the example app
npm run example:todo

# Development mode with watch
npm run example:todo:dev
```

## Code Style

- We use ESLint and Prettier for code style
- Run `npm run lint:fix` and `npm run format` before committing
- Follow existing code patterns
- Write clear, self-documenting code
- Add comments only when the code isn't self-evident

## Testing Guidelines

- All new features must include tests
- Aim for high code coverage (>80%)
- Write unit tests for individual functions
- Write integration tests for complex interactions
- Use descriptive test names

### Test Structure

```typescript
describe('Feature', () => {
  it('should do something specific', () => {
    // Arrange
    const input = ...;

    // Act
    const result = ...;

    // Assert
    expect(result).toBe(...);
  });
});
```

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(reactive): add batch update support

Implement batched reactive updates to improve performance
when multiple signals change simultaneously.

Closes #123
```

```
fix(dom): correct attribute escaping in SSR

Properly escape HTML attributes to prevent XSS vulnerabilities.
```

## Pull Request Process

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes and commit with conventional commit messages

3. Ensure all tests pass:
   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```

4. Push to your fork and create a Pull Request

5. Fill out the PR template completely

6. Wait for review and address any feedback

### PR Guidelines

- Keep PRs focused on a single feature or fix
- Update documentation if needed
- Add tests for new functionality
- Ensure CI passes
- Request review from maintainers

## Project Structure

```
wecs/
├── src/
│   ├── core/          # Core ECS primitives
│   ├── reactive/      # Reactive system
│   ├── client/        # Client-side rendering
│   ├── server/        # Server-side features
│   └── shared/        # Isomorphic utilities
├── examples/          # Example applications
├── scripts/           # Build scripts
└── .github/           # GitHub Actions workflows
```

## Adding New Features

### Before Starting

1. Open an issue to discuss the feature
2. Wait for maintainer feedback
3. Ensure it aligns with project goals

### Implementation Steps

1. Write tests first (TDD)
2. Implement the feature
3. Ensure tests pass
4. Update documentation
5. Add examples if applicable

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Include code examples in documentation
- Update CHANGELOG.md

## Release Process

(For maintainers only)

1. Update version in package.json
2. Update CHANGELOG.md
3. Create a git tag
4. Push tag to trigger release workflow
5. GitHub Actions will publish to npm

## Getting Help

- Open an issue for bugs or feature requests
- Join our discussions for questions
- Check existing issues and PRs first

## Code of Conduct

Be respectful, inclusive, and professional. We're all here to build something great together.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
