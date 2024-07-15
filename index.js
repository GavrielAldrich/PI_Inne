// Import necessary modules
import express from "express";
import session from "express-session";
import mysql from "mysql2";
import multer from "multer";
import bcrypt from "bcrypt";

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

// Set the view engine to ejs and specify the views directory
app.set("view engine", "ejs");
app.set("views", "views"); // Assuming your views are stored in a directory named 'views'

// Serve static files from the 'public' directory (if you have one)
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Add this line to parse JSON requests

// Session middleware configuration
app.use(session({
    secret: 'your-secret-key', // Change this to a random string for better security
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set secure: true in production with HTTPS
}));

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images'); // Directory where uploaded files will be stored
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // Unique filename for each uploaded file
    }
});

const upload = multer({ storage: storage });

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    // Check if user is authenticated and has role 'admin'
    if (req.session.userId && req.session.userRole === "admin") {
        return next();
    }
    // If not authenticated or not admin, redirect to sign-in page or handle unauthorized access
    res.send("You are not an admin"); // Modify as needed
};

// Middleware to restrict access to authenticated users only
const isAuthenticated = (req, res, next) => {
    if(req.session.userId){
        return next()
    }
    res.redirect("/login")
  };

// Middleware to pass userLoggedIn to all templates
app.use((req, res, next) => {
    res.locals.userLoggedIn = req.session.userId ? true : false;
    next();
});

// Routes
app.get("/", (req, res) => {
    res.render("index");
});

// Route to render admin page with products list
app.get("/adminpage", isAdmin, (req, res) => {
    const query = "SELECT * FROM products";
    connection.query(query, (err, products) => {
        if (err) {
            console.error("Error retrieving products:", err);
            res.status(500).send("Error retrieving products");
            return;
        }
        res.render("adminpage", { products }); // Render adminpage and pass products data
    });
});

// Route to render form for adding new product
app.get("/tambahproduk", isAdmin, (req, res) => {
    res.render("tambahproduk"); // Render form to add new product
});

// POST route to handle adding new product with image upload
app.post("/tambahproduk", isAdmin, upload.single('image'), (req, res) => {
    const { category, name, price, desc } = req.body;
    const image = req.file.filename; // Multer stores uploaded file details in req.file

    // Insert new product into database
    const insertProductQuery = "INSERT INTO products (product_name, product_desc, product_price, product_image, product_type) VALUES (?, ?, ?, ?, ?)";
    connection.query(insertProductQuery, [name, desc, price, image, category], (err, result) => {
        if (err) {
            console.error("Error adding new product:", err);
            res.status(500).send("Error adding new product");
            return;
        }
        console.log("New product added successfully");
        res.redirect("/adminpage"); // Redirect back to adminpage after adding product
    });
});

// Route to render edit product form
app.get("/editproduk/:productId", isAdmin, (req, res) => {
    const productId = req.params.productId;
    // Fetch product details from database using productId
    const query = "SELECT * FROM products WHERE id = ?";
    connection.query(query, [productId], (err, product) => {
        if (err) {
            console.error("Error retrieving product:", err);
            res.status(500).send("Error retrieving product");
            return;
        }

        // Check if product exists
        if (!product || product.length === 0) {
            // Handle case where product is not found
            res.status(404).send("Product not found");
            return;
        }
        // console.log(product)
        // Render editproduk.ejs with product details
        res.render("editproduk", { product: product[0] });
    });
});


// POST route to handle updating product with image edit
app.post("/editproduk/:productId", isAdmin, upload.single('image'), (req, res) => {
    const productId = req.params.productId;
    const { category, name, price, desc } = req.body;

    let image = req.file ? req.file.filename : req.body.currentImage;

    // Update product in database
    const updateProductQuery = "UPDATE products SET product_name = ?, product_price = ?, product_image = ?, product_type = ?, product_desc = ? WHERE id = ?";
    connection.query(updateProductQuery, [name, price, image, category, desc, productId], (err, result) => {
        if (err) {
            console.error("Error updating product:", err);
            res.status(500).send("Error updating product");
            return;
        }
        console.log("Product updated successfully");
        res.redirect("/adminpage");
    });
});

// Route to handle deleting a product
app.get("/delete/:productId", isAdmin, (req, res) => {
    const productId = req.params.productId;
    // Delete product from database using productId
    const deleteQuery = "DELETE FROM products WHERE id = ?";
    connection.query(deleteQuery, [productId], (err, result) => {
        if (err) {
            console.error("Error deleting product:", err);
            res.status(500).send("Error deleting product");
            return;
        }
        console.log("Product deleted successfully");
        res.redirect("/adminpage");
    });
});

