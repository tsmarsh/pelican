/**
 * Pelican Bingo - A family event bingo game
 */

// ============================================
// PRNG (Mulberry32) for deterministic randomness
// ============================================

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededShuffle(array, rng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  RELATIVES: "pelican_relatives",
  EVENT_CONFIG: "pelican_event_config",
  CARD_STATE: "pelican_card_state",
};

// ============================================
// State Management
// ============================================

const state = {
  relatives: [],
  eventConfig: null,
  cardState: null,
};

function loadState() {
  try {
    const relativesData = localStorage.getItem(STORAGE_KEYS.RELATIVES);
    state.relatives = relativesData ? JSON.parse(relativesData) : [];

    const eventData = localStorage.getItem(STORAGE_KEYS.EVENT_CONFIG);
    state.eventConfig = eventData ? JSON.parse(eventData) : null;

    const cardData = localStorage.getItem(STORAGE_KEYS.CARD_STATE);
    state.cardState = cardData ? JSON.parse(cardData) : null;
  } catch (e) {
    console.error("Error loading state:", e);
    state.relatives = [];
    state.eventConfig = null;
    state.cardState = null;
  }
}

function saveRelatives() {
  localStorage.setItem(STORAGE_KEYS.RELATIVES, JSON.stringify(state.relatives));
}

function saveEventConfig() {
  localStorage.setItem(
    STORAGE_KEYS.EVENT_CONFIG,
    JSON.stringify(state.eventConfig)
  );
}

function saveCardState() {
  localStorage.setItem(STORAGE_KEYS.CARD_STATE, JSON.stringify(state.cardState));
}

// ============================================
// Card Generation
// ============================================

function generateCard(eventId, playerName, relatives, maxRelatives, phrasesPerRelative, gridSize) {
  const seed = hashString(eventId + ":" + playerName);
  const rng = mulberry32(seed);

  const totalCells = gridSize * gridSize;

  // Filter relatives that have at least one phrase
  const validRelatives = relatives.filter((r) => r.phrases && r.phrases.length > 0);

  if (validRelatives.length === 0) {
    return { cells: [], gridSize };
  }

  // Shuffle and pick relatives
  const shuffledRelatives = seededShuffle(validRelatives, rng);
  const selectedRelatives = shuffledRelatives.slice(0, Math.min(maxRelatives, shuffledRelatives.length));

  // Build pool of phrases
  const phrasePool = [];
  for (const relative of selectedRelatives) {
    const shuffledPhrases = seededShuffle(relative.phrases, rng);
    const selectedPhrases = shuffledPhrases.slice(0, Math.min(phrasesPerRelative, shuffledPhrases.length));
    for (const phrase of selectedPhrases) {
      phrasePool.push({
        relative: relative.name,
        phrase: phrase,
      });
    }
  }

  // Shuffle the phrase pool
  const shuffledPool = seededShuffle(phrasePool, rng);

  // Fill cells (up to gridSize * gridSize)
  const cells = [];
  for (let i = 0; i < Math.min(totalCells, shuffledPool.length); i++) {
    cells.push({
      ...shuffledPool[i],
      checked: false,
    });
  }

  // If we don't have enough phrases, pad with empty cells
  while (cells.length < totalCells) {
    cells.push({
      relative: "",
      phrase: "(empty)",
      checked: false,
    });
  }

  return { cells, gridSize };
}

// ============================================
// Bingo Detection
// ============================================

