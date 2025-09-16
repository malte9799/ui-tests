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

type FlatNode = { node: TreeNode; depth: number };

class TestTreeManager {
    public cursor = 0;
    public visibleNodes: FlatNode[] = [];
    private tree: TreeNode[] = [];
    private selected = new Set<string>();
    private searchQuery = "";
    private testFiles: string[];

    constructor(testFiles: string[]) {
        this.testFiles = testFiles;
        this.tree = this.buildTree(testFiles);
        this.updateVisibleNodes();
    }

    private buildTree(testFiles: string[]): TreeNode[] {
        const root: TreeNode[] = [];
        const nodeMap = new Map<string, TreeNode>();

        for (const filePath of testFiles) {
            const parts = filePath
                .split(path.sep)
                .slice(filePath.startsWith("tests") ? 1 : 0);
            let currentPath = "";
            let currentLevel = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isFolder = i < parts.length - 1;
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                let node = nodeMap.get(currentPath);
                if (!node) {
                    node = {
                        name: part,
                        isFolder,
                        isOpen: false,
                        ...(isFolder ? { children: [] } : { path: filePath }),
                    };
                    nodeMap.set(currentPath, node);
                    currentLevel.push(node);
                }

                if (isFolder && node.children) {
                    currentLevel = node.children;
                }
            }
        }
        return root;
    }

    private flattenTree(nodes: TreeNode[], depth = 0): FlatNode[] {
        return nodes.flatMap((node) => [
            { node, depth },
            ...(node.isFolder && node.isOpen && node.children
                ? this.flattenTree(node.children, depth + 1)
                : []),
        ]);
    }

    private filterTreeByQuery(nodes: TreeNode[], query: string): TreeNode[] {
        if (!query) return nodes;

        const lowerQuery = query.toLowerCase();
        const filterNode = (node: TreeNode): TreeNode | null => {
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
                        isOpen: filteredChildren.length > 0 || node.isOpen,
                    };
                }
            } else if (node.path?.toLowerCase().includes(lowerQuery)) {
                return node;
            }
            return null;
        };

        return nodes.map(filterNode).filter((n): n is TreeNode => n !== null);
    }

    private updateVisibleNodes() {
        const filteredTree = this.filterTreeByQuery(
            this.tree,
            this.searchQuery
        );
        this.visibleNodes = this.flattenTree(filteredTree);
        this.cursor = Math.min(
            this.cursor,
            Math.max(0, this.visibleNodes.length - 1)
        );
    }

    private collectFiles(node: TreeNode): string[] {
        if (node.isFolder && node.children) {
            return node.children.flatMap((child) => this.collectFiles(child));
        }
        return node.path ? [node.path] : [];
    }

    private isNodeSelected(node: TreeNode): boolean {
        if (node.isFolder) {
            const files = this.collectFiles(node);
            return files.length > 0 && files.every((f) => this.selected.has(f));
        }
        return node.path ? this.selected.has(node.path) : false;
    }

    private renderNodeLine(
        flatNode: FlatNode,
        isHover: boolean,
        isSticky = false
    ) {
        const { node, depth } = flatNode;
        const isSelected = this.isNodeSelected(node);

        // Cursor indicator
        term(isHover && !isSticky ? "❯" : " ");

        // Indentation
        term("  ".repeat(depth));

        // Folder icon
        if (node.isFolder) {
            term.cyan(node.isOpen ? "▼ " : "▶ ");
        } else {
            term("  ");
        }

        // Selection circle
        if (isSelected) {
            term.green("● ");
        } else if (isHover && !isSticky) {
            term.cyan("◯ ");
        } else {
            term("◯ ");
        }

        // Node name
        const displayName = node.name + (node.isFolder ? "/" : "");
        if (isHover && !isSticky) {
            term.cyan(displayName + "\n");
        } else {
            term(displayName + "\n");
        }
    }

    render() {
        term.moveTo(1, 1);
        term.eraseDisplayBelow();

        // Header
        term.blue("? ")("Wähle die Tests aus, die du ausführen möchtest:\n")
            .bold("(")
            .bold.cyan("↑/↓")(" navigieren, ")
            .bold.cyan("→/←")(" öffnen/schließen, ")
            .bold.cyan("<space>")(" auswählen, ")
            .bold.cyan("<tab>")(" alle, ")
            .bold.bgGreen("<enter>")
            .bold(" ausführen, ")
            .bold.bgRed("<escape>")
            .bold(" abbrechen, ")
            .bold.cyan("tippen")
            .bold(" suchen):\n");

        // Show selected tests count
        const selectedCount = this.getSelectedFiles().length;
        term
            .green(selectedCount > 0 ? selectedCount : "0")("/")
            .red(this.testFiles.length)("\n");

        // Calculate available space for content
        const maxLines = term.height - 5;

        // Helper to get all sticky folders for a given start position
        const getStickyFolders = (
            startPos: number,
            visibleSlice: FlatNode[]
        ) => {
            const visibleNodes = visibleSlice.map(({ node }) => node);
            const stickyFolders: FlatNode[] = [];

            // Find all open folder ancestors that aren't visible in the slice
            for (let i = 0; i < startPos; i++) {
                const { node, depth } = this.visibleNodes[i];
                if (
                    node.isFolder &&
                    node.isOpen &&
                    !visibleNodes.includes(node)
                ) {
                    // Check if this folder is an ancestor of something in the visible slice
                    const hasVisibleDescendants = visibleSlice.some(
                        ({ depth: vDepth }) => vDepth > depth
                    );
                    if (hasVisibleDescendants) {
                        stickyFolders.push({ node, depth });
                    }
                }
            }
            return stickyFolders;
        };

        // Iteratively calculate viewport accounting for sticky folders
        let start = Math.max(0, this.cursor - Math.floor(maxLines / 2));
        let stickyCount = 0;
        let finalStickyFolders: FlatNode[] = [];

        // Iterate until sticky count stabilizes
        for (let iterations = 0; iterations < 5; iterations++) {
            const availableLines = maxLines - stickyCount;
            const newStart = Math.max(
                0,
                this.cursor - Math.floor(availableLines / 2)
            );
            const end = Math.min(
                this.visibleNodes.length,
                newStart + availableLines
            );
            const visibleSlice = this.visibleNodes.slice(newStart, end);

            const newStickyFolders = getStickyFolders(newStart, visibleSlice);
            const newStickyCount = newStickyFolders.length;

            if (newStickyCount === stickyCount && newStart === start) {
                // Stabilized
                finalStickyFolders = newStickyFolders;
                start = newStart;
                break;
            }

            stickyCount = newStickyCount;
            start = newStart;

            if (iterations === 4) {
                // Fallback: use current values
                finalStickyFolders = newStickyFolders;
            }
        }

        // Final viewport calculation
        const availableLines = maxLines - finalStickyFolders.length;
        const finalStart = Math.max(
            0,
            this.cursor - Math.floor(availableLines / 2)
        );
        const finalEnd = Math.min(
            this.visibleNodes.length,
            finalStart + availableLines
        );
        const finalVisibleSlice = this.visibleNodes.slice(finalStart, finalEnd);

        // Render sticky folders
        finalStickyFolders.forEach((flatNode) =>
            this.renderNodeLine(flatNode, false, true)
        );

        // Render visible nodes
        finalVisibleSlice.forEach((flatNode, idx) => {
            const isHover = idx + finalStart === this.cursor;
            this.renderNodeLine(flatNode, isHover);
        });

        // Search query
        term.moveTo(1, term.height);
        term.eraseLine();
        term("Suchbegriff: " + this.searchQuery);
    }

    toggleSelection() {
        const { node } = this.visibleNodes[this.cursor];
        const files = this.collectFiles(node);

        if (files.length === 0) return;

        const allSelected = files.every((f) => this.selected.has(f));
        files.forEach((f) =>
            allSelected ? this.selected.delete(f) : this.selected.add(f)
        );
    }

    toggleFolder(open?: boolean) {
        const { node } = this.visibleNodes[this.cursor];
        if (!node.isFolder) return false;

        node.isOpen = open ?? !node.isOpen;
        this.updateVisibleNodes();
        return true;
    }

    moveCursor(direction: "up" | "down", amount = 1) {
        const len = this.visibleNodes.length;
        if (len === 0) return;

        if (direction === "up") {
            this.cursor = (this.cursor - amount + len) % len;
        } else {
            this.cursor = (this.cursor + amount) % len;
        }
    }

    updateSearch(query: string) {
        this.searchQuery = query;
        this.updateVisibleNodes();
    }

    toggleAllSelection() {
        const allSelected = this.testFiles.every((f) => this.selected.has(f));
        if (allSelected) {
            this.selected.clear();
        } else {
            this.testFiles.forEach((f) => this.selected.add(f));
        }
    }

    getSelectedFiles(): string[] {
        return this.testFiles.filter((f) => this.selected.has(f));
    }
}

