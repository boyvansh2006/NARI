"""
Clinical Knowledge / RAG Agent's retrieval engine.

GGSIPU2617_Vitalis_Features_and_Recommended_Architecture.pdf and the
team's EPGA - Gap Analysis both flag that the Vitalis/Aarogya baseline has
"no RAG at all" - every LLM call only ever saw the raw user message and
profile, with no grounding in any medical evidence corpus. This module is
that missing piece.

Retrieval pipeline: Guidelines corpus -> chunk metadata (domain,
population, source tier) -> TF-IDF + keyword vectors -> cosine similarity
-> domain/population pre-filter -> evidence-tier-aware ranking -> top-k
with citations, matching MER - Retrieval Rules:
  R001 filter by domain, R002 filter by population, R005 rank official
  guidance above lower-tier evidence, R006 preserve citation/source
  metadata, R008 say so when there isn't enough evidence rather than
  inventing an answer.

Why TF-IDF and not embeddings/FAISS: this sandbox has no network access to
an embeddings API or a model-weight host, so a real
FAISS/Milvus/Pinecone + Gemini/OpenAI-embeddings pipeline (as GGSIPU2617's
tech stack names) can't actually be downloaded/exercised here.
scikit-learn's TF-IDF vectorizer needs no external download and is a
faithful *stand-in* for the same retrieve-then-rank shape - the
`EmbeddingBackend` seam below is exactly where you'd plug in real
embeddings + a vector DB for production, without changing any agent code.

--- Fix notes (see: "period cramps" surfacing Menopause/Fertility/Maternal
Health articles instead of a Menstrual Health one) ---
Two bugs were compounding to make retrieval return the wrong article:

1. Domain/population were only ever applied as a soft +0.20 / -0.05 score
   nudge on top of raw TF-IDF cosine similarity, never as the "pre-filter"
   the module docstring above always claimed. So a chunk in the *wrong*
   domain that happened to share one generic English word with the query
   (e.g. the word "period" appearing inside a Menopause chunk as "...twelve
   months without a period", or a Fertility chunk as "...attempt period")
   could easily outscore the one chunk that was actually in the right
   domain. That's exactly how "period cramps" (domain: Menstrual Health)
   surfaced Menopause/Fertility chunks instead.
2. Each knowledge chunk already carries a curated `keywords` list (per
   chunk, in knowledge_base.py) meant to catch exactly this kind of gap -
   but the vectorizer was only ever fit on `text`, so `keywords` was dead
   metadata that never influenced retrieval at all.

Fix: domain/population now act as a real hard pre-filter (matching the
pipeline this module already documented), and `keywords` are folded into
both the corpus and an explicit keyword-match signal, so an exact keyword
hit (e.g. "cramps", "hot flashes") reliably outranks incidental word
overlap from an unrelated domain.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.core.logging import get_logger
from app.data.knowledge_base import EVIDENCE_SOURCES, KNOWLEDGE_CHUNKS

LOGGER = get_logger(__name__)

MIN_SIMILARITY = 0.05  # below this, treat as "insufficient evidence" (R008)
LEXICAL_FLOOR = 0.08  # minimum raw TF-IDF cosine sim to count as "on topic"
KEYWORD_BOOST = 0.30  # per exact keyword hit - deliberately large so a real
# keyword match (curated per chunk) always beats incidental word overlap
DOMAIN_MISMATCH_PENALTY = 0.5  # multiplier applied when falling back across
# domains, so an off-domain fallback candidate never looks as confident as
# a genuine in-domain one

_TOKEN_RE = re.compile(r"[a-z0-9']+")


def _tokenize(text: str) -> set[str]:
    return set(_TOKEN_RE.findall(text.lower()))


@dataclass
class EvidenceItem:
    chunk_id: str
    source_id: str
    domain: str
    text: str
    similarity: float
    source_title: str
    source_url: str | None
    evidence_tier: int
    limitations: str | None = None


@dataclass
class RetrievalResult:
    items: list[EvidenceItem] = field(default_factory=list)
    sufficient: bool = False
    note: str = ""


class _EmbeddingBackend:
    """
    Seam for swapping in a real vector DB / embeddings provider later
    (FAISS/Milvus/Pinecone + Gemini/OpenAI embeddings, per GGSIPU2617's
    tech stack) without touching any calling code - see module docstring.
    """

    def __init__(self) -> None:
        self._sources_by_id = {s["id"]: s for s in EVIDENCE_SOURCES}
        self._chunks = KNOWLEDGE_CHUNKS
        # Fold each chunk's curated keywords into the corpus (repeated, so
        # they carry real TF-IDF weight) instead of leaving them as unused
        # metadata - this is what the module docstring always described.
        corpus = [
            c["text"] + "  " + ((" " + " ".join(c.get("keywords", []))) * 3)
            for c in self._chunks
        ]
        self._vectorizer = TfidfVectorizer(stop_words="english")
        self._matrix = self._vectorizer.fit_transform(corpus) if corpus else None

    def _keyword_hits(self, query_lower: str, query_tokens: set[str], chunk: dict) -> int:
        hits = 0
        for kw in chunk.get("keywords", []):
            kw_lower = kw.lower()
            if " " in kw_lower:
                # multi-word keyword (e.g. "hot flashes", "pelvic pain") -
                # match as a phrase so partial word overlap doesn't count
                if kw_lower in query_lower:
                    hits += 1
            elif kw_lower in query_tokens:
                hits += 1
        return hits

    def search(self, query: str, domain_hint: str | None, population_hint: str | None, top_k: int) -> list[EvidenceItem]:
        if self._matrix is None or not query.strip():
            return []

        query_lower = query.lower()
        query_tokens = _tokenize(query)
        query_vec = self._vectorizer.transform([query])
        sims = cosine_similarity(query_vec, self._matrix)[0]

        rows: list[dict] = []
        for chunk, sim in zip(self._chunks, sims):
            raw_sim = float(sim)
            kw_hits = self._keyword_hits(query_lower, query_tokens, chunk)
            source = self._sources_by_id.get(chunk["source_id"], {})
            rows.append(
                {
                    "chunk": chunk,
                    "source": source,
                    "raw_sim": raw_sim,
                    "kw_hits": kw_hits,
                    "on_topic": raw_sim >= LEXICAL_FLOOR or kw_hits > 0,
                }
            )

        # --- R001/R002: domain & population are hard pre-filters, applied
        # *before* ranking - not a soft score nudge - so an off-domain chunk
        # can never outrank an on-domain one just because it shares one
        # incidental word with the query.
        pool = rows
        domain_filtered = False
        if domain_hint:
            in_domain = [r for r in rows if r["chunk"]["domain"].lower() == domain_hint.lower()]
            if in_domain:
                pool = in_domain
                domain_filtered = True

        if population_hint:
            in_population = [
                r for r in pool
                if "all" in r["chunk"]["population"]
                or population_hint.lower() in [p.lower() for p in r["chunk"]["population"]]
            ]
            if in_population:
                pool = in_population

        relevant = [r for r in pool if r["on_topic"]]
        fell_back = False
        if not relevant and domain_filtered:
            # The named domain has no genuinely on-topic chunk for this
            # query (e.g. only a stub exists) - fall back to the full
            # corpus rather than a hard "no evidence" response, but flag it
            # so the fallback is scored down relative to a true in-domain hit.
            relevant = [r for r in rows if r["on_topic"]]
            fell_back = True

        def composite_score(row: dict) -> float:
            score = row["raw_sim"] + KEYWORD_BOOST * row["kw_hits"]
            if fell_back:
                score *= DOMAIN_MISMATCH_PENALTY
            return score

        relevant.sort(
            key=lambda r: (
                round(composite_score(r), 4),
                -r["source"].get("evidence_tier", 3),  # R005: lower tier number = higher priority
            ),
            reverse=True,
        )

        items: list[EvidenceItem] = []
        for row in relevant[:top_k]:
            chunk, source = row["chunk"], row["source"]
            items.append(
                EvidenceItem(
                    chunk_id=chunk["id"],
                    source_id=chunk["source_id"],
                    domain=chunk["domain"],
                    text=chunk["text"],
                    similarity=round(composite_score(row), 4),
                    source_title=source.get("title", "Unknown source"),
                    source_url=source.get("url"),
                    evidence_tier=source.get("evidence_tier", 3),
                    limitations=source.get("limitations"),
                )
            )
        return items


@lru_cache(maxsize=1)
def _backend() -> _EmbeddingBackend:
    return _EmbeddingBackend()


def retrieve(query: str, *, domain_hint: str | None = None, population_hint: str | None = None, top_k: int = 3) -> RetrievalResult:
    """Main entry point used by the Clinical Knowledge / RAG Agent node."""
    items = _backend().search(query, domain_hint, population_hint, top_k)
    sufficient = any(item.similarity >= MIN_SIMILARITY for item in items)

    if not sufficient:
        LOGGER.info(f"RAG: insufficient evidence for query={query!r} domain={domain_hint!r}")
        return RetrievalResult(
            items=[],
            sufficient=False,
            note=(
                "I don't have enough reliable evidence in the current knowledge base to safely answer "
                "this - please raise it with a clinician."
            ),
        )
    return RetrievalResult(items=items, sufficient=True, note="")