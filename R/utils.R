#' Create Directory
#'
#' Creates a directory if it doesn't already exist.
#'
#' @param path Character. The path of the directory to create.
#'
#' @return NULL. The function is used for its side effect of creating directories.
#' @export
dir_create <- function(path) {
  dir.create(path,
    showWarnings = FALSE,
    recursive = TRUE
  )
}

#' Read a Tab-Separated File
#'
#' Reads a tab-separated values (TSV) file and adds a `source` column based on the file name.
#'
#' @param path Character. The path to the TSV file.
#'
#' @return A data frame containing the TSV content with an additional `source` column.
#' @export
read_tsv <- function(path) {
  content <- read.delim(
    path,
    sep = "\t",
    header = TRUE,
    stringsAsFactors = FALSE
  )
  content$source <- gsub("\\.csv", "", basename(path))
  content$source <- gsub("_", " ", content$source)
  return(content)
}

#' Read and Merge Data
#'
#' Reads raw data from TSV and JSON files, and merges them into a single data frame.
#'
#' @return A data frame containing merged data with columns: `title`, `year`, `imdb_id`, and `source`.
#' @export
read_data <- function() {
  paths <- list.files("data/raw/", "csv", full.names = TRUE)
  tabular <- lapply(paths, read_tsv)
  tabular <- do.call(rbind, tabular)
  tabular <- tabular[order(tabular$Title), ]

  jsons <- list.files("data/imdb", "json",
    recursive = TRUE, full.names = TRUE
  ) |>
    lapply(jsonlite::read_json) |>
    lapply(function(x) {
      data.frame(
        Title = x$Title,
        Release.Date = x$Year,
        IMDB_ID = x$imdbID
      )
    })

  if(length(jsons) == 0){
    data <- tabular[, c("Title", "Release.Date", "Format", "source")]
    data$imdb_id <- NA
    names(data) <- tolower(names(data))
    names(data)[2] <- "year"
    return(data)
  }

  jsons <- do.call(rbind, jsons)
  data <- merge(
    tabular,
    jsons,
    by = c("Title", "Release.Date"),
    all.x = TRUE
  )

  # Make cleaner names
  names(data) <- tolower(names(data))
  names(data)[2] <- "year"

  return(data[, c("title", "year", "format", "source", "imdb_id")])
}

#' Fetch IMDb Data
#'
#' Retrieves movie data from the IMDb API.
#'
#' @param title Character. The title of the movie.
#' @param year Numeric or Character. The release year of the movie.
#' @param api_key Character. The API key for accessing the OMDB API. Default is read from the `OMDB_KEY` environment variable.
#'
#' @return A list containing the IMDb data, or `NULL` if the request fails.
#' @export
fetch_imdb_data <- function(title, year, api_key = Sys.getenv("OMDB_KEY")) {
  url <- sprintf(
    "http://www.omdbapi.com/?t=%s&y=%s&apikey=%s",
    gsub(" ", "+", title),
    year,
    api_key
  )

  response <- httr2::request(url) |>
    httr2::req_perform()

  if (httr2::resp_status(response) == 200) {
    return(httr2::resp_body_json(response))
  }

  return(NULL)
}

#' Save IMDb Data and Poster
#'
#' Fetches IMDb data for a movie, saves the data as a JSON file, and downloads the poster image if available.
#'
#' @param title Character. The title of the movie.
#' @param year Numeric or Character. The release year of the movie.
#'
#' @return Character. The IMDb ID of the movie, or `NULL` if the operation fails.
#' @export
save_imdb_data <- function(title, year, source) {
  imdb_data <- fetch_imdb_data(title, year)
  if (imdb_data$Response == "False"){
    return(NA)
  }

  movie_dir <- file.path("data/imdb/", imdb_data$imdbID)
  dir_create(movie_dir)

  imdb_data$Source <- source
  imdb_data$Genre <- unlist(strsplit(imdb_data$Genre, ", "))

  # Save JSON
  jsonlite::write_json(
    imdb_data,
    file.path(movie_dir, "details.json"),
    pretty = TRUE, auto_unbox = TRUE
  )

  # Download poster
  if (!is.null(imdb_data$Poster) && imdb_data$Poster != "N/A") {
    download.file(imdb_data$Poster, quiet = TRUE,
      file.path(movie_dir, "poster.jpg"),
      mode = "wb"
    )
  }
  return(imdb_data$imdbID)
}

#' Grab IMDb Data for Missing Records
#'
#' Fetches and saves IMDb data for movies missing an IMDb ID.
#'
#' @param data A list containing movie details. Must include `title`, `year`, and `imdb_id`.
#'
#' @return Character. The IMDb ID of the movie if fetched, or `NA` if already available or fetching fails.
#' @export
grab_imdb_data <- function(data, force = FALSE) {
  data <- as.list(data)
  if (!is.na(data$imdb_id) &&  force == FALSE) {
    return(data$imdb_id)
  }

  cli::cli_progress_step("Searching for {data$title} ({data$year})")

  Sys.sleep(0.5) # To avoid hitting API limits

  imdb_id <- save_imdb_data(
    data$title,
    data$year,
    data$source
  )

  return(imdb_id)
}