function checkBingo(cells, gridSize) {
  // Convert flat array to 2D grid
  const grid = [];
  for (let row = 0; row < gridSize; row++) {
    grid.push(cells.slice(row * gridSize, (row + 1) * gridSize));
  }

  // Check rows
  for (let row = 0; row < gridSize; row++) {
    if (grid[row].every((cell) => cell.checked)) {
      return true;
    }
  }

  // Check columns
  for (let col = 0; col < gridSize; col++) {
    let allChecked = true;
    for (let row = 0; row < gridSize; row++) {
      if (!grid[row][col].checked) {
        allChecked = false;
        break;
      }
    }
    if (allChecked) return true;
  }

  // Check main diagonal (top-left to bottom-right)
  let mainDiag = true;
  for (let i = 0; i < gridSize; i++) {
    if (!grid[i][i].checked) {
      mainDiag = false;
      break;
    }
  }
  if (mainDiag) return true;

  // Check anti-diagonal (top-right to bottom-left)
  let antiDiag = true;
  for (let i = 0; i < gridSize; i++) {
    if (!grid[i][gridSize - 1 - i].checked) {
      antiDiag = false;
      break;
    }
  }
  if (antiDiag) return true;

  return false;
}

// ============================================
// UI Rendering
// ============================================

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.add("hidden");
  });
  document.getElementById(screenId).classList.remove("hidden");
}

