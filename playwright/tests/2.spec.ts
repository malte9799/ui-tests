import { test, expect } from "@playwright/test";

export async function setup() {
    return `
        INSERT INTO objekt SET name='O Alice', nachname='O Müll', kunde_id=(
            SELECT id FROM kunde WHERE name='Alice' AND nachname='Müll' LIMIT 1
        );
    `;
}
export async function teardown() {
    return `
        DELETE FROM objekt WHERE name = 'O Alice' AND nachname = 'O Müll';
    `;
}

if (process.env.TEST_IGNORE !== "true") {
    test("2 @setup", async ({ page }) => {
        await page.waitForTimeout(Math.random() * 2_000);
    });
    test("2 @teardown", async ({ page }) => await page.waitForTimeout(1_000));
    test("1", async ({ page }) => await page.waitForTimeout(1_000));
    test("2", async ({ page }) => await page.waitForTimeout(1_000));
    test("3", async ({ page }) => await page.waitForTimeout(1_000));
    test("4", async ({ page }) => await page.waitForTimeout(1_000));
    test("5", async ({ page }) => await page.waitForTimeout(1_000));
}
