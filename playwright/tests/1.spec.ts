import { test, expect, type Page } from "@playwright/test";

export async function setup() {
    return `
        INSERT INTO kunde SET name='Alice', nachname='Müll';
    `;
}
export async function teardown() {
    return `
        DELETE FROM kunde WHERE name = 'Alice' AND nachname = 'Müll';

    `;
}

if (process.env.TEST_IGNORE !== "true") {
    test("1 @setup", async ({ page }) => {
        await page.waitForTimeout(Math.random() * 2_000);
    });
    test("1 @teardown", async ({ page }) => {
        await page.waitForTimeout(1_000);
    });
    test("1", async ({ page }) => {
        await page.waitForTimeout(1_000);
    });
    test("2", async ({ page }) => {
        await page.waitForTimeout(1_000);
    });
    test("3", async ({ page }) => {
        await page.waitForTimeout(1_000);
    });
    test("4", async ({ page }) => {
        await page.waitForTimeout(1_000);
    });
    test("5", async ({ page }) => {
        await page.waitForTimeout(1_000);
    });
}
