#!/usr/bin/env ts-node

import { execSync } from "child_process";
import { glob } from "glob";
import path from "path";
import config from "../playwright.config.ts";
import termkit from "terminal-kit";
import type { Terminal } from "terminal-kit";

const { testDir = "./tests", testIgnore, testMatch } = config;

const term: Terminal = termkit.terminal;

type TreeNode = {
    name: string;
    path?: string;
    children?: TreeNode[];
    isFolder: boolean;
    isOpen: boolean;
};

function buildTree(testFiles: string[]): TreeNode[] {
    const root: TreeNode[] = [];

    for (const filePath of testFiles) {
        let parts = filePath.split(path.sep);
        if (parts[0] === "tests") {
            parts = parts.slice(1);
        }
        let currentLevel = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFolder = i < parts.length - 1;
            let node = currentLevel.find(
                (n) => n.name === part && n.isFolder === isFolder
            );

            if (!node) {
                node = {
                    name: part,
                    isFolder,
                    isOpen: false,
                };
                if (!isFolder) {
                    node.path = filePath;
                } else {
                    node.children = [];
                }
                currentLevel.push(node);
            }

            if (isFolder && node.children) {
                currentLevel = node.children;
            }
        }
    }

    return root;
}

function flattenTree(
    nodes: TreeNode[],
    depth = 0
): { node: TreeNode; depth: number }[] {
    let result: { node: TreeNode; depth: number }[] = [];
    for (const node of nodes) {
        result.push({ node, depth });
        if (node.isFolder && node.isOpen && node.children) {
            result = result.concat(flattenTree(node.children, depth + 1));
        }
    }
    return result;
}

// 1. Alle Testdateien finden
function resolveTestFiles(
    testDir: string,
    testMatch: string | RegExp | (string | RegExp)[] | undefined,
    testIgnore: string | RegExp | (string | RegExp)[] | undefined
): string[] {
    const allFiles = glob.sync("**/*", {
        cwd: testDir,
        absolute: true,
    });

    const matchers = Array.isArray(testMatch)
        ? testMatch
        : [testMatch ?? "**/*.@(spec|test).?(c|m)[jt]s?(x)"];

    const ignoreMatchers = Array.isArray(testIgnore)
        ? testIgnore
        : testIgnore !== undefined
        ? [testIgnore]
        : [];

    function matchesAny(file: string, patterns: (string | RegExp)[]): boolean {
        return patterns.some((pattern) => {
            if (typeof pattern === "string") {
                if (glob.hasMagic(pattern)) {
                    const matchedFiles = glob.sync(pattern, {
                        cwd: testDir,
                        absolute: true,
                    });
                    return matchedFiles.includes(file);
                } else {
                    return new RegExp(pattern).test(file);
                }
            } else {
                return pattern.test(file);
            }
        });
    }

    return allFiles.filter(
        (file) =>
            matchesAny(file, matchers) && !matchesAny(file, ignoreMatchers)
    );
}

const testFiles = resolveTestFiles(testDir, testMatch, testIgnore).map((f) =>
    path.relative(process.cwd(), f)
);

if (testFiles.length === 0) {
    console.error("❌ Es wurden keine Testdateien gefunden!");
    process.exit(1);
}

const tree = buildTree(testFiles);
let visibleNodes = flattenTree(tree);

const selected: Set<string> = new Set();
let cursor = 0;
let searchQuery = "";

function filterTreeByQuery(nodes: TreeNode[], query: string): TreeNode[] {
    if (!query) return nodes;

    const lowerQuery = query.toLowerCase();

    function filterNode(node: TreeNode): TreeNode | null {
        if (node.isFolder && node.children) {
            const filteredChildren = node.children
                .map(filterNode)
                .filter((n): n is TreeNode => n !== null);
            if (
                filteredChildren.length > 0 ||
                node.name.toLowerCase().includes(lowerQuery)
            ) {
                return {
                    ...node,
                    children: filteredChildren,
                    isOpen: filteredChildren.length > 0 ? true : node.isOpen,
                };
            }
            return null;
        } else {
            if (node.path && node.path.toLowerCase().includes(lowerQuery)) {
                return node;
            }
            return null;
        }
    }

    return nodes.map(filterNode).filter((n): n is TreeNode => n !== null);
}

