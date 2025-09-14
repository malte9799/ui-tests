import { chromium, expect, type FullConfig } from "@playwright/test";
import { createRequire } from "module";
import { walkDir, sendSQLpw } from "../utils/utils.ts";
import "../utils/db.ts";

const require = createRequire(import.meta.url);

export default async function globalSetup(config: FullConfig) {
    console.debug("\x1b[32m%s\x1b[0m", "===== GLOBAL SETUP =====");

    const testDir = config.projects[0].testDir ?? "tests";
    const testIgnore = config.projects[0].testIgnore;

    process.env.IGNORE_TESTS = "true";

    const setupSQLs: string[] = [];

    const files = walkDir(testDir);
    for (const file of files) {
        const mod = require(file);
        if (typeof mod.default == "object") {
            const sql = mod.default.createQuery;
            if (sql) setupSQLs.push(sql);
        }
    }

    const setupSQL = setupSQLs.join("\n");

    await sendSQLpw(setupSQL, config);

    process.env.IGNORE_TESTS = "false";
}
