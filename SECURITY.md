# Security Policy

This file applies to the Builderstar fork snapshot. For upstream-only issues,
use the reporting process in
[involvex/youtube-music-cli](https://github.com/involvex/youtube-music-cli).

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Use [this repository's private vulnerability reporting](https://github.com/Builderstar/youtube-music-cli-mcp-fork/security/advisories/new)
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

Reports will be reviewed on a best-effort basis. This snapshot does not promise
an upstream maintenance or response schedule.

## Security Measures

### Audio URL Sanitization

This CLI streams audio from YouTube. All audio URLs are sanitized before being passed to the audio player to prevent shell injection vulnerabilities. See `source/services/player/` for implementation details.

### Dependencies

We monitor dependencies for known vulnerabilities using:

- GitHub Dependabot for automated security updates
- Regular `bun audit` checks during development

## Known Security Considerations

### Third-Party Dependencies

This project relies on several third-party packages. Some transitive dependencies may have known vulnerabilities that don't directly affect this application's usage:

| Package                              | Issue                                 | Risk Assessment                                                                      |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `@conventional-changelog/git-client` | Argument injection in `getTags()` API | **Low risk** - Only used during development for changelog generation, not at runtime |
| `ajv`                                | ReDoS when using `$data` option       | **Low risk** - Transitive dependency of ESLint, not used in production runtime       |
| `@eslint/plugin-kit`                 | ReDoS in ConfigCommentParser          | **Low risk** - Development dependency only, not included in published package        |

### Runtime Security

- The CLI executes external commands for audio playback (`play-sound`)
- Audio URLs are validated and sanitized before execution
- Configuration and optional service credentials are stored locally under
  `~/.youtube-music-cli`; protect that directory and do not attach it to issues
- No network requests are made to third-party services (only YouTube)

## Security Best Practices for Users

1. **Keep updated**: Always use the latest version of this CLI
2. **Verify sources**: Build this fork from this GitHub repository; the custom
   MCP server is not provided by the upstream npm package
3. **Review permissions**: This CLI requires network access and audio playback permissions

## Contact

For security concerns, contact the maintainers through:

- GitHub Security Advisories: https://github.com/Builderstar/youtube-music-cli-mcp-fork/security
