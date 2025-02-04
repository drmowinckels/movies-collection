const dataFolder = "data/imdb";

async function fetchMovieDirectories() {
  const response = await fetch("data/movie_collection.tsv");
  const tsvData = await response.text();
  return tsvData
    .split("\n")
    .slice(1)
    .map(line => {
      const [title, year, format, source, imdb_id] = line.split("\t");
      return imdb_id;
    })
    .filter(imdb_id => imdb_id);
}

async function fetchMovieDetails(imdbId) {
  const response = await fetch(`${dataFolder}/${imdbId}/details.json`);
  return await response.json();
}

async function loadGenreIcons() {
  const response = await fetch("genre-icons.json");
  return await response.json();
}

async function renderMovies() {
  const imdbIds = await fetchMovieDirectories();
  const genreIcons = await loadGenreIcons();

  const movieGrid = document.getElementById("movieGrid");
  movieGrid.innerHTML = "";

  const genreList = document.getElementById("genre-nav");
  genreList.innerHTML = ""; // Clear previous sidebar content

  const allMovies = []; // Store all movies for later filtering
  const uniqueGenres = new Set();

  for (const imdbId of imdbIds) {
    const details = await fetchMovieDetails(imdbId);
    const genres = Array.isArray(details.Genre) ? details.Genre : ["Unknown"];

    // Store unique genres
    genres.forEach(genre => uniqueGenres.add(genre));

    const imdbRating = details.Ratings?.find(r => r.Source === "Internet Movie Database")?.Value || "N/A";
    const rtRating = details.Ratings?.find(r => r.Source === "Rotten Tomatoes")?.Value || "N/A";
    const metaRating = details.Ratings?.find(r => r.Source === "Metacritic")?.Value || "N/A";

    // Create a single movie card
    const movieCard = document.createElement("div");
    movieCard.classList.add("movie-card", "card", "text-center", "text-white", "bg-dark", "mb-3");
    movieCard.style.minWidth = "200px";
    movieCard.dataset.imdbId = imdbId;
    movieCard.dataset.genres = genres.join(","); // Store genres for filtering

    movieCard.innerHTML = `
      <img src="${dataFolder}/${imdbId}/poster.jpg" class="card-img-top" alt="${details.Title}" onerror="this.src='fallback.jpg';">
      <div class="card-body bg-dark">
        <h5 class="card-title text-white">${details.Title}</h5>
      </div>
      <div class="card-footer text-muted">
        <p class="card-text text-white">
          <img width="20" height="20" src="https://img.icons8.com/color/16/imdb.png" alt="imdb"/> ${imdbRating}<br>
          <img width="20" height="20" src="https://img.icons8.com/office/16/rotten-tomatoes.png" alt="rotten-tomatoes"/> ${rtRating}<br>
          <img width="20" height="20" src="https://img.icons8.com/color/100/metascore.png" alt="metascore"/> ${metaRating}
        </p>
      </div>
    `;

    allMovies.push(movieCard);
    movieGrid.appendChild(movieCard);
  }

  // Add "All Movies" filter button
  const allMoviesBtn = document.createElement("a");
  allMoviesBtn.classList.add("p-2", "sidebar-link", "text-decoration-none");
  allMoviesBtn.dataset.genre = "all";
  allMoviesBtn.innerHTML = `<i class="fa-solid fa-film me-2"></i><span class="hide-on-collapse">All</span>`;
  genreList.appendChild(allMoviesBtn);

  // Ensure uniqueGenres is an array
  const uniqueGenresArray = Array.isArray(uniqueGenres) ? uniqueGenres : Array.from(uniqueGenres || []);

  // Sort genres alphabetically, keeping "All" on top
  const sortedGenres = [...uniqueGenresArray.filter(g => g !== "All").sort()];

  // Generate sidebar genre links
  sortedGenres.forEach(genre => {
    const genreA = document.createElement("a");
    genreA.setAttribute("data-genre", genre);
    genreA.classList.add("p-2", "sidebar-link", "text-decoration-none");

    const genreAI = document.createElement("i");
    const iconClass = genreIcons[genre] || "fa-film";  
    genreAI.classList.add("fas", iconClass, "me-2");

    const genreAS = document.createElement("span");
    genreAS.classList.add("hide-on-collapse");
    genreAS.innerHTML = genre;

    genreA.appendChild(genreAI);
    genreA.appendChild(genreAS);
    genreList.appendChild(genreA);
  });

  // Genre filter event listener
  genreList.addEventListener("click", (e) => {
    const selectedGenre = e.target.closest("a")?.dataset.genre;
    if (!selectedGenre) return;

    allMovies.forEach(card => {
      const movieGenres = card.dataset.genres.split(",");
      card.style.display = (selectedGenre === "all" || movieGenres.includes(selectedGenre)) ? "block" : "none";
    });
  });
}

// Movie click event (modal)
document.addEventListener("click", async (e) => {
  if (e.target.closest(".movie-card")) {
    const imdbId = e.target.closest(".movie-card").dataset.imdbId;
    const details = await fetchMovieDetails(imdbId);

    document.getElementById("modalTitle").textContent = details.Title;
    document.getElementById("modalPlot").textContent = details.Plot;
    document.getElementById("modalDirector").textContent = details.Director;
    document.getElementById("modalActors").textContent = details.Actors || "N/A";
    document.getElementById("modalYear").textContent = details.Year || "N/A";
    document.getElementById("modalRuntime").textContent = details.Runtime || "N/A";
    document.getElementById("modalSource").textContent = details.Source || "N/A";

    document.getElementById("modalGenre").textContent = 
  Array.isArray(details.Genre) ? details.Genre.join(", ") : details.Genre || "Unknown";


    document.getElementById("modalPoster").src = `${dataFolder}/${imdbId}/poster.jpg`;
    document.getElementById("modalPoster").onerror = () => {
      document.getElementById("modalPoster").src = "fallback.jpg";
    };

    const modal = new bootstrap.Modal(document.getElementById("movieModal"));
    modal.show();
  }
});

// Search filter
document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const movieCards = document.querySelectorAll(".movie-card");
  movieCards.forEach(card => {
    const title = card.querySelector(".card-title").textContent.toLowerCase();
    card.style.display = title.includes(query) ? "block" : "none";
  });
});

// Sidebar toggle
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.toggle('collapsed');
}

renderMovies();