function render() {
    term.moveTo(1, 1);
    term.eraseDisplayBelow();

    term
        .blue("? ")("Wähle die Tests aus, die du ausführen möchtest:\n")
        .bold("(")
        .bold.cyan("↑/↓")(" zum navigieren, ")
        .bold.cyan("→/←")(" Ordner öffnen/schließen, ")
        .bold.cyan("<space>")(" zum auswählen, ")
        .bold.cyan("<tab>")(" alle auswählen, ")
        .bold.bgGreen("<enter>")
        .bold(" zum ausführen, ")
        .bold.bgRed("<escape>")
        .bold(" zum abbrechen oder ")
        .bold.cyan("tippen")
        .bold(" zum suchen):")("\n\n");

    const maxLines = term.height - 5;
    let start = Math.max(0, cursor - Math.floor(maxLines / 2));
    let end = Math.min(visibleNodes.length, start + maxLines);

    visibleNodes.slice(start, end).forEach(({ node, depth }, idx) => {
        const isHover = idx + start === cursor;
        let isSelected = false;

        if (node.isFolder) {
            // folder selected if all descendant files are selected
            function allDescendantsSelected(n: TreeNode): boolean {
                if (n.isFolder && n.children) {
                    return n.children.every(allDescendantsSelected);
                } else if (n.path) {
                    return selected.has(n.path);
                }
                return true;
            }
            isSelected = allDescendantsSelected(node);
        } else if (node.path) {
            isSelected = selected.has(node.path);
        }

        // Cursor
        if (isHover) {
            term.cyan("❯");
        } else {
            term(" ");
        }

        // Indentation
        term("  ".repeat(depth));

        // Folder icon
        if (node.isFolder) {
            if (node.isOpen) {
                term.cyan("▼ ");
            } else {
                term.cyan("▶ ");
            }
        } else {
            term("  ");
        }

        // Circle
        if (isSelected) {
            term.green("● ");
        } else if (isHover) {
            term.cyan("◯ ");
        } else {
            term("◯ ");
        }

        // Filename or folder name
        if (isHover) {
            term.cyan(node.name + (node.isFolder ? "/" : "") + "\n");
        } else {
            term(node.name + (node.isFolder ? "/" : "") + "\n");
        }
    });

    term("\nSuchbegriff: " + searchQuery);
}

function filterFiles() {
    const filteredTree = filterTreeByQuery(tree, searchQuery);
    visibleNodes = flattenTree(filteredTree);
    cursor = 0;
}

function toggleSelectNode(node: TreeNode) {
    if (node.isFolder) {
        // toggle all descendant files
        function collectFiles(n: TreeNode, files: string[]) {
            if (n.isFolder && n.children) {
                for (const child of n.children) {
                    collectFiles(child, files);
                }
            } else if (n.path) {
                files.push(n.path);
            }
        }
        const files: string[] = [];
        collectFiles(node, files);
        const allSelected = files.every((f) => selected.has(f));
        if (allSelected) {
            for (const f of files) {
                selected.delete(f);
            }
        } else {
            for (const f of files) {
                selected.add(f);
            }
        }
    } else if (node.path) {
        if (selected.has(node.path)) {
            selected.delete(node.path);
        } else {
            selected.add(node.path);
        }
    }
}

async function main() {
    render();

    term.grabInput({ mouse: false, keys: true });

    term.on("key", (name: string, matches: string[], data: any) => {
        if (name === "UP") {
            cursor = (cursor - 1 + visibleNodes.length) % visibleNodes.length;
        } else if (name === "DOWN") {
            cursor = (cursor + 1) % visibleNodes.length;
        } else if (name === "SHIFT_UP") {
            cursor = Math.max(0, cursor - 5);
        } else if (name === "SHIFT_DOWN") {
            cursor = Math.min(visibleNodes.length - 1, cursor + 5);
        } else if (name === "LEFT") {
            const { node } = visibleNodes[cursor];
            if (node.isFolder && node.isOpen) {
                node.isOpen = false;
                visibleNodes = flattenTree(
                    filterTreeByQuery(tree, searchQuery)
                );
                if (cursor >= visibleNodes.length) {
                    cursor = visibleNodes.length - 1;
                }
            }
        } else if (name === "RIGHT") {
            const { node } = visibleNodes[cursor];
            if (node.isFolder && !node.isOpen) {
                node.isOpen = true;
                visibleNodes = flattenTree(
                    filterTreeByQuery(tree, searchQuery)
                );
            }
        } else if (name === " ") {
            const { node } = visibleNodes[cursor];
            toggleSelectNode(node);
        } else if (name === "TAB") {
            // Toggle select/deselect all files
            const allSelected = testFiles.every((f) => selected.has(f));
            if (allSelected) {
                selected.clear();
            } else {
                for (const f of testFiles) {
                    selected.add(f);
                }
            }
        } else if (name === "ENTER") {
            term.removeAllListeners("key");
            term.moveTo(1, 1);
            term.eraseDisplayBelow();
            run();
        } else if (name === "BACKSPACE") {
            searchQuery = searchQuery.slice(0, -1);
            filterFiles();
        } else if (name === "CTRL_C" || name == "ESCAPE") {
            term.removeAllListeners("key");
            term.moveTo(1, 1);
            term.eraseDisplayBelow();
            process.exit(0);
        } else if (name.length === 1) {
            searchQuery += name;
            filterFiles();
        }

        render();
    });
}

main();

function run() {
    // collect selected files recursively
    function collectSelectedFiles(n: TreeNode, files: string[]) {
        if (n.isFolder && n.children) {
            for (const c of n.children) {
                collectSelectedFiles(c, files);
            }
        } else if (n.path && selected.has(n.path)) {
            files.push(n.path);
        }
    }
    const selectedFiles: string[] = [];
    for (const node of tree) {
        collectSelectedFiles(node, selectedFiles);
    }

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
}
