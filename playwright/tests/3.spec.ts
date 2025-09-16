import { test, expect } from "@playwright/test";
if (process.env.IGNORE_TESTS !== "true") defineTests();

export default {
    createQuery: `
        INSERT INTO objekt SET name='PW-Objekt-Name2', nachname='PW-Objekt-Nachname2', kunde_id=(
            SELECT id FROM kunde WHERE name='PW-Kunde-Name' LIMIT 1
        );`,
    deleteQuery: `
        DELETE FROM objekt WHERE name = 'PW-Objekt-Name2';`,
};

function defineTests() {
    test("3 @setup", async ({ page }) => {
        await page.waitForTimeout(Math.random() * 2_000);
    });
    test("3 @teardown", async ({ page }) => {
        await page.waitForTimeout(Math.random() * 2_000);
    });
    test("1", async ({ page }) => await page.waitForTimeout(1_000));
    test("2", async ({ page }) => await page.waitForTimeout(1_000));
    test("3", async ({ page }) => await page.waitForTimeout(1_000));
    test("4", async ({ page }) => await page.waitForTimeout(1_000));
    test("5", async ({ page }) => await page.waitForTimeout(1_000));
}
