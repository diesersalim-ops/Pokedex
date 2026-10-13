/** Which function runs for which data-action value (event delegation). */
const clickActions = {
  'load-more': loadNextPage, 'search': searchPokemon, 'open-dialog': openDialog, 'close-dialog': closeDialog,
  'previous-pokemon': (button) => showNeighbor(-1, button), 'next-pokemon': (button) => showNeighbor(1, button), 'show-tab': showTab
};

/** Order and labels of the stats in the Base Stats tab. */
const statOrder = [['hp', 'HP'], ['attack', 'Attack'], ['defense', 'Defense'], ['special-attack', 'Sp. Atk'], ['special-defense', 'Sp. Def'], ['speed', 'Speed']];
/** The tabs of the dialog: key and visible label. */
const tabs = [['about', 'About'], ['stats', 'Base Stats'], ['evolution', 'Evolution']];

/** Which function builds the content of which tab. */
const panelBuilders = { about: buildAboutPanel, stats: buildStatsPanel, evolution: buildEvolutionPanel };

/** Starts the app: registers the listeners once and loads the first page. */
function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeydown);
  loadNextPage();
}

/** Starts the search when Enter is pressed in the search field. */
function handleKeydown(event) {
  if (event.key === 'Enter' && event.target === getElement('search-input')) {
    searchPokemon();
  }
}

/** One click listener for the whole page. Closes the dialog on a click next to the card, otherwise runs the data-action. */
function handleClick(event) {
  if (event.target === getElement('dialog')) {
    closeDialog();
    return;
  }
  const button = event.target.closest('[data-action]');
  const action = button === null ? undefined : clickActions[button.dataset.action];
  if (action !== undefined) {
    action(button);
  }
}

/** Finds an element by its data-id attribute. */
function getElement(dataId) {
  return document.querySelector(`[data-id="${dataId}"]`);
}

/** Loads and shows the next 20 Pokémon (or search results). Blocks double clicks and shows an error if loading fails. */
async function loadNextPage() {
  if (DB.isLoading) {
    return;
  }
  startLoading();
  try {
    addToCache(await fetchNextPage());
  } catch (error) {
    showError('Pokémon could not be loaded. Please try again.');
  } finally {
    stopLoading();
  }
}

/** Gets the details of the next 20 Pokémon, from the search results or from the full list of PokéAPI. */
async function fetchNextPage() {
  if (DB.isSearchActive) {
    const start = DB.searchResults.length;
    return await fetchPokemonDetails(DB.searchEntries.slice(start, start + DB.pageSize));
  }
  const list = await fetchJson(`${DB.pokeApiUrl}/pokemon-species?limit=${DB.pageSize}&offset=${DB.offset}`);
  DB.totalPokemon = list.count;
  return await fetchPokemonDetails(list.results);
}

/** Loads the details of the given Pokémon in parallel (one request each). */
async function fetchPokemonDetails(entries) {
  const requests = entries.map((entry) => fetchJson(`${DB.pokeApiUrl}/pokemon/${getIdFromUrl(entry.url)}`));
  return (await Promise.all(requests)).map(simplifyPokemon);
}

/** Loads JSON from an address and throws an error if the answer is not ok. */
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return await response.json();
}

/** Reduces the large answer of PokéAPI to the few values the app needs. */
function simplifyPokemon(raw) {
  return {
    id: raw.id, name: raw.name, height: raw.height, weight: raw.weight, base_experience: raw.base_experience,
    types: collectNames(raw.types, 'type'), abilities: collectNames(raw.abilities, 'ability'),
    stats: collectStats(raw.stats), image: pickImage(raw.sprites), speciesUrl: raw.species.url
  };
}

/** Collects the names of a list like types or abilities. */
function collectNames(entries, key) {
  return entries.map((entry) => entry[key].name);
}

/** Turns the stat list into an object with the stat name as key. */
function collectStats(entries) {
  const stats = {};
  for (let i = 0; i < entries.length; i++) {
    stats[entries[i].stat.name] = entries[i].base_stat;
  }
  return stats;
}

/** Chooses the image: HOME artwork first, then official artwork, then the small default sprite. */
function pickImage(sprites) {
  return sprites.other.home.front_default || sprites.other['official-artwork'].front_default || sprites.front_default;
}

/** Adds a loaded page to the current list (list or search results) and shows its cards. */
function addToCache(page) {
  const list = getCurrentList();
  const firstIndex = list.length;
  for (let i = 0; i < page.length; i++) {
    list.push(page[i]);
  }
  if (!DB.isSearchActive) {
    DB.offset = list.length;
  }
  renderCards(page, firstIndex);
}

/** Appends the cards of one page to the list. Cards already shown stay untouched. */
function renderCards(page, firstIndex) {
  const html = page.map((pokemon, i) => Template.card(buildCardView(pokemon, firstIndex + i))).join('');
  getElement('pokemon-list').insertAdjacentHTML('beforeend', html);
}

