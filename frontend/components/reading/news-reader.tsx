"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AuthModal } from "@/components/auth/auth-modal";
import { useAuth } from "@/context/auth-context";
import { getReadingWordAtOffset } from "@/lib/reading-selection";
import {
  addReadingVocabularyCard,
  createReadingVocabularySheet,
  getReadingArticles,
  getReadingArticleContent,
  getReadingSources,
  getReadingVocabularySheets,
  lookupReadingText,
  type ReadingArticle,
  type ReadingArticleContent,
  type ReadingCategory,
  type ReadingSource,
  type ReadingVocabularySheet,
} from "@/services/api";
import styles from "./news-reader.module.css";

type SelectionPopover = { text: string; left: number; top: number; placement: "above" | "below" };
type TranslationState = { value: string; loading: boolean; error: string | null };
const allCategory: ReadingCategory = { id: "all", name: "All topics" };

export function NewsReader() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [sources, setSources] = useState<ReadingSource[]>([]);
  const [sourceId, setSourceId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [articles, setArticles] = useState<ReadingArticle[]>([]);
  const [unavailableSources, setUnavailableSources] = useState<string[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<ReadingArticle | null>(null);
  const [articleContent, setArticleContent] = useState<ReadingArticleContent | null>(null);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [lookupPopover, setLookupPopover] = useState<SelectionPopover | null>(null);
  const [translation, setTranslation] = useState<TranslationState>({ value: "", loading: false, error: null });
  const [vocabularySheets, setVocabularySheets] = useState<ReadingVocabularySheet[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [phraseToSave, setPhraseToSave] = useState("");
  const [meaningToSave, setMeaningToSave] = useState("");
  const [savingWord, setSavingWord] = useState(false);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const articleBodyRef = useRef<HTMLElement | null>(null);
  const articleHeaderRef = useRef<HTMLDivElement | null>(null);
  const selectedRangeRef = useRef<Range | null>(null);
  const selectedTextRef = useRef<string | null>(null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupSequenceRef = useRef(0);
  const articleRequestRef = useRef(0);
  const translationCacheRef = useRef(new Map<string, string>());
  const pendingTranslationsRef = useRef(new Map<string, Promise<{ translation_vi: string }>>());

  const clearLookup = useCallback(() => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    lookupSequenceRef.current += 1;
    selectedRangeRef.current = null;
    selectedTextRef.current = null;
    setLookupPopover(null);
    setTranslation({ value: "", loading: false, error: null });
    setSaveMessage(null);
    setSaveError(null);
  }, []);

  const translateSelection = useCallback((text: string) => {
    const key = text.toLocaleLowerCase("en");
    const sequence = ++lookupSequenceRef.current;
    const cached = translationCacheRef.current.get(key);
    if (cached) {
      setTranslation({ value: cached, loading: false, error: null });
      setMeaningToSave(cached);
      return;
    }
    setTranslation({ value: "", loading: true, error: null });
    // Nhiều sự kiện selectionchange cho cùng đoạn chỉ dùng một request đang chờ.
    let pending = pendingTranslationsRef.current.get(key);
    if (!pending) {
      pending = lookupReadingText(text).finally(() => pendingTranslationsRef.current.delete(key));
      pendingTranslationsRef.current.set(key, pending);
    }
    void pending.then((result) => {
      translationCacheRef.current.set(key, result.translation_vi);
      if (sequence !== lookupSequenceRef.current) return;
      setTranslation({ value: result.translation_vi, loading: false, error: null });
      setMeaningToSave(result.translation_vi);
    }).catch((error: unknown) => {
      if (sequence === lookupSequenceRef.current) setTranslation({ value: "", loading: false, error: error instanceof Error ? error.message : "Translation could not be loaded." });
    });
  }, []);

  const openLookup = useCallback((text: string, range: Range, autoTranslate: boolean) => {
    const rectangle = range.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rectangle.left + rectangle.width / 2 - width / 2, window.innerWidth - width - 12));
    const above = rectangle.top > 210;
    selectedRangeRef.current = range.cloneRange();
    if (selectedTextRef.current === text) {
      setLookupPopover((current) => current ? { ...current, left, top: above ? rectangle.top - 10 : rectangle.bottom + 10, placement: above ? "above" : "below" } : current);
      return;
    }
    selectedTextRef.current = text;
    lookupSequenceRef.current += 1;
    setLookupPopover({ text, left, top: above ? rectangle.top - 10 : rectangle.bottom + 10, placement: above ? "above" : "below" });
    setPhraseToSave(text.slice(0, 200));
    setSaveMessage(null);
    setSaveError(null);
    setSheetError(null);
    const cached = translationCacheRef.current.get(text.toLocaleLowerCase("en"));
    setMeaningToSave(cached ?? "");
    if (cached) setTranslation({ value: cached, loading: false, error: null });
    else if (autoTranslate) translateSelection(text);
    else setTranslation({ value: "", loading: false, error: null });
  }, [translateSelection]);

  useEffect(() => {
    let active = true;
    void getReadingSources().then((value) => { if (active) setSources(value); })
      .catch(() => { if (active) setPageError("News sources could not be loaded. Please try again."); });
    return () => { active = false; };
  }, []);

  const loadArticles = useCallback(async () => {
    const requestId = ++articleRequestRef.current;
    setLoadingArticles(true);
    setPageError(null);
    setSelectedArticle(null);
    setArticleContent(null);
    clearLookup();
    try {
      const result = await getReadingArticles(sourceId, categoryId);
      if (requestId !== articleRequestRef.current) return;
      setArticles(result.articles);
      setUnavailableSources(result.unavailable_sources);
      if (result.articles[0]) setSelectedArticle(result.articles[0]);
    } catch (error) {
      if (requestId !== articleRequestRef.current) return;
      setArticles([]);
      setUnavailableSources([]);
      setPageError(error instanceof Error ? error.message : "News articles could not be loaded. Please try again.");
    } finally {
      if (requestId === articleRequestRef.current) setLoadingArticles(false);
    }
  }, [categoryId, clearLookup, sourceId]);

  useEffect(() => {
    // Filter changes synchronize the article catalog with the remote RSS service.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    let active = true;
    void getReadingVocabularySheets().then((result) => {
      if (!active) return;
      setVocabularySheets(result.sheets);
      setSelectedSheetId((current) => result.sheets.some((sheet) => String(sheet.id) === current)
        ? current : String(result.sheets[0]?.id ?? ""));
      setSheetError(null);
    }).catch((error: unknown) => {
      if (active) setSheetError(error instanceof Error ? error.message : "Your vocabulary sheets could not be loaded.");
    });
    return () => { active = false; };
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    if (!selectedArticle) return;
    let active = true;
    // Loading/content state tracks the request for the selected RSS article.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingContent(true);
    setArticleContent(null);
    clearLookup();
    void getReadingArticleContent(selectedArticle).then((content) => {
      if (active) setArticleContent(content);
    }).catch((error: unknown) => {
      if (active) setArticleContent({ article: selectedArticle, paragraphs: [], available: false, message: error instanceof Error ? error.message : "The full article could not be loaded." });
    }).finally(() => { if (active) setLoadingContent(false); });
    return () => { active = false; };
  }, [clearLookup, selectedArticle]);

  useEffect(() => {
    if (!selectedArticle) return;
    const isReadableNode = (node: Node) => Boolean(
      articleBodyRef.current?.contains(node) || articleHeaderRef.current?.contains(node),
    );
    const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    const readSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!isReadableNode(range.startContainer) || !isReadableNode(range.endContainer)) return;
      const text = selection.toString().replace(/\s+/g, " ").trim();
      if (!text) return;
      const capturedRange = range.cloneRange();
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = setTimeout(() => openLookup(text, capturedRange, !isTouchDevice()), 320);
    };
    const translateTappedWord = (event: MouseEvent) => {
      if (!isTouchDevice()) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest("button, a, input, textarea, select")) return;
      const textContainer = target.closest("p, h2");
      if (!textContainer || !isReadableNode(textContainer)) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim()) return;
      type CaretDocument = Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
      };
      const caretDocument = document as CaretDocument;
      const position = caretDocument.caretPositionFromPoint?.(event.clientX, event.clientY);
      const fallbackRange = position ? null : caretDocument.caretRangeFromPoint?.(event.clientX, event.clientY);
      const textNode = position?.offsetNode ?? fallbackRange?.startContainer;
      const offset = position?.offset ?? fallbackRange?.startOffset;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE || offset === undefined || !textContainer.contains(textNode)) return;
      const word = getReadingWordAtOffset(textNode.textContent ?? "", offset);
      if (!word) return;
      const range = document.createRange();
      range.setStart(textNode, word.start);
      range.setEnd(textNode, word.end);
      openLookup(word.text, range, true);
    };
    const reposition = () => {
      const range = selectedRangeRef.current;
      if (!range || !isReadableNode(range.startContainer) || !isReadableNode(range.endContainer)) return;
      const rectangle = range.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rectangle.left + rectangle.width / 2 - width / 2, window.innerWidth - width - 12));
      const above = rectangle.top > 210;
      setLookupPopover((current) => current
        ? { ...current, left, top: above ? rectangle.top - 10 : rectangle.bottom + 10, placement: above ? "above" : "below" }
        : current);
    };
    document.addEventListener("selectionchange", readSelection);
    document.addEventListener("touchend", readSelection, { passive: true });
    document.addEventListener("click", translateTappedWord);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("selectionchange", readSelection);
      document.removeEventListener("touchend", readSelection);
      document.removeEventListener("click", translateTappedWord);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      lookupSequenceRef.current += 1;
    };
  }, [openLookup, selectedArticle]);

  async function ensureVocabularySheet() {
    setCreatingSheet(true);
    setSheetError(null);
    try {
      const sheet = await createReadingVocabularySheet();
      setVocabularySheets((current) => current.some((item) => item.id === sheet.id) ? current : [...current, sheet]);
      setSelectedSheetId(String(sheet.id));
      return sheet.id;
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : "Your vocabulary sheet could not be created.");
      return null;
    } finally {
      setCreatingSheet(false);
    }
  }

  async function saveVocabulary() {
    if (!isAuthenticated || !lookupPopover || !phraseToSave.trim() || !meaningToSave.trim()) return;
    setSavingWord(true);
    setSaveError(null);
    setSaveMessage(null);
    let targetSheetId = Number(selectedSheetId);
    if (!targetSheetId) {
      const created = await ensureVocabularySheet();
      if (!created) { setSavingWord(false); return; }
      targetSheetId = created;
    }
    try {
      await addReadingVocabularyCard(targetSheetId, { phrase: phraseToSave.trim(), meaning: meaningToSave.trim() });
      setVocabularySheets((current) => current.map((sheet) => sheet.id === targetSheetId ? { ...sheet, card_count: sheet.card_count + 1 } : sheet));
      setSaveMessage("Added to your sheet.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "This vocabulary could not be saved.");
    } finally {
      setSavingWord(false);
    }
  }

  const categories = [allCategory, ...sources.flatMap((source) => source.categories)]
    .filter((category, index, collection) => collection.findIndex((item) => item.id === category.id) === index);

  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>READ · NOTICE · LEARN</p>
      <h1>Read the news in English</h1>
      <p>Explore English news about Vietnam. Select a word, phrase, or sentence to see its Vietnamese meaning.</p>
    </header>
    <section className={styles.controls} aria-label="Filter news">
      <label>Source<select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
        <option value="all">All sources</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
      </select></label>
      <label>Topic<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select></label>
      <span className={styles.sourceAttribution}>News text and links are provided by the publishers.</span>
    </section>
    {pageError && <p className={styles.error} role="alert">{pageError} <button type="button" onClick={() => void loadArticles()}>Try again</button></p>}
    {unavailableSources.length > 0 && <p className={styles.notice} role="status">Some sources are temporarily unavailable: {unavailableSources.join(", ")}.</p>}

    <div className={styles.layout}>
      <aside className={styles.articleList} aria-label="News articles">
        <div className={styles.listHeading}><h2>Latest stories</h2><span>{articles.length}</span></div>
        {loadingArticles ? <p className={styles.emptyState} role="status">Loading stories…</p> : articles.length === 0
          ? <p className={styles.emptyState}>No stories are available for these filters.</p>
          : articles.map((article, index) => <button type="button" className={styles.articleChoice} data-selected={selectedArticle?.id === article.id} data-has-image={Boolean(article.image_url)} key={article.id || index} onClick={() => setSelectedArticle(article)}>
            {article.image_url && <NewsImage key={article.id} className={styles.articleThumbnail} src={article.image_url} alt="" />}
            <span className={styles.articleMeta}>{article.source_name} · {article.category}</span>
            <strong>{article.title}</strong>
            {article.summary && <span className={styles.articleSummary}>{article.summary}</span>}
            {article.published_at && <time>{formatPublished(article.published_at)}</time>}
          </button>)}
      </aside>
      <article className={styles.reader}>
        {!selectedArticle ? <div className={styles.emptyReader}><span aria-hidden="true">📖</span><h2>Choose a story to read</h2><p>News stories will appear here.</p></div> : <>
          {selectedArticle.image_url && <NewsImage key={`${selectedArticle.id}-hero`} className={styles.heroImage} src={selectedArticle.image_url} alt={selectedArticle.title} priority />}
          <div className={styles.readerHeader} ref={articleHeaderRef}>
            <p className={styles.articleMeta}>{selectedArticle.source_name} · {selectedArticle.category}{selectedArticle.published_at ? " · " + formatPublished(selectedArticle.published_at) : ""}</p>
            <h2>{selectedArticle.title}</h2>
            <p className={styles.summary}>{selectedArticle.summary}</p>
          </div>
          <p className={styles.selectionHint}>Tap a word to translate it, or select a phrase and choose “Translate selection”.</p>
          {loadingContent || articleContent?.article.id !== selectedArticle.id ? <p className={styles.emptyState} role="status">Loading article…</p> : articleContent.available
            ? <section className={styles.articleBody} ref={articleBodyRef} aria-label="Article text" lang="en">
              {articleContent.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              <a className={styles.originalLink} href={selectedArticle.url} target="_blank" rel="noreferrer">Continue at {selectedArticle.source_name} <span aria-hidden="true">↗</span></a>
            </section>
          : !loadingContent && articleContent?.article.id === selectedArticle.id && <div className={styles.unavailableArticle}>
              <h3>Read this story on the publisher&apos;s website</h3>
              <p>{articleContent?.message ?? "The publisher did not provide the full article through its feed."} You can still translate the headline and summary.</p>
              <a className={styles.originalLink} href={selectedArticle.url} target="_blank" rel="noreferrer">Open original article <span aria-hidden="true">↗</span></a>
            </div>}
          <p className={styles.footerSource}>Source: <a href={selectedArticle.url} target="_blank" rel="noreferrer">{selectedArticle.source_name}</a></p>
        </>}
      </article>
    </div>

    {lookupPopover && selectedArticle && <div
      className={styles.lookupPopover}
      data-placement={lookupPopover.placement}
      data-selection-popover="true"
      style={{ left: lookupPopover.left, top: lookupPopover.top }}
      aria-live="polite"
    >
      <div className={styles.lookupTop}>
        <div><span className={styles.eyebrow}>SELECTED TEXT</span><p lang="en">{lookupPopover.text}</p></div>
        <button type="button" className={styles.closeButton} onClick={() => { clearLookup(); window.getSelection()?.removeAllRanges(); }} aria-label="Close translation">×</button>
      </div>
      <div className={styles.translationResult}>
        {translation.loading ? <span role="status">Translating…</span> : translation.error ? <><p className={styles.error} role="alert">{translation.error}</p><button type="button" className={styles.translateButton} onClick={() => translateSelection(lookupPopover.text)}>Try translation again</button></> : translation.value ? <span lang="vi">{translation.value}</span> : <button type="button" className={styles.translateButton} onClick={() => translateSelection(lookupPopover.text)}>Translate selection</button>}
      </div>
      {isAuthenticated ? <div className={styles.savePanel}>
        {vocabularySheets.length > 0 && <label>Personal sheet<select value={selectedSheetId} onChange={(event) => setSelectedSheetId(event.target.value)}>
          {vocabularySheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.workbook_name} · {sheet.name}</option>)}
        </select></label>}
        <label>Phrase<input value={phraseToSave} maxLength={200} onChange={(event) => setPhraseToSave(event.target.value)} /></label>
        <label>Meaning<textarea value={meaningToSave} maxLength={600} rows={2} onChange={(event) => setMeaningToSave(event.target.value)} /></label>
        {sheetError && <p className={styles.error} role="alert">{sheetError}</p>}
        {saveError && <p className={styles.error} role="alert">{saveError}</p>}
        {saveMessage && <p className={styles.success} role="status">{saveMessage}</p>}
        <button type="button" className={styles.saveButton} disabled={savingWord || creatingSheet || translation.loading || !translation.value || !phraseToSave.trim() || !meaningToSave.trim()} onClick={() => void saveVocabulary()} aria-busy={savingWord || creatingSheet}>
          {creatingSheet ? "Creating your sheet…" : savingWord ? "Saving…" : vocabularySheets.length ? "Add to sheet" : "Create personal sheet and add"}
        </button>
      </div> : <p className={styles.signInPrompt}><button type="button" onClick={() => setAuthModalOpen(true)}>Sign in</button> to save this word or phrase to your personal sheet.</p>}
      <p className={styles.lookupFootnote}>Translation powered by MyMemory. Only the selected text is sent for lookup.</p>
    </div>}
    <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialMode="login" />
  </main>;
}

function formatPublished(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(parsed);
}

function NewsImage({ src, alt, className, priority = false }: { src: string; alt: string; className: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    // RSS image URLs come from the publisher allowlist; load them directly instead of proxying through image optimization.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src}
      alt={alt}
      width={1200}
      height={800}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
