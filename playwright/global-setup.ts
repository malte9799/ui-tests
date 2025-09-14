import { chromium, expect, type FullConfig } from "@playwright/test";
import { createRequire } from "module";
import { walkDir, sendSQLpw } from "./utils";
import "./db";

const require = createRequire(import.meta.url);

export default async function globalSetup(config: FullConfig) {
    console.debug("\x1b[32m%s\x1b[0m", "===== GLOBAL SETUP =====");

    const testDir = config.projects[0].testDir;
    const testIgnore = config.projects[0].testIgnore;

    process.env.TEST_IGNORE = "true";

    const setupSQLs: string[] = [];

    const files = walkDir(testDir);
    for (const file of files) {
        const mod = require(file);
        if (typeof mod.setup === "function") {
            const sql = await mod.setup();
            if (sql) setupSQLs.push(sql);
        }
    }

    const setupSQL = setupSQLs.join("\n");

    await sendSQLpw(setupSQL, config);

    process.env.TEST_IGNORE = "false";
}
