const dataFolder = "data/imdb";

/**
 * Fetch the list of movie directories from a TSV file
 * @returns {Promise<string[]>} List of IMDb IDs
 */
async function fetchMovieDirectories() {
  const response = await fetch("data/movie_collection.tsv");
  const tsvData = await response.text();
  return tsvData
    .split("\n")
    .slice(1)
    .map(line => line.split("\t")[4]) // Extract IMDb ID
    .filter(imdb_id => imdb_id);
}

/**
 * Fetch movie details from a JSON file
 * @param {string} imdbId IMDb movie ID
 * @returns {Promise<Object>} Movie details JSON
 */
async function fetchMovieDetails(imdbId) {
  const response = await fetch(`${dataFolder}/${imdbId}/details.json`);
  return await response.json();
}

/**
 * Load genre icons from a JSON file
 * @returns {Promise<Object>} Genre icons mapping
 */
async function loadGenreIcons() {
  const response = await fetch("genre-icons.json");
  return await response.json();
}

/**
 * Render the movie collection in either grid or table view
 * @param {string} view "grid" or "list"
 */
async function renderMovies(view = "grid") {
  const imdbIds = await fetchMovieDirectories();
  const genreIcons = await loadGenreIcons();
  const sidebarSpinner = document.getElementById("sidebarSpinner");

  const movieGrid = document.getElementById("movieGrid");
  const genreList = document.getElementById("genre-nav");

  movieGrid.innerHTML = ""; // Clear content
  genreList.innerHTML = ""; // Clear sidebar

  const allMovies = [];
  const uniqueGenres = new Set();

  for (const imdbId of imdbIds) {
    const details = await fetchMovieDetails(imdbId);
    const genres = Array.isArray(details.Genre) ? details.Genre : ["Unknown"];
    genres.forEach(genre => uniqueGenres.add(genre));

    const movieData = {
      imdbId,
      title: details.Title,
      year: details.Year,
      genres: genres.join(", "),
      poster: `${dataFolder}/${imdbId}/poster.jpg`,
      imdbRating: details.Ratings?.find(r => r.Source === "Internet Movie Database")?.Value || "N/A"
    };

    allMovies.push(movieData);
  }

  if (view === "grid") {
    renderGridView(movieGrid, allMovies);
  } else {
    renderListView(movieGrid, allMovies);
  }

  renderSidebar(genreList, uniqueGenres, genreIcons, allMovies);
  sidebarSpinner.style.display = "none"; // Hide spinner after loading
}

/**
 * Render movies in grid view
 * @param {HTMLElement} container The container element
 * @param {Object[]} movies List of movie data
 */
function renderGridView(container, movies) {
  container.classList.remove("list-group", "list-group-flush");
  container.classList.add("row", "g-4");

  movies.forEach(movie => {
    const movieElement = document.createElement("div");
    movieElement.classList.add("col-xl-2", "col-lg-3", "col-md-4", "col-sm-6", "movie-card", "movie-item");
    movieElement.innerHTML = `
      <div class="card bg-dark text-white">
        <img src="${movie.poster}" class="card-img-top" alt="${movie.title}" onerror="this.src='fallback.jpg';">
        <div class="card-body">
          <h5 class="card-title title">${movie.title}</h5>
        </div>
        <div class="card-footer text-muted">${movie.year}</div>
      </div>`;
    movieElement.addEventListener("click", () => showMovieDetails(movie));
    movieElement.dataset.imdbId = movie.imdbId;
    movieElement.dataset.genres = movie.genres;
    container.appendChild(movieElement);
  });
}

/**
 * Render movies in list view
 * @param {HTMLElement} container The container element
 * @param {Object[]} movies List of movie data
 */
function renderListView(container, movies) {
  container.classList.remove("row", "g-4");
  container.classList.add("list-group", "list-group-flush");

  movies.forEach(movie => {
    const list = document.createElement("div");
    list.classList.add("list-group-item", "d-flex", "justify-content-between","list-group-item-dark", "align-items-center", "p-2", "movie-item")
    list.innerHTML = `
      <p class="title">${movie.title}</p>
      <span class="badge bg-info text-black">${movie.year}</span>
    `
    list.addEventListener("click", () => showMovieDetails(movie));
    list.dataset.imdbId = movie.imdbId;
    list.dataset.genres = movie.genres;
    container.appendChild(list);
  });
}

/**
 * Render the sidebar genre filters
 * @param {HTMLElement} sidebar Sidebar container
 * @param {Set} genres Unique genres
 * @param {Object} icons Genre icons mapping
 * @param {Object[]} movies List of all movies
 */
function renderSidebar(sidebar, genres, icons, movies) {
  sidebar.innerHTML = ""; // Clear existing content

  // "All Movies" button
  sidebar.appendChild(createGenreButton("All", "fa-film", movies));

  // Generate genre links
  [...genres].sort().forEach(genre => {
    const iconClass = icons[genre] || "fa-film";
    sidebar.appendChild(createGenreButton(genre, iconClass));
  });
}

