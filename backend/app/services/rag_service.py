"""
Clinical Knowledge / RAG Agent's retrieval engine.

GGSIPU2617_Vitalis_Features_and_Recommended_Architecture.pdf and the
team's EPGA - Gap Analysis both flag that the Vitalis/Aarogya baseline has
"no RAG at all" - every LLM call only ever saw the raw user message and
profile, with no grounding in any medical evidence corpus. This module is
that missing piece.

Retrieval pipeline: Guidelines corpus -> chunk metadata (domain,
population, source tier) -> TF-IDF vectors -> cosine similarity ->
domain/population pre-filter -> evidence-tier-aware ranking -> top-k with
citations, matching MER - Retrieval Rules:
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
"""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.core.logging import get_logger
from app.data.knowledge_base import EVIDENCE_SOURCES, KNOWLEDGE_CHUNKS

LOGGER = get_logger(__name__)

MIN_SIMILARITY = 0.05  # below this, treat as "insufficient evidence" (R008)


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
        corpus = [c["text"] for c in self._chunks]
        self._vectorizer = TfidfVectorizer(stop_words="english")
        self._matrix = self._vectorizer.fit_transform(corpus) if corpus else None

    def search(self, query: str, domain_hint: str | None, population_hint: str | None, top_k: int) -> list[EvidenceItem]:
        if self._matrix is None or not query.strip():
            return []
        query_vec = self._vectorizer.transform([query])
        sims = cosine_similarity(query_vec, self._matrix)[0]

        scored: list[tuple[float, dict]] = []
        for chunk, sim in zip(self._chunks, sims):
            score = float(sim)
            # R001: domain filter - boost same-domain chunks rather than
            # hard-excluding, so a near-miss domain can still surface if
            # nothing else is relevant.
            if domain_hint and chunk["domain"].lower() == domain_hint.lower():
                score += 0.15
            # R002: population filter.
            if population_hint and population_hint.lower() not in [p.lower() for p in chunk["population"]]:
                if "all" not in chunk["population"]:
                    score -= 0.1
            scored.append((score, chunk))

        scored.sort(key=lambda pair: pair[0], reverse=True)

        items: list[EvidenceItem] = []
        for score, chunk in scored[:top_k]:
            source = self._sources_by_id.get(chunk["source_id"], {})
            items.append(
                EvidenceItem(
                    chunk_id=chunk["id"],
                    source_id=chunk["source_id"],
                    domain=chunk["domain"],
                    text=chunk["text"],
                    similarity=round(score, 4),
                    source_title=source.get("title", "Unknown source"),
                    source_url=source.get("url"),
                    evidence_tier=source.get("evidence_tier", 3),
                    limitations=source.get("limitations"),
                )
            )
        # R005: rank official/higher-tier evidence above lower-tier evidence
        # once relevance is roughly comparable.
        items.sort(key=lambda item: (item.evidence_tier, -item.similarity))
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