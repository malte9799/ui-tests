#!/usr/bin/env ts-node

import { execSync } from "child_process";
import { glob } from "glob";
import path from "path";
import termkit from "terminal-kit";
import type { Terminal } from "terminal-kit";

const term: Terminal = termkit.terminal;

// 1. Alle Testdateien finden
const testFiles = glob
    .sync("./tests/**/*.spec.ts")
    .map((f) => path.relative(process.cwd(), f));

if (testFiles.length === 0) {
    console.error("❌ Es wurden keine Testdateien gefunden!");
    process.exit(1);
}

// Track selection by filename
const selected: Set<string> = new Set();
let filteredFiles = [...testFiles];
let cursor = 0;
let searchQuery = "";

function render() {
    term.moveTo(1, 1);
    term.eraseDisplayBelow();

    term
        .blue("? ")("Wähle die Tests aus, die du ausführen möchtest:\n")
        .bold("(")
        .bold.cyan("<↑/↓>")(" zum navigieren, ")
        .bold.cyan("<space>")(" zum auswählen, ")
        .bold.bgGreen("<enter>")
        .bold(" zum ausführen, ")
        .bold.bgRed("<escape>")
        .bold(" zum abbrechen oder ")
        .bold.cyan("tippen")
        .bold(" zum suchen):")("\n\n");

    // term.bold("Wähle Tests aus (");
    // term.cyan("↑/↓");
    // term.bold(" um zu navigieren, ");
    // term.cyan("Lehrtaste");
    // term.bold(" zum markieren, ");
    // term.cyan("Enter");
    // term.bold(" zum ausführen, ");
    // term.cyan("tippen");
    // term.bold(" zum suchen):\n\n");

    filteredFiles.forEach((file, idx) => {
        const isHover = idx === cursor;
        const isSelected = selected.has(file);

        // Cursor
        if (isHover) {
            term.cyan("❯");
        } else {
            term(" ");
        }

        // Circle
        if (isSelected) {
            term.green("● ");
        } else if (isHover) {
            term.cyan("◯ ");
        } else {
            term("◯ ");
        }

        // Filename
        if (isHover) {
            term.cyan(file + "\n");
        } else {
            term(file + "\n");
        }
    });

    term("\nSuchbegriff: " + searchQuery);
}

function filterFiles() {
    filteredFiles = testFiles.filter((f) =>
        f.toLowerCase().includes(searchQuery.toLowerCase())
    );
    cursor = 0;
}

async function main() {
    render();

    term.grabInput({ mouse: false, keys: true });

    term.on("key", (name: string, matches: string[], data: any) => {
        if (name === "UP") {
            cursor = (cursor - 1 + filteredFiles.length) % filteredFiles.length;
        } else if (name === "DOWN") {
            cursor = (cursor + 1) % filteredFiles.length;
        } else if (name === " ") {
            const currentFile = filteredFiles[cursor];
            if (selected.has(currentFile)) selected.delete(currentFile);
            else selected.add(currentFile);
        } else if (name === "ENTER") {
            term.removeAllListeners("key");
            term.moveTo(1, 1);
            term.eraseDisplayBelow();

            const selectedFiles = Array.from(selected);
            if (selectedFiles.length === 0) {
                console.log("⚠️ Es wurden keine Tests ausgewählt.");
                process.exit(0);
            }

            const fileString = selectedFiles.map((e) => `"${e}"`).join(" ");

            const cmd = `DEBUG=1 npx playwright test ${fileString} --project=debug --ui`;

            console.log("👉 Starte Tests:", cmd);

            try {
                execSync(cmd, { stdio: "inherit" });
            } catch (err) {
                process.exit(1);
            }
            process.exit(0);
        } else if (name === "ESCAPE") {
            term.removeAllListeners("key");
            term.moveTo(1, 1);
            term.eraseDisplayBelow();
            console.log("⏹️ Beendet.");
            process.exit(0);
        } else if (name === "BACKSPACE") {
            searchQuery = searchQuery.slice(0, -1);
            filterFiles();
        } else if (name.length === 1) {
            searchQuery += name;
            filterFiles();
        }

        render();
    });
}

main();
