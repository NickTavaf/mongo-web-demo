// Backend API URL - connects to Render backend
const API_URL = 'https://mongo-web-demo.onrender.com';

// ----- DOM elements -----
const form = document.getElementById("note-form");
const list = document.getElementById("notes-list");
const slider = document.getElementById("comfortScale");
const valueDisplay = document.querySelector(".scale-value");

// ----- Map setup (safe) -----
let map = null;
let singleMarker = null; // marker for the current submitted review
let markersLayer = null; // layer to hold ALL review markers

const mapContainer = document.getElementById("map");
if (mapContainer && typeof L !== "undefined") {
  // Default center (NYC)
  map = L.map("map").setView([40.7128, -74.006], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  // Layer group for all stored review markers
  markersLayer = L.layerGroup().addTo(map);
}

// Update slider value display
if (slider && valueDisplay) {
  slider.addEventListener("input", function () {
    valueDisplay.textContent = this.value + " / 10";
  });
}

// ----- Load notes into the list -----
async function loadNotes() {
  try {
    const res = await fetch(`${API_URL}/api/notes`); 
    if (!res.ok) {
      console.error("Failed to load notes:", res.status, res.statusText);
      return;
    }

    const notes = await res.json();

    list.innerHTML = "";

    if (notes.length === 0) {
      list.innerHTML = '<p class="no-reviews">No reviews yet. Be the first to share!</p>';
      return;
    }

    notes.forEach((note) => {
      const card = document.createElement("div");
      card.className = "review-card";

      const text = note.text;

      // Extract rating
      const ratingMatch = text.match(/Rating: (\d+)\/10/);
      const rating = ratingMatch ? ratingMatch[1] : "N/A";

      // Extract location info
      const restaurantMatch = text.match(/My review of (.+?) in /);
      const restaurant = restaurantMatch
        ? restaurantMatch[1].trim()
        : "Unknown Location";

      const locationMatch = text.match(/ in (.+?) is /);
      const location = locationMatch
        ? locationMatch[1].trim()
        : "Unknown Area";

      const reviewMatch = text.match(/ is (.+?) \(Rating:/);
      const reviewText = reviewMatch ? reviewMatch[1].trim() : text;

      // Extract sensory info
      const noiseMatch = text.match(/\[Noise: (.+?)\]/);
      const noise = noiseMatch ? noiseMatch[1] : null;

      const crowdMatch = text.match(/\[Crowd: (.+?)\]/);
      const crowd = crowdMatch ? crowdMatch[1] : null;

      const lightingMatch = text.match(/\[Lighting: (.+?)\]/);
      const lighting = lightingMatch ? lightingMatch[1] : null;

      // NEW: Extract texture info
      const textureMatch = text.match(/\[Texture: (.+?)\]/);
      const texture = textureMatch ? textureMatch[1] : null;

      const date = new Date(note.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      // Create sensory tags HTML
      let sensoryTags = "";
      if (noise && noise !== "not specified") {
        const noiseIcons = { quiet: "◇", moderate: "◆", loud: "◈" };
        sensoryTags += `<span class="sensory-tag"><span class="tag-icon">${
          noiseIcons[noise] || "♪"
        }</span>${noise}</span>`;
      }
      if (crowd && crowd !== "not specified") {
        const crowdIcons = { empty: "○", some: "◐", busy: "●" };
        sensoryTags += `<span class="sensory-tag"><span class="tag-icon">${
          crowdIcons[crowd] || "○"
        }</span>${crowd}</span>`;
      }
      if (lighting && lighting !== "not specified") {
        const lightIcons = { natural: "☼", soft: "◑", bright: "✦" };
        sensoryTags += `<span class="sensory-tag"><span class="tag-icon">${
          lightIcons[lighting] || "☼"
        }</span>${lighting}</span>`;
      }
      // NEW: Add texture tag
      if (texture && texture !== "not specified" && texture !== "not-applicable") {
        const textureIcons = { soft: "◡", mixed: "◠", crunchy: "◬" };
        sensoryTags += `<span class="sensory-tag"><span class="tag-icon">${
          textureIcons[texture] || "◡"
        }</span>${texture}</span>`;
      }

      card.innerHTML = `
        <div class="review-header">
          <div class="review-location">
            <strong>${restaurant.toUpperCase()}</strong>
            <span class="review-area">${location}</span>
          </div>
          <div class="review-rating">
            <span class="rating-number">${rating}</span>
            <span class="rating-label">/10</span>
          </div>
        </div>
        ${sensoryTags ? `<div class="sensory-tags">${sensoryTags}</div>` : ""}
        <div class="review-body">
          <p>${reviewText}</p>
        </div>
        <div class="review-footer">
          <span class="review-date">${date}</span>
        </div>
      `;

      list.appendChild(card);
    });
  } catch (err) {
    console.error("Error fetching /api/notes:", err);
  }
}

// ----- Load markers onto the map for ALL reviews -----
async function loadMarkers() {
  // If there is no map (for some reason), just skip
  if (!map || !markersLayer) return;

  try {
    const res = await fetch(`${API_URL}/api/notes`); 
    if (!res.ok) {
      console.error(
        "Failed to load notes for markers:",
        res.status,
        res.statusText
      );
      return;
    }

    const notes = await res.json();

    // Clear old markers so we don't double them
    markersLayer.clearLayers();

    notes.forEach((note) => {
      // Only make a marker if we have coordinates
      if (typeof note.lat === "number" && typeof note.lon === "number") {
        const marker = L.marker([note.lat, note.lon]).bindPopup(`
          <b>${note.restaurant || "Restaurant"}</b><br>
          ${note.location || ""}<br>
          Rating: ${note.scale ?? "?"}/10<br>
          ${note.review || ""}
        `);

        markersLayer.addLayer(marker);
      }
    });
  } catch (err) {
    console.error("Error fetching /api/notes for markers:", err);
  }
}

// ----- Geocode location string -> { lat, lon } -----
async function geocodeLocation(locationString) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    locationString
  )}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data || data.length === 0) {
    return null;
  }

  const lat = parseFloat(data[0].lat);
  const lon = parseFloat(data[0].lon);

  return { lat, lon };
}

