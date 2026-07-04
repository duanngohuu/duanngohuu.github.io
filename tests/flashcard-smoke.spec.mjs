import { test, expect } from '@playwright/test';

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function openFirstVocabLesson(page, { navigate = true } = {}) {
  if (navigate) await page.goto('/flashcard/?v=e2e', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#cardFront')).toBeVisible();

  await expect.poll(
    async () => page.evaluate(() => typeof window.switchFlashcardCategory === 'function'),
    { timeout: 15_000 }
  ).toBe(true);

  await page.evaluate(async () => {
    await window.switchFlashcardCategory('vocab');
    const courses = window.getFlashcardCategoryState?.().vocab?.courses || [];
    const course = courses.find(item => item.lessons?.length);
    const lesson = course?.lessons?.[0];
    if (!course || !lesson) throw new Error('Không có bài Từ vựng để smoke test.');
    window.st.lessons = course.lessons;
    await window.selectLesson(lesson.id);
  });

  await expect.poll(
    async () => page.evaluate(() => window.st?.cards?.length || 0),
    { timeout: 15_000 }
  ).toBeGreaterThan(0);
  await expect(page.locator('#sessionTitle')).not.toHaveText(/Lỗi JS|Lỗi tải bài/);
  await expect(page.locator('#cardFront')).not.toHaveText(/App lỗi|Không tải được data/);
}

test.describe('flashcard smoke', () => {
  test('loads, starts a session, flips and marks a card', async ({ page }) => {
    const errors = collectPageErrors(page);
    await openFirstVocabLesson(page);

    await page.locator('#startBtn').click();
    await expect(page.locator('#posText')).toHaveText(/1\/10|1\/20|1\/30|1\/50|1\/\d+/);

    const frontBefore = await page.locator('#cardFront').innerText();
    await page.locator('#flipBtn').click();
    await expect.poll(async () => page.locator('#cardFront').innerText()).not.toBe(frontBefore);

    await page.locator('#knownBtn').click();
    await expect(page.locator('#knownText')).toHaveText(/(?:Biết|Đã nhớ): 1/);

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('survives reload after first use', async ({ page }) => {
    const errors = collectPageErrors(page);
    await openFirstVocabLesson(page);
    await page.locator('#startBtn').click();
    await expect(page.locator('#posText')).toContainText('1/');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openFirstVocabLesson(page, { navigate: false });
    await expect(page.locator('#cardFront')).toBeVisible();
    await expect(page.locator('#sessionTitle')).not.toHaveText(/Lỗi JS|Lỗi tải bài/);
    await page.locator('#startBtn').click();
    await expect(page.locator('#posText')).toContainText('1/');

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('mobile viewport has no horizontal overflow and drawer opens', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-iphone', 'mobile-only layout check');
    const errors = collectPageErrors(page);
    await openFirstVocabLesson(page);

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 4);
    expect(hasOverflow).toBe(false);

    await page.locator('.library-fab').click();
    await expect(page.locator('body')).toHaveClass(/library-open/);

    await page.evaluate(async () => {
      const lessonId = window.st?.lesson?.id;
      if (!lessonId) throw new Error('Không có bài đang chọn để đóng drawer.');
      await window.selectLesson(lessonId);
    });
    await expect(page.locator('body')).not.toHaveClass(/library-open/);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