// Utility functions
function resolveTestFiles(
    testDir: string,
    testMatch: any,
    testIgnore: any
): string[] {
    const allFiles = glob.sync("**/*", { cwd: testDir, absolute: true });
    const matchers = Array.isArray(testMatch)
        ? testMatch
        : [testMatch ?? "**/*.@(spec|test).?(c|m)[jt]s?(x)"];
    const ignoreMatchers = Array.isArray(testIgnore)
        ? testIgnore
        : testIgnore
        ? [testIgnore]
        : [];

    const matchesPattern = (file: string, patterns: (string | RegExp)[]) => {
        return patterns.some((pattern) => {
            if (typeof pattern === "string") {
                return glob.hasMagic(pattern)
                    ? glob
                          .sync(pattern, { cwd: testDir, absolute: true })
                          .includes(file)
                    : new RegExp(pattern).test(file);
            }
            return pattern.test(file);
        });
    };

    return allFiles.filter(
        (file) =>
            matchesPattern(file, matchers) &&
            !matchesPattern(file, ignoreMatchers)
    );
}

function runTests(selectedFiles: string[]) {
    if (selectedFiles.length === 0) {
        console.log("⚠️ Es wurden keine Tests ausgewählt.");
        process.exit(0);
    }

    const fileString = selectedFiles.map((f) => `"${f}"`).join(" ");
    const cmd = `DEBUG=1 npx playwright test ${fileString} --project=debug --ui`;

    console.log("👉 Starte Tests:", cmd);

    try {
        execSync(cmd, { stdio: "inherit" });
        process.exit(0);
    } catch {
        process.exit(1);
    }
}

