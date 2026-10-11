/**
 * Shared state and cache of the app. Values only, no functions.
 * @property {string} databaseUrl Address of the Firebase Realtime Database.
 * @property {string} pokeApiUrl Address of PokéAPI (evolution chains).
 * @property {string} imageUrl Folder of the Pokémon images, file name is the id plus .png.
 * @property {number} totalPokemon Number of Pokémon in the database.
 * @property {number} pageSize Pokémon per page.
 * @property {number} offset Number of loaded Pokémon.
 * @property {Object[]} pokemonList Loaded Pokémon in list order.
 * @property {Object[]} searchResults Pokémon found by the last search.
 * @property {boolean} isSearchActive True while search results are shown.
 * @property {Object[]} allPokemon All Pokémon, loaded once for the search.
 * @property {Object} evolutionCache Evolution chains by Pokémon id.
 * @property {string} currentTab Shown dialog tab.
 * @property {number} currentIndex Index of the shown Pokémon in the current list.
 * @property {boolean} isLoading True while a page is loading.
 */
const DB = {
  databaseUrl: 'https://pokedex-6b473-default-rtdb.europe-west1.firebasedatabase.app',
  pokeApiUrl: 'https://pokeapi.co/api/v2',
  imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home',
  totalPokemon: 151,
  pageSize: 20,
  offset: 0,
  pokemonList: [],
  searchResults: [],
  isSearchActive: false,
  allPokemon: [],
  evolutionCache: {},
  currentTab: 'about',
  currentIndex: 0,
  isLoading: false
};
