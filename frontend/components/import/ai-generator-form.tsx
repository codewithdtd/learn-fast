"use client";

import { useEffect, useState } from "react";

import { AIPreviewDeck } from "@/components/import/ai-preview-deck";
import { Icon } from "@/components/layout/app-shell";
import { useAuth } from "@/context/auth-context";
import {
  generateAICards,
  getWorkbook,
  getWorkbooks,
  mineAICards,
  type AIGeneratedCardItem,
  type SheetSummary,
  type WorkbookListItem,
} from "@/services/api";

const QUICK_TOPICS = [
  { label: "🏢 Office Meetings", value: "Office Meetings & Status Updates" },
  { label: "☕ Everyday Conversation", value: "Everyday Small Talk & Socializing" },
  { label: "✈️ Travel & Commuting", value: "Travel, Airport & Commuting" },
  { label: "💼 Job Interviews", value: "Job Interview & Career Background" },
  { label: "🍽️ Dining & Food", value: "Dining Out & Ordering Food" },
  { label: "🤝 Negotiation", value: "Business Negotiation & Deals" },
];

const QUICK_SAMPLES = [
  {
    label: "🏢 Startup & Business",
    text: "The startup decided to call it a day after failing to see eye to eye with investors on their current valuation, which left the founders in a tight spot.",
  },
  {
    label: "☕ Work & Everyday Life",
    text: "I'd love to grab a coffee and catch up, but right now I'm snowed under with work and need to get a head start on this report.",
  },
  {
    label: "📰 Economy & Technology",
    text: "Central banks are walking a tightrope between curbing inflation and avoiding a recession, while tech giants double down on AI infrastructure.",
  },
];

