source("R/utils.R")

# Read the TSV files
movies <- read_data()

# Process each movie
movies$imdb_id <- apply(
  X = movies, 
  MARGIN = 1, 
#  force = TRUE,
  FUN = grab_imdb_data
)

# Save the updated TSV file
write.table(
  subset(movies, !is.na(movies$imdb_id)),
  "data/movie_collection.tsv", 
  sep = "\t",
  row.names = FALSE,
  quote = FALSE
)

