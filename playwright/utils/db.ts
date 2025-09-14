import express from "express";
import mysql, { type ResultSetHeader } from "mysql2";

const app = express();
app.use(express.text({ type: "*/*" }));
const port = 3000;

type SqlResult = {
    results?: any;
    lastId?: number;
    affectedRows?: number;
};

// Verbindung konfigurieren
const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "main",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
});

// /sql Endpoint
app.post("/sql", (req, res) => {
    const sql = req.body;

    if (typeof sql !== "string" || !sql.trim()) {
        return res
            .status(400)
            .json({ error: "Bitte SQL als Text im Body senden" });
    }

    // console.log("SQL: ", sql.replace(/\s+/g, " ").replace(/;/g, ";\n"));

    pool.query(sql.replace(/\s+/g, " "), (err, results) => {
        if (err) {
            console.error("SQL Fehler:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.listen(port, () => {
    console.log(`🚀 Server läuft auf http://localhost:${port}`);
});
