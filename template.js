/** Pure functions: values in, HTML text out. No DOM access. */
const Template = {
  /**
   * Type symbol as a round icon.
   * @param {string} type Type name in lower case, e.g. 'fire'.
   * @param {string} label Readable type name for screen readers.
   * @returns {string} HTML of the icon.
   */
  typeIcon(type, label) {
    return `<span class="type-icon type-icon--${type}">
      <img class="type-icon__image" src="assets/icons/types/${type}.svg" alt="${label}" title="${label}" width="24" height="24">
    </span>`;
  },

  /**
   * Small Pokémon card for the list.
   * @param {{index: number, type: string, idLabel: string, name: string, image: string, typeIcons: string}} view Prepared values.
   * @returns {string} HTML of one list item with the card button.
   */
  card(view) {
    return `<li class="pokemon-list__item">
      <button class="pokemon-card pokemon-card--${view.type}" type="button" data-id="card" data-action="open-dialog" data-index="${view.index}" aria-label="Open details of ${view.name}">
        <span class="pokemon-card__header">
          <span class="pokemon-card__id">${view.idLabel}</span>
          <span class="pokemon-card__name">${view.name}</span>
        </span>
        <span class="pokemon-card__stage">
          <img class="pokemon-card__image" data-id="card-image" src="${view.image}" alt="${view.name}" width="240" height="240" loading="lazy">
        </span>
        <span class="pokemon-card__types">${view.typeIcons}</span>
      </button>
    </li>`;
  },

  /**
   * Content of the large view.
   * @param {{type: string, idLabel: string, name: string, image: string, typeIcons: string, tabButtons: string, panel: string}} view Prepared values.
   * @returns {string} HTML of the dialog container.
   */
  dialog(view) {
    return `<div class="pokemon-dialog pokemon-dialog--${view.type}" data-id="overlay-pokemon-name">
      ${Template.dialogHeader(view)}
      <div class="pokemon-dialog__body">
        <div class="pokemon-dialog__tabs" role="group" aria-label="Pokémon details">${view.tabButtons}</div>
        <div class="pokemon-dialog__panel" data-id="dialog-panel" aria-live="polite">${view.panel}</div>
      </div>
      ${Template.dialogNavigation()}
    </div>`;
  },

  /**
   * Coloured top part of the dialog with name, types and image.
   * @param {{idLabel: string, name: string, image: string, typeIcons: string}} view Prepared values.
   * @returns {string} HTML of the dialog header.
   */
  dialogHeader(view) {
    return `<div class="pokemon-dialog__header">
      <button class="pokemon-dialog__close" type="button" data-id="close-dialog-button" data-action="close-dialog" aria-label="Close details">&times;</button>
      <p class="pokemon-dialog__id">${view.idLabel}</p>
      <h2 class="pokemon-dialog__name">${view.name}</h2>
      <div class="pokemon-dialog__types">${view.typeIcons}</div>
      <img class="pokemon-dialog__image" data-id="dialog-image" src="${view.image}" alt="${view.name}" width="240" height="240">
    </div>`;
  },

  /**
   * Arrow buttons for the previous and the next Pokémon.
   * @returns {string} HTML of the navigation.
   */
  dialogNavigation() {
    return `<div class="pokemon-dialog__navigation">
      <button class="pokemon-dialog__arrow" type="button" data-id="prev-button" data-action="previous-pokemon" aria-label="Show previous Pokémon">&larr;</button>
      <button class="pokemon-dialog__arrow" type="button" data-id="next-button" data-action="next-pokemon" aria-label="Show next Pokémon">&rarr;</button>
    </div>`;
  },

  /**
   * One tab button of the dialog.
   * @param {string} tab Tab key: 'about', 'stats' or 'evolution'.
   * @param {string} label Visible text.
   * @param {boolean} isActive True for the shown tab.
   * @returns {string} HTML of the button.
   */
  tabButton(tab, label, isActive) {
    return `<button class="pokemon-dialog__tab" type="button" data-action="show-tab" data-tab="${tab}" aria-pressed="${isActive}">${label}</button>`;
  },

  /**
   * Content of the About tab.
   * @param {{height: string, weight: string, baseExperience: number, abilities: string}} view Prepared values.
   * @returns {string} HTML of the list.
   */
  aboutPanel(view) {
    return `<dl class="pokemon-about">
      <dt>Height</dt><dd>${view.height}</dd>
      <dt>Weight</dt><dd>${view.weight}</dd>
      <dt>Base experience</dt><dd>${view.baseExperience}</dd>
      <dt>Abilities</dt><dd>${view.abilities}</dd>
    </dl>`;
  },

  /**
   * One row with a value bar.
   * @param {{label: string, value: number}} stat Name and value.
   * @returns {string} HTML of the list item.
   */
  statRow(stat) {
    return `<li class="pokemon-stats__row">
      <span class="pokemon-stats__label">${stat.label}</span>
      <span class="pokemon-stats__value">${stat.value}</span>
      <progress class="pokemon-stats__bar" value="${stat.value}" max="255" aria-label="${stat.label}: ${stat.value}"></progress>
    </li>`;
  },

  /**
   * Content of the Base Stats tab.
   * @param {string} rows HTML of all stat rows.
   * @param {number} total Sum of all values.
   * @returns {string} HTML of the panel.
   */
  statsPanel(rows, total) {
    return `<ul class="pokemon-stats" aria-label="Base stats">${rows}</ul>
    <p class="pokemon-stats__total">Total <strong>${total}</strong></p>`;
  },

  /**
   * One Pokémon of the evolution chain.
   * @param {{name: string, image: string}} step Name and image address.
   * @returns {string} HTML of the list item.
   */
  evolutionStep(step) {
    return `<li class="pokemon-evolution__step">
      <img class="pokemon-evolution__image" src="${step.image}" alt="" width="96" height="96" loading="lazy">
      <span class="pokemon-evolution__name">${step.name}</span>
    </li>`;
  },

  /**
   * Content of the Evolution tab.
   * @param {string} steps HTML of all steps.
   * @returns {string} HTML of the list.
   */
  evolutionPanel(steps) {
    return `<ul class="pokemon-evolution" aria-label="Evolution chain">${steps}</ul>`;
  },

  /**
   * Short text inside the dialog, e.g. while loading.
   * @param {string} text Message.
   * @returns {string} HTML of the paragraph.
   */
  message(text) {
    return `<p class="pokemon-dialog__message" role="status">${text}</p>`;
  },

  /**
   * Message for a search without results.
   * @returns {string} HTML of the paragraph.
   */
  notFound() {
    return `<p class="content__message" data-id="not-found" role="status">No match found.</p>`;
  },

  /**
   * Hint below the list, e.g. for a too short search.
   * @param {string} text Hint.
   * @returns {string} HTML of the paragraph.
   */
  hint(text) {
    return `<p class="content__message" role="status">${text}</p>`;
  },

  /**
   * Error message below the list.
   * @param {string} text Message.
   * @returns {string} HTML of the paragraph.
   */
  error(text) {
    return `<p class="content__message content__message--error" role="alert">${text}</p>`;
  },

  /**
   * Loading screen.
   * @returns {string} HTML of the loading screen.
   */
  loading() {
    return `<div class="loading" data-id="loading" role="status" aria-live="polite">
      <span class="loading__ball" aria-hidden="true"></span>
      <p class="loading__text">Loading…</p>
    </div>`;
  }
};
