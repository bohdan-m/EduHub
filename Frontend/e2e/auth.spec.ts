import { expect, test } from "@playwright/test";
import { PASSWORD, emailedLink, uniqueEmail, watchForErrors } from "./helpers";

test("sign-up checks every field before sending", async ({ page }) => {
  const noErrors = watchForErrors(page);
  await page.goto("/register");
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
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Forgetful");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // confirm, then forget the password
  await page.goto(await emailedLink(request, email, "/verify-email"));
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

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

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  noErrors();
});
