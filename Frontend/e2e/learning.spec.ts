import { expect, test } from "@playwright/test";
import { createCourseAs, signUp, watchForErrors } from "./helpers";

// A course from the catalogue to the certificate: a learner takes it, discusses and reviews it; its author answers
// and reads the stats.
test("a learner finishes a course and its author sees how it went", async ({ page, request, browser }) => {
  const title = `Capitals and SQL ${Date.now()}`;
  const authorErrors = watchForErrors(page);
  await signUp(page, request, "E2E Teacher");
  const courseId = await createCourseAs(page, {
    title,
    description: "A tiny course for the browser tests.",
    status: "published",
    category: "data",
    level: "beginner",
    outcomes: ["Name a capital", "Match SQL commands"],
    stages: [{
      title: "Only stage",
      order: 1,
      lessons: [
        { title: "Capitals", order: 1, blocks: [
          { type: "text", text: "Paris is the capital of **France**.\n\n```sql\nSELECT name FROM cities;\n```" },
          { type: "quiz", id: "capital", kind: "short", question: "What is the capital of France?", answers: ["Paris"] },
        ] },
        { title: "Commands", order: 2, blocks: [
          { type: "quiz", id: "commands", kind: "match", question: "Match each command",
            pairs: [{ id: "p1", left: "SELECT", right: "reads rows" }, { id: "p2", left: "DELETE", right: "removes rows" }] },
        ] },
      ],
    }],
  });

  // the learner finds it in the catalogue
  const learnerContext = await browser.newContext();
  const learner = await learnerContext.newPage();
  const learnerErrors = watchForErrors(learner);
  await signUp(learner, request, "E2E Learner");
  await learner.goto("/home");
  await learner.getByRole("searchbox", { name: "Search courses" }).fill(title);
  await expect(learner).toHaveURL(/q=/);
  await learner.getByRole("link", { name: title }).click();
  await expect(learner.getByRole("heading", { name: title })).toBeVisible();
  await expect(learner.getByText("Name a capital")).toBeVisible();
  // code in lessons gets syntax colours
  await expect(learner.locator("article pre code.hljs")).toBeVisible();

  await learner.getByRole("button", { name: "Start course" }).click();
  const capital = learner.getByRole("region", { name: "Quiz" });
  await capital.getByRole("textbox", { name: "Your answer" }).fill("  paris ");
  await capital.getByRole("button", { name: "Check answer" }).click();
  await expect(capital.getByRole("status")).toContainText("Correct!");

  // private notes save themselves; the bookmark shows in the curriculum
  await learner.getByRole("button", { name: "Notes" }).click();
  await learner.getByRole("textbox", { name: /My notes/ }).fill("Paris, not Lyon");
  await expect(learner.getByText("Saved", { exact: true })).toBeVisible();
  await learner.getByRole("button", { name: "Bookmark this lesson" }).click();
  await expect(learner.getByRole("button", { name: "Remove bookmark" })).toBeVisible();

  await learner.getByRole("button", { name: "Complete and continue" }).click();
  await expect(learner.getByRole("heading", { name: "Commands", level: 2 })).toBeVisible();
  const commands = learner.getByRole("region", { name: "Quiz" });
  await commands.getByLabel("SELECT").selectOption("reads rows");
  await commands.getByLabel("DELETE").selectOption("removes rows");
  await commands.getByRole("button", { name: "Check answer" }).click();
  await expect(commands.getByRole("status")).toContainText("Correct!");

  // a question in the lesson's discussion
  await learner.getByRole("textbox", { name: /Ask a question/ }).fill("Is TRUNCATE like DELETE?");
  await learner.getByRole("button", { name: "Post", exact: true }).click();
  await expect(learner.getByText("Is TRUNCATE like DELETE?")).toBeVisible();

  // the last lesson completes the course and issues a certificate
  await learner.getByRole("button", { name: "Mark as complete" }).click();
  await expect(learner.getByText("2 of 2 done")).toBeVisible();
  await expect(learner.getByRole("link", { name: "View certificate" })).toBeVisible();

  // a review, now that lessons are done
  await learner.getByRole("radio", { name: "5 stars" }).check({ force: true });
  await learner.getByLabel("What did you think? (optional)").fill("Short and clear.");
  await learner.getByRole("button", { name: "Post review" }).click();
  await expect(learner.getByRole("button", { name: "Update review" })).toBeVisible();
  await expect(learner.getByRole("listitem").getByText("Short and clear.")).toBeVisible();

  await learner.getByRole("link", { name: "View certificate" }).click();
  await expect(learner.getByRole("heading", { name: "E2E Learner" })).toBeVisible();
  await expect(learner.getByRole("heading", { name: title })).toBeVisible();
  const certificateUrl = learner.url();

  // My learning: the finished course and the bookmark with its note
  await learner.goto("/learning");
  await expect(learner.getByRole("heading", { name: "Finished" })).toBeVisible();
  await expect(learner.getByRole("link", { name: "Capitals", exact: true })).toBeVisible();
  await expect(learner.getByText("Paris, not Lyon")).toBeVisible();
  learnerErrors();

  // anyone with the link can check the certificate
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(certificateUrl);
  await expect(guest.getByText("Certificate of completion")).toBeVisible();
  await guestContext.close();

  // the author answers the question and the review, and reads the stats
  await page.goto(`/courses/${courseId}?lesson=0`);
  await page.getByRole("button", { name: /Commands/ }).first().click();
  const question = page.getByRole("article", { name: "Comment by E2E Learner" });
  await question.getByRole("button", { name: "Reply" }).click();
  await page.getByRole("textbox", { name: "Reply to E2E Learner" }).fill("Close: it empties the whole table.");
  await page.getByRole("region", { name: /Discussion/ }).getByRole("button", { name: "Reply", exact: true }).last().click();
  await expect(page.getByRole("article", { name: "Comment by E2E Teacher" })).toContainText("Author");

  await page.getByRole("region", { name: "Reviews" }).getByRole("button", { name: "Reply" }).click();
  await page.getByRole("textbox", { name: "Your reply" }).fill("Thank you!");
  await page.getByRole("button", { name: "Save reply" }).click();
  await expect(page.getByText("Reply from the author")).toBeVisible();

  await page.getByRole("link", { name: "Stats" }).click();
  await expect(page.getByText("Average progress")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hardest quizzes" })).toBeVisible();
  await page.goto("/teach");
  await expect(page.getByText("1 learner finished")).toBeVisible();
  authorErrors();
  await learnerContext.close();
});

test("on a phone the curriculum opens from a button at the bottom", async ({ browser, request }) => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await phone.newPage();
  await signUp(page, request, "E2E Phone");
  const courseId = await createCourseAs(page, {
    title: "Phone course", description: "For the phone test.", status: "unlisted",
    stages: [{ title: "S", order: 1, lessons: [
      { title: "First", order: 1, blocks: [{ type: "text", text: "One" }] },
      { title: "Second", order: 2, blocks: [{ type: "text", text: "Two" }] },
    ] }],
  });
  await page.goto(`/courses/${courseId}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: /Lessons · 1 of 2/ }).click();
  await page.getByRole("dialog", { name: "Curriculum" }).getByRole("button", { name: /Second/ }).click();
  await expect(page.getByRole("heading", { name: "Second", level: 2 })).toBeVisible();
  await phone.close();
});
