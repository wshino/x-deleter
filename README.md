# X-Deleter

A tool to delete X (formerly Twitter) posts while respecting API rate limits.

## Prerequisites

- Bun runtime or Docker

## Configuration

Create a `.env` file in the root directory with your X API credentials and configuration:

```env
# API Credentials
X_API_KEY=your_api_key
X_API_SECRET=your_api_secret
X_ACCESS_TOKEN=your_access_token
X_ACCESS_TOKEN_SECRET=your_access_token_secret

# User Configuration
X_USERNAME=your_username
```

## Running the Application

### Using Bun

1. Install dependencies:
```bash
bun install
```

2. Start the application:
```bash
bun start
```

### Using Docker

Simply run:
```bash
docker-compose up
```

Or build and run manually:
```bash
docker build -t x-deleter .
docker run -it --env-file .env x-deleter
```

## Development

For development with auto-reload:
```bash
bun dev
```

## Notes

- Due to X API rate limits, the deletion process may take time
- Deleted posts cannot be restored
- The most recent post will be preserved 