import { expect, test } from "@playwright/test";
import { API, logIn, signUp, watchForErrors } from "./helpers";

// One story from both sides: an author builds a course in the builder, a guest learner takes it.
test("an author builds a course and a learner takes it", async ({ page, request, browser }) => {
  const noErrors = watchForErrors(page);
  const email = await signUp(page, request, "E2E Author");

  await page.goto("/courses/create");
  const outline = page.getByRole("navigation", { name: "Course outline" });

  // saving an empty course points at every missing part instead of sending it
  await page.getByRole("button", { name: "Create course", exact: true }).click();
  await expect(page.getByText("things to fix before saving")).toBeVisible();
  await expect(page.getByText("Enter a course title.").first()).toBeVisible();

  await page.getByLabel("Title").fill("Playwright SQL course");
  await page.getByLabel("Description").fill("Built and taken by the browser tests.");
  await outline.getByRole("button", { name: /Untitled stage/ }).click();
  await page.getByLabel("Stage title").fill("Basics");
  await outline.getByRole("button", { name: /Untitled lesson/ }).click();
  await page.getByLabel("Lesson title").fill("Filtering rows");

  // rich text: type, select, bold from the toolbar
  await page.getByRole("button", { name: "Add text block" }).click();
  const text = page.getByRole("textbox", { name: "Text" });
  await text.click();
  await page.keyboard.type("WHERE keeps matching rows.");
  await page.keyboard.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Bold (Ctrl+B)" }).click();
  await expect(text.locator("strong")).toHaveText("WHERE keeps matching rows.");

  await page.getByRole("button", { name: "Add quiz block" }).click();
  await page.getByLabel("Question").fill("Which clause filters rows?");
  await page.getByRole("textbox", { name: "Answer 1" }).fill("SELECT");
  await page.getByRole("textbox", { name: "Answer 2" }).fill("WHERE");
  // react-aria keeps the real input under the styled box; check() still verifies it ends up ticked
  await page.getByRole("checkbox", { name: "Answer 2 is correct" }).check({ force: true });

  // the work is saved as a draft on the server: it's back after a reload, and on another device
  await expect(page.getByText(/^Draft saved/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Your unsaved draft is back")).toBeVisible();
  await outline.getByRole("button", { name: /Filtering rows/ }).click();
  await expect(page.getByRole("textbox", { name: "Text" }).locator("strong")).toHaveText("WHERE keeps matching rows.");

  const otherDevice = await browser.newContext();
  const elsewhere = await otherDevice.newPage();
  await logIn(elsewhere, email);
  await elsewhere.goto("/courses/create");
  await expect(elsewhere.getByText("Your unsaved draft is back")).toBeVisible();
  await expect(elsewhere.getByLabel("Title")).toHaveValue("Playwright SQL course");
  await otherDevice.close();

  await page.getByRole("tab", { name: "Preview as learner" }).click();
  await expect(page.getByRole("region", { name: "Quiz" })).toBeVisible();

  await page.getByRole("button", { name: "Create course", exact: true }).click();
  await expect(page).toHaveURL(/\/courses\/\d+$/);
  const courseUrl = page.url();
  await expect(page.getByRole("heading", { name: "Playwright SQL course" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit course" })).toBeVisible();
  await expect(page.locator("article strong")).toHaveText("WHERE keeps matching rows.");
  await page.goto("/courses/create");
  await expect(page.getByLabel("Title")).toHaveValue("");
  await expect(page.getByText("Your unsaved draft is back")).toHaveCount(0);
  noErrors();

  // a guest sees the course without author controls and can take the quiz
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  const guestErrors = watchForErrors(guest);
  await guest.goto(courseUrl);
  await expect(guest.getByRole("heading", { name: "Filtering rows" })).toBeVisible();
  await expect(guest.getByRole("link", { name: "Edit course" })).toHaveCount(0);

  // learners never receive the answers: the server grades each attempt
  const courseJson = await (await guest.request.get(`${API}/api/courses/${courseUrl.split("/").pop()}/`)).text();
  expect(courseJson).not.toContain('"correct"');
  expect(courseJson).toContain('"multiple":false');

  const quiz = guest.getByRole("region", { name: "Quiz" });
  await quiz.getByRole("radio", { name: "SELECT" }).click();
  const graded = guest.waitForResponse((response) => response.url().includes("/check/") && response.status() === 200);
  await quiz.getByRole("button", { name: "Check answer" }).click();
  await graded;
  await expect(quiz.getByRole("status")).toContainText("Not quite.");
  await quiz.getByRole("button", { name: "Try again" }).click();
  await quiz.getByRole("radio", { name: "WHERE" }).click();
  await quiz.getByRole("button", { name: "Check answer" }).click();
  await expect(quiz.getByRole("status")).toContainText("Correct!");

  // someone else can't open the editor
  await guest.goto(`${courseUrl}/edit`);
  await expect(guest.getByText("Only the course's author can edit it.")).toBeVisible();
  guestErrors();
  await guestContext.close();
});
