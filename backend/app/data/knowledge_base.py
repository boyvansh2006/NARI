"""
Seed data for the Clinical Knowledge / RAG Agent.

EVIDENCE_SOURCES is transcribed from the project's own research
(MER - Source Registry sheet in IBMIE_Features_and_Research_Extracted.xlsx),
compiled by the team's Researcher 2 (Research_Vanshika.docx, Chapter 2 &
14). IMPORTANT, and consistent with that same research's own "Verification
Status"/"Verify current version before ingestion" column: this project has
no live web-search or fact-checking capability, so these titles/dates/URLs
have not been independently re-verified here. Treat them as a *starting
source list to validate* before any real ingestion, exactly as
MER - Retrieval Rules R004 (version control) and the research doc's own
source-registry idea require - not as confirmed-current citations.

KNOWLEDGE_CHUNKS are short, original, educational-level summaries written
for this project (not verbatim guideline text, which isn't available
offline here) so the RAG pipeline below has real content to retrieve
against. Each chunk is tagged to a source_id, domain and population so
MER - Retrieval Rules R001/R002 (filter by domain/population) can be
demonstrated. Before production use, these chunks should be replaced with
vetted excerpts from the actual verified guideline documents, ideally with
page/section references, per R006 (citation preservation).
"""
from __future__ import annotations

