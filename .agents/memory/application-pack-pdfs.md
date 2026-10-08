---
name: Multilingual application PDFs
description: Why pack exports use local shaping fonts, and limits of Indic text extraction.
---

Application-pack PDFs must preserve the reviewed snapshot and render English, Hindi and Gujarati without rewriting or automatically translating the documents. Generate them locally with embedded, licensed shaping fonts rather than using screenshots or the older English-only resume exporter.

**Why:** The user selected multilingual PDF application packs. Image-only PDFs lose selectable text, while default Latin PDF fonts cannot render Indic scripts properly. Local font assets avoid sending application content to a third-party rendering service.

**How to apply:** Keep exports on demand and based on the selected snapshot, not mutable source records or private workspace metadata. Keep original UTF-8 ZIP downloads available.

Visual rendering and logical text extraction are different checks for Indic PDFs.

**Why:** A rendered sample displayed Hindi correctly, but Poppler extraction reordered some Devanagari vowel marks despite embedded fonts and Unicode mappings. Text-native output alone does not establish exact copy/paste or ATS compatibility for every script.

**How to apply:** Check both rendered pages and extracted text when changing the PDF engine or fonts. Do not promise exact Indic text round-tripping or universal ATS compatibility without verifying it; the UTF-8 ZIP remains the exact editable-text export.
