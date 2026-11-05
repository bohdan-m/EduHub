import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PASSWORD, emailedLink, logIn, signUp, watchForErrors } from "./helpers";

test("profile, data export, password change and account deletion from Settings", async ({ page, request }) => {
  const noErrors = watchForErrors(page);
  const email = await signUp(page, request, "E2E Settings");
  await page.goto("/settings");

  // profile: shown on the public author page
  await page.getByLabel("Headline").fill("Teaches with tests");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await page.getByRole("link", { name: "View your author page" }).click();
  await expect(page.getByText("Teaches with tests")).toBeVisible();
  await page.goto("/settings");

  // export: one JSON file with the account and the API's data
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const exported = JSON.parse(await readFile(await (await download).path(), "utf-8"));
  expect(exported.account.email).toBe(email);
  expect(exported.profile.headline).toBe("Teaches with tests");

  // the session list shows this device
  await expect(page.getByText("This device")).toBeVisible();

  // password change, then sign in with the new one
  const newPassword = `${PASSWORD}-changed`;
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await logIn(page, email, newPassword);

  // deletion is confirmed from the inbox; the account is then gone
  await page.goto("/settings");
  await page.getByLabel("Your password").fill(newPassword);
  await page.getByRole("checkbox", { name: /can.t be undone/ }).check({ force: true });
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText(/Check your email/)).toBeVisible();
  await page.goto(await emailedLink(request, email, "/delete-user/callback"));
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  noErrors();
});

test("visitors get a start page, honest pages and a real 404", async ({ page }) => {
  const noErrors = watchForErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Learn something new/ })).toBeVisible();
  await expect(page).toHaveTitle(/EduHub/);

  for (const [path, title] of [["/about", "About · EduHub"], ["/privacy", "Privacy policy · EduHub"], ["/terms", "Terms of use · EduHub"]]) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  }

  const missing = await page.goto("/no-such-page");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page doesn’t exist" })).toBeVisible();

  // catalogue filters live in the URL, so a search can be shared
  await page.goto("/home");
  await page.getByLabel("Category").selectOption("data");
  await expect(page).toHaveURL(/category=data/);
  noErrors();
});
