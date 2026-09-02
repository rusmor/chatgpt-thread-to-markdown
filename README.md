<p align="center">
  <img src="assets/icon-source.svg" width="128" height="128" alt="ChatGPT Thread to Markdown icon">
</p>

# ChatGPT Thread to Markdown

An open-source, privacy-first Chrome and Edge extension for exporting long ChatGPT conversations to clean Markdown with one click.

It is designed for long threads. The exporter scrolls through the conversation from bottom to top, collecting messages even when ChatGPT virtualizes the page and keeps only part of the thread in the DOM.

> [!NOTE]
> This is an independent, unofficial project. It is not affiliated with or endorsed by OpenAI.

## Features

- One-click export from the browser toolbar
- Handles long, virtualized ChatGPT conversations
- Exports the currently selected conversation branch
- Preserves `User`, `Assistant`, `System`, and `Tool` roles
- Converts headings, paragraphs, lists, links, and blockquotes
- Preserves fenced code blocks and inline code
- Converts HTML tables to Markdown tables
- Preserves KaTeX/LaTeX source when it is available in the page
- Includes the source conversation URL and export timestamp
- Runs entirely in the active tab with no network requests
- Uses only temporary `activeTab` access—no persistent access to ChatGPT or browsing history

## Install

### From a release

1. Download the ZIP file from the repository's latest release.
2. Extract it to a permanent folder. Do not delete or move that folder while the extension is installed.
3. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted folder containing `manifest.json`.
7. Optionally pin the extension to the browser toolbar.

### From source

Clone or download this repository, then select the repository folder through **Load unpacked** as described above.

## Use

1. Open a conversation on `chatgpt.com` and wait for the current response to finish.
2. Click the extension icon.
3. Keep the tab open and do not switch to another conversation while collection is in progress.
4. Chrome downloads the resulting `.md` file to the normal downloads folder.

Very long threads may take a few minutes. A status panel shows the number of messages collected and provides a cancel button.

## Example output

```markdown
# Conversation title

> Source: [ChatGPT thread](https://chatgpt.com/c/example)
> Exported: 2026-09-01T12:00:00.000Z

## User

How does this work?

---

## Assistant

The extension reads the rendered conversation and converts it to Markdown.
```

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `activeTab` | Grants temporary access only to the tab where the toolbar icon was clicked. |
| `scripting` | Injects the exporter into that active ChatGPT tab. |

The extension requests no persistent host access and contains no analytics, tracking, or network calls. See [PRIVACY.md](PRIVACY.md).

## Limitations

- Only the currently selected branch is exported. Hidden alternative responses are not included.
- Uploaded images and files are not embedded in the Markdown file. The exporter keeps an accessible label or URL when available.
- Cancelling stops collection and does not save a partial export.
- ChatGPT's interface is not a stable public API. A future DOM change may require the selectors or conversion logic to be updated.

## Development

There is no build step and no runtime dependency. The extension uses Manifest V3 and plain JavaScript.

Before committing changes:

```bash
node --check background.js
node --check exporter.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"
```

For a new release, increment `version` in `manifest.json` and push to `main`. The release workflow packages the extension and creates the matching GitHub release automatically.

## Contributing

Bug reports and focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
