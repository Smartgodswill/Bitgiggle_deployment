const express = require("express");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const filePath = path.join(__dirname, "../comic.json");

/**
 * Sync JSON file with Supabase
 */
async function syncDatabaseWithJSON() {
  try {
    if (!fs.existsSync(filePath)) {
      console.error("❌ JSON file not found:", filePath);
      return;
    }

    const data = fs.readFileSync(filePath, "utf8");
    const comics = JSON.parse(data);

    const formattedComics = comics.map((comic) => ({
      title: comic.title,
      description: comic.description || "",
      genre: comic.genre || "",
      year: comic.year || null,
      cloudinary_url: Array.isArray(comic.images) ? comic.images : [],
    }));

    // Get current comics from Supabase
    const { data: currentComics, error: fetchError } = await supabase.from("comics").select("title");

    if (fetchError) {
      console.error("❌ Error fetching existing comics:", fetchError.message);
      return;
    }

    const existingTitles = currentComics.map((comic) => comic.title);
    const newTitles = formattedComics.map((comic) => comic.title);

    // Delete comics that are no longer in the JSON file
    const titlesToDelete = existingTitles.filter((title) => !newTitles.includes(title));

    if (titlesToDelete.length > 0) {
      const { error: deleteError } = await supabase.from("comics").delete().in("title", titlesToDelete);
      if (deleteError) console.error("❌ Error deleting removed comics:", deleteError.message);
      else console.log(`✅ Deleted comics: ${titlesToDelete.join(", ")}`);
    }

    // Insert or update comics from JSON file
    const { error: upsertError } = await supabase.from("comics").upsert(formattedComics, { onConflict: ["title"] });

    if (upsertError) {
      console.error("❌ Supabase error:", upsertError.message);
    } else {
      console.log("✅ Database successfully synced with JSON!");
    }
  } catch (error) {
    console.error("❌ Error syncing database:", error);
  }
}

/**
 * Watch for file changes and sync automatically
 */
fs.watch(filePath, (eventType) => {
  if (eventType === "change") {
    console.log("🔄 Detected change in comic.json, syncing...");
    setTimeout(syncDatabaseWithJSON, 1000); // Prevent multiple rapid syncs
  }
});

/**
 * Fetch comics from Supabase
 */
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.from("comics").select("*");
    if (error) throw error;

    // Ensure cloudinary_url is always an array
    const formattedData = data.map((comic) => ({
      ...comic,
      cloudinary_url: Array.isArray(comic.cloudinary_url) ? comic.cloudinary_url : JSON.parse(comic.cloudinary_url || "[]"),
    }));

    res.json(formattedData);
  } catch (err) {
    console.error("❌ Error fetching comics:", err.message);
    res.status(500).json({ error: "Failed to load comics" });
  }
});

/**
 * Add a new comic
 */
router.post("/add", async (req, res) => {
  try {
    const { title, description, genre, year, cloudinary_url } = req.body;

    const { data, error } = await supabase.from("comics").insert([
      {
        title,
        description,
        genre,
        year,
        cloudinary_url: Array.isArray(cloudinary_url) ? cloudinary_url : [],
      },
    ]);

    if (error) throw error;

    await syncDatabaseWithJSON();
    res.json({ message: "Comic added!", comic: data ? data[0] : null });
  } catch (err) {
    console.error("❌ Error adding comic:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update a comic
 */
router.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, genre, year, cloudinary_url } = req.body;

    const { data, error } = await supabase
      .from("comics")
      .update({
        title,
        description,
        genre,
        year,
        cloudinary_url: Array.isArray(cloudinary_url) ? cloudinary_url : [],
      })
      .eq("id", id);

    if (error) throw error;

    await syncDatabaseWithJSON();
    res.json({ message: "Comic updated!", comic: data ? data[0] : null });
  } catch (err) {
    console.error("❌ Error updating comic:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete a comic
 */
router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase.from("comics").delete().eq("id", id);

    if (error) throw error;

    await syncDatabaseWithJSON();
    res.json({ message: "Comic deleted!", comic: data ? data[0] : null });
  } catch (err) {
    console.error("❌ Error deleting comic:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
