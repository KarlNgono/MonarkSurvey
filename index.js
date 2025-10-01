require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const PostgresStorage = require("./db-adapters/postgres");

const apiBaseAddress = "/api";

const app = express();
const storage = PostgresStorage();

app.use(helmet());
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7},
    })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true,
    })
);
app.get(apiBaseAddress + "/getUsers", async (req, res) => {
    try {
        const result = await storage.dbQuery("SELECT id, name, email FROM users ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        console.error("Get users error:", err);
        res.status(500).json({message: "Server error"});
    }
});
app.delete(apiBaseAddress + "/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await storage.dbQuery("DELETE FROM users WHERE id = $1", [id]);
        res.json({ message: "Utilisateur supprimé", id });
    } catch (err) {
        console.error("Delete user error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

app.post(apiBaseAddress + "/updateUser/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const { name, email, password } = req.body;
        if (!name || !email) return res.status(400).json({ message: "Missing fields" });

        let query = "UPDATE users SET name=$1, email=$2";
        const values = [name, email];

        if (password) {
            const hashed = await bcrypt.hash(password, 10);
            query += ", password=$3";
            values.push(hashed);
        }

        query += " WHERE id=$" + (values.length + 1) + " RETURNING id, name, email";
        values.push(id);

        const result = await storage.dbQuery(query, values);
        const updatedUser = result.rows[0];
        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        res.json({ message: "User updated", user: updatedUser });
    } catch (err) {
        console.error("Update user error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

app.post(apiBaseAddress + "/changePassword", async (req, res) => {
    try {
        const { id, newPassword } = req.body;
        if (!id || !newPassword) return res.status(400).json({ message: "Missing fields" });

        const hashed = await bcrypt.hash(newPassword, 10);
        await storage.dbQuery("UPDATE users SET password=$1 WHERE id=$2", [hashed, id]);
        res.json({ message: "Password updated" });
    } catch (err) {
        console.error("Change password error:", err);
        res.status(500).json({ message: "Server error" });
    }
});
app.post(apiBaseAddress + "/signup", async (req, res) => {
    try {
        const {name, email, password} = req.body;
        if (!name || !email || !password) return res.status(400).json({message: "Missing fields"});

        const existing = await storage.dbQuery("SELECT id FROM users WHERE email=$1", [email]);
        if (existing.rows.length > 0) return res.status(409).json({message: "Email already exists"});

        const hashed = await bcrypt.hash(password, 10);
        const result = await storage.dbQuery(
            "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
            [name, email, hashed]
        );
        const user = result.rows[0];
        req.session.userId = user.id;
        res.json({message: "User created", user});
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({message: "Server error"});
    }
});

app.post(apiBaseAddress + "/login", async (req, res) => {
    try {
        const {email, password} = req.body;
        if (!email || !password) return res.status(400).json({message: "Missing fields"});

        const result = await storage.dbQuery("SELECT id, name, email, password FROM users WHERE email=$1", [email]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({message: "Invalid credentials"});

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({message: "Invalid credentials"});

        req.session.userId = user.id;
        res.json({message: "Login successful", user: {id: user.id, name: user.name, email: user.email}});
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({message: "Server error"});
    }
});

app.post(apiBaseAddress + "/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({message: "Logout failed"});
        res.clearCookie("connect.sid");
        res.json({message: "Logged out"});
    });
});

app.get(apiBaseAddress + "/me", async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({message: "Not authenticated"});

        const result = await storage.dbQuery("SELECT id, name, email FROM users WHERE id=$1", [req.session.userId]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({message: "Not authenticated"});

        res.json(user);
    } catch (err) {
        console.error("Me error:", err);
        res.status(500).json({message: "Server error"});
    }
});

app.get(apiBaseAddress + "/getActive", (req, res) => storage.getSurveys(result => res.json(result)));
app.get(apiBaseAddress + "/getSurvey", (req, res) => {
    const surveyId = req.query["surveyId"];
    storage.getSurvey(surveyId, result => res.json(result));
});
app.get(apiBaseAddress + "/changeName", (req, res) => {
    const id = req.query["id"];
    const name = req.query["name"];
    storage.changeName(id, name, result => res.json(result));
});
app.get(apiBaseAddress + "/create", (req, res) => {
    const name = req.query["name"];
    storage.addSurvey(name, survey => res.json(survey));
});
app.post(apiBaseAddress + "/changeJson", (req, res) => {
    const {id, json} = req.body;
    storage.storeSurvey(id, null, json, survey => res.json(survey));
});
app.post(apiBaseAddress + "/post", (req, res) => {
    const {postId, surveyResult} = req.body;
    storage.postResults(postId, surveyResult, result => res.json(result.json));
});
app.get(apiBaseAddress + "/delete", (req, res) => {
    const id = req.query["id"];
    storage.deleteSurvey(id, () => res.json({id}));
});
app.get(apiBaseAddress + "/results", (req, res) => {
    const postId = req.query["postId"];
    storage.getResults(postId, result => res.json(result));
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log("Listening on port " + port + "...");
});
