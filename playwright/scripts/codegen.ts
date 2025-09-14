import { spawn } from "child_process";
import globalSetup from "../tests/global.setup.ts";
import config from "../playwright.config.ts";
import { type FullConfig } from "@playwright/test";

async function runCodegen() {
    await globalSetup(config as FullConfig);

    const child = spawn(
        "npx",
        [
            "playwright",
            "codegen",
            "--storage-state=storageState.json",
            "https://demo.playwright.dev/todomvc",
        ],
        {
            stdio: "inherit", // let child use the parent’s stdio
        }
    );

    child.on("close", (code) => {
        process.exit(code ?? 0);
    });
}

runCodegen().catch((err) => {
    console.error(err);
    process.exit(1);
});