/** Prepares the values for one card (the template only inserts them). */
function buildCardView(pokemon, index) {
  return {
    index: index, type: escapeHtml(pokemon.types[0]), idLabel: `#${pokemon.id}`,
    name: formatName(pokemon.name), image: escapeHtml(pokemon.image),
    typeIcons: buildTypeIcons(pokemon.types)
  };
}

/** Builds the HTML of all type symbols of a Pokémon. */
function buildTypeIcons(types) {
  return types.map((type) => Template.typeIcon(escapeHtml(type), formatName(type))).join('');
}

/** Makes a name readable: capital letters, hyphens become spaces, special characters are escaped. */
function formatName(name) {
  const words = name.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return escapeHtml(words.join(' '));
}

/** Escapes characters that would be read as HTML, because the text comes from outside. */
function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Shows the loading screen and blocks the Load more and Search buttons. */
function startLoading() {
  DB.isLoading = true;
  removeMessages();
  getElement('load-more-button').disabled = true;
  getElement('search-button').disabled = true;
  document.body.insertAdjacentHTML('beforeend', Template.loading());
}

/** Hides the loading screen and unblocks the buttons. Shows or hides Load more as needed. */
function stopLoading() {
  DB.isLoading = false;
  getElement('loading').remove();
  getElement('load-more-button').disabled = false;
  getElement('search-button').disabled = false;
  getElement('load-more-button').hidden = shouldHideLoadMore();
}

/** Tells if Load more is not needed: all search results shown or the last Pokémon reached. */
function shouldHideLoadMore() {
  if (DB.isSearchActive) {
    return DB.searchResults.length >= DB.searchEntries.length;
  }
  return DB.offset >= DB.totalPokemon;
}

/** Shows an error message below the list. */
function showError(message) {
  getElement('pokemon-list').insertAdjacentHTML('afterend', Template.error(message));
}

/** Removes all messages below the list (errors and 'No match found'). */
function removeMessages() {
  document.querySelectorAll('.content__message').forEach((message) => message.remove());
}

/** Reads the search field and starts the search from 3 letters on. An empty field resets the list. */
async function searchPokemon() {
  const term = getElement('search-input').value.trim().toLowerCase();
  removeMessages();
  if (term === '') {
    resetSearch();
  } else if (term.length < 3) {
    showSearchHint('Please enter at least 3 letters.');
  } else {
    await runSearch(term);
  }
}

/** Shows a hint under the search field. An empty text hides it. */
function showSearchHint(text) {
  getElement('search-hint').textContent = text;
}

/** Runs a search: loads the name list once, finds the matches and shows the first page of them. */
async function runSearch(term) {
  if (DB.isLoading) {
    return;
  }
  startLoading();
  try {
    await loadAllNames();
    await showResults(DB.allNames.filter((entry) => entry.name.includes(term)));
  } catch (error) {
    showError('Search failed. Please try again.');
  } finally {
    stopLoading();
  }
}

/** Loads the names of all Pokémon once and keeps them for later searches. */
async function loadAllNames() {
  if (DB.allNames.length === 0) {
    const list = await fetchJson(`${DB.pokeApiUrl}/pokemon-species?limit=${DB.maxNames}`);
    DB.allNames = list.results;
  }
}

/** Replaces the list with the first page of the search results, or shows 'No match found'. */
async function showResults(entries) {
  DB.searchEntries = entries;
  DB.searchResults = [];
  DB.isSearchActive = true;
  getElement('pokemon-list').innerHTML = '';
  if (entries.length === 0) {
    getElement('pokemon-list').insertAdjacentHTML('afterend', Template.notFound());
    return;
  }
  addToCache(await fetchNextPage());
}

/** Clears the search hint and brings back the normal list with all loaded Pokémon. */
function resetSearch() {
  showSearchHint('');
  if (!DB.isSearchActive) {
    return;
  }
  DB.isSearchActive = false;
  getElement('pokemon-list').innerHTML = '';
  renderCards(DB.pokemonList, 0);
  getElement('load-more-button').hidden = shouldHideLoadMore();
}

/** Reacts to typing in the search field: a hint for 1 or 2 letters, a reset when the field is empty. */
function handleInput(event) {
  if (event.target !== getElement('search-input')) {
    return;
  }
  const length = event.target.value.trim().length;
  if (length === 0) {
    removeMessages();
    resetSearch();
  } else {
    showSearchHint(length < 3 ? 'Please enter at least 3 letters.' : '');
  }
}

/** Returns the list that is shown right now (search results or normal list). */
function getCurrentList() {
  return DB.isSearchActive ? DB.searchResults : DB.pokemonList;
}