// ----- Form submit handler -----
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const restaurant = document.getElementById("restaurant").value.trim();
  const location = document.getElementById("location").value.trim();
  const scale = slider.value;
  const review = document.getElementById("review").value.trim();

  // Get sensory selections
  const noise =
    document.querySelector('input[name="noise"]:checked')?.value ||
    "not specified";
  const crowd =
    document.querySelector('input[name="crowd"]:checked')?.value ||
    "not specified";
  const lighting =
    document.querySelector('input[name="lighting"]:checked')?.value ||
    "not specified";
  // NEW: Get texture selection
  const texture =
    document.querySelector('input[name="texture"]:checked')?.value ||
    "not specified";

  // Get features
  const features = Array.from(
    document.querySelectorAll('input[name="features"]:checked')
  ).map((cb) => cb.value);

  if (!restaurant || !location || !scale || !review) return;

  // Get lat/lon for this location
  const coords = await geocodeLocation(location);

  if (!coords) {
    alert("Could not find that location on the map.");
    return;
  }

  const { lat, lon } = coords;

  // Center map and show a "current" marker
  if (map) {
    map.setView([lat, lon], 15);

    if (singleMarker) {
      singleMarker.setLatLng([lat, lon]);
    } else {
      singleMarker = L.marker([lat, lon]).addTo(map);
    }
  }

  // Text used for the list (with sensory info including texture)
  const text = `My review of ${restaurant} in ${location} is ${review} (Rating: ${scale}/10) [Noise: ${noise}] [Crowd: ${crowd}] [Lighting: ${lighting}] [Texture: ${texture}] [Features: ${features.join(", ")}]`;

  // Send everything to backend (MongoDB via Render)
  await fetch(`${API_URL}/api/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      lat,
      lon,
      restaurant,
      location,
      scale,
      review,
    }),
  });

  // Clear form
  document.getElementById("restaurant").value = "";
  document.getElementById("location").value = "";
  slider.value = "7";
  valueDisplay.textContent = "7 / 10";
  document.getElementById("review").value = "";

  // Uncheck all radios and checkboxes
  document
    .querySelectorAll('input[type="radio"]')
    .forEach((r) => (r.checked = false));
  document
    .querySelectorAll('input[type="checkbox"]')
    .forEach((c) => (c.checked = false));

  // Set defaults back
  document.getElementById("noise-moderate").checked = true;
  document.getElementById("crowd-some").checked = true;
  document.getElementById("light-natural").checked = true;
  document.getElementById("texture-na").checked = true;

  // Reload list + markers so new review appears
  await loadNotes();
  await loadMarkers();
});

// Checkbox selection highlight
document.querySelectorAll(".checkbox-label").forEach((label) => {
  const checkbox = label.querySelector('input[type="checkbox"]');

  if (checkbox) {
    checkbox.addEventListener("change", function () {
      if (this.checked) {
        label.style.borderColor = "#6b9b82";
        label.style.background = "rgba(107, 155, 130, 0.1)";
      } else {
        label.style.borderColor = "#c9ddd3";
        label.style.background = "white";
      }
    });
  }
});

// Radio button selection highlight
document.querySelectorAll(".rating-option").forEach((option) => {
  const radio = option.querySelector('input[type="radio"]');

  if (radio) {
    radio.addEventListener("change", function () {
      document.querySelectorAll(`input[name="${this.name}"]`).forEach((r) => {
        r.closest(".rating-option").style.borderColor = "#c9ddd3";
        r.closest(".rating-option").style.background = "white";
      });

      if (this.checked) {
        option.style.borderColor = "#6b9b82";
        option.style.background = "rgba(107, 155, 130, 0.1)";
      }
    });

    if (radio.checked) {
      option.style.borderColor = "#6b9b82";
      option.style.background = "rgba(107, 155, 130, 0.1)";
    }
  }
});

// ----- Initial load -----
loadNotes();
loadMarkers();