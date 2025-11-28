/**
 * Pelican Bingo - A family event bingo game
 */

import LZString from "lz-string";
import qrcode from "qrcode-generator";

// ============================================
// Type Definitions
// ============================================

interface Relative {
  name: string;
  phrases: string[];
}

interface EventConfig {
  eventId: string;
  playerName: string;
  maxRelatives: number;
  phrasesPerRelative: number;
}

interface BingoCell {
  relative: string;
  phrase: string;
  checked: boolean;
}

interface CardState {
  cells: BingoCell[];
  rows: number;
  cols: number;
  eventId: string;
  playerName: string;
  maxRelatives: number;
  phrasesPerRelative: number;
}

interface ShareBlob {
  schema: number;
  gameConfig: {
    relatives: Relative[];
  };
  eventConfig: {
    eventId: string;
    maxRelatives: number;
    phrasesPerRelative: number;
  };
}

interface AppState {
  relatives: Relative[];
  eventConfig: EventConfig | null;
  cardState: CardState | null;
}

// ============================================
// PRNG (Mulberry32) for deterministic randomness
// ============================================

function mulberry32(seed: number): () => number {
  return function (): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededShuffle<T>(array: T[], rng: () => number): T[] {
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
} as const;

// ============================================
// State Management
// ============================================

const state: AppState = {
  relatives: [],
  eventConfig: null,
  cardState: null,
};

function loadState(): void {
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

function saveRelatives(): void {
  localStorage.setItem(STORAGE_KEYS.RELATIVES, JSON.stringify(state.relatives));
}

function saveEventConfig(): void {
  localStorage.setItem(
    STORAGE_KEYS.EVENT_CONFIG,
    JSON.stringify(state.eventConfig)
  );
}

function saveCardState(): void {
  localStorage.setItem(STORAGE_KEYS.CARD_STATE, JSON.stringify(state.cardState));
}

// ============================================
// Card Generation
// ============================================

interface GeneratedCard {
  cells: BingoCell[];
  rows: number;
  cols: number;
}

function generateCard(
  eventId: string,
  playerName: string,
  relatives: Relative[],
  maxRelatives: number,
  phrasesPerRelative: number
): GeneratedCard {
  const seed = hashString(eventId + ":" + playerName);
  const rng = mulberry32(seed);

  // Filter relatives that have at least one phrase
  const validRelatives = relatives.filter(
    (r) => r.phrases && r.phrases.length > 0
  );

  if (validRelatives.length === 0) {
    return { cells: [], rows: 0, cols: 0 };
  }

  // Shuffle and pick relatives
  const shuffledRelatives = seededShuffle(validRelatives, rng);
  const selectedRelatives = shuffledRelatives.slice(
    0,
    Math.min(maxRelatives, shuffledRelatives.length)
  );

  // Build cells organized by relative (each row = one relative)
  const cells: BingoCell[] = [];

  for (const relative of selectedRelatives) {
    const shuffledPhrases = seededShuffle(relative.phrases, rng);
    const selectedPhrases = shuffledPhrases.slice(
      0,
      Math.min(phrasesPerRelative, shuffledPhrases.length)
    );

    for (const phrase of selectedPhrases) {
      cells.push({
        relative: relative.name,
        phrase: phrase,
        checked: false,
      });
    }
  }

  const rows = selectedRelatives.length;
  const cols = phrasesPerRelative;

  // Pad rows that have fewer phrases than phrasesPerRelative
  const paddedCells: BingoCell[] = [];
  let cellIndex = 0;
  for (const relative of selectedRelatives) {
    const phrasesForRelative: BingoCell[] = [];
    // Collect all cells for this relative
    while (cellIndex < cells.length && cells[cellIndex].relative === relative.name) {
      phrasesForRelative.push(cells[cellIndex]);
      cellIndex++;
    }
    // Add the phrases we have
    for (const cell of phrasesForRelative) {
      paddedCells.push(cell);
    }
    // Pad with empty cells if needed
    for (let i = phrasesForRelative.length; i < cols; i++) {
      paddedCells.push({
        relative: relative.name,
        phrase: "(empty)",
        checked: false,
      });
    }
  }

  return { cells: paddedCells, rows, cols };
}

// ============================================
// Bingo Detection
// ============================================

function checkBingo(cells: BingoCell[], rows: number, cols: number): boolean {
  if (rows === 0 || cols === 0) return false;

  // Convert flat array to 2D grid
  const grid: BingoCell[][] = [];
  for (let row = 0; row < rows; row++) {
    grid.push(cells.slice(row * cols, (row + 1) * cols));
  }

  // Check rows
  for (let row = 0; row < rows; row++) {
    if (grid[row].every((cell) => cell.checked)) {
      return true;
    }
  }

  // Check columns
  for (let col = 0; col < cols; col++) {
    let allChecked = true;
    for (let row = 0; row < rows; row++) {
      if (!grid[row][col].checked) {
        allChecked = false;
        break;
      }
    }
    if (allChecked) return true;
  }

  // Only check diagonals if the grid is square
  if (rows === cols) {
    const size = rows;

    // Check main diagonal (top-left to bottom-right)
    let mainDiag = true;
    for (let i = 0; i < size; i++) {
      if (!grid[i][i].checked) {
        mainDiag = false;
        break;
      }
    }
    if (mainDiag) return true;

    // Check anti-diagonal (top-right to bottom-left)
    let antiDiag = true;
    for (let i = 0; i < size; i++) {
      if (!grid[i][size - 1 - i].checked) {
        antiDiag = false;
        break;
      }
    }
    if (antiDiag) return true;
  }

  return false;
}

// ============================================
// UI Rendering
// ============================================

function showScreen(screenId: string): void {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.add("hidden");
  });
  document.getElementById(screenId)?.classList.remove("hidden");
}

