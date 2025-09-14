import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkDir(fullPath));
        } else if (
            entry.isFile() &&
            (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) &&
            entry.name.includes(".spec.")
        ) {
            files.push(fullPath);
        }
    }
    return files;
}

export async function sendSQLpw(sql: string, config: FullConfig) {
    if (!sql) return;
    sql = sql.replace(/\s+/g, " ");

    await fetch("http://localhost:3000/sql", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: sql,
    });

    return;
}
