from __future__ import annotations

from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
import logging
import re
from threading import Lock
from time import monotonic
from urllib.parse import urlparse
import xml.etree.ElementTree as ElementTree

import httpx

from app.schemas.reading import ReadingArticle, ReadingArticleContent, ReadingArticleList, ReadingCategory, ReadingSource


logger = logging.getLogger(__name__)
MAX_FEED_BYTES = 1_000_000
MAX_ARTICLE_BYTES = 2_500_000
MAX_ARTICLE_PARAGRAPHS = 120
NEWS_CACHE_SECONDS = 300
USER_AGENT = "LearnFastReading/1.0 (+https://learnfast.app)"


class NewsProviderError(RuntimeError):
    """Raised when the allowlisted news feeds cannot provide a usable result."""


class NewsArticleUnavailable(RuntimeError):
    """Raised when a source article cannot be safely retrieved or parsed."""


SOURCE_FEEDS: dict[str, dict[str, object]] = {
    "vnexpress": {
        "name": "VnExpress International",
        "host": "e.vnexpress.net",
        "categories": {
            "news": ("https://e.vnexpress.net/rss/news.rss", "News"),
            "business": ("https://e.vnexpress.net/rss/business.rss", "Business"),
            "technology": ("https://e.vnexpress.net/rss/tech.rss", "Technology"),
            "travel": ("https://e.vnexpress.net/rss/travel.rss", "Travel"),
            "life": ("https://e.vnexpress.net/rss/life.rss", "Life"),
            "sports": ("https://e.vnexpress.net/rss/sport.rss", "Sports"),
        },
    },
    "vietnamnews": {
        "name": "Viet Nam News",
        "host": "vietnamnews.vn",
        "categories": {
            "news": ("https://vietnamnews.vn/rss/society.rss", "News"),
            "business": ("https://vietnamnews.vn/rss/economy.rss", "Business"),
            "technology": ("https://vietnamnews.vn/rss/industries.rss", "Technology"),
            "travel": ("https://vietnamnews.vn/rss/travel.rss", "Travel"),
            "life": ("https://vietnamnews.vn/rss/life.rss", "Life"),
            "sports": ("https://vietnamnews.vn/rss/sports.rss", "Sports"),
        },
    },
}

_cache_lock = Lock()
_feed_cache: dict[str, tuple[float, list[ReadingArticle]]] = {}


def list_news_sources() -> list[ReadingSource]:
    """Expose the fixed source allowlist so clients never supply feed URLs."""
    return [
        ReadingSource(
            id=source_id,
            name=str(config["name"]),
            categories=[
                ReadingCategory(id=category_id, name=feed[1])
                for category_id, feed in config["categories"].items()
            ],
        )
        for source_id, config in SOURCE_FEEDS.items()
    ]


def fetch_news_articles(source_id: str, category_id: str) -> ReadingArticleList:
    if source_id != "all" and source_id not in SOURCE_FEEDS:
        raise ValueError("Choose a supported news source.")
    if category_id != "all" and category_id not in {"news", "business", "technology", "travel", "life", "sports"}:
        raise ValueError("Choose a supported news category.")

    source_ids = tuple(SOURCE_FEEDS) if source_id == "all" else (source_id,)
    cache_key = f"{source_id}:{category_id}"
    cached = _get_cached_articles(cache_key)
    if cached is not None:
        return ReadingArticleList(articles=cached)

    articles: list[ReadingArticle] = []
    unavailable: list[str] = []
    for selected_source in source_ids:
        config = SOURCE_FEEDS[selected_source]
        feeds: dict[str, tuple[str, str]] = config["categories"]  # type: ignore[assignment]
        category_ids = tuple(feeds) if category_id == "all" else (category_id,)
        source_articles: list[ReadingArticle] = []
        source_failed = True
        for selected_category in category_ids:
            feed_url, category_name = feeds[selected_category]
            try:
                source_articles.extend(_fetch_feed(selected_source, str(config["name"]), selected_category, category_name, feed_url))
                source_failed = False
            except (httpx.HTTPError, ElementTree.ParseError, ValueError) as error:
                logger.warning("News RSS fetch failed for %s/%s (%s)", selected_source, selected_category, type(error).__name__)
        if source_failed:
            unavailable.append(str(config["name"]))
        articles.extend(source_articles)

    unique_articles = _deduplicate(articles)
    unique_articles.sort(key=_published_sort_key, reverse=True)
    result = unique_articles[:60]
    if not result:
        raise NewsProviderError("News feeds are temporarily unavailable. Please try again later.")
    _set_cached_articles(cache_key, result)
    return ReadingArticleList(articles=result, unavailable_sources=unavailable)