// Route to display order view (admin only)
app.get("/orderview", isAdmin, (req, res) => {
    const query = "SELECT * FROM orders";
    connection.query(query, (err, orders) => {
        if (err) {
            console.error("Error retrieving orders:", err);
            res.status(500).send("Error retrieving orders");
            return;
        }
        res.render("orderview", { products: orders }); // Render orderview and pass orders data
    });
});

// Route to handle deleting an order
app.get("/deleteorder/:orderId", isAdmin, (req, res) => {
    const orderId = req.params.orderId;
    // Delete order from database using orderId
    const deleteQuery = "DELETE FROM orders WHERE id = ?";
    connection.query(deleteQuery, [orderId], (err, result) => {
        if (err) {
            console.error("Error deleting order:", err);
            res.status(500).send("Error deleting order");
            return;
        }
        console.log("Order deleted successfully");
        res.redirect("/orderview"); // Redirect back to orderview after deletion
    });
});

// Route to render other pages
app.get("/edukasi", (req, res) => {
    res.render("merajutpage");
});

// Route to render produk page with products fetched from database
app.get("/produk", (req, res) => {
    // Fetch products from database
    const query = "SELECT * FROM products";
    connection.query(query, (err, products) => {
        if (err) {
            console.error("Error retrieving products:", err);
            res.status(500).send("Error retrieving products");
            return;
        }
        res.render("produk", { products }); // Render produk.ejs and pass products data
    });
});

// Route to render product detail page
app.get("/detail/:productid",isAuthenticated, (req, res) => {
    const productId = req.params.productid;
    const query = "SELECT * FROM products WHERE id = ?";
    connection.query(query, [productId], (err, results) => {
        if (err) {
            console.error("Error retrieving product:", err);
            res.status(500).send("Error retrieving product");
            return;
        }

        if (results.length === 0) {
            // Handle case where product is not found
            res.status(404).send("Product not found");
            return;
        }

        const product = results[0]; // Assuming only one product is fetched
        res.render("detail", { product });
    });
});

// Route to handle checkout process
app.post("/checkout", isAuthenticated, (req, res) => {
    const { size, quantity, productId } = req.body;
    const { userId } = req.session;
    
    // Fetch product details from `products` table
    const getProductQuery = `SELECT product_name, product_price, product_type FROM products WHERE id = ?`;

    connection.query(getProductQuery, [productId], (err, productResults) => {
        if (err) {
            console.error('Error fetching product details:', err);
            return res.status(500).json({ error: 'Error fetching product details' });
        }

        if (productResults.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const { product_name, product_price, product_type } = productResults[0];
        const total_price = product_price * quantity;

        // Fetch user details from `users` table
        const getUserQuery = `SELECT fullname AS buyer_fullname, email AS buyer_email, address AS buyer_address FROM users WHERE id = ?`;

        connection.query(getUserQuery, [userId], (err, userResults) => {
            if (err) {
                console.error('Error fetching user details:', err);
                return res.status(500).json({ error: 'Error fetching user details' });
            }

            if (userResults.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const { buyer_fullname, buyer_email, buyer_address } = userResults[0];

            // Insert into `orders` table
            const insertOrderQuery = `
                INSERT INTO orders 
                (kategori_produk, nama_produk, qty, total_harga, buyer_fullname, buyer_email, buyer_address, buyer_note, product_size) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const orderValues = [
                product_type,
                product_name,
                quantity,
                total_price,
                buyer_fullname,
                buyer_email,
                buyer_address,
                'Buyer Note', // Replace with actual buyer note
                size
            ];

            connection.query(insertOrderQuery, orderValues, (err, insertResult) => {
                if (err) {
                    console.error('Error inserting order:', err);
                    return res.status(500).json({ error: 'Error inserting order' });
                }

                // Order successfully inserted
                console.log('Order successfully inserted:', insertResult);

                // You might want to send a response indicating success
                res.render('notifikasipesanan')
            });
        });
    });
});

app.get("/tentang", (req, res) => {
    res.render("tentang");
});

// Route to handle user registration
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

        const defaultRole = 'user';
        const insertUserQuery = 'INSERT INTO users (fullname, email, username, password, address, role) VALUES (?, ?, ?, ?, ?, ?)';
        connection.query(insertUserQuery, [fullname, email, username, hashedPassword, address, defaultRole], (err, result) => {
            if (err) {
                console.error('Error registering user in database: ' + err);
                res.send("Error registering user");
                return;
            }

            console.log('User registered successfully');
            res.redirect('/');
        });
    });
});

// Route to handle user login
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
                req.session.userRole = user.role; // Store user role in session
                res.redirect("/");
            } else {
                res.send("Passwords do not match");
            }
        });
    });
});

// Route to handle user logout
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
});
