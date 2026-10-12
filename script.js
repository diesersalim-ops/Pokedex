/** Which function runs for which data-action value (event delegation). */
const clickActions = {
  'load-more': loadNextPage,
  'search': searchPokemon,
  'open-dialog': openDialog,
  'close-dialog': closeDialog,
  'previous-pokemon': showPrevious,
  'next-pokemon': showNext,
  'show-tab': showTab
};

/** Order and labels of the stats in the Base Stats tab. PokéAPI delivers them in its own order. */
const statOrder = [
  ['hp', 'HP'], ['attack', 'Attack'], ['defense', 'Defense'],
  ['special-attack', 'Sp. Atk'], ['special-defense', 'Sp. Def'], ['speed', 'Speed']
];

/** The tabs of the dialog: key and visible label. */
const tabs = [['about', 'About'], ['stats', 'Base Stats'], ['evolution', 'Evolution']];

/** Which function builds the content of which tab. */
const panelBuilders = {
  about: buildAboutPanel,
  stats: buildStatsPanel,
  evolution: buildEvolutionPanel
};

/**
 * Starts the app: registers the click and input listeners once and loads the first page.
 */
function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeydown);
  loadNextPage();
}

/**
 * Starts the search when Enter is pressed in the search field.
 * @param {KeyboardEvent} event The key event.
 */
function handleKeydown(event) {
  if (event.key === 'Enter' && event.target === getElement('search-input')) {
    searchPokemon();
  }
}

/**
 * One click listener for the whole page (event delegation). Closes the dialog on a click next to the card, otherwise runs the action named in data-action.
 * @param {MouseEvent} event The click event.
 */
function handleClick(event) {
  if (event.target === getElement('dialog')) {
    closeDialog();
    return;
  }
  const button = event.target.closest('[data-action]');
  if (button === null) {
    return;
  }
  const action = clickActions[button.dataset.action];
  if (action !== undefined) {
    action(button);
  }
}

/**
 * Finds an element by its data-id attribute.
 * @param {string} dataId Value of data-id.
 * @returns {Element|null} The element or null.
 */
function getElement(dataId) {
  return document.querySelector(`[data-id="${dataId}"]`);
}

/**
 * Loads and shows the next 20 Pokémon (or the next 20 search results). Blocks double clicks while loading and shows an error message if loading fails.
 */
async function loadNextPage() {
  if (DB.isLoading) {
    return;
  }
  startLoading();
  try {
    const page = await fetchNextPage();
    addToCache(page);
  } catch (error) {
    showError('Pokémon could not be loaded. Please try again.');
  } finally {
    stopLoading();
  }
}

/**
 * Gets the details of the next 20 Pokémon, from the search results or from the full list of PokéAPI.
 * @returns {Promise<Object[]>} The simplified Pokémon.
 */
async function fetchNextPage() {
  if (DB.isSearchActive) {
    const start = DB.searchResults.length;
    return await fetchPokemonDetails(DB.searchEntries.slice(start, start + DB.pageSize));
  }
  const list = await fetchJson(buildPageUrl());
  DB.totalPokemon = list.count;
  return await fetchPokemonDetails(list.results);
}

/**
 * Loads the details of the given Pokémon in parallel (one request each).
 * @param {{name: string, url: string}[]} entries Names and addresses from PokéAPI.
 * @returns {Promise<Object[]>} The simplified Pokémon.
 */
async function fetchPokemonDetails(entries) {
  const requests = [];
  for (let i = 0; i < entries.length; i++) {
    requests.push(fetchJson(`${DB.pokeApiUrl}/pokemon/${getIdFromUrl(entries[i].url)}`));
  }
  const details = await Promise.all(requests);
  const pokemon = [];
  for (let i = 0; i < details.length; i++) {
    pokemon.push(simplifyPokemon(details[i]));
  }
  return pokemon;
}

/**
 * Loads JSON from an address and throws an error if the answer is not ok.
 * @param {string} url Address to load.
 * @returns {Promise<Object>} The parsed answer.
 */
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return await response.json();
}

/**
 * Builds the address of the next page of the Pokémon list (species list of PokéAPI).
 * @returns {string} The address.
 */
