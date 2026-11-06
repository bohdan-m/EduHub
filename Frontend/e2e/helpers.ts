import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const MAILPIT = (process.env.E2E_MAILPIT_URL ?? "http://localhost:8025").replace(/\/$/, "");
export const PASSWORD = `E2e-ui-${Math.random().toString(36).slice(2, 10)}`;

export const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e2e.test`;

export const API = (process.env.E2E_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/** Fails the test on uncaught page errors, anything the Content Security Policy blocks, and server errors. */
export function watchForErrors(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => {
    // React's development-only performance tracks sometimes throw this during route changes; production has no such code
    if (error.message.includes("cannot have a negative time stamp")) return;
    problems.push(`page error: ${error.message}`);
  });
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/.test(message.text())) problems.push(`blocked: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
  });
  return () => expect(problems, problems.join("\n")).toEqual([]);
}

/** The link in the newest email Mailpit caught for this address (sending is asynchronous, so poll). */
export async function emailedLink(request: APIRequestContext, email: string, contains: string) {
  let link: string | undefined;
  await expect.poll(async () => {
    const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${email}"` } });
    for (const message of (await search.json()).messages ?? []) {
      const body = await (await request.get(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
      link = (body.Text as string).match(/https?:\/\/\S+/g)?.find((url) => url.includes(contains));
      if (link) return true;
    }
    return false;
  }, { message: `no "${contains}" email for ${email}` }).toBe(true);
  return link!;
}

/** Opens a page and waits until its form is live: typed into too early, a submit goes to the server, not the app. */
export async function openForm(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => {
    const submit = document.querySelector('form button[type="submit"]');
    return submit !== null && Object.keys(submit).some((key) => key.startsWith("__reactFiber"));
  });
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await openForm(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

/** Signs up through the form and confirms the address the way a person would, ending signed in on /home. */
export async function signUp(page: Page, request: APIRequestContext, name: string) {
  const email = uniqueEmail("ui");
  await openForm(page, "/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto(await emailedLink(request, email, "/verify-email"));
  await expect(page).toHaveURL(/\/home$/);
  return email;
}

/** The API token of the account signed in on this page (Better Auth hands it out with the session). */
export async function apiToken(page: Page) {
  const response = await page.request.get("/api/auth/get-session");
  const token = response.headers()["set-auth-jwt"];
  expect(token, "signed in, so the session comes with an API token").toBeTruthy();
  return token;
}

/** Creates a course through the API as the page's account; returns its id. Faster than the builder for setup. */
export async function createCourseAs(page: Page, course: Record<string, unknown>) {
  const response = await page.request.post(`${API}/api/courses/create/`, {
    data: course,
    headers: { Authorization: `Bearer ${await apiToken(page)}` },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).id as number;
}