// Main execution
async function main() {
    const testFiles = resolveTestFiles(testDir, testMatch, testIgnore).map(
        (f) => path.relative(process.cwd(), f)
    );

    if (testFiles.length === 0) {
        console.error("❌ Es wurden keine Testdateien gefunden!");
        process.exit(1);
    }

    const treeManager = new TestTreeManager(testFiles);
    treeManager.render();

    function smoothMoveCursor(direction: "up" | "down", amount: number) {
        const cursorAtEnd = () =>
            (treeManager.cursor == 0 && direction == "up") ||
            (treeManager.cursor == treeManager.visibleNodes.length - 1 &&
                direction == "down");
        if (cursorAtEnd()) return;

        let steps = cursorAtEnd() ? 0 : amount;
        const stepDelay = 20; // milliseconds per step
        const moveStep = () => {
            if (steps <= 0) return;
            treeManager.moveCursor(direction, 1);
            treeManager.render();
            if (cursorAtEnd()) return;
            steps--;
            setTimeout(moveStep, stepDelay);
        };
        moveStep();
    }

    term.grabInput({ mouse: false, keys: true });

    term.on("key", (name: string) => {
        switch (name) {
            case "UP":
                treeManager.moveCursor("up");
                break;
            case "DOWN":
                treeManager.moveCursor("down");
                break;
            case "SHIFT_UP":
                smoothMoveCursor("up", 5);
                break;
            case "SHIFT_DOWN":
                smoothMoveCursor("down", 5);
                break;
            case "LEFT":
                treeManager.toggleFolder(false);
                break;
            case "RIGHT":
                treeManager.toggleFolder(true);
                break;
            case " ":
                treeManager.toggleSelection();
                break;
            case "TAB":
                treeManager.toggleAllSelection();
                break;
            case "ENTER":
                term.removeAllListeners("key");
                term.moveTo(1, 1);
                term.eraseDisplayBelow();
                runTests(treeManager.getSelectedFiles());
                return;
            case "BACKSPACE":
                treeManager.updateSearch(
                    treeManager["searchQuery"].slice(0, -1)
                );
                break;
            case "CTRL_C":
            case "ESCAPE":
                term.removeAllListeners("key");
                term.moveTo(1, 1);
                term.eraseDisplayBelow();
                process.exit(0);
            default:
                if (name.length === 1) {
                    treeManager.updateSearch(treeManager["searchQuery"] + name);
                }
        }
        treeManager.render();
    });
}

main();