function buildPageUrl() {
  return `${DB.pokeApiUrl}/pokemon-species?limit=${DB.pageSize}&offset=${DB.offset}`;
}

/**
 * Reduces the large answer of PokéAPI to the few values the app needs.
 * @param {Object} raw Answer of pokemon/<id>.
 * @returns {Object} Pokémon with id, name, height, weight, base_experience, types, abilities, stats, image and speciesUrl.
 */
function simplifyPokemon(raw) {
  return {
    id: raw.id,
    name: raw.name,
    height: raw.height,
    weight: raw.weight,
    base_experience: raw.base_experience,
    types: collectNames(raw.types, 'type'),
    abilities: collectNames(raw.abilities, 'ability'),
    stats: collectStats(raw.stats),
    image: pickImage(raw.sprites),
    speciesUrl: raw.species.url
  };
}

/**
 * Collects the names of a list like types or abilities.
 * @param {Object[]} entries List from PokéAPI.
 * @param {string} key Name of the entry that holds the name, e.g. 'type'.
 * @returns {string[]} The names.
 */
function collectNames(entries, key) {
  const names = [];
  for (let i = 0; i < entries.length; i++) {
    names.push(entries[i][key].name);
  }
  return names;
}

/**
 * Turns the stat list into an object with the stat name as key.
 * @param {Object[]} entries Stat list from PokéAPI.
 * @returns {Object} Values by name, e.g. {hp: 45}.
 */
function collectStats(entries) {
  const stats = {};
  for (let i = 0; i < entries.length; i++) {
    stats[entries[i].stat.name] = entries[i].base_stat;
  }
  return stats;
}

/**
 * Chooses the image: HOME artwork first, then official artwork, then the small default sprite.
 * @param {Object} sprites Sprites of a Pokémon.
 * @returns {string} Image address.
 */
function pickImage(sprites) {
  if (sprites.other.home.front_default) {
    return sprites.other.home.front_default;
  }
  if (sprites.other['official-artwork'].front_default) {
    return sprites.other['official-artwork'].front_default;
  }
  return sprites.front_default;
}

/**
 * Adds a loaded page to the current list (list or search results) and shows its cards.
 * @param {Object[]} page The simplified Pokémon of one page.
 */
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

/**
 * Appends the cards of one page to the list. Cards already shown stay untouched.
 * @param {Object[]} page Pokémon to show.
 * @param {number} firstIndex Position of the first Pokémon in the current list.
 */
function renderCards(page, firstIndex) {
  let html = '';
  for (let i = 0; i < page.length; i++) {
    html += Template.card(buildCardView(page[i], firstIndex + i));
  }
  getElement('pokemon-list').insertAdjacentHTML('beforeend', html);
}

/**
 * Prepares the values for one card (the template only inserts them).
 * @param {Object} pokemon One Pokémon.
 * @param {number} index Position in the current list.
 * @returns {Object} Values for Template.card.
 */
function buildCardView(pokemon, index) {
  return {
    index: index,
    type: escapeHtml(pokemon.types[0]),
    idLabel: `#${pokemon.id}`,
    name: formatName(pokemon.name),
    image: escapeHtml(pokemon.image),
    typeIcons: buildTypeIcons(pokemon.types)
  };
}

/**
 * Builds the HTML of all type symbols of a Pokémon.
 * @param {string[]} types Type names.
 * @returns {string} HTML text.
 */
function buildTypeIcons(types) {
  let html = '';
  for (let i = 0; i < types.length; i++) {
    html += Template.typeIcon(escapeHtml(types[i]), formatName(types[i]));
  }
  return html;
}

/**
 * Makes a name readable: capital letters, hyphens become spaces, special characters are escaped.
 * @param {string} name Name from PokéAPI, e.g. 'mr-mime'.
 * @returns {string} Readable name, e.g. 'Mr Mime'.
 */
function formatName(name) {
  const words = name.split('-');
  const capitalized = [];
  for (let i = 0; i < words.length; i++) {
    capitalized.push(words[i].charAt(0).toUpperCase() + words[i].slice(1));
  }
  return escapeHtml(capitalized.join(' '));
}

/**
 * Escapes characters that would be read as HTML, because the text comes from outside.
 * @param {*} text Any text.
 * @returns {string} Safe text.
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Shows the loading screen and blocks the Load more and Search buttons.
 */
