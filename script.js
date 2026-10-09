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