def fetch_news_article(source_id: str, article: ReadingArticle) -> ReadingArticleContent:
    config = SOURCE_FEEDS.get(source_id)
    if config is None or article.source_id != source_id or not _is_article_url(article.url, str(config["host"])):
        raise NewsArticleUnavailable("This article is not from a supported news source.")
    try:
        with httpx.Client(timeout=12.0, follow_redirects=False, headers={"User-Agent": USER_AGENT, "Accept": "text/html"}) as client:
            with client.stream("GET", article.url) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").lower()
                if "text/html" not in content_type:
                    raise NewsArticleUnavailable("The source did not return an article page.")
                chunks: list[bytes] = []
                total = 0
                for chunk in response.iter_bytes():
                    total += len(chunk)
                    if total > MAX_ARTICLE_BYTES:
                        raise NewsArticleUnavailable("The article page is too large to read here.")
                    chunks.append(chunk)
        html_text = b"".join(chunks).decode("utf-8", errors="replace")
    except httpx.HTTPStatusError as error:
        logger.warning("News article request failed with HTTP %s for %s", error.response.status_code, source_id)
        raise NewsArticleUnavailable("This source did not allow the article to load. Open it on the publisher website.") from error
    except httpx.HTTPError as error:
        logger.warning("News article request failed (%s) for %s", type(error).__name__, source_id)
        raise NewsArticleUnavailable("The article could not be loaded. Open it on the publisher website.") from error

    parser = _ArticleTextParser()
    parser.feed(html_text)
    paragraphs = parser.paragraphs[:MAX_ARTICLE_PARAGRAPHS]
    if not paragraphs:
        raise NewsArticleUnavailable("The article text is unavailable in this preview. Open it on the publisher website.")
    return ReadingArticleContent(article=article, paragraphs=paragraphs, available=True)


