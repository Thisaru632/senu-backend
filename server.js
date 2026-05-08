const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/bookings", require("./routes/bookingRoutes"));

const connectDB = require("./config/db");

// Database connection
connectDB().catch(err => {
  console.error("Failed to connect to MongoDB:", err);
  process.exit(1);
});


const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});