function renderRelativesList() {
  const container = document.getElementById("relatives-list");

  if (state.relatives.length === 0) {
    container.innerHTML = '<p class="empty-message">No relatives added yet. Add some above!</p>';
    return;
  }

  container.innerHTML = state.relatives
    .map(
      (relative, relIndex) => `
    <div class="relative-item" data-index="${relIndex}">
      <div class="relative-header">
        <span class="relative-name">${escapeHtml(relative.name)}</span>
        <button class="relative-delete" data-action="delete-relative" data-index="${relIndex}">Delete</button>
      </div>
      <div class="phrases-container">
        ${relative.phrases
          .map(
            (phrase, phraseIndex) => `
          <div class="phrase-item">
            <span class="phrase-text">${escapeHtml(phrase)}</span>
            <button class="phrase-delete" data-action="delete-phrase" data-rel="${relIndex}" data-phrase="${phraseIndex}">x</button>
          </div>
        `
          )
          .join("")}
        <div class="add-phrase-form">
          <input type="text" placeholder="Add catchphrase" data-rel="${relIndex}" class="phrase-input">
          <button data-action="add-phrase" data-rel="${relIndex}">Add</button>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function renderBingoCard() {
  const container = document.getElementById("bingo-card");
  const { cells, gridSize } = state.cardState;

  container.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;

  container.innerHTML = cells
    .map(
      (cell, index) => `
    <div class="bingo-cell ${cell.checked ? "checked" : ""}" data-index="${index}">
      <span class="relative-label">${escapeHtml(cell.relative)}</span>
      ${escapeHtml(cell.phrase)}
    </div>
  `
    )
    .join("");

  // Update player info
  document.getElementById("player-info").textContent = `${state.eventConfig.playerName} @ ${state.eventConfig.eventId}`;

  // Check for bingo
  const hasBingo = checkBingo(cells, gridSize);
  document.getElementById("bingo-message").classList.toggle("hidden", !hasBingo);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Event Handlers
// ============================================

function setupEventHandlers() {
  // Config screen
  document.getElementById("add-relative-btn").addEventListener("click", () => {
    const input = document.getElementById("new-relative-name");
    const name = input.value.trim();
    if (name) {
      state.relatives.push({ name, phrases: [] });
      saveRelatives();
      renderRelativesList();
      input.value = "";
    }
  });

  document.getElementById("new-relative-name").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      document.getElementById("add-relative-btn").click();
    }
  });

  document.getElementById("relatives-list").addEventListener("click", (e) => {
    const action = e.target.dataset.action;

    if (action === "delete-relative") {
      const index = parseInt(e.target.dataset.index);
      state.relatives.splice(index, 1);
      saveRelatives();
      renderRelativesList();
    }

    if (action === "delete-phrase") {
      const relIndex = parseInt(e.target.dataset.rel);
      const phraseIndex = parseInt(e.target.dataset.phrase);
      state.relatives[relIndex].phrases.splice(phraseIndex, 1);
      saveRelatives();
      renderRelativesList();
    }

    if (action === "add-phrase") {
      const relIndex = parseInt(e.target.dataset.rel);
      const input = document.querySelector(`.phrase-input[data-rel="${relIndex}"]`);
      const phrase = input.value.trim();
      if (phrase) {
        state.relatives[relIndex].phrases.push(phrase);
        saveRelatives();
        renderRelativesList();
      }
    }
  });

  document.getElementById("relatives-list").addEventListener("keypress", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("phrase-input")) {
      const relIndex = e.target.dataset.rel;
      document.querySelector(`button[data-action="add-phrase"][data-rel="${relIndex}"]`).click();
    }
  });

  document.getElementById("to-event-setup-btn").addEventListener("click", () => {
    if (state.relatives.length === 0) {
      alert("Please add at least one relative with catchphrases first!");
      return;
    }

    const hasAnyPhrases = state.relatives.some((r) => r.phrases && r.phrases.length > 0);
    if (!hasAnyPhrases) {
      alert("Please add at least one catchphrase to a relative!");
      return;
    }

    // Restore previous event config if available
    if (state.eventConfig) {
      document.getElementById("event-id").value = state.eventConfig.eventId || "";
      document.getElementById("player-name").value = state.eventConfig.playerName || "";
      document.getElementById("max-relatives").value = state.eventConfig.maxRelatives || 5;
      document.getElementById("phrases-per-relative").value = state.eventConfig.phrasesPerRelative || 5;
      document.getElementById("grid-size").value = state.eventConfig.gridSize || 5;
    }

    showScreen("event-setup-screen");
  });

  // Event setup screen
  document.getElementById("back-to-config-btn").addEventListener("click", () => {
    showScreen("config-screen");
  });

  document.getElementById("start-game-btn").addEventListener("click", () => {
    const eventId = document.getElementById("event-id").value.trim();
    const playerName = document.getElementById("player-name").value.trim();
    const maxRelatives = parseInt(document.getElementById("max-relatives").value) || 5;
    const phrasesPerRelative = parseInt(document.getElementById("phrases-per-relative").value) || 5;
    const gridSize = parseInt(document.getElementById("grid-size").value) || 5;

    if (!eventId) {
      alert("Please enter an Event ID!");
      return;
    }
    if (!playerName) {
      alert("Please enter your name!");
      return;
    }

    state.eventConfig = {
      eventId,
      playerName,
      maxRelatives,
      phrasesPerRelative,
      gridSize,
    };
    saveEventConfig();

    // Check if we have an existing card for this event/player combo
    if (
      state.cardState &&
      state.cardState.eventId === eventId &&
      state.cardState.playerName === playerName &&
      state.cardState.gridSize === gridSize
    ) {
      // Use existing card
    } else {
      // Generate new card
      const card = generateCard(
        eventId,
        playerName,
        state.relatives,
        maxRelatives,
        phrasesPerRelative,
        gridSize
      );
      state.cardState = {
        ...card,
        eventId,
        playerName,
      };
      saveCardState();
    }

    renderBingoCard();
    showScreen("game-screen");
  });

  // Game screen
  document.getElementById("bingo-card").addEventListener("click", (e) => {
    const cell = e.target.closest(".bingo-cell");
    if (cell) {
      const index = parseInt(cell.dataset.index);
      state.cardState.cells[index].checked = !state.cardState.cells[index].checked;
      saveCardState();
      renderBingoCard();
    }
  });

  document.getElementById("reset-card-btn").addEventListener("click", () => {
    if (confirm("Reset all checked cells?")) {
      state.cardState.cells.forEach((cell) => (cell.checked = false));
      saveCardState();
      renderBingoCard();
    }
  });

  document.getElementById("new-game-btn").addEventListener("click", () => {
    state.cardState = null;
    localStorage.removeItem(STORAGE_KEYS.CARD_STATE);
    showScreen("event-setup-screen");
  });
}

// ============================================
// Initialization
// ============================================

function init() {
  loadState();
  setupEventHandlers();
  renderRelativesList();

  // Check if we have an active game to resume
  if (state.cardState && state.eventConfig) {
    renderBingoCard();
    showScreen("game-screen");
  } else {
    showScreen("config-screen");
  }
}

document.addEventListener("DOMContentLoaded", init);
