import type { WebContents } from "electron";

export type JourneyAction =
  | "goto"
  | "click"
  | "fill"
  | "selectOption"
  | "check"
  | "uncheck"
  | "press"
  | "assertVisible"
  | "assertText"
  | "assertValue";

export type JourneyStep = {
  id?: string | undefined;
  action: JourneyAction;
  selector?: string | undefined;
  value?: string | undefined;
  url?: string | undefined;
  key?: string | undefined;
  placeholder?: string | undefined;
  expectedValue?: string | undefined;
  isFragile?: boolean | undefined;
  reviewed?: boolean | undefined;
  locatorKey?: string | undefined;
  locatorEntryId?: string | undefined;
};

export function journeyCode(
  url: string,
  steps: readonly JourneyStep[],
): string {
  let input = 0;
  const lines: string[] = [
    'import { test, expect } from "playwright/test";',
    "",
    'test("Recorded journey - review assertions before use", async ({ page }) => {',
    `  await page.goto(${JSON.stringify(url)});`,
  ];

  for (const step of steps) {
    if (step.action === "goto") {
      lines.push(`  await page.goto(${JSON.stringify(step.url || url)});`);
      continue;
    }

    const sel = step.selector ?? "body";
    const locator = `page.locator(${JSON.stringify(sel)})`;

    switch (step.action) {
      case "click":
        lines.push(`  await ${locator}.click();`);
        break;
      case "fill": {
        const name = step.placeholder || `RECORDED_INPUT_${++input}`;
        if (step.value !== undefined && step.value !== "") {
          lines.push(`  await ${locator}.fill(${JSON.stringify(step.value)});`);
        } else {
          lines.push(
            `  // Supply reviewed test data; typed values were not recorded.\n  if (process.env.${name} === undefined) throw new Error("Set ${name}");\n  await ${locator}.fill(process.env.${name}!);`,
          );
        }
        break;
      }
      case "selectOption": {
        if (step.value !== undefined && step.value !== "") {
          lines.push(
            `  await ${locator}.selectOption(${JSON.stringify(step.value)});`,
          );
        } else {
          const name = step.placeholder || `RECORDED_INPUT_${++input}`;
          lines.push(
            `  // Supply reviewed test data; typed values were not recorded.\n  if (process.env.${name} === undefined) throw new Error("Set ${name}");\n  await ${locator}.selectOption(process.env.${name}!);`,
          );
        }
        break;
      }
      case "check":
        lines.push(`  await ${locator}.check();`);
        break;
      case "uncheck":
        lines.push(`  await ${locator}.uncheck();`);
        break;
      case "press":
        lines.push(
          `  await ${locator}.press(${JSON.stringify(step.key || "Enter")});`,
        );
        break;
      case "assertVisible":
        lines.push(`  await expect(${locator}).toBeVisible();`);
        break;
      case "assertText":
        lines.push(
          `  await expect(${locator}).toHaveText(${JSON.stringify(step.expectedValue ?? "")});`,
        );
        break;
      case "assertValue":
        lines.push(
          `  await expect(${locator}).toHaveValue(${JSON.stringify(step.expectedValue ?? "")});`,
        );
        break;
    }
  }

  const hasAssertion = steps.some((s) => s.action.startsWith("assert"));
  if (!hasAssertion) {
    lines.push(
      "  // Replace this guard with reviewed business assertions before running.",
    );
    lines.push(
      '  throw new Error("Add expected-result assertions to this recording");',
    );
  }

  lines.push("});");
  lines.push("");
  return lines.join("\n");
}

function safeUrl(value: string): string {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("Record an HTTP(S) page");
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.href;
}

export class JourneyRecorder {
  private steps: JourneyStep[] = [];
  private scriptId: string | undefined;
  private attached = false;
  private active = false;
  private initialUrl = "";
  private lastNavigatedUrl = "";
  private readonly binding = `__tabsJourney${crypto.randomUUID().replaceAll("-", "")}`;
  constructor(private readonly contents: WebContents) {}