function startLoading() {
  DB.isLoading = true;
  removeMessages();
  getElement('load-more-button').disabled = true;
  getElement('search-button').disabled = true;
  document.body.insertAdjacentHTML('beforeend', Template.loading());
}

/**
 * Hides the loading screen and unblocks the buttons. Shows or hides Load more as needed.
 */
function stopLoading() {
  DB.isLoading = false;
  getElement('loading').remove();
  const button = getElement('load-more-button');
  button.disabled = false;
  getElement('search-button').disabled = false;
  button.hidden = shouldHideLoadMore();
}

/**
 * Tells if Load more is needed: not during a search with all results shown and not after the last Pokémon.
 * @returns {boolean} True if the button must be hidden.
 */
function shouldHideLoadMore() {
  if (DB.isSearchActive) {
    return DB.searchResults.length >= DB.searchEntries.length;
  }
  return DB.offset >= DB.totalPokemon;
}

/**
 * Shows an error message below the list.
 * @param {string} message Text to show.
 */
function showError(message) {
  getElement('pokemon-list').insertAdjacentHTML('afterend', Template.error(message));
}

/**
 * Removes all messages below the list (errors and 'No match found').
 */
function removeMessages() {
  const messages = document.querySelectorAll('.content__message');
  for (let i = 0; i < messages.length; i++) {
    messages[i].remove();
  }
}

/**
 * Reads the search field and starts the search from 3 letters on. With fewer letters a hint appears, an empty field resets the list.
 */
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

/**
 * Shows a hint under the search field. An empty text hides it.
 * @param {string} text Hint text.
 */
function showSearchHint(text) {
  getElement('search-hint').textContent = text;
}

/**
 * Runs a search: loads the name list once, finds the matches and shows the first page of them.
 * @param {string} term Search term in lower case.
 */
async function runSearch(term) {
  if (DB.isLoading) {
    return;
  }
  startLoading();
  try {
    await loadAllNames();
    await showResults(findMatches(term));
  } catch (error) {
    showError('Search failed. Please try again.');
  } finally {
    stopLoading();
  }
}

/**
 * Loads the names of all Pokémon once and keeps them for later searches.
 */
async function loadAllNames() {
  if (DB.allNames.length === 0) {
    const list = await fetchJson(`${DB.pokeApiUrl}/pokemon-species?limit=${DB.maxNames}`);
    DB.allNames = list.results;
  }
}

/**
 * Finds all Pokémon whose name contains the search term.
 * @param {string} term Search term in lower case.
 * @returns {Object[]} Matching names and addresses.
 */
function findMatches(term) {
  return DB.allNames.filter((entry) => entry.name.includes(term));
}

/**
 * Replaces the list with the first page of the search results, or shows 'No match found'.
 * @param {Object[]} entries Matching names and addresses.
 */
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

/**
 * Clears the search hint and brings back the normal list with all loaded Pokémon.
 */
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

/**
 * Reacts to typing in the search field: a hint for 1 or 2 letters, a reset of the list when the field is empty.
 * @param {InputEvent} event The input event.
 */
function handleInput(event) {
  if (event.target !== getElement('search-input')) {
    return;
  }
  const length = event.target.value.trim().length;
  if (length === 0) {
    removeMessages();
    resetSearch();
  } else if (length < 3) {
    showSearchHint('Please enter at least 3 letters.');
  } else {
    showSearchHint('');
  }
}

/**
 * Returns the list that is shown right now (search results or normal list).
 * @returns {Object[]} The list.
 */
function getCurrentList() {
  if (DB.isSearchActive) {
    return DB.searchResults;
  }
  return DB.pokemonList;
}

/**
 * Returns the Pokémon shown in the dialog.
 * @returns {Object} The Pokémon.
 */
function getCurrentPokemon() {
  return getCurrentList()[DB.currentIndex];
}

/**
 * Opens the large view for the clicked card, starting on the About tab.
 * @param {HTMLElement} button The card button with data-index.
 */
function openDialog(button) {
  DB.currentIndex = Number(button.dataset.index);
  DB.currentTab = 'about';
  renderDialog();
  getElement('dialog').showModal();
}

/**
 * Closes the large view.
 */
function closeDialog() {
  getElement('dialog').close();
}

