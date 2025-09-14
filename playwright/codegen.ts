import { exec } from "child_process";
import globalSetup from "./global-setup.ts";
import config from "./playwright.config.ts";
import { type FullConfig } from "@playwright/test";

async function runCodegen() {
    await globalSetup(config as FullConfig);
    exec(
        "npx playwright codegen --storage-state=storageState.json https://demo.playwright.dev/todomvc"
    );
}

runCodegen().catch((err) => {
    console.error(err);
    process.exit(1);
});
