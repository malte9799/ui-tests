import { test, expect, type Page } from "@playwright/test";
import { md5 } from "../utils/utils";
if (process.env.IGNORE_TESTS !== "true") defineTests();

export default {
    createQuery: `
        INSERT INTO kunde SET name='PW-Kunde-Name', nachname='PW-Kunde-Nachname';`,
    deleteQuery: `
        DELETE FROM kunde WHERE name='PW-Kunde-Name';`,
};

function defineTests() {
    let page: Page;
    test.beforeAll(async ({ browser }) => {
        page = await (await browser.newContext()).newPage();
        await page.goto(`?bereich=list&class=${md5("ListKunde")}`);
    });

    test("1 @setup", async () => {
        await page.waitForTimeout(Math.random() * 2_000);
        test.fail(true, "Fail Example");
    });
    test("1 @teardown", async () => {
        await page.waitForTimeout(Math.random() * 2_000);
        test.skip(true, "Skip Example");
    });
    test("1", async () => {
        await page.waitForTimeout(1_000);
        test.fixme(true, "Fixme Example");
    });
    test("2", async () => {
        await page.waitForTimeout(1_000);
    });
    test("3", async () => {
        await page.waitForTimeout(1_000);
    });
    test("4", async () => {
        await page.waitForTimeout(1_000);
    });
    test("5", async () => {
        await page.waitForTimeout(1_000);
    });
}
