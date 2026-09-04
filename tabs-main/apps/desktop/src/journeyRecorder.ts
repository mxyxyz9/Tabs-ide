import type { WebContents } from "electron";

export type JourneyStep = {
  action: "click" | "fill" | "check" | "uncheck" | "selectOption" | "press";
  selector: string;
};

export function journeyCode(url: string, steps: readonly JourneyStep[]): string {
  let input = 0;
  return [
    'import { test, expect } from "playwright/test";',
    "",
    'test("Recorded journey - review assertions before use", async ({ page }) => {',
    `  await page.goto(${JSON.stringify(url)});`,
    ...steps.map((step) => {
      const locator = `page.locator(${JSON.stringify(step.selector)})`;
      if (step.action === "fill" || step.action === "selectOption") {
        const name = `RECORDED_INPUT_${++input}`;
        return `  // Supply reviewed test data; typed values were not recorded.\n  if (process.env.${name} === undefined) throw new Error("Set ${name}");\n  await ${locator}.${step.action}(process.env.${name}!);`;
      }
      return `  await ${locator}.${step.action}(${step.action === "press" ? '"Enter"' : ""});`;
    }),
    "  // Replace this guard with reviewed business assertions before running.",
    '  throw new Error("Add expected-result assertions to this recording");',
    "});",
    "",
  ].join("\n");
}

function safeUrl(value: string): string {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Record an HTTP(S) page");
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
      if (
        !["click", "fill", "check", "uncheck", "selectOption", "press"].includes(step.action) ||
        typeof step.selector !== "string" ||
        step.selector.length > 2000
      )
        return;
      this.steps.push({ action: step.action, selector: step.selector });
    } catch {
      /* Ignore malformed events from page content. */
    }
  };
  private readonly destroyed = () => {
    void this.stop();
  };

  async start(): Promise<void> {
    if (this.active) throw new Error("A journey is already recording");
    this.initialUrl = safeUrl(this.contents.getURL());
    this.steps = [];
    this.active = true;
    const debug = this.contents.debugger;
    this.attached = !debug.isAttached();
    try {
      if (this.attached) debug.attach("1.3");
      debug.on("message", this.message);
      this.contents.once("destroyed", this.destroyed);
      await debug.sendCommand("Runtime.enable");
      await debug.sendCommand("Page.enable");
      await debug.sendCommand("Runtime.addBinding", { name: this.binding });
      // Only structural selectors and action types cross the binding. No input values,
      // text labels, hrefs or attributes that could contain personal data are captured.
      const source = `(() => {
        if (window !== window.top || window[${JSON.stringify(this.binding + "Stop")}]) return;
        const cleanups = [];
        const listen = (type, handler) => { document.addEventListener(type, handler, true); cleanups.push(() => document.removeEventListener(type, handler, true)); };
        const path = (element) => { const parts = []; for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
          const siblings = node.parentElement ? [...node.parentElement.children].filter(s => s.localName === node.localName) : [node];
          parts.unshift(node.localName + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')');
        } return parts.join(' > '); };
        const emit = (action, element) => { if (element) window[${JSON.stringify(this.binding)}](JSON.stringify({ action, selector: path(element) })); };
        listen('click', event => { if (!event.isTrusted || !(event.target instanceof Element)) return; const el = event.target.closest('button,a[href],[role="button"],input[type="submit"]'); emit('click', el); });
        listen('change', event => { if (!event.isTrusted || !(event.target instanceof Element)) return; const el = event.target;
          if (el.matches('input[type="checkbox"],input[type="radio"]')) emit(el.checked ? 'check' : 'uncheck', el);
          else if (el.matches('select')) emit('selectOption', el);
          else if (el.matches('input,textarea')) emit('fill', el);
        });
        listen('keydown', event => { if (!event.isTrusted || event.key !== 'Enter' || !(event.target instanceof Element) || !event.target.matches('input,textarea')) return; emit('fill', event.target); emit('press', event.target); });
        window[${JSON.stringify(this.binding + "Stop")}] = () => { cleanups.forEach(dispose => dispose()); delete window[${JSON.stringify(this.binding + "Stop")}]; };
      })();`;
      const script = await debug.sendCommand("Page.addScriptToEvaluateOnNewDocument", { source });
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

  async stop(): Promise<{ code: string; count: number }> {
    this.active = false;
    const debug = this.contents.debugger;
    debug.removeListener("message", this.message);
    this.contents.removeListener("destroyed", this.destroyed);
    if (!this.contents.isDestroyed()) {
      await this.contents
        .executeJavaScript(`window[${JSON.stringify(this.binding + "Stop")}]?.()`)
        .catch(() => undefined);
      if (this.scriptId)
        await debug
          .sendCommand("Page.removeScriptToEvaluateOnNewDocument", { identifier: this.scriptId })
          .catch(() => undefined);
      await debug
        .sendCommand("Runtime.removeBinding", { name: this.binding })
        .catch(() => undefined);
      if (this.attached && debug.isAttached()) debug.detach();
    }
    this.scriptId = undefined;
    return { code: journeyCode(this.initialUrl, this.steps), count: this.steps.length };
  }
}
