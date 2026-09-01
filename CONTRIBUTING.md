# Contributing

Thanks for helping improve ChatGPT Thread to Markdown.

## Bug reports

Before opening an issue, check whether the problem is caused by a recent ChatGPT interface change. Include:

- Chrome or Edge version;
- extension version;
- approximate thread length;
- the status panel or console error;
- a minimal description of formatting that was lost or corrupted.

Do not post private conversation content. Replace it with a minimal synthetic example.

## Pull requests

Keep changes focused and dependency-free unless a dependency solves a clearly documented problem. Before submitting:

```bash
node --check background.js
node --check exporter.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"
```

Update `CHANGELOG.md` for user-visible changes. Do not bump the extension version in ordinary pull requests unless the change is explicitly preparing a release.