function renderRelativesList(): void {
  const container = document.getElementById("relatives-list");
  if (!container) return;

  if (state.relatives.length === 0) {
    container.innerHTML =
      '<p class="empty-message">No relatives added yet. Add some above!</p>';
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

function renderBingoCard(): void {
  const container = document.getElementById("bingo-card") as HTMLElement | null;
  if (!container || !state.cardState || !state.eventConfig) return;

  const { cells, rows, cols } = state.cardState;

  container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

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
  const playerInfo = document.getElementById("player-info");
  if (playerInfo) {
    playerInfo.textContent = `${state.eventConfig.playerName} @ ${state.eventConfig.eventId}`;
  }

  // Check for bingo
  const hasBingo = checkBingo(cells, rows, cols);
  document.getElementById("bingo-message")?.classList.toggle("hidden", !hasBingo);
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// QR Code Sharing
// ============================================

function generateShareURL(): string {
  const eventIdInput = document.getElementById("event-id") as HTMLInputElement | null;
  const maxRelativesInput = document.getElementById("max-relatives") as HTMLInputElement | null;
  const phrasesInput = document.getElementById("phrases-per-relative") as HTMLInputElement | null;

  const eventId = eventIdInput?.value.trim() ?? "";
  const maxRelatives = parseInt(maxRelativesInput?.value ?? "5") || 5;
  const phrasesPerRelative = parseInt(phrasesInput?.value ?? "5") || 5;

  const shareBlob: ShareBlob = {
    schema: 1,
    gameConfig: {
      relatives: state.relatives,
    },
    eventConfig: {
      eventId: eventId,
      maxRelatives: maxRelatives,
      phrasesPerRelative: phrasesPerRelative,
    },
  };

  const json = JSON.stringify(shareBlob);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const baseURL = window.location.origin + window.location.pathname;
  return baseURL + "#pelican=" + compressed;
}

function showQRCode(url: string): void {
  const container = document.getElementById("qr-code-container");
  if (!container) return;

  container.innerHTML = "";

  // Use type 0 for auto-detect size
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();

  // Create SVG for better quality
  container.innerHTML = qr.createSvgTag(4, 0);

  document.getElementById("qr-modal")?.classList.remove("hidden");
}

function parseSharedLink(): ShareBlob | null {
  const hash = window.location.hash;
  if (!hash || !hash.includes("pelican=")) {
    return null;
  }

  try {
    const encoded = hash.split("pelican=")[1];
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;

    const data = JSON.parse(json) as ShareBlob;
    if (data.schema !== 1) {
      console.warn("Unknown schema version:", data.schema);
      return null;
    }

    return data;
  } catch (e) {
    console.error("Error parsing shared link:", e);
    return null;
  }
}

function loadSharedConfig(data: ShareBlob): string {
  // Overwrite relatives config
  if (data.gameConfig && data.gameConfig.relatives) {
    state.relatives = data.gameConfig.relatives;
    saveRelatives();
  }

  // Overwrite event config (except playerName which user should enter)
  if (data.eventConfig) {
    state.eventConfig = {
      eventId: data.eventConfig.eventId || "",
      playerName: "",
      maxRelatives: data.eventConfig.maxRelatives || 5,
      phrasesPerRelative: data.eventConfig.phrasesPerRelative || 5,
    };
    saveEventConfig();
  }

  // Clear any existing card state
  state.cardState = null;
  localStorage.removeItem(STORAGE_KEYS.CARD_STATE);

  // Clear the hash from URL
  history.replaceState(null, "", window.location.pathname);

  return data.eventConfig?.eventId || "shared event";
}

function showBanner(message: string): void {
  const banner = document.getElementById("shared-link-banner");
  const bannerMessage = document.getElementById("banner-message");
  if (bannerMessage) {
    bannerMessage.textContent = message;
  }
  banner?.classList.remove("hidden");
}

// ============================================
// Event Handlers
// ============================================

function setupEventHandlers(): void {
  // Config screen
  document.getElementById("add-relative-btn")?.addEventListener("click", () => {
    const input = document.getElementById("new-relative-name") as HTMLInputElement | null;
    const name = input?.value.trim() ?? "";
    if (name) {
      state.relatives.push({ name, phrases: [] });
      saveRelatives();
      renderRelativesList();
      if (input) input.value = "";
    }
  });

  document.getElementById("new-relative-name")?.addEventListener("keypress", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      document.getElementById("add-relative-btn")?.click();
    }
  });

  document.getElementById("relatives-list")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;

    if (action === "delete-relative") {
      const index = parseInt(target.dataset.index ?? "0");
      state.relatives.splice(index, 1);
      saveRelatives();
      renderRelativesList();
    }

    if (action === "delete-phrase") {
      const relIndex = parseInt(target.dataset.rel ?? "0");
      const phraseIndex = parseInt(target.dataset.phrase ?? "0");
      state.relatives[relIndex].phrases.splice(phraseIndex, 1);
      saveRelatives();
      renderRelativesList();
    }

    if (action === "add-phrase") {
      const relIndex = parseInt(target.dataset.rel ?? "0");
      const input = document.querySelector(
        `.phrase-input[data-rel="${relIndex}"]`
      ) as HTMLInputElement | null;
      const phrase = input?.value.trim() ?? "";
      if (phrase) {
        state.relatives[relIndex].phrases.push(phrase);
        saveRelatives();
        renderRelativesList();
      }
    }
  });

  document.getElementById("relatives-list")?.addEventListener("keypress", (e) => {
    const target = e.target as HTMLElement;
    if ((e as KeyboardEvent).key === "Enter" && target.classList.contains("phrase-input")) {
      const relIndex = (target as HTMLInputElement).dataset.rel;
      document
        .querySelector(`button[data-action="add-phrase"][data-rel="${relIndex}"]`)
        ?.dispatchEvent(new Event("click"));
    }
  });

  document.getElementById("to-event-setup-btn")?.addEventListener("click", () => {
    if (state.relatives.length === 0) {
      alert("Please add at least one relative with catchphrases first!");
      return;
    }

    const hasAnyPhrases = state.relatives.some(
      (r) => r.phrases && r.phrases.length > 0
    );
    if (!hasAnyPhrases) {
      alert("Please add at least one catchphrase to a relative!");
      return;
    }

    // Restore previous event config if available
    if (state.eventConfig) {
      const eventIdInput = document.getElementById("event-id") as HTMLInputElement | null;
      const playerNameInput = document.getElementById("player-name") as HTMLInputElement | null;
      const maxRelativesInput = document.getElementById("max-relatives") as HTMLInputElement | null;
      const phrasesInput = document.getElementById("phrases-per-relative") as HTMLInputElement | null;

      if (eventIdInput) eventIdInput.value = state.eventConfig.eventId || "";
      if (playerNameInput) playerNameInput.value = state.eventConfig.playerName || "";
      if (maxRelativesInput) maxRelativesInput.value = String(state.eventConfig.maxRelatives || 5);
      if (phrasesInput) phrasesInput.value = String(state.eventConfig.phrasesPerRelative || 5);
    }

    showScreen("event-setup-screen");
  });

  // Event setup screen
  document.getElementById("back-to-config-btn")?.addEventListener("click", () => {
    showScreen("config-screen");
  });

  document.getElementById("start-game-btn")?.addEventListener("click", () => {
    const eventIdInput = document.getElementById("event-id") as HTMLInputElement | null;
    const playerNameInput = document.getElementById("player-name") as HTMLInputElement | null;
    const maxRelativesInput = document.getElementById("max-relatives") as HTMLInputElement | null;
    const phrasesInput = document.getElementById("phrases-per-relative") as HTMLInputElement | null;

    const eventId = eventIdInput?.value.trim() ?? "";
    const playerName = playerNameInput?.value.trim() ?? "";
    const maxRelatives = parseInt(maxRelativesInput?.value ?? "5") || 5;
    const phrasesPerRelative = parseInt(phrasesInput?.value ?? "5") || 5;

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
    };
    saveEventConfig();

    // Check if we have an existing card for this event/player combo
    if (
      state.cardState &&
      state.cardState.eventId === eventId &&
      state.cardState.playerName === playerName &&
      state.cardState.maxRelatives === maxRelatives &&
      state.cardState.phrasesPerRelative === phrasesPerRelative
    ) {
      // Use existing card
    } else {
      // Generate new card
      const card = generateCard(
        eventId,
        playerName,
        state.relatives,
        maxRelatives,
        phrasesPerRelative
      );
      state.cardState = {
        ...card,
        eventId,
        playerName,
        maxRelatives,
        phrasesPerRelative,
      };
      saveCardState();
    }

    renderBingoCard();
    showScreen("game-screen");
  });

  // Game screen
  document.getElementById("bingo-card")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const cell = target.closest(".bingo-cell") as HTMLElement | null;
    if (cell && state.cardState) {
      const index = parseInt(cell.dataset.index ?? "0");
      state.cardState.cells[index].checked = !state.cardState.cells[index].checked;
      saveCardState();
      renderBingoCard();
    }
  });

  document.getElementById("reset-card-btn")?.addEventListener("click", () => {
    if (confirm("Reset all checked cells?") && state.cardState) {
      state.cardState.cells.forEach((cell) => (cell.checked = false));
      saveCardState();
      renderBingoCard();
    }
  });

  document.getElementById("new-game-btn")?.addEventListener("click", () => {
    state.cardState = null;
    localStorage.removeItem(STORAGE_KEYS.CARD_STATE);
    showScreen("event-setup-screen");
  });

  // QR Code modal
  document.getElementById("generate-qr-btn")?.addEventListener("click", () => {
    const eventIdInput = document.getElementById("event-id") as HTMLInputElement | null;
    const eventId = eventIdInput?.value.trim() ?? "";

    if (!eventId) {
      alert("Please enter an Event ID first!");
      return;
    }

    if (state.relatives.length === 0) {
      alert("Please configure relatives first!");
      return;
    }

    const url = generateShareURL();
    showQRCode(url);
  });

  document.getElementById("close-qr-btn")?.addEventListener("click", () => {
    document.getElementById("qr-modal")?.classList.add("hidden");
  });

  document.getElementById("qr-modal")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "qr-modal") {
      document.getElementById("qr-modal")?.classList.add("hidden");
    }
  });

  // Banner
  document.getElementById("close-banner-btn")?.addEventListener("click", () => {
    document.getElementById("shared-link-banner")?.classList.add("hidden");
  });
}

