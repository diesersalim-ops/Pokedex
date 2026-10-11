const clickActions = {
  'load-more': loadNextPage,
  'search': searchPokemon,
  'open-dialog': openDialog,
  'close-dialog': closeDialog,
  'previous-pokemon': showPrevious,
  'next-pokemon': showNext,
  'show-tab': showTab
};

const statOrder = [
  ['hp', 'HP'], ['attack', 'Attack'], ['defense', 'Defense'],
  ['special-attack', 'Sp. Atk'], ['special-defense', 'Sp. Def'], ['speed', 'Speed']
];

const tabs = [['about', 'About'], ['stats', 'Base Stats'], ['evolution', 'Evolution']];

const panelBuilders = {
  about: buildAboutPanel,
  stats: buildStatsPanel,
  evolution: buildEvolutionPanel
};

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);
  loadNextPage();
}

function handleKeydown(event) {
  if (event.key === 'Enter' && event.target === getElement('search-input')) {
    searchPokemon();
  }
}

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

function getElement(dataId) {
  return document.querySelector(`[data-id="${dataId}"]`);
}

async function loadNextPage() {
  if (DB.isLoading) {
    return;
  }
  startLoading();
  try {
    const page = await fetchPokemonPage();
    addToCache(page);
  } catch (error) {
    showError('Pokémon could not be loaded. Please try again.');
  } finally {
    stopLoading();
  }
}

async function fetchPokemonPage() {
  const result = await fetchJson(buildPageUrl());
  return objectToList(result);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return await response.json();
}

function buildPageUrl() {
  const startKey = String(DB.offset + 1).padStart(3, '0');
  const order = encodeURIComponent('"$key"');
  const start = encodeURIComponent(`"${startKey}"`);
  return `${DB.databaseUrl}/pokemon.json?orderBy=${order}&startAt=${start}&limitToFirst=${DB.pageSize}`;
}

function objectToList(result) {
  const list = [];
  const keys = Object.keys(result).sort();
  for (let i = 0; i < keys.length; i++) {
    list.push(result[keys[i]]);
  }
  return list;
}

function addToCache(page) {
  const firstIndex = DB.pokemonList.length;
  for (let i = 0; i < page.length; i++) {
    DB.pokemonList.push(page[i]);
  }
  DB.offset = DB.pokemonList.length;
  renderCards(page, firstIndex);
}

function renderCards(page, firstIndex) {
  let html = '';
  for (let i = 0; i < page.length; i++) {
    html += Template.card(buildCardView(page[i], firstIndex + i));
  }
  getElement('pokemon-list').insertAdjacentHTML('beforeend', html);
}

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

function buildTypeIcons(types) {
  let html = '';
  for (let i = 0; i < types.length; i++) {
    html += Template.typeIcon(escapeHtml(types[i]), formatName(types[i]));
  }
  return html;
}

