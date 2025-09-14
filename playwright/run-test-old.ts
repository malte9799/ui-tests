#!/usr/bin/env ts-node

import inquirer from "inquirer";
import { execSync } from "child_process";
import { glob } from "glob";
import path from "path";

// 1. Alle Testdateien finden
const testFiles = glob.sync("./tests/**/*.spec.ts");

if (testFiles.length === 0) {
    console.error("❌ Es wurden keine Testdateien gefunden!");
    process.exit(1);
}

(async () => {
    // 2. Liste anzeigen + Mehrfachauswahl
    const answers = await inquirer.prompt([
        {
            type: "checkbox",
            name: "selectedTests",
            message: `Wähle die Tests aus, die du ausführen möchtest:
  (Mit ↑/↓ navigieren`,
            choices: testFiles.map((f) => ({
                name: path.relative(process.cwd(), f),
                value: f,
            })),
            pageSize: 15, // scrollbare Liste
            loop: false, // verhindert Endlosschleife beim Scrollen (optional)
        },
    ]);

    const { selectedTests } = answers;

    if (!selectedTests || selectedTests.length === 0) {
        console.log("⚠️ Es wurden keine Tests ausgewählt.");
        process.exit(0);
    }

    // 3. Playwright mit config starten + nur die ausgewählten Tests
    const cmd = `DEBUG=1 npx playwright test ${selectedTests.join(
        " "
    )} --debug --project=debug`;

    console.log("👉 Starte Tests:", cmd);

    try {
        execSync(cmd, { stdio: "inherit" });
    } catch (err) {
        process.exit(1);
    }
})();
