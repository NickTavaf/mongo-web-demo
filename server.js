const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// serve static files from /docs
const publicPath = path.join(__dirname, "docs");
app.use(express.static(publicPath));

const mongoUri = process.env.MONGO_URI;
const port = process.env.PORT || 4000;

console.log("Using MONGO_URI:", mongoUri);

// ----- connect to MongoDB FIRST -----
mongoose
  .connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log("✅ Connected to MongoDB Atlas");

    // only start the server AFTER we connect to DB
    app.listen(port, () => {
      console.log(`🚀 Server listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // crash immediately so you see the real error
  });

// simple Note schema
const noteSchema = new mongoose.Schema({
  text: { type: String, required: true },

  // NEW: extra fields from your review form + geocoding
  restaurant: { type: String },
  location: { type: String },
  scale: { type: Number },
  review: { type: String },
  lat: { type: Number },
  lon: { type: Number },

  createdAt: { type: Date, default: Date.now },
});

const Note = mongoose.model("Note", noteSchema);

// routes
app.get("/api/notes", async (req, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    console.error("GET /api/notes error:", err);
    res.status(500).json({ error: "Failed to load notes" });
  }
});

app.post("/api/notes", async (req, res) => {
  try {
    // NEW: pull all fields from the body
    const {
      text,
      restaurant,
      location,
      scale,
      review,
      lat,
      lon,
    } = req.body;

    const newNote = await Note.create({
      text,
      restaurant,
      location,
      scale,
      review,
      lat,
      lon,
    });

    res.status(201).json(newNote);
  } catch (err) {
    console.error("POST /api/notes error:", err);
    res.status(500).json({ error: "Could not create note" });
  }
});