function formatName(name) {
  const words = name.split('-');
  const capitalized = [];
  for (let i = 0; i < words.length; i++) {
    capitalized.push(words[i].charAt(0).toUpperCase() + words[i].slice(1));
  }
  return escapeHtml(capitalized.join(' '));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function startLoading() {
  DB.isLoading = true;
  removeMessages();
  getElement('load-more-button').disabled = true;
  getElement('search-button').disabled = true;
  document.body.insertAdjacentHTML('beforeend', Template.loading());
}

function stopLoading() {
  DB.isLoading = false;
  getElement('loading').remove();
  const button = getElement('load-more-button');
  button.disabled = false;
  getElement('search-button').disabled = false;
  button.hidden = shouldHideLoadMore();
}

function shouldHideLoadMore() {
  if (DB.isSearchActive) {
    return true;
  }
  return DB.offset >= DB.totalPokemon;
}

function showError(message) {
  getElement('pokemon-list').insertAdjacentHTML('afterend', Template.error(message));
}

function removeMessages() {
  const messages = document.querySelectorAll('.content__message');
  for (let i = 0; i < messages.length; i++) {
    messages[i].remove();
  }
}

async function searchPokemon() {
  const term = getElement('search-input').value.trim().toLowerCase();
  removeMessages();
  if (term === '') {
    resetSearch();
  } else if (term.length < 3) {
    getElement('pokemon-list').insertAdjacentHTML('afterend', Template.hint('Please enter at least 3 letters.'));
  } else {
    await runSearch(term);
  }
}

async function runSearch(term) {
  if (DB.isLoading) {
    return;
  }
  startLoading();
  try {
    await loadAllPokemon();
    showResults(findMatches(term));
  } catch (error) {
    showError('Search failed. Please try again.');
  } finally {
    stopLoading();
  }
}

async function loadAllPokemon() {
  if (DB.allPokemon.length === 0) {
    DB.allPokemon = objectToList(await fetchJson(`${DB.databaseUrl}/pokemon.json`));
  }
}

function findMatches(term) {
  return DB.allPokemon.filter((pokemon) => pokemon.name.includes(term));
}

function showResults(results) {
  DB.searchResults = results;
  DB.isSearchActive = true;
  getElement('pokemon-list').innerHTML = '';
  renderCards(results, 0);
  if (results.length === 0) {
    getElement('pokemon-list').insertAdjacentHTML('afterend', Template.notFound());
  }
}

function resetSearch() {
  if (!DB.isSearchActive) {
    return;
  }
  DB.isSearchActive = false;
  getElement('pokemon-list').innerHTML = '';
  renderCards(DB.pokemonList, 0);
  getElement('load-more-button').hidden = shouldHideLoadMore();
}

function getCurrentList() {
  if (DB.isSearchActive) {
    return DB.searchResults;
  }
  return DB.pokemonList;
}

function getCurrentPokemon() {
  return getCurrentList()[DB.currentIndex];
}

function openDialog(button) {
  DB.currentIndex = Number(button.dataset.index);
  DB.currentTab = 'about';
  renderDialog();
  getElement('dialog').showModal();
}

function closeDialog() {
  getElement('dialog').close();
}

function showPrevious(button) {
  showNeighbor(-1, button);
}

function showNext(button) {
  showNeighbor(1, button);
}

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

function showTab(button) {
  DB.currentTab = button.dataset.tab;
  const buttons = document.querySelectorAll('.pokemon-dialog__tab');
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].setAttribute('aria-pressed', buttons[i] === button);
  }
  updatePanel();
}

function renderDialog() {
  const pokemon = getCurrentPokemon();
  getElement('dialog').innerHTML = Template.dialog(buildDialogView(pokemon));
  updateEvolution(pokemon);
}

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

function buildTabButtons() {
  let html = '';
  for (let i = 0; i < tabs.length; i++) {
    html += Template.tabButton(tabs[i][0], tabs[i][1], tabs[i][0] === DB.currentTab);
  }
  return html;
}

function buildPanel(pokemon) {
  return panelBuilders[DB.currentTab](pokemon);
}

function updatePanel() {
  const pokemon = getCurrentPokemon();
  getElement('dialog-panel').innerHTML = buildPanel(pokemon);
  updateEvolution(pokemon);
}

function buildAboutPanel(pokemon) {
  return Template.aboutPanel({
    height: `${pokemon.height * 10} cm`,
    weight: `${pokemon.weight / 10} kg`,
    baseExperience: pokemon.base_experience,
    abilities: buildAbilities(pokemon.abilities)
  });
}

function buildAbilities(abilities) {
  const names = [];
  for (let i = 0; i < abilities.length; i++) {
    names.push(formatName(abilities[i]));
  }
  return names.join(', ');
}

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

async function updateEvolution(pokemon) {
  if (needsEvolutionLoad(pokemon)) {
    await loadEvolution(pokemon);
  }
}

function needsEvolutionLoad(pokemon) {
  if (DB.currentTab !== 'evolution') {
    return false;
  }
  return DB.evolutionCache[pokemon.id] === undefined;
}

async function loadEvolution(pokemon) {
  try {
    DB.evolutionCache[pokemon.id] = await fetchEvolution(pokemon.id);
    showEvolution(pokemon);
  } catch (error) {
    showPanelMessage(pokemon, 'Evolution could not be loaded.');
  }
}

function showEvolution(pokemon) {
  if (isShowingEvolution(pokemon)) {
    getElement('dialog-panel').innerHTML = buildEvolutionPanel(pokemon);
  }
}

function isShowingEvolution(pokemon) {
  return DB.currentTab === 'evolution' && getCurrentPokemon() === pokemon;
}

function showPanelMessage(pokemon, text) {
  if (isShowingEvolution(pokemon)) {
    getElement('dialog-panel').innerHTML = Template.message(text);
  }
}

async function fetchEvolution(id) {
  const species = await fetchJson(`${DB.pokeApiUrl}/pokemon-species/${id}`);
  const chain = await fetchJson(species.evolution_chain.url);
  return flattenChain(chain.chain, []);
}

function getIdFromUrl(url) {
  const parts = url.split('/');
  return parts[parts.length - 2];
}

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
