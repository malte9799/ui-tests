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

    type SQLNode = {
        sql: string;
        into?: string;
        from?: string;
    };

    const sqlNodes: SQLNode[] = [];
    const files = walkDir(testDir);
    for (const file of files) {
        const mod = require(file);
        if (typeof mod.default == "object") {
            const sql = mod.default.createQuery;
            if (sql) {
                const intoMatch = sql.match(/INTO (\w+)/i);
                const fromMatch = sql.match(/FROM (\w+)/i);
                sqlNodes.push({
                    sql,
                    into: intoMatch ? intoMatch[1] : undefined,
                    from: fromMatch ? fromMatch[1] : undefined,
                });
            }
        }
    }

    // Build dependency map
    const graph = new Map<SQLNode, SQLNode[]>();

    for (const node of sqlNodes) {
        graph.set(node, []);
        for (const dep of sqlNodes) {
            if (node.from && dep.into && node.from === dep.into) {
                graph.get(node)!.push(dep); // dep must come before node
            }
        }
    }

    // Topological sort
    const visited = new Set<SQLNode>();
    const result: SQLNode[] = [];

    function visit(node: SQLNode) {
        if (visited.has(node)) return;
        visited.add(node);
        for (const dep of graph.get(node)!) {
            visit(dep);
        }
        result.push(node);
    }

    for (const node of sqlNodes) {
        visit(node);
    }

    const setupSQL = result.map((n) => n.sql).join("\n");
    await sendSQLpw(setupSQL, config);

    process.env.IGNORE_TESTS = "false";
}