  private readonly message = (
    _event: unknown,
    method: string,
    params: { name?: string; payload?: string },
  ) => {
    if (
      !this.active ||
      method !== "Runtime.bindingCalled" ||
      params.name !== this.binding ||
      !params.payload ||
      params.payload.length > 4096 ||
      this.steps.length >= 500
    )
      return;
    try {
      const step = JSON.parse(params.payload) as JourneyStep;
      const validActions: JourneyAction[] = [
        "goto",
        "click",
        "fill",
        "check",
        "uncheck",
        "selectOption",
        "press",
        "assertVisible",
        "assertText",
        "assertValue",
      ];
      if (!validActions.includes(step.action)) return;
      if (typeof step.selector !== "string" && typeof step.url !== "string")
        return;
      if (step.selector && step.selector.length > 2000) return;

      // Deduplicate consecutive fill on identical selector
      if (
        step.action === "fill" &&
        this.steps.length > 0 &&
        this.steps[this.steps.length - 1]?.action === "fill" &&
        this.steps[this.steps.length - 1]?.selector === step.selector
      ) {
        return;
      }

      this.steps.push({
        id: `step-${this.steps.length + 1}`,
        action: step.action,
        selector: step.selector ?? "",
        key: step.key,
        url: step.url,
        isFragile: Boolean(step.isFragile),
        reviewed: !step.isFragile,
      });
    } catch {
      /* Ignore malformed events from page content. */
    }
  };

  private readonly navigated = (_event: unknown, url: string) => {
    if (!this.active || this.steps.length >= 500) return;
    try {
      const sUrl = safeUrl(url);
      if (sUrl !== this.lastNavigatedUrl && sUrl !== this.initialUrl) {
        this.lastNavigatedUrl = sUrl;
        this.steps.push({
          id: `step-${this.steps.length + 1}`,
          action: "goto",
          url: sUrl,
          selector: "",
          reviewed: true,
        });
      }
    } catch {}
  };

  private readonly destroyed = () => {
    void this.stop();
  };

