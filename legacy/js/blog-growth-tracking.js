(function () {
    var REF = "blog_article";
    var ALLOWED_EVENTS = {
        article_tool_cta_click: true,
        article_inspector_click: true,
        article_pro_click: true,
        related_click: true
    };
    var ALLOWED_POS = {
        hero: true,
        inline_track: true,
        inline_timing: true,
        footer: true,
        related: true
    };
    var ALLOWED_TARGETS = {
        tool_json: true,
        tool_csv: true,
        inspector: true,
        pro: true,
        related: true
    };

    function getArticleSlug() {
        var fromBody = document.body && document.body.getAttribute("data-article-slug");
        if (fromBody) {
            return fromBody;
        }

        var fromHtml = document.documentElement && document.documentElement.getAttribute("data-article-slug");
        if (fromHtml) {
            return fromHtml;
        }

        var meta = document.querySelector('meta[name="article-slug"]');
        if (meta && meta.content) {
            return meta.content;
        }

        var path = window.location.pathname || "";
        var file = path.split("/").pop() || "";
        return file.replace(/\.html$/, "") || "unknown-article";
    }

    function pushAnalyticsEvent(name, params) {
        if (!name) {
            return;
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(Object.assign({ event: name }, params || {}));
    }

    function escapeHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function normalizeItems(items, currentSlug) {
        var result = [];
        var seen = {};

        seen[currentSlug] = true;

        (items || []).forEach(function (item) {
            if (!item || !item.slug || seen[item.slug]) {
                return;
            }

            seen[item.slug] = true;
            result.push(item);
        });

        return result;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var articleSlug = getArticleSlug();

        document.addEventListener("click", function (event) {
            var target = event.target.closest("[data-track], [data-track-event]");
            if (!target) {
                return;
            }

            var eventName = target.getAttribute("data-track") || target.getAttribute("data-track-event");
            var pos = target.getAttribute("data-pos") || "unknown";
            var targetType = target.getAttribute("data-target");
            var relatedSlug = target.getAttribute("data-related-slug");
            var idxRaw = target.getAttribute("data-index");
            var idx = idxRaw ? parseInt(idxRaw, 10) : null;

            if (!ALLOWED_EVENTS[eventName] || !ALLOWED_POS[pos]) {
                return;
            }

            if (!targetType || !ALLOWED_TARGETS[targetType]) {
                return;
            }

            var payload = {
                article_slug: articleSlug,
                pos: pos,
                target: targetType,
                ref: REF
            };

            if (eventName === "related_click") {
                if (!relatedSlug || idx === null || isNaN(idx) || idx < 1) {
                    return;
                }
                payload.related_slug = relatedSlug;
                payload.index = idx;
            }

            pushAnalyticsEvent(eventName, payload);
        });

        var relatedContainer = document.getElementById("related-articles-list");
        if (relatedContainer) {
            var data = window.BLOG_ARTICLE_DATA || {};
            var related = normalizeItems(data.related, articleSlug);

            if (related.length < 3) {
                var latest = normalizeItems(data.latest, articleSlug);
                latest.forEach(function (item) {
                    if (related.length >= 6) {
                        return;
                    }

                    var exists = related.some(function (entry) {
                        return entry.slug === item.slug;
                    });

                    if (!exists) {
                        related.push(item);
                    }
                });
            }

            related = related.slice(0, 6);

            if (related.length === 0) {
                var section = relatedContainer.closest(".article-related-section") || relatedContainer.closest(".related-articles");
                if (section) {
                    section.style.display = "none";
                }
            } else {
                var defaultImage = "/images/How to Efficiently Convert MIDI Files to JSON Format Detailed Steps.jpg";
                relatedContainer.innerHTML = related.map(function (item, index) {
                    return (
                        '<article class="related-article-card">' +
                            '<a class="related-article-link" href="' + escapeHtml(item.url || "#") + '" data-track="related_click" data-pos="related" data-target="related" data-related-slug="' + escapeHtml(item.slug) + '" data-index="' + (index + 1) + '">' +
                                '<img class="related-article-image" loading="lazy" src="' + escapeHtml(item.image || defaultImage) + '" alt="' + escapeHtml(item.title || "Related article") + '">' +
                                '<div class="related-article-body">' +
                                    '<h3>' + escapeHtml(item.title || "Related article") + '</h3>' +
                                    '<p>' + escapeHtml(item.excerpt || "Read the full guide for practical workflows and examples.") + '</p>' +
                                '</div>' +
                            '</a>' +
                        '</article>'
                    );
                }).join("");
            }
        }

        var sentinel = document.getElementById("scroll-sentinel-75");
        if (sentinel) {
            var hasTrackedScroll = false;
            var trackScroll75 = function () {
                if (hasTrackedScroll) {
                    return;
                }
                hasTrackedScroll = true;
                pushAnalyticsEvent("scroll_75", {
                    article_slug: articleSlug,
                    percent: 75,
                    ref: REF
                });
            };

            if ("IntersectionObserver" in window) {
                var observer = new IntersectionObserver(function (entries, obs) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting) {
                            trackScroll75();
                            obs.disconnect();
                        }
                    });
                }, {
                    root: null,
                    threshold: 0.1
                });

                observer.observe(sentinel);
            } else {
                var onScroll = function () {
                    var rect = sentinel.getBoundingClientRect();
                    if (rect.top <= window.innerHeight * 0.95) {
                        trackScroll75();
                        window.removeEventListener("scroll", onScroll);
                    }
                };

                window.addEventListener("scroll", onScroll, { passive: true });
                onScroll();
            }
        }
    });
})();
