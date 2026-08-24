from __future__ import annotations

"""
GGSIPU2617 extension - audit fix ("No drug-interaction or duplicate-
medication checking despite the README describing 'interaction checks'.
Either implement basic interaction flags or remove the claim.").

This implements the "basic interaction flags" half of that fix, not a full
clinical drug-interaction database (that needs a licensed dataset - e.g.
RxNorm/DrugBank - and clinical sign-off, well beyond this pass; see
agents/risk_engine.py's docstring for the same "heuristic, not validated"
principle applied here). What this DOES catch, deterministically:

  1. Duplicate/near-duplicate medication names already on the person's
     reminder list (the actual bug report: "no duplicate-medication
     checking").
  2. A small, explicitly non-exhaustive set of well-known, high-caution
     combinations, purely as an informational nudge to ask a pharmacist/
     doctor - never a block on saving the reminder.

Callers (api/reminders.py) always surface these as advisory `warnings`
alongside a successful write, never as a rejected request - the app must
not make an autonomous clinical call to prevent someone taking their
medication (same "no autonomous diagnosis/decision" boundary as the Risk
Prediction Agent).
"""

# Deliberately tiny and explicit rather than a big opaque table - every
# entry here should be checkable by a human reading this file. NOT a
# substitute for a pharmacist or a real interaction-checking API.
_KNOWN_CAUTION_PAIRS: list[tuple[set[str], str]] = [
    ({"warfarin", "aspirin"}, "Combining warfarin and aspirin increases bleeding risk - ask your prescriber."),
    ({"warfarin", "ibuprofen"}, "NSAIDs like ibuprofen can increase bleeding risk when taken with warfarin."),
    ({"metformin", "alcohol"}, "Alcohol combined with metformin can raise the risk of lactic acidosis - discuss with your prescriber."),
    ({"ssri", "maoi"}, "Combining an SSRI with an MAOI can cause serotonin syndrome - this combination needs specialist supervision."),
    ({"levothyroxine", "calcium"}, "Calcium supplements can reduce levothyroxine absorption if taken too close together - space doses by 4+ hours."),
    ({"iron", "calcium"}, "Iron and calcium supplements can reduce each other's absorption if taken together - consider spacing them out."),
]


def _normalize(name: str) -> str:
    return (name or "").strip().lower()


def check_duplicate(new_name: str, existing_names: list[str]) -> str | None:
    """Flags an exact or near-exact match against the person's existing
    reminders (case-insensitive, ignoring surrounding whitespace)."""
    normalized_new = _normalize(new_name)
    if not normalized_new:
        return None
    for existing in existing_names:
        if _normalize(existing) == normalized_new:
            return f"You already have a reminder named \"{existing}\" - check this isn't a duplicate entry."
    return None


def check_interactions(new_name: str, existing_names: list[str]) -> list[str]:
    """Checks the new medication name against the small known-caution list
    above, paired with every other active reminder name. Purely a name
    substring match (case-insensitive) - not brand/generic-aware beyond
    what's spelled out in _KNOWN_CAUTION_PAIRS."""
    warnings: list[str] = []
    all_names = [_normalize(n) for n in ([new_name] + existing_names) if n]
    for pair, message in _KNOWN_CAUTION_PAIRS:
        hits = {drug for drug in pair if any(drug in name for name in all_names)}
        if hits == pair:
            warnings.append(message)
    return warnings


def evaluate_new_reminder(new_name: str, existing_names: list[str]) -> list[str]:
    warnings: list[str] = []
    duplicate = check_duplicate(new_name, existing_names)
    if duplicate:
        warnings.append(duplicate)
    warnings.extend(check_interactions(new_name, existing_names))
    return warnings