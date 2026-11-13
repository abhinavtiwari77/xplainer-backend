# Contributing to Xplainer Backend

Thank you for your interest in contributing to **Xplainer Backend**! We welcome contributions, bug reports, documentation improvements, and feature suggestions.

Every contribution helps make this project better. We appreciate your time and effort!

## Getting Started

Follow these steps to set up the project locally.

### 1. Fork the Repository

Fork the repository to your GitHub account.

### 2. Clone Your Fork

```bash
git clone https://github.com/<your-username>/xplainer-backend.git
cd xplainer-backend
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory and add the following variables:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173

OPENAI_ENDPOINT=
OPENAI_APIKEY=

SPEECH_KEY=
SPEECH_REGION=
SPEECH_VOICE=
```

Add your own API credentials where required.

**Important:** Never commit API keys, credentials, generated audio files, or other sensitive information to the repository.

### 5. Start the Development Server

```bash
npm run dev
```

### 6. Verify the Setup

Check whether the backend server is running correctly:

```bash
curl http://localhost:3000/health
```

## Project Structure

The project follows a modular structure to keep the code organized and maintainable.

```text
xplainer-backend/
├── agents/         # AI agents for text, voice, and image generation
├── controllers/    # Request handling and orchestration
├── routes/         # Express API routes
├── services/       # Audio processing and supporting services
├── app.js          # Express application configuration
├── server.js       # Application entry point
└── package.json    # Project dependencies and scripts
```

## Making Changes

Before making changes, create a new branch:

```bash
git checkout -b feature/short-description
```

Please follow these guidelines when contributing:

- Follow the existing CommonJS JavaScript coding style.
- Keep changes focused and avoid unrelated refactoring.
- Write clean, readable, and maintainable code.
- Validate request inputs and return meaningful HTTP error responses.
- Preserve the existing NDJSON streaming format used by `/api/explain`.
- Never expose API keys, provider credentials, or sensitive information in logs or API responses.
- Update relevant documentation when introducing new features or changing existing behavior.

## Testing Changes

Before submitting your changes, make sure everything works as expected.

Start the application:

```bash
npm start
```

Verify the health endpoint:

```bash
curl http://localhost:3000/health
```

For changes involving AI services, audio generation, or image generation:

- Test using valid local API credentials.
- Verify that the affected functionality works correctly.
- Check error handling and edge cases.
- Mention the validation performed in your pull request.

## Pull Requests

Once your changes are complete and tested, push your branch and open a pull request against the main repository.

Your pull request should include:

- A clear title and description.
- The problem or feature being addressed.
- Important implementation details.
- Testing steps and results.
- Any new or modified environment variables or API changes.
- Screenshots or logs when useful (with sensitive information removed).

Please keep pull requests small, focused, and easy to review.

Remember to update the README when changing setup instructions or public API behavior.

## Reporting Issues

If you encounter a bug or unexpected behavior, please open an issue in the GitHub repository.

When reporting an issue, include:

- A clear description of the problem.
- Steps to reproduce the issue.
- Expected and actual behavior.
- Relevant API endpoint or request payload.
- Error messages or logs with secrets removed.
- Node.js and operating system versions.
- Relevant commit or branch information, if applicable.

Providing these details helps us investigate and resolve issues more efficiently.

## Commit Messages

Use concise, descriptive commit messages that explain the purpose of your changes.

Examples:

```text
Add health check endpoint
Fix audio session cleanup
Improve explanation error handling
Update API documentation
Add image generation support
```

Keep commit messages meaningful and consistent with the existing project history.

## License

By contributing to Xplainer Backend, you agree that your contributions will be licensed under the repository's **MIT License**.

## Thank You!

Thank you for contributing to **Xplainer Backend**!

Whether you're fixing a bug, improving documentation, suggesting a feature, or adding new functionality, every contribution is valuable.

We appreciate your support and look forward to building something great together!
