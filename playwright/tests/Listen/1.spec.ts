import { test, expect, type Page } from "@playwright/test";
if (process.env.IGNORE_TESTS !== "true") defineTests();

export default {
    createQuery: `
        INSERT INTO kunde SET name='PW-Kunde-Name', nachname='PW-Kunde-Nachname';`,
    deleteQuery: `
        DELETE FROM kunde WHERE name='PW-Kunde-Name';`,
};

function defineTests() {
    test("1 @setup", async ({ page }) => {
        await page.waitForTimeout(Math.random() * 2_000);
    });
    test("1 @teardown", async ({ page }) => {
        await page.waitForTimeout(Math.random() * 2_000);
    });
    test("1", async ({ page }) => await page.waitForTimeout(1_000));
    test("2", async ({ page }) => await page.waitForTimeout(1_000));
    test("3", async ({ page }) => await page.waitForTimeout(1_000));
    test("4", async ({ page }) => await page.waitForTimeout(1_000));
    test("5", async ({ page }) => await page.waitForTimeout(1_000));

    test.describe.serial("ed", () => {
        test("11", async ({ page }) => await page.waitForTimeout(1_000));
        test("12", async ({ page }) => await page.waitForTimeout(1_000));
        test("13", async ({ page }) => await page.waitForTimeout(1_000));
        test("14", async ({ page }) => await page.waitForTimeout(1_000));
        test("15", async ({ page }) => await page.waitForTimeout(1_000));
    });
}
