// Import necessary modules
import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import session from "express-session";
import mysql from "mysql2";
import open from "open";

const app = express();
const port = 3000;

const saltRounds = 10;

// MySQL connection configuration
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "owiana_craft"
});

// Connect to MySQL
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
    }
    console.log('Connected to MySQL as id ' + connection.threadId);
});

// Middleware setup
app.use(express.static("views"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));

// Session middleware configuration
app.use(session({
    secret: 'your-secret-key', // Change this to a random string for better security
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set secure: true in production with HTTPS
}));    

// Middleware to pass userLoggedIn to all templates
app.use((req, res, next) => {
    res.locals.userLoggedIn = req.session.userId ? true : false;
    next();
});

// Routes
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/edukasi", (req, res) => {
    res.render("merajutpage");
});

app.get("/produk", (req, res) => {
    res.render("produk");
});

app.get("/tentang", (req, res) => {
    res.render("tentang");
});

app.get("/register", (req, res) => {
    if (req.session.userId) {
        res.redirect("/");
    } else {
        res.render("signUp");
    }
});

app.post("/register", (req, res) => {
    const { fullname, email, username, password, address } = req.body;

    bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password: ' + err);
            res.send("Error registering user");
            return;
        }

        const insertUserQuery = 'INSERT INTO users (fullname, email, username, password, address) VALUES (?, ?, ?, ?, ?)';
        connection.query(insertUserQuery, [fullname, email, username, hashedPassword, address], (err, result) => {
            if (err) {
                console.error('Error registering user in database: ' + err);
                res.send("Error registering user");
                return;
            }

            console.log('User registered successfully');
            req.session.userId = result.insertId; // Store auto-incremented ID in session
            res.redirect('/');
        });
    });
});

app.get("/login", (req, res) => {
    if (req.session.userId) {
        res.redirect("/");
    } else {
        res.render("signIn");
    }
});

app.post("/login", (req, res) => {
    const { emailusername, password } = req.body;

    // Check if username or email exists in database
    const findUserQuery = 'SELECT * FROM users WHERE username = ? OR email = ?';
    connection.query(findUserQuery, [emailusername, emailusername], (err, results) => {
        if (err) {
            console.error('Error finding user: ' + err);
            res.send("Error finding user");
            return;
        }

        if (results.length === 0) {
            res.send("No user found");
            return;
        }

        const user = results[0];

        // Compare hashed password with input password
        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.error('Error comparing passwords: ' + err);
                res.send("Error logging in");
                return;
            }

            if (result) {
                req.session.userId = user.id; // Store user id in session
                res.redirect("/");
            } else {
                res.send("Passwords do not match");
            }
        });
    });
});

// Logout route
app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session: ' + err);
            res.send("Error logging out");
            return;
        }
        res.redirect("/");
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Listening to port: ${port}`);
    const serverUrl = `http://localhost:${port}`;
    console.log(`Server URL: ${serverUrl}`);
    open(serverUrl); // Open default browser
});
