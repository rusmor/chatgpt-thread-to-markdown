(() => {
  "use strict";

  if (window.__chatgptMarkdownExporter?.running) {
    window.__chatgptMarkdownExporter.flash?.("An export is already running");
    return;
  }

  const state = {
    running: true,
    cancelled: false,
    flash: null
  };
  window.__chatgptMarkdownExporter = state;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function makePanel() {
    const host = document.createElement("div");
    host.id = "chatgpt-md-export-status";
    host.style.cssText = [
      "position:fixed",
      "right:20px",
      "bottom:20px",
      "z-index:2147483647",
      "width:330px",
      "box-sizing:border-box",
      "padding:14px 15px",
      "border:1px solid rgba(255,255,255,.18)",
      "border-radius:12px",
      "background:#171717",
      "color:#f5f5f5",
      "box-shadow:0 12px 40px rgba(0,0,0,.35)",
      "font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "Export thread to Markdown";
    title.style.cssText = "font-weight:650;font-size:14px;margin:0 0 7px";

    const message = document.createElement("div");
    message.textContent = "Preparing…";
    message.style.cssText = "color:#d4d4d4;white-space:pre-wrap";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:11px";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Cancel";
    button.style.cssText = [
      "border:1px solid #525252",
      "border-radius:7px",
      "padding:5px 10px",
      "background:#262626",
      "color:#fafafa",
      "cursor:pointer",
      "font:inherit"
    ].join(";");
    button.addEventListener("click", () => {
      if (state.running) {
        state.cancelled = true;
        message.textContent = "Stopping…";
        button.disabled = true;
      } else {
        host.remove();
      }
    });

    actions.append(button);
    host.append(title, message, actions);
    document.documentElement.append(host);

    let flashTimer = null;
    state.flash = (text) => {
      const previous = message.textContent;
      message.textContent = text;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        if (state.running) message.textContent = previous;
      }, 1600);
    };

    return {
      update(text) {
        message.textContent = text;
      },
      finish(text, isError = false) {
        state.running = false;
        message.textContent = text;
        message.style.color = isError ? "#fda29b" : "#a6f4c5";
        button.disabled = false;
        button.textContent = "Close";
        if (!isError) setTimeout(() => host.remove(), 5000);
      }
    };
  }

  const panel = makePanel();

  function findScroller(element) {
    let current = element;
    while (current && current !== document.body) {
      const style = getComputedStyle(current);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        current.scrollHeight > current.clientHeight + 100
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function setScrollTop(scroller, value) {
    scroller.scrollTop = value;
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
  }

  function textContent(node) {
    return (node.textContent || "").replace(/\u00a0/g, " ");
  }

  function inlineChildren(element, context) {
    return Array.from(element.childNodes)
      .map((node) => convertNode(node, context))
      .join("");
  }

  function normalizeInline(value) {
    return value
      .replace(/[\t\r\n ]+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
  }

  function escapeInlineCode(value) {
    const ticks = value.match(/`+/g) || [];
    const fence = "`".repeat(Math.max(1, ...ticks.map((part) => part.length + 1)));
    const padding = /^ | $|^`|`$/.test(value) ? " " : "";
    return `${fence}${padding}${value}${padding}${fence}`;
  }

  function codeLanguage(pre) {
    const code = pre.querySelector("code");
    const className = `${code?.className || ""} ${pre.className || ""}`;
    const match = className.match(/(?:language-|lang-)([\w+-]+)/i);
    if (match) return match[1];

    const nearbyLabel = pre.parentElement?.querySelector(
      "[data-language], [class*='language-']"
    );
    return nearbyLabel?.getAttribute("data-language") || "";
  }

  function convertTable(table) {
    const rows = Array.from(table.querySelectorAll("tr"));
    if (!rows.length) return "";

    const matrix = rows.map((row) =>
      Array.from(row.querySelectorAll(":scope > th, :scope > td")).map((cell) =>
        normalizeInline(inlineChildren(cell, { inline: true }))
          .replace(/\|/g, "\\|")
          .replace(/\n+/g, "<br>")
      )
    );
    const width = Math.max(...matrix.map((row) => row.length));
    if (!width) return "";

    for (const row of matrix) {
      while (row.length < width) row.push("");
    }

    const header = matrix[0];
    const body = matrix.slice(1);
    return [
      `| ${header.join(" | ")} |`,
      `| ${header.map(() => "---").join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`)
    ].join("\n");
  }

  function convertList(list, depth = 0) {
    const ordered = list.tagName.toLowerCase() === "ol";
    const start = Number.parseInt(list.getAttribute("start") || "1", 10);
    const items = Array.from(list.children).filter(
      (child) => child.tagName?.toLowerCase() === "li"
    );

    return items
      .map((item, index) => {
        const nestedLists = Array.from(item.children).filter((child) =>
          ["ul", "ol"].includes(child.tagName?.toLowerCase())
        );
        const parts = Array.from(item.childNodes)
          .filter((child) => !nestedLists.includes(child))
          .map((child) => convertNode(child, { inline: true }))
          .join("");
        const content = normalizeInline(parts);
        const marker = ordered ? `${start + index}.` : "-";
        const indent = "  ".repeat(depth);
        const continuation = content.replace(/\n/g, `\n${indent}  `);
        const nested = nestedLists
          .map((child) => `\n${convertList(child, depth + 1)}`)
          .join("");
        return `${indent}${marker} ${continuation}${nested}`.trimEnd();
      })
      .join("\n");
  }

  function convertNode(node, context = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      return context.pre
        ? node.nodeValue || ""
        : (node.nodeValue || "").replace(/[\t\r\n ]+/g, " ");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node;
    const tag = element.tagName.toLowerCase();

    if (["script", "style", "svg", "canvas", "button", "input", "textarea"].includes(tag)) {
      return "";
    }

    if (element.matches("[data-md-export-ignore]")) return "";

    if (element.classList.contains("katex") || element.classList.contains("katex-display")) {
      const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
      if (annotation) {
        const source = textContent(annotation).trim();
        const display =
          element.classList.contains("katex-display") ||
          element.closest(".katex-display") !== null;
        return display ? `\n\n$$\n${source}\n$$\n\n` : `$${source}$`;
      }
    }

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      return `\n\n${"#".repeat(level)} ${normalizeInline(inlineChildren(element, { inline: true }))}\n\n`;
    }

    if (tag === "pre") {
      const code = textContent(element.querySelector("code") || element)
        .replace(/^\n/, "")
        .replace(/\n$/, "");
      const backtickRuns = code.match(/`+/g) || [];
      const fence = "`".repeat(Math.max(3, ...backtickRuns.map((part) => part.length + 1)));
      return `\n\n${fence}${codeLanguage(element)}\n${code}\n${fence}\n\n`;
    }

    if (tag === "code") {
      return escapeInlineCode(textContent(element));
    }

    if (tag === "strong" || tag === "b") {
      const value = inlineChildren(element, { inline: true }).trim();
      return value ? `**${value}**` : "";
    }

    if (tag === "em" || tag === "i") {
      const value = inlineChildren(element, { inline: true }).trim();
      return value ? `*${value}*` : "";
    }

    if (tag === "del" || tag === "s") {
      const value = inlineChildren(element, { inline: true }).trim();
      return value ? `~~${value}~~` : "";
    }

    if (tag === "a") {
      const label = normalizeInline(inlineChildren(element, { inline: true })) || textContent(element).trim();
      const rawHref = element.getAttribute("href") || "";
      if (!rawHref || rawHref.startsWith("javascript:")) return label;
      let href = rawHref;
      try {
        href = new URL(rawHref, location.href).href;
      } catch {
        // Keep the original href if the browser cannot resolve it.
      }
      const safeLabel = label.replace(/\]/g, "\\]");
      return label === href ? `<${href}>` : `[${safeLabel}](${href})`;
    }

    if (tag === "img") {
      const alt = (element.getAttribute("alt") || "image").replace(/\]/g, "\\]");
      const src = element.getAttribute("src") || "";
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return `[Image: ${alt}]`;
      return `![${alt}](${src})`;
    }

    if (tag === "br") return "\n";
    if (tag === "hr") return "\n\n---\n\n";
    if (tag === "table") return `\n\n${convertTable(element)}\n\n`;
    if (tag === "ul" || tag === "ol") return `\n\n${convertList(element)}\n\n`;
    if (tag === "li") return inlineChildren(element, context);

    if (tag === "blockquote") {
      const value = cleanupMarkdown(inlineChildren(element, context));
      return `\n\n${value.split("\n").map((line) => `> ${line}`.trimEnd()).join("\n")}\n\n`;
    }

    if (tag === "details") {
      const summary = element.querySelector(":scope > summary");
      const summaryText = summary ? normalizeInline(inlineChildren(summary, { inline: true })) : "Details";
      const body = Array.from(element.childNodes)
        .filter((child) => child !== summary)
        .map((child) => convertNode(child, context))
        .join("");
      return `\n\n**${summaryText}**\n\n${body}\n\n`;
    }

    if (tag === "summary") return "";

    const children = inlineChildren(element, context);
    const blockTags = new Set([
      "address", "article", "aside", "div", "figure", "figcaption", "footer",
      "header", "main", "nav", "p", "section", "dd", "dt", "dl"
    ]);
    return blockTags.has(tag) ? `\n\n${children}\n\n` : children;
  }

  function cleanupMarkdown(markdown) {
    const lines = markdown.replace(/\u00a0/g, " ").split("\n");
    const output = [];
    let fence = null;
    let previousWasBlank = false;

    for (const originalLine of lines) {
      const fenceMatch = originalLine.match(/^\s*(`{3,}|~{3,})/);

      if (fence) {
        output.push(originalLine);
        if (
          fenceMatch &&
          fenceMatch[1][0] === fence.character &&
          fenceMatch[1].length >= fence.length
        ) {
          fence = null;
        }
        continue;
      }

      if (fenceMatch) {
        fence = {
          character: fenceMatch[1][0],
          length: fenceMatch[1].length
        };
        output.push(originalLine.replace(/[ \t]+$/g, ""));
        previousWasBlank = false;
        continue;
      }

      const line = originalLine.replace(/[ \t]+$/g, "");
      const isBlank = line.length === 0;
      if (isBlank && previousWasBlank) continue;
      output.push(line);
      previousWasBlank = isBlank;
    }

    return output.join("\n").trim();
  }

  function contentRoot(roleNode) {
    if (roleNode.getAttribute("data-message-author-role") === "assistant") {
      return roleNode.querySelector(".markdown") || roleNode;
    }
    return (
      roleNode.querySelector("[class*='whitespace-pre-wrap']") ||
      roleNode.querySelector(".markdown") ||
      roleNode
    );
  }

  function stripInterfaceNoise(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll([
      "button", "script", "style", "svg", "canvas", "form", "input", "textarea",
      "[contenteditable='true']", "[data-testid*='copy']", "[data-testid*='feedback']"
    ].join(",")).forEach((node) => node.remove());
    return clone;
  }

  function serializeMessage(roleNode, fallbackIndex) {
    const role = roleNode.getAttribute("data-message-author-role") || "unknown";
    const container =
      roleNode.closest("[data-message-id]") ||
      roleNode.closest("[data-turn-id]") ||
      roleNode;
    const stableId =
      container.getAttribute?.("data-message-id") ||
      container.getAttribute?.("data-turn-id") ||
      roleNode.getAttribute("data-message-id") ||
      "";
    const root = stripInterfaceNoise(contentRoot(roleNode));
    let markdown = cleanupMarkdown(convertNode(root));
    if (!markdown) markdown = (contentRoot(roleNode).innerText || "").trim();
    if (!markdown) return null;

    const fallbackKey = `${role}\n${markdown}`;
    return {
      key: stableId || fallbackKey || `${role}-${fallbackIndex}`,
      role,
      markdown
    };
  }

  function visibleMessages() {
    const nodes = Array.from(document.querySelectorAll("[data-message-author-role]"));
    const seenNodes = new Set();
    const messages = [];
    nodes.forEach((node, index) => {
      const owningRole = node.parentElement?.closest("[data-message-author-role]");
      if (owningRole || seenNodes.has(node)) return;
      seenNodes.add(node);
      const message = serializeMessage(node, index);
      if (message) messages.push(message);
    });
    return messages;
  }

  function mergeUpward(existing, batch) {
    if (!existing.length) return batch.slice();
    if (!batch.length) return existing;

    const existingKeys = new Set(existing.map((item) => item.key));
    if (batch.every((item) => existingKeys.has(item.key))) return existing;

    const maxOverlap = Math.min(existing.length, batch.length);
    for (let overlap = maxOverlap; overlap >= 1; overlap--) {
      let matches = true;
      for (let index = 0; index < overlap; index++) {
        if (batch[batch.length - overlap + index].key !== existing[index].key) {
          matches = false;
          break;
        }
      }
      if (matches) return batch.slice(0, -overlap).concat(existing);
    }

    const fresh = batch.filter((item) => !existingKeys.has(item.key));
    return fresh.concat(existing);
  }

  function roleLabel(role) {
    if (role === "user") return "User";
    if (role === "assistant") return "Assistant";
    if (role === "system") return "System";
    if (role === "tool") return "Tool";
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  function cleanTitle() {
    return (document.title || "ChatGPT thread")
      .replace(/\s*[-–—|]\s*ChatGPT.*$/i, "")
      .replace(/^ChatGPT\s*[-–—|]\s*/i, "")
      .trim() || "ChatGPT thread";
  }

  function makeDocument(messages) {
    const title = cleanTitle();
    const source = location.href.split("#")[0];
    const exportedAt = new Date().toISOString();
    const sections = messages.flatMap((message) => [
      `## ${roleLabel(message.role)}`,
      "",
      message.markdown,
      "",
      "---",
      ""
    ]);
    return {
      title,
      markdown: [
        `# ${title}`,
        "",
        `> Source: [ChatGPT thread](${source})  `,
        `> Exported: ${exportedAt}`,
        "",
        ...sections
      ].join("\n").replace(/\n+$/, "\n")
    };
  }

  function safeFilename(title) {
    const cleaned = title
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
      .replace(/[. ]+$/g, "")
      .trim()
      .slice(0, 120);
    return `${cleaned || "chatgpt-thread"}.md`;
  }

  function downloadMarkdown(markdown, filename) {
    const blob = new Blob(["\ufeff", markdown], {
      type: "text/markdown;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function run() {
    const firstMessage = document.querySelector("[data-message-author-role]");
    if (!firstMessage) {
      throw new Error("No messages found. Open a ChatGPT conversation and try again.");
    }

    const scroller = findScroller(firstMessage);
    const originalHeight = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    const originalRatio = scroller.scrollTop / originalHeight;
    const originalDistanceFromBottom = originalHeight - scroller.scrollTop;
    let messages = [];

    const restoreScroll = async () => {
      await sleep(100);
      const newHeight = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const target = originalDistanceFromBottom < scroller.clientHeight * 1.5
        ? Math.max(0, newHeight - originalDistanceFromBottom)
        : Math.round(newHeight * originalRatio);
      setScrollTop(scroller, target);
    };

    try {
      panel.update("Moving to the end of the thread…");
      setScrollTop(scroller, scroller.scrollHeight);
      await sleep(850);
      messages = mergeUpward(messages, visibleMessages());

      let quietAtTop = 0;
      let iterations = 0;

      while (iterations < 4000 && quietAtTop < 3) {
        if (state.cancelled) {
          await restoreScroll();
          panel.finish("Export cancelled.", true);
          return;
        }

        iterations++;
        const beforeCount = messages.length;
        const beforeTop = scroller.scrollTop;
        const step = Math.max(450, Math.round(scroller.clientHeight * 0.72));
        setScrollTop(scroller, Math.max(0, beforeTop - step));
        await sleep(300);

        messages = mergeUpward(messages, visibleMessages());
        panel.update(`Messages collected: ${messages.length}\nKeep this conversation open until the export finishes.`);

        if (scroller.scrollTop <= 2) {
          await sleep(900);
          messages = mergeUpward(messages, visibleMessages());
          const noGrowth = messages.length === beforeCount;
          const stillAtTop = scroller.scrollTop <= 2;
          quietAtTop = noGrowth && stillAtTop ? quietAtTop + 1 : 0;
        } else {
          quietAtTop = 0;
        }
      }

      if (iterations >= 4000) {
        throw new Error("The scrolling safety limit was reached. The thread may be incomplete.");
      }

      messages = mergeUpward(messages, visibleMessages());
      if (!messages.length) throw new Error("Unable to read the message content.");

      const documentData = makeDocument(messages);
      downloadMarkdown(documentData.markdown, safeFilename(documentData.title));
      await restoreScroll();
      panel.finish(`Done. Messages saved: ${messages.length}`);
    } finally {
      state.running = false;
    }
  }

  run().catch((error) => {
    console.error("ChatGPT Thread to Markdown:", error);
    panel.finish(`Error: ${error?.message || String(error)}`, true);
  });
})();
