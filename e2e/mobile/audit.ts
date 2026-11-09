import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const MIN_TARGET = 44;

export interface BoxOffender {
  name: string;
  width: number;
  height: number;
}

function assertEmpty(label: string, offenders: BoxOffender[]) {
  expect(offenders, `${label}\n${JSON.stringify(offenders, null, 2)}`).toEqual(
    [],
  );
}

export async function assertNoPageOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    metrics.scrollWidth,
    `document scrolls horizontally (${metrics.scrollWidth} > ${metrics.clientWidth})`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

export async function assertNoWideElements(page: Page) {
  const wide = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const found: BoxOffender[] = [];
    for (const node of document.body.querySelectorAll("*")) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.closest("[hidden]")) continue;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (rect.width <= viewport + 1) continue;
      const text = (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
      found.push({
        name: `${node.tagName}${node.id ? `#${node.id}` : ""} ${text}`.trim(),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
      if (found.length >= 8) break;
    }
    return found;
  });
  assertEmpty("elements wider than the viewport", wide);
}

export async function assertTouchTargets(page: Page) {
  const offenders = await page.evaluate((min) => {
    const selectors = [
      "button",
      "a[href]",
      "input:not([type='hidden']):not([type='file'])",
      "textarea",
      "select",
      "[role='tab']",
      "[role='checkbox']",
      "[role='radio']",
      "[role='combobox']",
    ].join(",");
    const seen = new Set<Element>();
    const found: BoxOffender[] = [];

    const isVisible = (el: Element) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.closest("[hidden]")) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width >= 1 && rect.height >= 1;
    };

    const hitTarget = (el: HTMLElement): HTMLElement => {
      const type = el instanceof HTMLInputElement ? el.type : "";
      const role = el.getAttribute("role");
      const checkable =
        role === "checkbox" ||
        role === "radio" ||
        type === "checkbox" ||
        type === "radio";
      if (!checkable) return el;
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label instanceof HTMLElement && isVisible(label)) return label;
      }
      const wrap = el.closest("label");
      if (wrap instanceof HTMLElement && isVisible(wrap)) return wrap;
      return el;
    };

    for (const node of document.querySelectorAll(selectors)) {
      if (!(node instanceof HTMLElement) || !isVisible(node) || seen.has(node)) {
        continue;
      }
      const target = hitTarget(node);
      seen.add(node);
      seen.add(target);
      const rect = target.getBoundingClientRect();
      if (rect.width >= min - 0.5 && rect.height >= min - 0.5) continue;
      const name = (
        target.getAttribute("aria-label") ||
        target.textContent ||
        ""
      )
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 48);
      found.push({
        name: `${target.tagName}${target.id ? `#${target.id}` : ""} ${name}`.trim(),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
      if (found.length >= 12) break;
    }
    return found;
  }, MIN_TARGET);
  assertEmpty("controls under 44x44 CSS pixels", offenders);
}

export async function assertInputFontSize(page: Page) {
  const small = await page.evaluate(() => {
    const found: BoxOffender[] = [];
    const nodes = document.querySelectorAll(
      "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea, select, [role='combobox']",
    );
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.closest("[hidden]")) continue;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (Number(style.opacity) === 0) continue;
      const size = Number.parseFloat(style.fontSize);
      if (size >= 16) continue;
      const name = (
        node.getAttribute("aria-label") ||
        node.getAttribute("placeholder") ||
        node.id ||
        node.tagName
      ).slice(0, 48);
      found.push({ name, width: Math.round(size), height: 0 });
    }
    return found;
  });
  assertEmpty("inputs below 16px (iOS zoom)", small);
}

export async function assertTabLabels(page: Page) {
  for (const label of ["Upload", "People", "Items", "Results"]) {
    const tab = page.getByRole("tab", { name: label, exact: true });
    await expect(tab, `tab ${label}`).toBeVisible();
    const clipped = await tab.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped, `tab ${label} truncates its label`).toBe(false);
  }

  const overlap = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll("[role='tab']")].filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    const boxes = tabs.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        name: (el.textContent || "").trim().replace(/\s+/g, " "),
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    });
    const hits: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (width > 2 && height > 2) hits.push(`${a.name} overlaps ${b.name}`);
      }
    }
    return hits;
  });
  expect(overlap, overlap.join("\n")).toEqual([]);
}

export async function assertTotalColumnVisible(page: Page) {
  const headers = page.getByRole("columnheader", { name: "Total", exact: true });
  const count = await headers.count();
  expect(count).toBeGreaterThan(0);
  const viewport = page.viewportSize();
  const width = viewport?.width ?? 0;
  for (let index = 0; index < count; index++) {
    const box = await headers.nth(index).boundingBox();
    expect(box, `Total header ${index}`).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  }

  const scrolls = await page.evaluate(() => {
    const headersInDom = [...document.querySelectorAll("th")].filter(
      (el) => el.textContent?.trim() === "Total",
    );
    return headersInDom.some((th) => {
      let node: HTMLElement | null = th.parentElement;
      while (node) {
        const style = getComputedStyle(node);
        const overflow = style.overflowX;
        if (
          (overflow === "auto" || overflow === "scroll") &&
          node.scrollWidth > node.clientWidth + 1
        ) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    });
  });
  expect(scrolls, "Total is inside a horizontal scroller").toBe(false);
}

export async function assertAxe(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  const summary = serious.map((violation) => {
    const nodes = violation.nodes
      .slice(0, 3)
      .map((node) => node.target.join(" "))
      .join(" | ");
    return `${violation.id} (${violation.impact}): ${violation.help} [${nodes}]`;
  });
  expect(summary, summary.join("\n")).toEqual([]);
}

export async function assertFocusInDialog(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const open = document.querySelector("[role='dialog']");
        return !!open && open.contains(document.activeElement);
      }),
    )
    .toBe(true);
  await page.keyboard.press("Tab");
  const stillInside = await page.evaluate(() => {
    const open = document.querySelector("[role='dialog']");
    return !!open && open.contains(document.activeElement);
  });
  expect(stillInside, "Tab moved focus outside the dialog").toBe(true);
}

export async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/mobile-ui/${name}.png`,
    fullPage: true,
  });
}

export async function auditScreen(page: Page, name: string, options?: { tabs?: boolean; totals?: boolean }) {
  await screenshot(page, name);
  await assertNoPageOverflow(page);
  await assertNoWideElements(page);
  await assertTouchTargets(page);
  await assertInputFontSize(page);
  if (options?.tabs) await assertTabLabels(page);
  if (options?.totals) await assertTotalColumnVisible(page);
  await assertAxe(page);
}