  async start(): Promise<void> {
    if (this.active) throw new Error("A journey is already recording");
    this.initialUrl = safeUrl(this.contents.getURL());
    this.lastNavigatedUrl = this.initialUrl;
    this.steps = [];
    this.active = true;
    const debug = this.contents.debugger;
    this.attached = !debug.isAttached();
    try {
      if (this.attached) debug.attach("1.3");
      debug.on("message", this.message);
      this.contents.once("destroyed", this.destroyed);
      if (typeof (this.contents as any).on === "function") {
        this.contents.on("did-navigate", this.navigated);
        this.contents.on("did-navigate-in-page", this.navigated);
      }
      await debug.sendCommand("Runtime.enable");
      await debug.sendCommand("Page.enable");
      await debug.sendCommand("Runtime.addBinding", { name: this.binding });

      // Only structural selectors and action types cross the binding. No input values,
      // text labels, hrefs or attributes that could contain personal data are captured.
      const source = `(() => {
        if (window !== window.top || window[${JSON.stringify(this.binding + "Stop")}]) return;
        const cleanups = [];
        let lastFilledElement = null;
        let lastFilledTime = 0;
        const listen = (type, handler) => { document.addEventListener(type, handler, true); cleanups.push(() => document.removeEventListener(type, handler, true)); };
        const getSelector = (element) => {
          if (!element || element.nodeType !== 1) return { selector: '', isFragile: false };
          const testIdAttribute = ['data-testid', 'data-test', 'data-cy'].find(name => element.hasAttribute(name));
          if (testIdAttribute) {
            const sel = '[' + testIdAttribute + '="' + CSS.escape(element.getAttribute(testIdAttribute)) + '"]';
            try { if (document.querySelectorAll(sel).length === 1) return { selector: sel, isFragile: false }; } catch {}
          }
          if (element.id && !/[-_][0-9a-f]{6,}/i.test(element.id) && !/^[0-9]/.test(element.id)) {
            const sel = '#' + CSS.escape(element.id);
            try { if (document.querySelectorAll(sel).length === 1) return { selector: sel, isFragile: false }; } catch {}
          }
          if (['input', 'select', 'textarea'].includes(element.tagName.toLowerCase()) && element.getAttribute('name')) {
            const sel = element.tagName.toLowerCase() + '[name="' + CSS.escape(element.getAttribute('name')) + '"]';
            try { if (document.querySelectorAll(sel).length === 1) return { selector: sel, isFragile: false }; } catch {}
          }
          if (element.getAttribute('aria-label')) {
            const sel = '[aria-label="' + CSS.escape(element.getAttribute('aria-label')) + '"]';
            try { if (document.querySelectorAll(sel).length === 1) return { selector: sel, isFragile: false }; } catch {}
          }
          if (element.getAttribute('placeholder')) {
            const sel = '[placeholder="' + CSS.escape(element.getAttribute('placeholder')) + '"]';
            try { if (document.querySelectorAll(sel).length === 1) return { selector: sel, isFragile: false }; } catch {}
          }
          const parts = [];
          for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
            const siblings = node.parentElement ? [...node.parentElement.children].filter(s => s.localName === node.localName) : [node];
            parts.unshift(node.localName + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')');
          }
          return { selector: parts.join(' > '), isFragile: true };
        };

        const emit = (action, element, extra) => {
          if (!element) return;
          const info = getSelector(element);
          window[${JSON.stringify(this.binding)}](JSON.stringify({ action, selector: info.selector, isFragile: info.isFragile, ...extra }));
        };

        listen('click', event => {
          if (!event.isTrusted || !(event.target instanceof Element)) return;
          const el = event.target.closest('button,a[href],[role="button"],input[type="submit"],input[type="button"],summary');
          if (el) emit('click', el);
        });

        listen('change', event => {
          if (!event.isTrusted || !(event.target instanceof Element)) return;
          const el = event.target;
          if (el.matches('input[type="checkbox"],input[type="radio"]')) emit(el.checked ? 'check' : 'uncheck', el);
          else if (el.matches('select')) emit('selectOption', el);
          else if (el.matches('input,textarea')) {
            lastFilledElement = el;
            lastFilledTime = Date.now();
            emit('fill', el);
          }
        });

        listen('keydown', event => {
          if (!event.isTrusted || event.key !== 'Enter' || !(event.target instanceof Element) || !event.target.matches('input,textarea')) return;
          const el = event.target;
          const isRecentFill = el === lastFilledElement && (Date.now() - lastFilledTime < 1000);
          if (!isRecentFill) {
            emit('fill', el);
          }
          emit('press', el, { key: 'Enter' });
        });

        window[${JSON.stringify(this.binding + "Stop")}] = () => {
          cleanups.forEach(dispose => dispose());
          delete window[${JSON.stringify(this.binding + "Stop")}];
        };
      })();`;
      const script = await debug.sendCommand(
        "Page.addScriptToEvaluateOnNewDocument",
        { source },
      );
      this.scriptId = script.identifier;
      await this.contents.executeJavaScript(source);
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  status() {
    return { recording: this.active, count: this.steps.length, limit: 500 };
  }

  async stop(): Promise<{
    code: string;
    count: number;
    steps: JourneyStep[];
    initialUrl: string;
  }> {
    this.active = false;
    const debug = this.contents.debugger;
    debug.removeListener("message", this.message);
    this.contents.removeListener("destroyed", this.destroyed);
    if (typeof (this.contents as any).removeListener === "function") {
      this.contents.removeListener("did-navigate", this.navigated);
      this.contents.removeListener("did-navigate-in-page", this.navigated);
    }
    if (!this.contents.isDestroyed()) {
      await this.contents
        .executeJavaScript(
          `window[${JSON.stringify(this.binding + "Stop")}]?.()`,
        )
        .catch(() => undefined);
      if (this.scriptId)
        await debug
          .sendCommand("Page.removeScriptToEvaluateOnNewDocument", {
            identifier: this.scriptId,
          })
          .catch(() => undefined);
      await debug
        .sendCommand("Runtime.removeBinding", { name: this.binding })
        .catch(() => undefined);
      if (this.attached && debug.isAttached()) debug.detach();
    }
    this.scriptId = undefined;
    const steps = [...this.steps];
    return {
      code: journeyCode(this.initialUrl, steps),
      count: steps.length,
      steps,
      initialUrl: this.initialUrl,
    };
  }
}