/** Returns the Pokémon shown in the dialog. */
function getCurrentPokemon() {
  return getCurrentList()[DB.currentIndex];
}

/** Opens the large view for the clicked card, starting on the About tab. */
function openDialog(button) {
  DB.currentIndex = Number(button.dataset.index);
  DB.currentTab = 'about';
  renderDialog();
  getElement('dialog').showModal();
}

/** Closes the large view. */
function closeDialog() {
  getElement('dialog').close();
}

/** Moves to the previous or next Pokémon and jumps from one end of the list to the other. The focus stays on the arrow. */
function showNeighbor(step, button) {
  const length = getCurrentList().length;
  DB.currentIndex = (DB.currentIndex + step + length) % length;
  renderDialog();
  getElement(button.dataset.id).focus();
}

/** Switches the dialog tab without drawing the whole dialog again, so the focus stays. */
function showTab(button) {
  DB.currentTab = button.dataset.tab;
  document.querySelectorAll('.pokemon-dialog__tab').forEach((tab) => {
    tab.setAttribute('aria-pressed', tab === button);
  });
  const pokemon = getCurrentPokemon();
  getElement('dialog-panel').innerHTML = panelBuilders[DB.currentTab](pokemon);
  updateEvolution(pokemon);
}

/** Draws the whole dialog for the current Pokémon and starts loading the evolution if its tab is open. */
function renderDialog() {
  const pokemon = getCurrentPokemon();
  getElement('dialog').innerHTML = Template.dialog(buildDialogView(pokemon));
  updateEvolution(pokemon);
}

/** Prepares the values for the dialog (the template only inserts them). */
function buildDialogView(pokemon) {
  const view = buildCardView(pokemon, DB.currentIndex);
  view.tabButtons = tabs.map((tab) => Template.tabButton(tab[0], tab[1], tab[0] === DB.currentTab)).join('');
  view.panel = panelBuilders[DB.currentTab](pokemon);
  return view;
}

/** Builds the About tab: height in cm, weight in kg, base experience and abilities. */
function buildAboutPanel(pokemon) {
  return Template.aboutPanel({
    height: `${pokemon.height * 10} cm`, weight: `${pokemon.weight / 10} kg`,
    baseExperience: pokemon.base_experience,
    abilities: pokemon.abilities.map(formatName).join(', ')
  });
}

/** Builds the Base Stats tab in a fixed order with the total. */
function buildStatsPanel(pokemon) {
  const values = statOrder.map((stat) => pokemon.stats[stat[0]]);
  const rows = statOrder.map((stat, i) => Template.statRow({ label: stat[1], value: values[i] }));
  return Template.statsPanel(rows.join(''), values.reduce((sum, value) => sum + value, 0));
}

/** Builds the Evolution tab from the cache, or a loading text while the chain is still missing. */
function buildEvolutionPanel(pokemon) {
  const chain = DB.evolutionCache[pokemon.id];
  if (chain === undefined) {
    return Template.message('Loading evolution…');
  }
  return Template.evolutionPanel(chain.map((step) => Template.evolutionStep(step)).join(''));
}

/** Loads the evolution chain if its tab is open and it is not in the cache yet (lazy loading). */
async function updateEvolution(pokemon) {
  if (DB.currentTab !== 'evolution' || DB.evolutionCache[pokemon.id] !== undefined) {
    return;
  }
  try {
    DB.evolutionCache[pokemon.id] = await fetchEvolution(pokemon.speciesUrl);
    showInEvolutionPanel(pokemon, buildEvolutionPanel(pokemon));
  } catch (error) {
    showInEvolutionPanel(pokemon, Template.message('Evolution could not be loaded.'));
  }
}

/** Shows HTML in the tab area, but only if the same Pokémon and the evolution tab are still open (the user may have moved on while loading). */
function showInEvolutionPanel(pokemon, html) {
  if (DB.currentTab === 'evolution' && getCurrentPokemon() === pokemon) {
    getElement('dialog-panel').innerHTML = html;
  }
}

/** Loads the evolution chain of a Pokémon in two steps: first its species, then the chain from the species. */
async function fetchEvolution(speciesUrl) {
  const species = await fetchJson(speciesUrl);
  const chain = await fetchJson(species.evolution_chain.url);
  return flattenChain(chain.chain, []);
}

/** Takes the id out of a PokéAPI address. */
function getIdFromUrl(url) {
  return url.split('/').slice(-2)[0];
}

/** Turns the branching chain into a flat list, step by step (calls itself for every branch). */
function flattenChain(node, steps) {
  const image = `${DB.imageUrl}/${getIdFromUrl(node.species.url)}.png`;
  steps.push({ name: formatName(node.species.name), image: image });
  node.evolves_to.forEach((next) => flattenChain(next, steps));
  return steps;
}

init();