export function AIGeneratorForm() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.is_superuser === true;

  // Workbooks state
  const [workbooks, setWorkbooks] = useState<WorkbookListItem[]>([]);
  const [selectedWorkbookId, setSelectedWorkbookId] = useState<number | null>(null);
  const [workbookSheets, setWorkbookSheets] = useState<SheetSummary[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null);
  const [isLoadingWorkbooks, setIsLoadingWorkbooks] = useState(false);

  // Form options
  const [workbookMode, setWorkbookMode] = useState<"existing" | "new">("existing");
  const [newWorkbookName, setNewWorkbookName] = useState("AI Vocabulary Collection");
  const [sheetMode, setSheetMode] = useState<"new_sheet" | "append">("new_sheet");

  // Generator sub-mode: "topic" (Day 41) vs "mine" (Day 42 Sentence Mining)
  const [generatorMode, setGeneratorMode] = useState<"topic" | "mine">("topic");
  const [miningText, setMiningText] = useState("");

  const [topic, setTopic] = useState("");
  const [cardCount, setCardCount] = useState<10 | 20 | 40>(20);
  const [level, setLevel] = useState("Intermediate B1-B2");

  // Loading & Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Generated Result state for Preview Deck
  const [generatedSheetName, setGeneratedSheetName] = useState<string | null>(null);
  const [generatedCards, setGeneratedCards] = useState<AIGeneratedCardItem[] | null>(null);

  useEffect(() => {
    async function loadWorkbooks() {
      setIsLoadingWorkbooks(true);
      try {
        const items = await getWorkbooks();
        setWorkbooks(items);
        if (items.length > 0) {
          setSelectedWorkbookId(items[0].id);
        } else {
          setWorkbookMode("new");
        }
      } catch {
        // Fallback silently if offline or unauthenticated
      } finally {
        setIsLoadingWorkbooks(false);
      }
    }
    loadWorkbooks();
  }, []);

  useEffect(() => {
    if (!selectedWorkbookId || workbookMode === "new") {
      setWorkbookSheets([]);
      setSelectedSheetId(null);
      return;
    }

    async function loadSheets() {
      try {
        const detail = await getWorkbook(String(selectedWorkbookId));
        setWorkbookSheets(detail.sheets || []);
        if (detail.sheets && detail.sheets.length > 0) {
          setSelectedSheetId(detail.sheets[0].id);
        } else {
          setSelectedSheetId(null);
          setSheetMode("new_sheet");
        }
      } catch {
        setWorkbookSheets([]);
      }
    }
    loadSheets();
  }, [selectedWorkbookId, workbookMode]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) {
      setError("Only administrators can use AI card generation.");
      return;
    }

    if (generatorMode === "mine") {
      if (miningText.trim().length < 5) {
        setError("Paste at least 5 characters for AI to analyze and extract useful phrases.");
        return;
      }

      setIsGenerating(true);
      setError(null);
      setLoadingStep("Analyzing the text and extracting useful phrases...");

      try {
        const resp = await mineAICards({
          text: miningText.trim(),
          target_sheet_id:
            sheetMode === "append" && selectedSheetId ? selectedSheetId : undefined,
          target_workbook_id:
            workbookMode === "existing" && selectedWorkbookId
              ? selectedWorkbookId
              : undefined,
        });

        setGeneratedSheetName(resp.sheet_name);
        setGeneratedCards(resp.cards);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not extract phrases from the text.";
        setError(msg);
      } finally {
        setIsGenerating(false);
        setLoadingStep("");
      }
      return;
    }

    setIsGenerating(true);
    setError(null);
    setLoadingStep(
      cardCount === 40
        ? "Connecting to AI and generating batch 1 of 2 (20 cards)..."
        : `Connecting to AI and generating ${cardCount} conversation cards...`
    );

    try {
      const resp = await generateAICards({
        topic: topic.trim() || undefined,
        count: cardCount,
        level,
        target_sheet_id:
          sheetMode === "append" && selectedSheetId ? selectedSheetId : undefined,
        target_workbook_id:
          workbookMode === "existing" && selectedWorkbookId
            ? selectedWorkbookId
            : undefined,
      });

      setGeneratedSheetName(resp.sheet_name);
      setGeneratedCards(resp.cards);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not generate cards with AI.";
      setError(msg);
    } finally {
      setIsGenerating(false);
      setLoadingStep("");
    }
  }

  function handleBackToConfig() {
    setGeneratedCards(null);
    setGeneratedSheetName(null);
    setError(null);
  }

  if (generatedCards && generatedSheetName) {
    return (
      <AIPreviewDeck
        initialSheetName={generatedSheetName}
        initialCards={generatedCards}
        mode={sheetMode}
        workbookId={workbookMode === "existing" ? selectedWorkbookId ?? undefined : undefined}
        newWorkbookName={workbookMode === "new" ? newWorkbookName : undefined}
        targetSheetId={sheetMode === "append" ? selectedSheetId ?? undefined : undefined}
        onBackToConfig={handleBackToConfig}
      />
    );
  }
  return (
    <div className="ai-generator-container">
      {!isAdmin && (
        <div className="admin-restriction-banner" role="alert">
          <div className="admin-restriction-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="admin-restriction-text">
            <strong>Administrator access required</strong>
            <p>Only administrators can create AI-generated study content.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleGenerate} className="ai-config-card">
        {/* DESTINATION SECTION */}
        <section className="ai-section">
          <div className="ai-section-title">
            <span className="ai-section-num">1</span>
            <div>
              <h3>Destination</h3>
              <p>Choose the workbook and study sheet that will contain these cards.</p>
            </div>
          </div>

          <div className="ai-form-grid">
            <div className="ai-field">
              <label>Target workbook:</label>
              <div className="ai-radio-toggle">
                <button
                  type="button"
                  className={`ai-toggle-btn ${workbookMode === "existing" ? "active" : ""}`}
                  onClick={() => setWorkbookMode("existing")}
                  disabled={workbooks.length === 0}
                >
                  Choose an existing workbook
                </button>
                <button
                  type="button"
                  className={`ai-toggle-btn ${workbookMode === "new" ? "active" : ""}`}
                  onClick={() => setWorkbookMode("new")}
                >
                  ➕ Create a new workbook
                </button>
              </div>

              {workbookMode === "existing" ? (
                <div className="ai-select-wrap">
                  <select
                    value={selectedWorkbookId ?? ""}
                    onChange={(e) => setSelectedWorkbookId(Number(e.target.value))}
                    disabled={isLoadingWorkbooks || workbooks.length === 0}
                    className="ai-select-input"
                  >
                    {workbooks.map((wb) => (
                      <option key={wb.id} value={wb.id}>
                        {wb.name} ({wb.sheet_count} sheets, {wb.total_cards} cards)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  type="text"
                  value={newWorkbookName}
                  onChange={(e) => setNewWorkbookName(e.target.value)}
                  placeholder="New workbook name..."
                  className="ai-text-input"
                  required
                />
              )}
            </div>

            {workbookMode === "existing" && (
              <div className="ai-field">
                <label>Target study sheet:</label>
                <div className="ai-radio-toggle">
                  <button
                    type="button"
                    className={`ai-toggle-btn ${sheetMode === "new_sheet" ? "active" : ""}`}
                    onClick={() => setSheetMode("new_sheet")}
                  >
                    Create a new sheet
                  </button>
                  <button
                    type="button"
                    className={`ai-toggle-btn ${sheetMode === "append" ? "active" : ""}`}
                    onClick={() => setSheetMode("append")}
                    disabled={workbookSheets.length === 0}
                  >
                    Append to an existing sheet
                  </button>
                </div>

                {sheetMode === "append" && (
                  <div className="ai-select-wrap">
                    <select
                      value={selectedSheetId ?? ""}
                      onChange={(e) => setSelectedSheetId(Number(e.target.value))}
                      className="ai-select-input"
                    >
                      {workbookSheets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.card_count} existing cards)
                        </option>
                      ))}
                    </select>
                    <p className="ai-help-text">
                      💡 Existing phrases in this sheet will be excluded to avoid duplicates.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* TOPIC & CONTENT SECTION */}
        <section className="ai-section">
          <div className="ai-section-title">
            <span className="ai-section-num">2</span>
            <div>
              <h3>Generation method & AI settings</h3>
              <p>Choose a topic or paste an article so AI can extract useful phrases from it.</p>
            </div>
          </div>

          {/* Sub-mode Tabs */}
          <div className="ai-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={generatorMode === "topic"}
              className={`ai-mode-tab ${generatorMode === "topic" ? "active" : ""}`}
              onClick={() => {
                setGeneratorMode("topic");
                setError(null);
              }}
            >
              <span className="ai-mode-icon">🎯</span>
              <span>Generate by topic</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={generatorMode === "mine"}
              className={`ai-mode-tab ${generatorMode === "mine" ? "active" : ""}`}
              onClick={() => {
                setGeneratorMode("mine");
                setError(null);
              }}
            >
              <span className="ai-mode-icon">📰</span>
              <span>Extract from a sentence or article</span>
            </button>
          </div>

          {generatorMode === "topic" ? (
            <div className="ai-topic-mode-content">
              <div className="ai-field">
                <label htmlFor="ai-topic-input">Study topic (optional):</label>
                <input
                  id="ai-topic-input"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Leave blank to generate common conversational phrases..."
                  className="ai-text-input"
                />
                <div className="ai-quick-topics">
                  <span className="ai-quick-label">Quick suggestions:</span>
                  {QUICK_TOPICS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className="ai-topic-chip"
                      onClick={() => setTopic(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

          <div className="ai-form-row-2">
            <div className="ai-field">
              <label>Number of cards:</label>
              <div className="ai-card-count-options">
                <button
                  type="button"
                  className={`ai-count-btn ${cardCount === 10 ? "active" : ""}`}
                  onClick={() => setCardCount(10)}
                >
                  <strong>10 cards</strong>
                  <small>Quick</small>
                </button>
                <button
                  type="button"
                  className={`ai-count-btn ${cardCount === 20 ? "active" : ""}`}
                  onClick={() => setCardCount(20)}
                >
                  <strong>20 cards</strong>
                  <small>Standard</small>
                </button>
                <button
                  type="button"
                  className={`ai-count-btn ${cardCount === 40 ? "active" : ""}`}
                  onClick={() => setCardCount(40)}
                >
                  <strong>40 cards</strong>
                  <small>2 sequential batches ✨</small>
                </button>
              </div>
            </div>

            <div className="ai-field">
              <label htmlFor="ai-level-select">Target proficiency:</label>
              <select
                id="ai-level-select"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="ai-select-input"
              >
                <option value="Elementary A2-B1">Elementary A2-B1 (Basic conversation)</option>
                <option value="Intermediate B1-B2">Intermediate B1-B2 (Common workplace English)</option>
                <option value="Advanced C1">Advanced C1 (Natural, advanced fluency)</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="ai-mine-mode-content">
          <div className="ai-field">
            <label htmlFor="ai-mine-textarea">
              English source text (article, email, podcast excerpt, or news):
            </label>
            <textarea
              id="ai-mine-textarea"
              rows={4}
              value={miningText}
              onChange={(e) => setMiningText(e.target.value)}
              placeholder="Paste a sentence or passage from an article, Reddit, or workplace text..."
              className="ai-textarea-input"
            />
            <div className="ai-quick-topics">
              <span className="ai-quick-label">Try a sample:</span>
              {QUICK_SAMPLES.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  className="ai-topic-chip"
                  onClick={() => setMiningText(sample.text)}
                >
                  {sample.label}
                </button>
              ))}
            </div>
            <p className="ai-help-text">
              💡 AI will identify useful collocations and phrasal verbs, preserve the original sentence as context, and provide natural Vietnamese translations.
            </p>
          </div>
        </div>
      )}
    </section>

    {error && (
      <div className="ai-alert-error" role="alert">
        <Icon name="weak" size={20} />
        <span>{error}</span>
      </div>
    )}

    <div className="ai-action-bar">
      <button
        type="submit"
        disabled={isGenerating || !isAdmin}
        className="ai-generate-submit-btn"
      >
        {isGenerating ? (
          <>
            <span className="ai-spinner" aria-hidden="true" />
            <span>{loadingStep || "Working with AI..."}</span>
          </>
        ) : generatorMode === "mine" ? (
          <>
            <span className="ai-sparkle-icon">✨</span>
            <span>Extract phrases from text with AI</span>
          </>
        ) : (
          <>
            <span className="ai-sparkle-icon">✨</span>
            <span>Generate {cardCount} conversation cards with AI</span>
          </>
        )}
      </button>
    </div>

      </form>
    </div>
  );
}


