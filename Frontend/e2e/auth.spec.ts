import { expect, test } from "@playwright/test";
import { PASSWORD, emailedLink, openForm, uniqueEmail, watchForErrors } from "./helpers";

test("sign-up checks every field before sending", async ({ page }) => {
  const noErrors = watchForErrors(page);
  await openForm(page, "/register");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Enter your email address.")).toBeVisible();

  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter a valid email address, like name@example.com.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  noErrors();
});

test("an unconfirmed account can't log in, and forgot password sets a new one", async ({ page, request }) => {
  const noErrors = watchForErrors(page);
  const email = uniqueEmail("reset");
  await openForm(page, "/register");
  await page.getByLabel("Name").fill("E2E Forgetful");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await openForm(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // confirm, then forget the password
  await page.goto(await emailedLink(request, email, "/verify-email"));
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: /Learn something new/ })).toBeVisible();

  await openForm(page, "/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto(await emailedLink(request, email, "/reset-password/"));
  const newPassword = `${PASSWORD}-new`;
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Repeat the new password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();

  await openForm(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  noErrors();
});

test("a form sent before the page's scripts run keeps the password out of the URL", async ({ browser }) => {
  const noScripts = await browser.newContext({ javaScriptEnabled: false });
  const page = await noScripts.newPage();
  await page.goto("/register");
  await page.getByLabel("Name").fill("No Scripts");
  await page.getByLabel("Email").fill(uniqueEmail("noscript"));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForLoadState();
  expect(page.url()).not.toContain(PASSWORD);

  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@e2e.test");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForLoadState();
  expect(page.url()).not.toContain(PASSWORD);
  await noScripts.close();
});