def _fetch_feed(source_id: str, source_name: str, category_id: str, category_name: str, feed_url: str) -> list[ReadingArticle]:
    response = httpx.get(feed_url, timeout=8.0, follow_redirects=False, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml"})
    response.raise_for_status()
    if len(response.content) > MAX_FEED_BYTES:
        raise ValueError("RSS feed exceeded its size limit.")
    root = ElementTree.fromstring(response.content)
    result: list[ReadingArticle] = []
    for item in root.findall(".//item"):
        title = _clean_text(_find_text(item, "title"))
        url = _find_text(item, "link").strip()
        if not title or not _is_article_url(url, str(SOURCE_FEEDS[source_id]["host"])):
            continue
        summary = _clean_text(_find_text(item, "description"))[:900]
        published = _find_text(item, "pubDate").strip() or None
        image_url = _find_image_url(item)
        identifier = f"{source_id}:{url}"
        result.append(ReadingArticle(
            id=identifier,
            source_id=source_id,
            source_name=source_name,
            category=category_name,
            title=title[:300],
            summary=summary,
            url=url,
            published_at=published,
            image_url=image_url,
        ))
    return result


def _find_text(item: ElementTree.Element, name: str) -> str:
    element = item.find(name)
    return element.text or "" if element is not None else ""


def _find_image_url(item: ElementTree.Element) -> str | None:
    for element in item.iter():
        if element.tag.lower().endswith("content") or element.tag.lower().endswith("thumbnail") or element.tag.lower() == "enclosure":
            candidate = element.attrib.get("url", "")
            hostname = (urlparse(candidate).hostname or "").lower()
            if candidate.startswith("https://") and any(
                hostname == domain or hostname.endswith(f".{domain}")
                for domain in ("vnexpress.net", "vietnamnews.vn")
            ):
                return candidate[:2000]
    return None


def _is_article_url(value: str, allowed_host: str) -> bool:
    parsed = urlparse(value)
    return (
        parsed.scheme == "https"
        and parsed.hostname == allowed_host
        and parsed.port is None
        and parsed.username is None
        and parsed.password is None
        and not parsed.fragment
        and parsed.path.lower().endswith(".html")
    )


def _clean_text(value: str) -> str:
    parser = _PlainTextParser()
    parser.feed(unescape(value))
    return re.sub(r"\s+", " ", " ".join(parser.parts)).strip()


def _deduplicate(articles: list[ReadingArticle]) -> list[ReadingArticle]:
    seen: set[str] = set()
    unique: list[ReadingArticle] = []
    for article in articles:
        if article.url in seen:
            continue
        seen.add(article.url)
        unique.append(article)
    return unique


def _published_sort_key(article: ReadingArticle) -> datetime:
    if article.published_at:
        try:
            parsed = parsedate_to_datetime(article.published_at)
            return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
        except (TypeError, ValueError, OverflowError):
            pass
    return datetime.min.replace(tzinfo=timezone.utc)


def _get_cached_articles(key: str) -> list[ReadingArticle] | None:
    with _cache_lock:
        cached = _feed_cache.get(key)
        if cached and cached[0] > monotonic():
            return cached[1]
        _feed_cache.pop(key, None)
        return None


def _set_cached_articles(key: str, articles: list[ReadingArticle]) -> None:
    with _cache_lock:
        _feed_cache[key] = (monotonic() + NEWS_CACHE_SECONDS, articles)


class _PlainTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


class _ArticleTextParser(HTMLParser):
    """Extract readable paragraphs only from semantic article body containers."""

    _BODY_CLASSES = {
        "fck_detail",
        "article-body",
        "article__body",
        "article-content",
        "article__content",
        "detail-content",
        "detail__content",
        "content-detail",
        "news-content",
        "news-detail-content",
        "story-content",
    }
    _SKIP_TAGS = {"script", "style", "nav", "footer", "aside", "noscript", "svg"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.body_depth: int | None = None
        self.skip_depth: int | None = None
        self.paragraph_depth: int | None = None
        self.paragraph: list[str] = []
        self.paragraphs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.depth += 1
        attributes = dict(attrs)
        classes = set((attributes.get("class") or "").lower().split())
        element_id = (attributes.get("id") or "").lower()
        if tag in self._SKIP_TAGS and self.skip_depth is None:
            self.skip_depth = self.depth
        if self.body_depth is None and _is_article_body_container(tag, attributes, classes, element_id):
            self.body_depth = self.depth
        if self.body_depth is not None and self.skip_depth is None and tag == "p":
            self.paragraph_depth = self.depth
            self.paragraph = []
        elif self.body_depth is not None and self.paragraph_depth is not None and tag == "br":
            self.paragraph.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if self.paragraph_depth == self.depth and tag == "p":
            text = re.sub(r"\s+", " ", "".join(self.paragraph)).strip()
            if len(text) >= 20:
                self.paragraphs.append(text)
            self.paragraph_depth = None
            self.paragraph = []
        if self.skip_depth == self.depth:
            self.skip_depth = None
        if self.body_depth == self.depth:
            self.body_depth = None
        self.depth = max(0, self.depth - 1)

    def handle_data(self, data: str) -> None:
        if self.body_depth is not None and self.skip_depth is None and self.paragraph_depth is not None:
            self.paragraph.append(data)


def _is_article_body_container(
    tag: str,
    attributes: dict[str, str | None],
    classes: set[str],
    element_id: str,
) -> bool:
    """Recognize semantic publisher containers without treating generic layout sections as article text."""
    itemprop = set((attributes.get("itemprop") or "").lower().split())
    if tag == "article" or "articlebody" in itemprop or classes & _ArticleTextParser._BODY_CLASSES:
        return True

    # Publisher templates often add a site prefix or version suffix to these common body names.
    normalized_names = re.sub(r"[^a-z]", "", "".join(classes) + element_id)
    return any(
        marker in normalized_names
        for marker in ("articlebody", "articlecontent", "detailcontent", "contentdetail", "newscontent", "newsdetailcontent")
    )


