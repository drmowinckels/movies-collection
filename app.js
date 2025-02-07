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
  const movieGrid = document.getElementById("movie-grid");
  const genreList = document.getElementById("genre-nav");
  const sidebarSpinner = document.getElementById("sidebar-spinner");

  movieGrid.innerHTML = ""; // Clear content
  genreList.innerHTML = ""; // Clear sidebar

  showLoadingSkeleton(movieGrid); // Show skeleton loader

  const imdbIds = await fetchMovieDirectories();
  const genreIcons = await loadGenreIcons();

  // Fetch all movie details in parallel
  const movieDetailsList = await Promise.all(imdbIds.map(fetchMovieDetails));

  const allMovies = [];
  const uniqueGenres = new Set();

  movieDetailsList.forEach((details, index) => {
    const genres = Array.isArray(details.Genre) ? details.Genre : ["Unknown"];
    genres.forEach(genre => uniqueGenres.add(genre));

    allMovies.push({
      imdbId: imdbIds[index],
      title: details.Title,
      year: details.Year,
      genres: genres.join(", "),
      poster: `${dataFolder}/${imdbIds[index]}/poster.jpg`,
      imdbRating: details.Ratings?.find(r => r.Source === "Internet Movie Database")?.Value || "N/A"
    });
  });

  // Incrementally render movies
  renderMoviesIncrementally(movieGrid, allMovies, view);

  // Render sidebar genres
  renderSidebar(genreList, uniqueGenres, genreIcons, allMovies);

  sidebarSpinner.style.display = "none"; // Hide spinner after loading
}

/**
 * Render movies incrementally in batches
 * @param {HTMLElement} container The container element
 * @param {Object[]} movies List of movie data
 * @param {string} view "grid" or "list"
 */
function renderMoviesIncrementally(container, movies, view) {
  let index = 0;
  
  function renderBatch() {
    const batchSize = 10; // Render in batches of 10
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < batchSize && index < movies.length; i++, index++) {
      const movieElement = (view === "grid") ? createGridElement(movies[index]) : createListElement(movies[index]);
      fragment.appendChild(movieElement);
    }

    container.appendChild(fragment);

    if (index < movies.length) {
      requestAnimationFrame(renderBatch);
    }
  }

  renderBatch();
}

/**
 * Show loading skeletons while fetching data
 * @param {HTMLElement} container The container element
 * @param {number} count Number of skeletons to show
 */
function showLoadingSkeleton(container, count = 10) {
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement("div");
    skeleton.classList.add("skeleton");
    container.appendChild(skeleton);
  }
}

/**
 * Create a grid view movie element
 * @param {Object} movie Movie data
 * @returns {HTMLElement} Movie element
 */
function createGridElement(movie) {
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
  return movieElement;
}

/**
 * Create a list view movie element
 * @param {Object} movie Movie data
 * @returns {HTMLElement} Movie list item
 */
function createListElement(movie) {
  const list = document.createElement("div");
  list.classList.add("list-group-item", "list-group-item-dark", 
    "d-flex", "justify-content-between", "align-items-center", "movie-item", "p-2", "border-0", "mt-0");
  list.innerHTML = `
    <span class="title">${movie.title}</span>
    <span class="badge bg-info text-black">${movie.year}</span>`;
  list.addEventListener("click", () => showMovieDetails(movie));
  list.dataset.imdbId = movie.imdbId;
  list.dataset.genres = movie.genres;
  return list;
}

/**
 * Render the sidebar genre filters
 * @param {HTMLElement} sidebar Sidebar container
 * @param {Set} genres Unique genres
 * @param {Object} icons Genre icons mapping
 * @param {Object[]} movies List of all movies
 */
function renderSidebar(sidebar, genres, icons, movies) {
  sidebar.innerHTML = "";

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
  button.setAttribute("data-bs-toggle", "tooltip");
  button.setAttribute("data-bs-placement", "top");
  button.setAttribute("title", genre);
  button.setAttribute("role", "button");
  button.dataset.genre = genre;
  button.innerHTML = `<i class="fa-solid ${iconClass} me-2"></i>
    <span class="hide-on-collapse">${genre}</span>`;
  
  button.addEventListener("click", () => {
    const movieItems = document.querySelectorAll(".movie-item");
    movieItems.forEach(item => {
      const movieGenres = item.dataset.genres?.split(", ") || [];
      toggleVisibility(item, genre === "All" || movieGenres.includes(genre));
    });
  });

  return button;
}

/**
 * Toggle the visibility of an element based on a predicate function.
 * @param {HTMLElement} item The DOM element
 * @param {boolean} predicate Whether to show or hide
 */
function toggleVisibility(item, predicate) {
  item.classList.toggle("d-none", !predicate);
}

// Search filter
document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const movieItem = document.querySelectorAll(".movie-item");
  movieItem.forEach(item => {
    console.log(item);
    const title = item.querySelector(".title").textContent.toLowerCase();
    toggleVisibility(item, title.includes(query))
  });
});

/**
 * Display movie details in a modal
 * @param {Object} movie Movie data
 */
async function showMovieDetails(movie) {
  const details = await fetchMovieDetails(movie.imdbId);

  // Remove any existing modal
  const existingModal = document.getElementById("movie-modal");
  if (existingModal) existingModal.remove();

  // Create modal container
  const modal = document.createElement("div");
  modal.id = "movie-modal";
  modal.classList.add("modal", "fade");
  modal.tabIndex = -1;
  modal.setAttribute("aria-labelledby", "movie-modal-label");
  modal.setAttribute("aria-hidden", "true");

  // Set up modal content
  modal.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content bg-dark text-white">
        <div class="modal-header border-secondary">
          <h5 class="modal-title" id="movie-modal-label">${details.Title}</h5>
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
  on: '<i class="fa-solid fa-table-cells toggle"></i>', 
  off: '<i class="fa-solid fa-table-list toggle"></i>' 
});

// View toggle functionality
$("#viewToggle").change(function () {
  $(".toggle-on").html('<i class="fa-solid fa-table-cells toggle"></i>');
  $(".toggle-off").html('<i class="fa-solid fa-table-list toggle"></i>');  
  renderMovies($(this).prop("checked") ? "grid" : "list");
});

function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const searchInput = document.getElementById("searchInput");
  const viewToggle = document.querySelector("toggle");
  const genreContainer = document.getElementById("genre-nav");
  const mainContent = document.querySelector(".main-content"); 

  const isCollapsed = sidebar.classList.toggle("collapsed");
  mainContent.classList.toggle("collapsed", isCollapsed);

  // Hide/show search input and view toggle based on collapse state
  searchInput.classList.toggle("invisible", isCollapsed);
  viewToggle.classList.toggle("d-none", isCollapsed);

  // Toggle two-column layout for genres when collapsed
  genreContainer.classList.toggle("genre-container", isCollapsed);

}


// Initial render
renderMovies();