EVIDENCE_SOURCES: list[dict] = [
    {
        "id": "SRC-W01", "domain": "AI Governance", "organization": "WHO",
        "title": "Ethics and governance of artificial intelligence for health",
        "source_type": "WHO guidance", "scope": "Global", "publication_date": "2021-06-28",
        "evidence_tier": 1, "topics": "human autonomy, safety, transparency, accountability, equity",
        "url": "https://www.who.int/publications/i/item/9789240029200",
        "limitations": "Foundational governance guidance; complement with current national law/policy.",
    },
    {
        "id": "SRC-W02", "domain": "AI Governance", "organization": "WHO",
        "title": "Ethics and governance of AI for health: guidance on large multi-modal models",
        "source_type": "WHO guidance", "scope": "Global", "publication_date": "2025-03-25",
        "evidence_tier": 1, "topics": "large multimodal models, health, safety, governance, evaluation",
        "url": "https://www.who.int/publications/i/item/9789240084759",
        "limitations": "Use alongside domain-specific clinical evidence.",
    },
    {
        "id": "SRC-W03", "domain": "Menstrual Health", "organization": "WHO",
        "title": "Menstrual health", "source_type": "WHO fact sheet", "scope": "Global",
        "publication_date": "2026-06-18", "evidence_tier": 1, "topics": "menstruation, symptoms, care seeking",
        "url": "https://www.who.int/news-room/fact-sheets/detail/menstrual-health",
        "limitations": "Fact sheet is not a substitute for specialty clinical guidelines.",
    },
    {
        "id": "SRC-W04", "domain": "PCOS", "organization": "WHO",
        "title": "Polycystic ovary syndrome", "source_type": "WHO fact sheet", "scope": "Global",
        "publication_date": "2026-01-22", "evidence_tier": 1,
        "topics": "PCOS, irregular menstruation, androgen, infertility, metabolic risk, mental health",
        "url": "https://www.who.int/news-room/fact-sheets/detail/polycystic-ovary-syndrome",
        "limitations": "Use a specialty guideline for detailed diagnostic criteria/management.",
    },
    {
        "id": "SRC-W05", "domain": "Endometriosis", "organization": "WHO",
        "title": "Endometriosis", "source_type": "WHO fact sheet", "scope": "Global",
        "publication_date": "2025-10-15", "evidence_tier": 1,
        "topics": "pain, heavy bleeding, pelvic pain, infertility, bowel, urinary, mental health",
        "url": "https://www.who.int/news-room/fact-sheets/detail/endometriosis",
        "limitations": "Should be complemented by specialty guidelines.",
    },
    {
        "id": "SRC-W06", "domain": "Fertility", "organization": "WHO",
        "title": "Guideline for the prevention, diagnosis and treatment of infertility",
        "source_type": "WHO guideline", "scope": "Global", "publication_date": "2025-11-28",
        "evidence_tier": 1, "topics": "infertility, ovulatory dysfunction, tubal disease, uterine cavity, male factors",
        "url": "https://www.who.int/publications/i/item/9789240115774",
        "limitations": "Country-specific adaptation may be required.",
    },
    {
        "id": "SRC-W07", "domain": "Pregnancy", "organization": "WHO",
        "title": "WHO recommendations on antenatal care for a positive pregnancy experience",
        "source_type": "WHO guideline", "scope": "Global", "publication_date": "2016; updated resources",
        "evidence_tier": 1, "topics": "antenatal care, maternal/fetal assessment, nutrition, prevention",
        "url": "https://www.who.int/publications/i/item/9789241549912",
        "limitations": "Must be paired with current national protocols and local clinical guidance.",
    },
    {
        "id": "SRC-W08", "domain": "Maternal Health", "organization": "WHO",
        "title": "WHO recommendations on maternal health (2nd ed., GRC-approved)",
        "source_type": "WHO guideline compilation", "scope": "Global", "publication_date": "2025-03-21",
        "evidence_tier": 1, "topics": "maternal health, pregnancy, postpartum, clinical recommendations",
        "url": "https://www.who.int/publications/i/item/9789240080591",
        "limitations": "Apply recommendation dates and scope carefully.",
    },
    {
        "id": "SRC-W09", "domain": "Postpartum", "organization": "WHO",
        "title": "WHO recommendations on maternal and newborn care for a positive postnatal experience",
        "source_type": "WHO guideline", "scope": "Global", "publication_date": "2022-03-30",
        "evidence_tier": 1, "topics": "postnatal, maternal recovery, newborn, mental health, nutrition",
        "url": "https://www.who.int/publications/i/item/9789240045989",
        "limitations": "Local/national protocols may add requirements.",
    },
    {
        "id": "SRC-W10", "domain": "Menopause", "organization": "WHO",
        "title": "Menopause", "source_type": "WHO fact sheet", "scope": "Global",
        "publication_date": "2024-10-16", "evidence_tier": 1, "topics": "menopause, symptoms, life course, management",
        "url": "https://www.who.int/news-room/fact-sheets/detail/menopause",
        "limitations": "Use specialty guidelines for detailed treatment decisions.",
    },
    {
        "id": "SRC-W11", "domain": "Nutrition", "organization": "WHO",
        "title": "Healthy diet", "source_type": "WHO fact sheet", "scope": "Global",
        "publication_date": "2026-01-26", "evidence_tier": 1, "topics": "healthy diet, diversity, balance, moderation",
        "url": "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
        "limitations": "Not a disease-specific therapeutic diet guideline.",
    },
    {
        "id": "SRC-W12", "domain": "Mental Wellbeing", "organization": "WHO",
        "title": "Depressive disorder (depression)", "source_type": "WHO fact sheet", "scope": "Global",
        "publication_date": "2025-08-29", "evidence_tier": 1, "topics": "depression, symptoms, treatment, suicide risk",
        "url": "https://www.who.int/news-room/fact-sheets/detail/depression",
        "limitations": "Use validated clinical guidelines/instruments for screening and treatment.",
    },
    {
        "id": "SRC-W13", "domain": "Perinatal Mental Health", "organization": "WHO",
        "title": "Perinatal mental health", "source_type": "WHO topic/guidance", "scope": "Global",
        "publication_date": "Current", "evidence_tier": 1, "topics": "perinatal mental health, pregnancy, postpartum",
        "url": "https://www.who.int/teams/mental-health-and-substance-use/promotion-prevention/perinatal-mental-health",
        "limitations": "Verify exact document/version before ingestion.",
    },
    {
        "id": "SRC-W14", "domain": "Chronic Conditions", "organization": "WHO",
        "title": "Noncommunicable diseases", "source_type": "WHO fact sheet", "scope": "Global",
        "publication_date": "2025-09-25", "evidence_tier": 1,
        "topics": "NCD, diabetes, cardiovascular, chronic disease risk factors",
        "url": "https://www.who.int/news-room/fact-sheets/detail/noncommunicable-diseases",
        "limitations": "Disease-specific guidelines required for clinical decisions.",
    },
    {
        "id": "SRC-W15", "domain": "Cardiovascular", "organization": "WHO",
        "title": "Cardiovascular diseases", "source_type": "WHO fact sheet", "scope": "Global",
        "publication_date": "2025-07-31", "evidence_tier": 1, "topics": "cardiovascular disease, hypertension, risk factors",
        "url": "https://www.who.int/en/news-room/fact-sheets/detail/cardiovascular-diseases-%28cvds%29",
        "limitations": "Not a substitute for cardiology/primary-care guidelines.",
    },
]