/**
 * Shows the previous Pokémon in the dialog.
 * @param {HTMLElement} button The arrow button.
 */
function showPrevious(button) {
  showNeighbor(-1, button);
}

/**
 * Shows the next Pokémon in the dialog.
 * @param {HTMLElement} button The arrow button.
 */
function showNext(button) {
  showNeighbor(1, button);
}

/**
 * Moves to the previous or next Pokémon and jumps from one end of the list to the other. The focus stays on the arrow.
 * @param {number} step -1 for previous, 1 for next.
 * @param {HTMLElement} button The pressed arrow button.
 */
function showNeighbor(step, button) {
  const lastIndex = getCurrentList().length - 1;
  DB.currentIndex += step;
  if (DB.currentIndex < 0) {
    DB.currentIndex = lastIndex;
  } else if (DB.currentIndex > lastIndex) {
    DB.currentIndex = 0;
  }
  renderDialog();
  getElement(button.dataset.id).focus();
}

/**
 * Switches the dialog tab without drawing the whole dialog again, so the focus stays.
 * @param {HTMLElement} button The tab button with data-tab.
 */
function showTab(button) {
  DB.currentTab = button.dataset.tab;
  const buttons = document.querySelectorAll('.pokemon-dialog__tab');
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].setAttribute('aria-pressed', buttons[i] === button);
  }
  updatePanel();
}

/**
 * Draws the whole dialog for the current Pokémon and starts loading the evolution if its tab is open.
 */
function renderDialog() {
  const pokemon = getCurrentPokemon();
  getElement('dialog').innerHTML = Template.dialog(buildDialogView(pokemon));
  updateEvolution(pokemon);
}

/**
 * Prepares the values for the dialog (the template only inserts them).
 * @param {Object} pokemon One Pokémon.
 * @returns {Object} Values for Template.dialog.
 */
function buildDialogView(pokemon) {
  return {
    type: escapeHtml(pokemon.types[0]),
    idLabel: `#${pokemon.id}`,
    name: formatName(pokemon.name),
    image: escapeHtml(pokemon.image),
    typeIcons: buildTypeIcons(pokemon.types),
    tabButtons: buildTabButtons(),
    panel: buildPanel(pokemon)
  };
}

/**
 * Builds the HTML of the three tab buttons and marks the active one.
 * @returns {string} HTML text.
 */
function buildTabButtons() {
  let html = '';
  for (let i = 0; i < tabs.length; i++) {
    html += Template.tabButton(tabs[i][0], tabs[i][1], tabs[i][0] === DB.currentTab);
  }
  return html;
}

/**
 * Builds the content of the active tab.
 * @param {Object} pokemon One Pokémon.
 * @returns {string} HTML text.
 */
function buildPanel(pokemon) {
  return panelBuilders[DB.currentTab](pokemon);
}

/**
 * Replaces only the content of the tab area, e.g. after a tab click.
 */
function updatePanel() {
  const pokemon = getCurrentPokemon();
  getElement('dialog-panel').innerHTML = buildPanel(pokemon);
  updateEvolution(pokemon);
}

/**
 * Builds the About tab: height in cm, weight in kg, base experience and abilities.
 * @param {Object} pokemon One Pokémon.
 * @returns {string} HTML text.
 */
function buildAboutPanel(pokemon) {
  return Template.aboutPanel({
    height: `${pokemon.height * 10} cm`,
    weight: `${pokemon.weight / 10} kg`,
    baseExperience: pokemon.base_experience,
    abilities: buildAbilities(pokemon.abilities)
  });
}

/**
 * Joins the abilities to one readable text.
 * @param {string[]} abilities Ability names.
 * @returns {string} Text like 'Overgrow, Chlorophyll'.
 */
function buildAbilities(abilities) {
  const names = [];
  for (let i = 0; i < abilities.length; i++) {
    names.push(formatName(abilities[i]));
  }
  return names.join(', ');
}

/**
 * Builds the Base Stats tab in a fixed order with the total.
 * @param {Object} pokemon One Pokémon.
 * @returns {string} HTML text.
 */
