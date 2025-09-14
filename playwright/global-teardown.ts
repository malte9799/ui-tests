import { chromium, expect, type FullConfig } from "@playwright/test";
import { createRequire } from "module";
import { walkDir, sendSQLpw } from "./utils";

const require = createRequire(import.meta.url);

export default async function globalTeardown(config: FullConfig) {
    console.debug("\x1b[32m%s\x1b[0m", "===== GLOBAL TEARDOWN =====");

    const testDir = config.projects[0].testDir;
    const testIgnore = config.projects[0].testIgnore;
    process.env.TEST_IGNORE = "true";

    const teardownSQLs: string[] = [];

    const files = walkDir(testDir);
    for (const file of files) {
        const mod = require(file);
        if (typeof mod.default === "object") {
            const sql = mod.default.deleteQuery;
            if (sql) teardownSQLs.push(sql);
        }
    }

    const teardownSQL = teardownSQLs.join("\n");

    await sendSQLpw(teardownSQL, config);

    process.env.TEST_IGNORE = "false";
}
