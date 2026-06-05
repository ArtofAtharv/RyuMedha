# Technical Debt Analysis

Based on repository inspection, the following technical debt items have been identified:

## Duplicate Code & Repeated Logic
- **Web Directories**: The directories `web/`, `web-legacy/`, and `web-clone/` contain duplicate Next.js applications. The primary application appears to be `web/`.

## Missing Documentation
- While there are detailed markdown files in `docs/`, inline code documentation and API definitions within the frontend and backend are sparse.

## Configuration Duplication
- `package.json` and `package-lock.json` are duplicated across multiple directories, making dependency updates tedious.