# Each chunk: id, source_id, domain (matches EvidenceSource.domain for R001
# domain filtering), population (list, for R002 population filtering),
# keywords (list, informs the TF-IDF corpus + quick keyword pre-filter),
# text (short educational summary - see module docstring on provenance).
KNOWLEDGE_CHUNKS: list[dict] = [
    {
        "id": "CHK-01", "source_id": "SRC-W03", "domain": "Menstrual Health",
        "population": ["all"], "keywords": ["cycle", "period", "menstruation", "bleeding", "irregular"],
        "text": (
            "A typical menstrual cycle varies in length between individuals; persistent irregularity, "
            "very heavy bleeding, or cycles that suddenly change pattern are reasons to track carefully "
            "and discuss with a clinician rather than assume they are normal variation."
        ),
    },
    {
        "id": "CHK-02", "source_id": "SRC-W04", "domain": "PCOS",
        "population": ["all"], "keywords": ["pcos", "polycystic", "irregular cycle", "androgen", "acne", "hair growth"],
        "text": (
            "Polycystic ovary syndrome (PCOS) is associated with irregular or absent periods, signs of "
            "higher androgen levels (such as acne or excess hair growth), and can be linked to metabolic "
            "and mental-health effects. It is diagnosed clinically, not from symptoms or a single lab "
            "value alone, and evaluation with a clinician is recommended when a pattern is suspected."
        ),
    },
    {
        "id": "CHK-03", "source_id": "SRC-W04", "domain": "PCOS",
        "population": ["all"], "keywords": ["pcos", "metabolic", "insulin", "weight"],
        "text": (
            "PCOS can be associated with metabolic changes such as insulin resistance. Lifestyle support "
            "(nutrition, activity, sleep) is commonly part of management, but is a complement to, not a "
            "replacement for, clinical evaluation and treatment."
        ),
    },
    {
        "id": "CHK-04", "source_id": "SRC-W05", "domain": "Endometriosis",
        "population": ["all"], "keywords": ["endometriosis", "pelvic pain", "heavy bleeding", "painful periods"],
        "text": (
            "Endometriosis often presents with pelvic pain (including painful periods and pain during "
            "intercourse), heavy bleeding, and sometimes bowel or urinary symptoms and fertility "
            "difficulty. Severity of pain doesn't always match how much disease is present, and symptoms "
            "alone don't confirm a diagnosis - specialist evaluation is recommended for persistent pain."
        ),
    },
    {
        "id": "CHK-05", "source_id": "SRC-W06", "domain": "Fertility",
        "population": ["all"], "keywords": ["fertility", "infertility", "conceive", "ovulation"],
        "text": (
            "Infertility evaluation typically looks at cycle/ovulatory patterns, structural factors, and "
            "relevant history for both partners where applicable. A single missed conception attempt "
            "period is not itself diagnostic; timelines for seeking evaluation vary with age and history, "
            "so a clinician's guidance is recommended rather than self-diagnosis."
        ),
    },
    {
        "id": "CHK-06", "source_id": "SRC-W07", "domain": "Pregnancy",
        "population": ["pregnancy"], "keywords": ["pregnancy", "antenatal", "prenatal", "trimester"],
        "text": (
            "Antenatal care focuses on regular monitoring, nutrition, and early identification of "
            "complications. Any of the following warrant prompt clinical attention during pregnancy: "
            "severe abdominal pain, heavy vaginal bleeding, severe headache with visual changes, reduced "
            "fetal movement, or signs of labor before term."
        ),
    },
    {
        "id": "CHK-07", "source_id": "SRC-W08", "domain": "Maternal Health",
        "population": ["pregnancy", "postpartum"], "keywords": ["maternal health", "high risk pregnancy"],
        "text": (
            "Maternal health recommendations emphasize routine screening, management of pre-existing and "
            "pregnancy-related conditions, and continuity of care from pregnancy through the postpartum "
            "period, with escalation pathways for warning signs at every stage."
        ),
    },
    {
        "id": "CHK-08", "source_id": "SRC-W09", "domain": "Postpartum",
        "population": ["postpartum"], "keywords": ["postpartum", "postnatal", "delivery", "recovery"],
        "text": (
            "Postnatal recovery involves physical healing, sleep, mood, nutrition, and infant feeding "
            "support. Persistent heavy bleeding, fever, severe pain, breast infection signs, or "
            "significant mood changes after delivery should be discussed with a clinician promptly rather "
            "than waiting for a routine follow-up."
        ),
    },
    {
        "id": "CHK-09", "source_id": "SRC-W13", "domain": "Perinatal Mental Health",
        "population": ["pregnancy", "postpartum"], "keywords": ["postpartum depression", "baby blues", "perinatal mood"],
        "text": (
            "Mood changes are common in pregnancy and after birth. Persistent low mood, anxiety, "
            "difficulty bonding, or any thoughts of self-harm are reasons to seek professional support "
            "promptly - perinatal mental health concerns are treatable and should not be dismissed as "
            "'normal' exhaustion alone."
        ),
    },
    {
        "id": "CHK-10", "source_id": "SRC-W10", "domain": "Menopause",
        "population": ["menopause"], "keywords": ["menopause", "perimenopause", "hot flashes", "transition"],
        "text": (
            "Menopause is a natural life-stage transition, usually confirmed after twelve consecutive "
            "months without a period. The transition can affect physical, emotional and mental wellbeing "
            "in varied ways, and symptom management can be discussed with a clinician based on individual "
            "history and preferences."
        ),
    },
    {
        "id": "CHK-11", "source_id": "SRC-W11", "domain": "Nutrition",
        "population": ["all"], "keywords": ["diet", "nutrition", "healthy eating", "balanced diet"],
        "text": (
            "A healthy dietary pattern generally includes a variety of fruits, vegetables, whole grains, "
            "and adequate protein, with limited free sugars, saturated fat, and salt. Individual "
            "requirements vary by life stage, activity level, and health conditions, so general guidance "
            "should be adapted rather than applied uniformly."
        ),
    },
    {
        "id": "CHK-12", "source_id": "SRC-W12", "domain": "Mental Wellbeing",
        "population": ["all"], "keywords": ["depression", "low mood", "stress", "anxiety"],
        "text": (
            "Persistent low mood, loss of interest, changes in sleep/appetite, or difficulty functioning "
            "for more than two weeks can indicate depression, which is treatable. Any thoughts of "
            "self-harm or suicide are a reason to seek help immediately from a professional or crisis "
            "service rather than waiting."
        ),
    },
    {
        "id": "CHK-13", "source_id": "SRC-W14", "domain": "Chronic Conditions",
        "population": ["all"], "keywords": ["diabetes", "hypertension", "chronic disease", "ncd"],
        "text": (
            "Noncommunicable diseases such as diabetes and hypertension are managed with condition-"
            "specific monitoring, lifestyle measures, and medication where indicated. A general wellness "
            "score is not a substitute for disease-specific clinical assessment."
        ),
    },
    {
        "id": "CHK-14", "source_id": "SRC-W15", "domain": "Cardiovascular",
        "population": ["all"], "keywords": ["heart disease", "cardiovascular", "blood pressure", "chest pain"],
        "text": (
            "Cardiovascular risk factors include high blood pressure, high cholesterol, smoking, "
            "inactivity, and diabetes. Chest pain, breathlessness, or fainting are reasons for urgent "
            "evaluation rather than routine follow-up."
        ),
    },
    {
        "id": "CHK-15", "source_id": "SRC-W01", "domain": "AI Governance",
        "population": ["all"], "keywords": ["ai safety", "autonomy", "transparency", "accountability"],
        "text": (
            "Responsible use of AI in health should preserve human autonomy over decisions, remain "
            "transparent about its limitations, and keep humans accountable for clinical outcomes - "
            "an AI system should support, not replace, clinical judgement."
        ),
    },
]