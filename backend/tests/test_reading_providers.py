from xml.etree import ElementTree

from app.services.news_provider import (
    SOURCE_FEEDS,
    _ArticleTextParser,
    _find_image_url,
    _is_article_url,
    list_news_sources,
)


def test_news_sources_use_fixed_publishers_and_supported_categories() -> None:
    sources = list_news_sources()

    assert {source.id for source in sources} == set(SOURCE_FEEDS)
    assert all(source.categories for source in sources)
    assert _is_article_url("https://e.vnexpress.net/news/example.html", "e.vnexpress.net")
    assert not _is_article_url("https://e.vnexpress.net.attacker.example/news/example.html", "e.vnexpress.net")
    assert not _is_article_url("http://e.vnexpress.net/news/example.html", "e.vnexpress.net")


def test_rss_image_hosts_do_not_accept_lookalike_domains() -> None:
    item = ElementTree.fromstring(
        '<item xmlns:media="http://search.yahoo.com/mrss/">'
        '<media:content url="https://vnexpress.net.attacker.example/photo.jpg" />'
        '</item>'
    )

    assert _find_image_url(item) is None


def test_article_parser_skips_navigation_and_keeps_readable_paragraphs() -> None:
    parser = _ArticleTextParser()
    parser.feed(
        '<nav><p>Navigation should not be shown in the reading text.</p></nav>'
        '<article><p>Residents are preparing for the annual cultural festival.</p>'
        '<script><p>Hidden script text should not appear here.</p></script>'
        '<p>The event will welcome visitors from across the country.</p></article>'
    )

    assert parser.paragraphs == [
        "Residents are preparing for the annual cultural festival.",
        "The event will welcome visitors from across the country.",
    ]