/**
 * Create a sidebar genre button
 * @param {string} genre Genre name
 * @param {string} iconClass FontAwesome icon class
 * @returns {HTMLElement} Sidebar button element
 */
function createGenreButton(genre, iconClass) {
  const button = document.createElement("a");
  button.classList.add("p-2", "sidebar-link", "text-decoration-none");
  button.dataset.genre = genre;
  button.innerHTML = `<i class="fa-solid ${iconClass} me-2"></i><span class="hide-on-collapse">${genre}</span>`;
  
  button.addEventListener("click", () => {
    const movieItem = document.querySelectorAll(".movie-item");
    movieItem.forEach(item => {
      const movieGenre = item.dataset.genres?.split(", ") || [];
      toggleVisibility(item, genre === "All" || movieGenre.includes(genre))
    });
  });

  return button;
}

// Search filter
document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const movieItem = document.querySelectorAll(".movie-item");
  movieItem.forEach(item => {
    const title = item.querySelector(".title").textContent.toLowerCase();
    toggleVisibility(item, title.includes(query))
  });
});

/**
 * Toggles the visibility of an element based on a predicate function.
 *
 * @param {HTMLElement} item - The DOM element to show or hide.
 * @param {Function} predicate - A function that returns true if the item should be shown, false otherwise.
 */
function toggleVisibility(item, predicate) {
  if (predicate) {
      item.classList.remove("d-none");
  } else {
      item.classList.add("d-none");
  }
}


/**
 * Display movie details in a modal
 * @param {Object} movie Movie data
 */
async function showMovieDetails(movie) {
  const details = await fetchMovieDetails(movie.imdbId);

  // Remove any existing modal
  const existingModal = document.getElementById("movieModal");
  if (existingModal) existingModal.remove();

  // Create modal container
  const modal = document.createElement("div");
  modal.id = "movieModal";
  modal.classList.add("modal", "fade");
  modal.tabIndex = -1;
  modal.setAttribute("aria-labelledby", "movieModalLabel");
  modal.setAttribute("aria-hidden", "true");

  // Set up modal content
  modal.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content bg-dark text-white">
        <div class="modal-header border-secondary">
          <h5 class="modal-title" id="movieModalLabel">${details.Title}</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="row">
            <div class="col-md-4">
              <img id="modalPoster" src="${dataFolder}/${movie.imdbId}/poster.jpg" class="img-fluid rounded" alt="${details.Title}" onerror="this.src='fallback.jpg';">
            </div>
            <div class="col-md-8">
              <p><strong>Plot:</strong> ${details.Plot}</p>
              <p><strong>Director:</strong> ${details.Director}</p>
              <p><strong>Actors:</strong> ${details.Actors || "N/A"}</p>
              <p><strong>Year:</strong> ${details.Year || "N/A"}</p>
              <p><strong>Runtime:</strong> ${details.Runtime || "N/A"}</p>
              <p><strong>Genre:</strong> ${Array.isArray(details.Genre) ? details.Genre.join(", ") : details.Genre || "Unknown"}</p>
              <p><strong>Ratings:</strong>
              <ul>
                <img width="20" height="20" src="https://img.icons8.com/color/16/imdb.png" alt="imdb"/> ${details.Ratings?.find(r => r.Source === "Internet Movie Database")?.Value || "N/A"}<br>
                <img width="20" height="20" src="https://img.icons8.com/office/16/rotten-tomatoes.png" alt="rotten-tomatoes"/> ${details.Ratings?.find(r => r.Source === "Rotten Tomatoes")?.Value || "N/A"}<br>
                <img width="20" height="20" src="https://img.icons8.com/color/100/metascore.png" alt="metascore"/> ${details.Ratings?.find(r => r.Source === "Metacritic")?.Value || "N/A"}
              </ul>
            </div>
          </div>
        </div>
        <div class="modal-footer border-secondary">
          <a href="https://www.imdb.com/title/${movie.imdbId}" target="_blank" class="btn btn-warning">View on IMDb</a>
          <button type="button" class="btn btn-info" disabled>${details.Source}</button>
        </div>
      </div>
    </div>
  `;

  // Append modal to the body and show it
  document.body.appendChild(modal);
  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}


// View initial values
$("#viewToggle").bootstrapToggle({
  on: '<i class="fa-solid fa-table-cells"> Grid</i>',  // Grid icon
  off: '<i class="fa-solid fa-table-list"> List</i>'   // List icon
});

// View toggle functionality
$("#viewToggle").change(function () {
  $(".toggle-on").html('<i class="fa-solid fa-table-cells"> Grid</i>');
  $(".toggle-off").html('<i class="fa-solid fa-table-list"> List</i>');  
  renderMovies($(this).prop("checked") ? "grid" : "list");
});

// Initial render
renderMovies();