// ============================================
// Initialization
// ============================================

function init(): void {
  // Check for shared link before loading state
  const sharedData = parseSharedLink();

  loadState();

  // If we have shared data, load it and show banner
  if (sharedData) {
    const eventId = loadSharedConfig(sharedData);
    showBanner(`Loaded event "${eventId}" from shared link.`);
  }

  setupEventHandlers();
  renderRelativesList();

  // If we loaded from a shared link, go to event setup
  if (sharedData) {
    // Pre-fill the event setup form
    if (state.eventConfig) {
      const eventIdInput = document.getElementById("event-id") as HTMLInputElement | null;
      const playerNameInput = document.getElementById("player-name") as HTMLInputElement | null;
      const maxRelativesInput = document.getElementById("max-relatives") as HTMLInputElement | null;
      const phrasesInput = document.getElementById("phrases-per-relative") as HTMLInputElement | null;

      if (eventIdInput) eventIdInput.value = state.eventConfig.eventId || "";
      if (playerNameInput) playerNameInput.value = "";
      if (maxRelativesInput) maxRelativesInput.value = String(state.eventConfig.maxRelatives || 5);
      if (phrasesInput) phrasesInput.value = String(state.eventConfig.phrasesPerRelative || 5);
    }
    showScreen("event-setup-screen");
  } else if (state.cardState && state.eventConfig) {
    // Check if we have an active game to resume
    renderBingoCard();
    showScreen("game-screen");
  } else {
    showScreen("config-screen");
  }
}

document.addEventListener("DOMContentLoaded", init);
