import { test, expect, type Page } from "@playwright/test";
import { localDateTime, localDate, addDays } from "../../src/lib/time";
const password = "TeamTracker-Demo-2026!";
async function login(page: Page, jsId: string, secret = password) {
  await page.goto("/login"); await page.getByLabel("JS ID", { exact: true }).fill(jsId);
  await page.getByLabel("Password", { exact: true }).fill(secret); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/my-tasks|change-password/);
}
test("sidebar navigation responds while waiting and works on desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, "JS1001");
  await expect(page.getByRole("heading", { name: "My tasks", exact: true })).toBeVisible();
  // Hold the actual navigation response to reproduce a slow network without
  // relying on a timing threshold or slowing unrelated assets.
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void;
  const arrived = new Promise<void>(resolve => { requested = resolve; });
  await page.route("**/people?*", async route => {
    if (route.request().headers()["rsc"] && !route.request().headers()["next-router-prefetch"]) {
      requested(); await held;
    }
    await route.continue();
  });
  try {
    await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "People", exact: true }).click();
    await arrived;
    await expect(page.locator(".navigation-spinner:visible, .workspace-loading:visible").first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation", exact: true })).toBeVisible();
  } finally { release(); }
  await expect(page.getByRole("heading", { name: "People", exact: true })).toBeVisible();
  await page.unroute("**/people?*");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const nav = page.getByRole("navigation", { name: width === 390 ? "Mobile navigation" : "Main navigation", exact: true });
    for (const label of ["Settings", "Holidays", "Recurring tasks", "Team overview", "My tasks", "People"]) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page.getByRole("heading", { name: label === "Settings" ? "Account settings" : label, exact: true })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("desktop assignment, member submission, privacy and manager reopen", async ({ page, browser }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 }); await login(page, "JS1001");
  await page.goto("/team"); await expect(page.getByRole("heading", { name: "Team overview" })).toBeVisible();
  await page.screenshot({ path: ".playwright-results/team-desktop.png", fullPage: true, caret: "initial" });
  await page.getByRole("button", { name: "Assign task", exact: true }).click();
  const dialog = page.getByRole("dialog"); await dialog.getByLabel("Task title").fill("Browser verified handover");
  await dialog.getByLabel("Instructions").fill("अंतिम report और relevant link साझा करें।");
  await dialog.getByLabel("Assigned to").selectOption({ label: "Riya Mehta" });
  await dialog.getByLabel("Deadline (IST)").fill(localDateTime(Date.now() + 86_400_000));
  await dialog.getByLabel("Require a work link when submitting").check();
  await dialog.getByRole("button", { name: "Assign task", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Browser verified handover" })).toBeVisible(); const taskUrl = page.url();
  const memberContext = await browser.newContext(); const member = await memberContext.newPage();
  await login(member, "js1003"); await member.goto(taskUrl);
  await expect(member.getByRole("button", { name: "Edit task", exact: true })).toHaveCount(0);
  await member.getByLabel("Completion note").fill("Report completed and ready for review.");
  await member.getByLabel("Work links (at least one required)").fill("https://example.com/completed-report");
  await member.getByRole("button", { name: "Submit & complete" }).click();
  await expect(member.getByRole("heading", { name: "Submitted work" })).toBeVisible();
  await expect(member.getByText("Report completed and ready for review.", { exact: true })).toBeVisible();
  const otherContext = await browser.newContext(); const other = await otherContext.newPage(); await login(other, "JS1004"); await other.goto(taskUrl);
  await expect(other.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await other.goto("/people"); await expect(other.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.goto(taskUrl); await page.getByLabel("Reason for reopening").fill("Please add the final totals.");
  await page.getByRole("button", { name: "Reopen task", exact: true }).click();
  await expect(page.getByText("Reopened", { exact: true }).first()).toBeVisible();
  await member.reload(); await member.getByLabel("Completion note").fill("Final totals have been added.");
  await member.getByLabel("Work links (at least one required)").fill("https://example.com/revised-report");
  await member.getByRole("button", { name: "Submit & complete" }).click();
  await expect(member.getByText("2 submissions", { exact: true })).toBeVisible();
  expect(errors).toEqual([]); await memberContext.close(); await otherContext.close();
});

test("theme follows the device and remembers explicit choices across pages and reloads", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" }); await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Color theme").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload(); await expect(page.getByLabel("Color theme")).toHaveValue("light");
  await login(page, "JS1001"); await page.goto("/team");
  await page.getByLabel("Color theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: ".playwright-results/team-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Assign task", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCSS("background-color", "rgb(27, 32, 48)");
  await page.keyboard.press("Escape"); await page.goto("/settings");
  await expect(page.getByLabel("Color theme").first()).toHaveValue("dark");
  await page.getByLabel("Color theme").last().selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/holidays");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("employee holidays are immediate, private and reversible by management on desktop and mobile", async ({ page, browser }) => {
  const today = localDate(); const tomorrow = addDays(today, 1);
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, "JS1003");
  await page.getByLabel("Color theme").selectOption("dark"); await page.goto("/holidays");
  await page.getByRole("button", { name: "Add holiday", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Note (optional)").fill("Full-day family holiday");
  await dialog.getByRole("button", { name: "Record holiday", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByText("Full-day family holiday", { exact: true })).toBeVisible();
  const managerContext = await browser.newContext(); const manager = await managerContext.newPage();
  await login(manager, "JS1002"); await manager.goto("/team");
  await expect(manager.getByRole("region", { name: "Team holidays today" }).getByText("Riya Mehta")).toBeVisible();
  const otherContext = await browser.newContext(); const other = await otherContext.newPage();
  await login(other, "JS1004"); await other.goto("/holidays");
  await expect(other.getByText("Full-day family holiday", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add holiday", exact: true }).click();
  dialog = page.getByRole("dialog"); await dialog.getByLabel("Duration").selectOption("second_half");
  await dialog.getByLabel("Holiday date (IST)").fill(tomorrow); await dialog.getByLabel("Note (optional)").fill("Half-day personal appointment");
  await dialog.getByRole("button", { name: "Record holiday", exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Half day · Second half", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".playwright-results/holidays-mobile-dark.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await manager.goto("/holidays");
  const full = manager.locator("article").filter({ hasText: "Full-day family holiday" });
  await full.getByRole("button", { name: "Reverse holiday", exact: true }).click();
  await manager.getByRole("dialog").getByLabel("Reason for reversal").fill("Employee requested a different date");
  await manager.getByRole("dialog").getByRole("button", { name: "Confirm reversal", exact: true }).click();
  await expect(manager.getByRole("dialog")).toHaveCount(0);
  await manager.goto("/team");
  await expect(manager.getByRole("region", { name: "Team holidays today" }).getByText("No holidays recorded for today.")).toBeVisible();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.getByText("Reversed by management", { exact: true })).toBeVisible();
  await expect(page.getByText("Employee requested a different date", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Current & upcoming", exact: true }).click();
  await page.locator("article").filter({ hasText: "Half-day personal appointment" }).getByRole("button", { name: "Cancel holiday", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Reason for cancellation").fill("Appointment rescheduled");
  await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0); await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByText("Appointment rescheduled", { exact: true })).toBeVisible();
  await managerContext.close(); await otherContext.close();
});
test("new account must change password; reset and deactivation revoke access", async ({ page, browser }) => {
  await login(page, "JS1001"); await page.goto("/people");
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  let dialog = page.getByRole("dialog"); await dialog.getByLabel("Full name").fill("Browser Test Member");
  await dialog.getByLabel("Designation (optional)").fill("Video editor");
  await dialog.getByLabel("JS ID", { exact: true }).fill("JS-E2E");
  await dialog.getByLabel("Temporary password", { exact: true }).fill("Temporary-pass-2026!");
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Browser Test Member", { exact: true })).toBeVisible();
  await expect(page.getByText("Video editor", { exact: true })).toBeVisible();
  const memberContext = await browser.newContext(); const member = await memberContext.newPage();
  await login(member, "js-e2e", "Temporary-pass-2026!"); await expect(member).toHaveURL(/change-password/);
  await member.goto("/team"); await expect(member).toHaveURL(/change-password/);
  await member.getByLabel("Current password", { exact: true }).fill("Temporary-pass-2026!");
  await member.getByLabel("New password", { exact: true }).fill("Personal-pass-2026!");
  await member.getByLabel("Confirm new password", { exact: true }).fill("Personal-pass-2026!");
  await member.getByRole("button", { name: "Set new password" }).click(); await expect(member).toHaveURL(/login/);
  await login(member, "JS-E2E", "Personal-pass-2026!"); await expect(member.getByRole("heading", { name: "My tasks" })).toBeVisible();
  const row = page.locator("article").filter({ hasText: "Browser Test Member" });
  await row.getByRole("button", { name: "Reset password", exact: true }).click(); dialog = page.getByRole("dialog");
  await dialog.getByLabel("New temporary password").fill("Another-temp-2026!"); await dialog.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(dialog).toHaveCount(0); await member.reload(); await expect(member).toHaveURL(/login/);
  await row.getByRole("button", { name: "Edit", exact: true }).click(); dialog = page.getByRole("dialog");
  await dialog.getByLabel("Account status").selectOption("false"); await dialog.getByRole("button", { name: "Save account" }).click();
  await expect(row.getByText("Inactive", { exact: true })).toBeVisible();
  await member.goto("/login"); await member.getByLabel("JS ID", { exact: true }).fill("JS-E2E"); await member.getByLabel("Password", { exact: true }).fill("Another-temp-2026!"); await member.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(member.getByRole("alert")).toBeVisible(); await memberContext.close();
});
test("recurring schedule controls and mobile workflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, "JS1001");
  await page.goto("/recurring"); await page.getByRole("button", { name: "New schedule" }).click();
  const dialog = page.getByRole("dialog"); await dialog.getByLabel("Task title").fill("Monthly records check");
  await dialog.getByLabel("Assigned to").selectOption({ label: "Riya Mehta" });
  await dialog.getByLabel("Repeat", { exact: true }).selectOption("monthly");
  await dialog.getByLabel("Day of the month").fill("31");
  await dialog.getByLabel("Days after the task appears").fill("3");
  await dialog.getByRole("button", { name: "Create schedule" }).click();
  const card = page.locator("article").filter({ hasText: "Monthly records check" });
  await expect(card.getByText("Active", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Pause", exact: true }).click(); await expect(card.getByText("Paused", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Resume", exact: true }).click(); await expect(card.getByText("Active", { exact: true })).toBeVisible();
  await page.goto("/team"); await expect(page.getByRole("heading", { name: "Team overview" })).toBeVisible(); await page.screenshot({ path: ".playwright-results/team-mobile.png", fullPage: true, caret: "initial" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/my-tasks"); await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Task title").fill("Mobile follow-up");
  await page.getByRole("dialog").getByLabel("Deadline (IST)").fill(localDateTime(Date.now() + 86_400_000));
  await page.getByRole("dialog").getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mobile follow-up" })).toBeVisible();
  await page.getByLabel("Completion note").fill("Completed from mobile."); await page.getByRole("button", { name: "Submit & complete" }).click();
  await expect(page.getByRole("heading", { name: "Submitted work" })).toBeVisible();
  await page.getByLabel("Reason for reopening").fill("One final correction."); await page.getByRole("button", { name: "Reopen task", exact: true }).click();
  await expect(page.getByText("Reopened", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