function buildStatsPanel(pokemon) {
  let rows = '';
  let total = 0;
  for (let i = 0; i < statOrder.length; i++) {
    const value = pokemon.stats[statOrder[i][0]];
    total += value;
    rows += Template.statRow({ label: statOrder[i][1], value: value });
  }
  return Template.statsPanel(rows, total);
}

/**
 * Builds the Evolution tab from the cache, or a loading text while the chain is still missing.
 * @param {Object} pokemon One Pokémon.
 * @returns {string} HTML text.
 */
function buildEvolutionPanel(pokemon) {
  const chain = DB.evolutionCache[pokemon.id];
  if (chain === undefined) {
    return Template.message('Loading evolution…');
  }
  let steps = '';
  for (let i = 0; i < chain.length; i++) {
    steps += Template.evolutionStep(chain[i]);
  }
  return Template.evolutionPanel(steps);
}

/**
 * Loads the evolution chain if its tab is open and it is not in the cache yet.
 * @param {Object} pokemon One Pokémon.
 */
async function updateEvolution(pokemon) {
  if (needsEvolutionLoad(pokemon)) {
    await loadEvolution(pokemon);
  }
}

/**
 * Tells if the evolution chain must be loaded now (lazy loading).
 * @param {Object} pokemon One Pokémon.
 * @returns {boolean} True if the tab is open and the chain is not cached.
 */
function needsEvolutionLoad(pokemon) {
  if (DB.currentTab !== 'evolution') {
    return false;
  }
  return DB.evolutionCache[pokemon.id] === undefined;
}

/**
 * Loads the evolution chain, keeps it in the cache and shows it. Shows a message if loading fails.
 * @param {Object} pokemon One Pokémon.
 */
async function loadEvolution(pokemon) {
  try {
    DB.evolutionCache[pokemon.id] = await fetchEvolution(pokemon.speciesUrl);
    showEvolution(pokemon);
  } catch (error) {
    showPanelMessage(pokemon, 'Evolution could not be loaded.');
  }
}

/**
 * Shows the evolution chain, but only if the same Pokémon and tab are still open.
 * @param {Object} pokemon One Pokémon.
 */
function showEvolution(pokemon) {
  if (isShowingEvolution(pokemon)) {
    getElement('dialog-panel').innerHTML = buildEvolutionPanel(pokemon);
  }
}

/**
 * Checks that the dialog still shows the evolution tab of this Pokémon (the user may have moved on while loading).
 * @param {Object} pokemon One Pokémon.
 * @returns {boolean} True if still shown.
 */
function isShowingEvolution(pokemon) {
  return DB.currentTab === 'evolution' && getCurrentPokemon() === pokemon;
}

/**
 * Shows a short message in the tab area, but only while the evolution tab of this Pokémon is open.
 * @param {Object} pokemon One Pokémon.
 * @param {string} text Message.
 */
function showPanelMessage(pokemon, text) {
  if (isShowingEvolution(pokemon)) {
    getElement('dialog-panel').innerHTML = Template.message(text);
  }
}

/**
 * Loads the evolution chain of a Pokémon in two steps: first its species, then the chain from the species.
 * @param {string} speciesUrl Species address of the Pokémon.
 * @returns {Promise<{name: string, image: string}[]>} All Pokémon of the chain.
 */
async function fetchEvolution(speciesUrl) {
  const species = await fetchJson(speciesUrl);
  const chain = await fetchJson(species.evolution_chain.url);
  return flattenChain(chain.chain, []);
}

/**
 * Takes the id out of a PokéAPI address.
 * @param {string} url Address like https://pokeapi.co/api/v2/pokemon/25/.
 * @returns {string} The id, e.g. '25'.
 */
function getIdFromUrl(url) {
  const parts = url.split('/');
  return parts[parts.length - 2];
}

/**
 * Turns the branching chain into a flat list, step by step (calls itself for every branch).
 * @param {Object} node Part of the chain.
 * @param {Object[]} steps List that is filled.
 * @returns {Object[]} The steps with name and image.
 */
function flattenChain(node, steps) {
  const id = getIdFromUrl(node.species.url);
  const image = `${DB.imageUrl}/${id}.png`;
  steps.push({ name: formatName(node.species.name), image: image });
  for (let i = 0; i < node.evolves_to.length; i++) {
    flattenChain(node.evolves_to[i], steps);
  }
  return steps;
}

init();
