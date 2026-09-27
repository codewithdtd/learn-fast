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
  { label: "🏢 Cuộc họp công sở", value: "Office Meetings & Status Updates" },
  { label: "☕ Giao tiếp thường ngày", value: "Everyday Small Talk & Socializing" },
  { label: "✈️ Du lịch & Đi lại", value: "Travel, Airport & Commuting" },
  { label: "💼 Phỏng vấn xin việc", value: "Job Interview & Career Background" },
  { label: "🍽️ Gọi món & Ăn uống", value: "Dining Out & Ordering Food" },
  { label: "🤝 Đàm phán & Thương lượng", value: "Business Negotiation & Deals" },
];

const QUICK_SAMPLES = [
  {
    label: "🏢 Startup & Business",
    text: "The startup decided to call it a day after failing to see eye to eye with investors on their current valuation, which left the founders in a tight spot.",
  },
  {
    label: "☕ Công việc & Đời sống",
    text: "I'd love to grab a coffee and catch up, but right now I'm snowed under with work and need to get a head start on this report.",
  },
  {
    label: "📰 Kinh tế & Công nghệ",
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
      setError("Chức năng sinh bài học bằng AI yêu cầu quyền Quản trị viên (Admin).");
      return;
    }

    if (generatorMode === "mine") {
      if (miningText.trim().length < 5) {
        setError("Vui lòng dán ít nhất một câu văn (tối thiểu 5 ký tự) để AI phân tích và bóc tách.");
        return;
      }

      setIsGenerating(true);
      setError(null);
      setLoadingStep("Đang phân tích ngữ liệu văn bản và trích xuất các conversational chunks...");

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
        const msg = err instanceof Error ? err.message : "Không thể bóc tách chunks từ văn bản.";
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
        ? "Đang kết nối AI và sinh batch 1 (20 thẻ)..."
        : `Đang kết nối AI và tạo ${cardCount} thẻ giao tiếp...`
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
      const msg = err instanceof Error ? err.message : "Không thể sinh thẻ bằng AI.";
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
            <strong>Quyền Quản trị viên (Admin Required)</strong>
            <p>Chỉ Quản trị viên mới có quyền tạo nội dung bài học mới vào thư viện hệ thống.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleGenerate} className="ai-config-card">
        {/* DESTINATION SECTION */}
        <section className="ai-section">
          <div className="ai-section-title">
            <span className="ai-section-num">1</span>
            <div>
              <h3>Nơi lưu trữ (Destination)</h3>
              <p>Chọn Workbook và Study Sheet sẽ chứa các thẻ được sinh.</p>
            </div>
          </div>

          <div className="ai-form-grid">
            <div className="ai-field">
              <label>Workbook đích:</label>
              <div className="ai-radio-toggle">
                <button
                  type="button"
                  className={`ai-toggle-btn ${workbookMode === "existing" ? "active" : ""}`}
                  onClick={() => setWorkbookMode("existing")}
                  disabled={workbooks.length === 0}
                >
                  Chọn Workbook có sẵn
                </button>
                <button
                  type="button"
                  className={`ai-toggle-btn ${workbookMode === "new" ? "active" : ""}`}
                  onClick={() => setWorkbookMode("new")}
                >
                  ➕ Tạo Workbook mới
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
                  placeholder="Tên Workbook mới..."
                  className="ai-text-input"
                  required
                />
              )}
            </div>

            {workbookMode === "existing" && (
              <div className="ai-field">
                <label>Study Sheet đích:</label>
                <div className="ai-radio-toggle">
                  <button
                    type="button"
                    className={`ai-toggle-btn ${sheetMode === "new_sheet" ? "active" : ""}`}
                    onClick={() => setSheetMode("new_sheet")}
                  >
                    Tạo Sheet mới
                  </button>
                  <button
                    type="button"
                    className={`ai-toggle-btn ${sheetMode === "append" ? "active" : ""}`}
                    onClick={() => setSheetMode("append")}
                    disabled={workbookSheets.length === 0}
                  >
                    Nối tiếp vào Sheet có sẵn
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
                          {s.name} ({s.card_count} thẻ đã có)
                        </option>
                      ))}
                    </select>
                    <p className="ai-help-text">
                      💡 Hệ thống sẽ tự động quét các cụm từ cũ trong sheet này để không sinh trùng lặp!
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
              <h3>Phương thức sinh thẻ & Cấu hình AI</h3>
              <p>Chọn sinh danh sách theo chủ đề hoặc dán câu văn/bài báo để AI tự động bóc tách cụm từ.</p>
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
              <span>Sinh theo Chủ đề (Topic)</span>
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
              <span>Bóc tách từ Câu / Bài báo (Sentence Mining)</span>
            </button>
          </div>

          {generatorMode === "topic" ? (
            <div className="ai-topic-mode-content">
              <div className="ai-field">
                <label htmlFor="ai-topic-input">Chủ đề bài học (Tùy chọn):</label>
                <input
                  id="ai-topic-input"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Để trống nếu muốn sinh ngẫu nhiên các cụm từ giao tiếp thông dụng..."
                  className="ai-text-input"
                />
                <div className="ai-quick-topics">
                  <span className="ai-quick-label">Gợi ý nhanh:</span>
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
              <label>Số lượng thẻ:</label>
              <div className="ai-card-count-options">
                <button
                  type="button"
                  className={`ai-count-btn ${cardCount === 10 ? "active" : ""}`}
                  onClick={() => setCardCount(10)}
                >
                  <strong>10 thẻ</strong>
                  <small>Nhanh</small>
                </button>
                <button
                  type="button"
                  className={`ai-count-btn ${cardCount === 20 ? "active" : ""}`}
                  onClick={() => setCardCount(20)}
                >
                  <strong>20 thẻ</strong>
                  <small>Tiêu chuẩn</small>
                </button>
                <button
                  type="button"
                  className={`ai-count-btn ${cardCount === 40 ? "active" : ""}`}
                  onClick={() => setCardCount(40)}
                >
                  <strong>40 thẻ</strong>
                  <small>2 Batch ngầm ✨</small>
                </button>
              </div>
            </div>

            <div className="ai-field">
              <label htmlFor="ai-level-select">Trình độ mục tiêu:</label>
              <select
                id="ai-level-select"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="ai-select-input"
              >
                <option value="Elementary A2-B1">Elementary A2-B1 (Cơ bản giao tiếp)</option>
                <option value="Intermediate B1-B2">Intermediate B1-B2 (Phổ biến công sở)</option>
                <option value="Advanced C1">Advanced C1 (Tự nhiên, phản xạ cao cấp)</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="ai-mine-mode-content">
          <div className="ai-field">
            <label htmlFor="ai-mine-textarea">
              Đoạn trích tiếng Anh (câu báo chí, email, podcast quote, tin tức):
            </label>
            <textarea
              id="ai-mine-textarea"
              rows={4}
              value={miningText}
              onChange={(e) => setMiningText(e.target.value)}
              placeholder="Dán câu văn hoặc đoạn văn bất kỳ đọc được trên báo chí, Reddit, công việc..."
              className="ai-textarea-input"
            />
            <div className="ai-quick-topics">
              <span className="ai-quick-label">Mẫu câu thử nghiệm nhanh:</span>
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
              💡 AI sẽ tự động phân tích ngữ liệu, nhận diện các collocations và phrasal verbs đắt giá, giữ nguyên câu trích dẫn làm ví dụ ngữ cảnh và dịch nghĩa tiếng Việt sát thực tế.
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
            <span>{loadingStep || "Đang xử lý cùng AI..."}</span>
          </>
        ) : generatorMode === "mine" ? (
          <>
            <span className="ai-sparkle-icon">✨</span>
            <span>Bóc tách Chunks từ văn bản với AI</span>
          </>
        ) : (
          <>
            <span className="ai-sparkle-icon">✨</span>
            <span>Sinh {cardCount} thẻ giao tiếp với AI</span>
          </>
        )}
      </button>
    </div>

      </form>
    </div>
  );
}


