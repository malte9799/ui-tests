import { test, expect } from "@playwright/test";
if (process.env.IGNORE_TESTS !== "true") defineTests();

export default {
    createQuery: `
        INSERT INTO kunde SET name='PW-Kunde-Name', nachname='PW-Kunde-Nachname';
        `,
    deleteQuery: `
        DELETE FROM kunde WHERE name = 'PW-Kunde-Name';`,
};

function defineTests() {
    test("2 @setup", async ({ page }) => {
        await page.waitForTimeout(Math.random() * 2_000);
    });
    test("2 @teardown", async ({ page }) => {
        await page.waitForTimeout(Math.random() * 2_000);
    });
    test("1", async ({ page }) => await page.waitForTimeout(1_000));
    test("2", async ({ page }) => await page.waitForTimeout(1_000));
    test("3", async ({ page }) => await page.waitForTimeout(1_000));
    test("4", async ({ page }) => await page.waitForTimeout(1_000));
    test("5", async ({ page }) => await page.waitForTimeout(1_000));
}
