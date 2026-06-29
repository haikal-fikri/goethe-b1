# Content Correction Pass — Changelog

Goethe-B1 Redemittel corpus, reviewed by a 3-expert panel (German linguistics, DE-EN interpreting, SLA pedagogy) in 11 batches over all 414 entries + 12 exam tasks, web-verified against Duden where doubtful. Applied directly to the Supabase `redemittel`/`exam_tasks` tables (idempotent UPDATEs; full CSV backup taken first).

## Summary
- **Example sentences added:** 414 entries now carry 1–2 contextual worked examples (new `examples` jsonb column, migration 0004).
- **Grammar/orthography fixes (phrase rewrites):** 2
- **Translation refinements (register / cueing / accuracy):** 21
- **Re-leveling (linguist-confirmed only):** 4
- **Notes refinements:** 0
- **Exam task fixes:** 2

Distractors were intentionally left untouched (they are by-design wrong-answer foils). Pedagogy-suggested re-levels beyond the linguist’s confirmed set were logged to `/tmp/deutsch-review/ped-level-suggestions.txt` for human review, not auto-applied.

## Grammar / orthography fixes
- `0e8603cb557f` — Die Eltern arbeiten, die Kinder indes spielen. → **Die Eltern arbeiten, die Kinder spielen indes.**
  - Der zweite Teil ist ein selbstständiger (asyndetischer) Hauptsatz. Die notes bezeichnen 'indes' korrekt als Mittelfeld-Adverb (Konjunktionaladverb), kein Subjunktor. Damit muss das finite Verb in V2-Position stehen: 'die Kinder spielen indes', nicht verbletzt 'die Kinder indes spielen'. Verbletztstellung wäre nur bei einleitendem Subjunktor ('indes die Kinder spielen') möglich; mit vorangestelltem Subjekt ist sie ungrammatisch.
- `d313d0f755be` — Die Theorie überzeugt, die Praxis indessen enttäuscht. → **Die Theorie überzeugt, die Praxis enttäuscht indessen.**
  - Selbstständiger (asyndetischer) Hauptsatz; 'indessen' ist hier laut notes Konjunktionaladverb im Mittelfeld. Das finite Verb muss in V2-Position stehen: 'die Praxis enttäuscht indessen'. Die Verbletztstellung 'die Praxis indessen enttäuscht' verletzt die V2-Regel des Hauptsatzes.

## Re-leveling
- `350758ada03e` — C2 → **B2** — Sehr gebräuchliche, transparente Dankesformel; C2 zu hoch, allenfalls B2.
- `3c71fc741de3` — C2 → **B2** — Alltäglicher umgangssprachlicher Abschiedsgruß; keine C2-Merkmale.
- `c04b34f62306` — C1 → **B1** — Einfacher transparenter Satz, typische B1-Mailwendung.
- `18ee39a0310e` — C1 → **B2** — Verbreitete informelle Schlussformel; allenfalls B2.

## Translation refinements
- `448cafae0ddf` — “Many thanks for your message!” → “Thanks so much for your message!” (improvement)
  - register: informal email warrants warmer English
- `f23cd5c771e7` — “I'm very glad to read from you.” → “It's so good to hear from you in writing!” (error)
  - 'read from you' is not idiomatic English; keeps the written-medium sense
- `3c71fc741de3` — “Take care of yourself!” → “Take care and look after yourself!” (improvement)
  - cueing: original dropped the 'Mach's gut und' half
- `09e118defa3e` — “Best wishes, Anna” → “Love, Anna” (improvement)
  - register/cueing: 'Liebe Grüße' warmer than 'Best wishes', avoids collision with 'Viele Grüße'
- `1eb760708b04` — “Just think of the many commuters.” → “Let's just think of the many commuters.” (improvement)
  - German 'Denken wir nur an' is a 1st-person-plural hortative ('let us think'), but 'Just think of' is a 2nd-person imperative that cues 'Denk(t) nur an' instead. 'Let's just think of' preserves the inclusive 'wir' so the learner produces 'Denken wir', and matches the rest (an + Akkusativ = 'of').
- `265c2fb6fa0a` — “What speaks for it is that the costs fall.” → “A point in its favour is that costs are falling.” (improvement)
  - 'What speaks for it' is a Germanism and 'the costs fall' is unnatural English. The revised version reads naturally while still cueing the 'dafür spricht, dass …' frame via 'in its favour'; 'are falling' correctly renders the present-tense 'sinken'.
- `0eba336abcd6` — “In my view, the advantages clearly outweigh.” → “In my view, the advantages clearly outweigh the disadvantages.” (improvement)
  - English 'outweigh' is transitive and sounds incomplete without an object; 'überwiegen' here is intransitive ('predominate'). Adding the implied object makes the English natural while still cueing 'überwiegen ... deutlich'.
- `d66227df3bde` — “It is expensive, true, but it is worth it.” → “It is true that it is expensive, but it is worth it.” (improvement)
  - The parenthetical 'true' weakly cues 'zwar' and the reshuffled word order obscures the 'zwar ..., aber ...' concessive pair. A clearer concessive frame ('It is true that ..., but ...') reliably cues the zwar/aber structure.
- `a858c475e3bd` — “From my point of view, the disadvantages outweigh here.” → “From my point of view, the disadvantages prevail here.” (improvement)
  - 'outweigh' is transitive and needs an object; intransitive 'outweigh here' is unnatural English. 'überwiegen' here is intransitive ('predominate/prevail'), so 'prevail' renders it naturally and still cues 'überwiegen die Nachteile'.
- `14f5d7486b21` — “Ultimately, the advantages outweigh for me.” → “Ultimately, for me the advantages prevail.” (improvement)
  - Intransitive 'outweigh for me' is ungrammatical/unnatural; 'überwiegen für mich die Vorteile' uses überwiegen intransitively. 'prevail' fixes the English while still cueing überwiegen.
- `835ad1cf7c7f` — “Would you please name an appointment for me?” → “Would you please suggest an appointment time?” (improvement)
  - 'name an appointment' is unnatural in English; 'einen Termin nennen' means giving/suggesting a date or time. The fix reads naturally while still cuing a formal Würden-Sie request for a Termin.
- `c68fc6acf34c` — “I would be much obliged for your accommodation.” → “I would be much obliged for your cooperation.” (improvement)
  - 'accommodation' is ambiguous in English (suggests lodging) and does not naturally render 'Entgegenkommen'. 'cooperation/obliging me' matches the very formal register and still cues 'verbunden' + 'Entgegenkommen'.
- `8f014feb3bf9` — “Then let's settle on the middle ground as a compromise.” → “Then let's put down the middle ground as a compromise.” (error)
  - German verb is festhalten (record/note down a result), not 'settle on' (= sich einigen). 'Settle on' mis-cues the learner toward einigen and duplicates entry 6b0f. 'Put down' (or 'note down') cues festhalten and matches the C1 note about festschreiben.
- `a45bfc2f5dd7` — “I think that the advantages outweigh the disadvantages.” → “I think the advantages outweigh.” (improvement)
  - German 'die Vorteile überwiegen' states only that the advantages prevail; 'the disadvantages' is added content not in the source. Drop it to match the cued phrase (überwiegen is intransitive here).
- `12c030ebfb5c` — “All in all, the advantages outweigh the rest for me.” → “All in all, for me the advantages outweigh.” (improvement)
  - 'überwiegen' here is intransitive ('prevail/predominate'); 'outweigh the rest' adds an object not in the German and reads awkwardly. Keeps 'für mich' cued.
- `fd59ad5fded6` — “Where I'm from, this festival is celebrated in summer.” → “Where I'm from, we celebrate this festival in summer.” (improvement)
  - German is active 'feiert man' (cloze targets 'feiert'); the English passive 'is celebrated' cues 'wird gefeiert' instead. Active rendering cues the targeted verb form.
- `0e5b97de67da` — “Hats off, that was an all-around successful presentation.” → “Hats off, that was a thoroughly successful presentation.” (improvement)
  - 'all-around successful' is awkward English collocation; 'rundum gelungen' = thoroughly/completely successful. 'thoroughly' reads naturally and still cues 'rundum gelungene'.
- `1aec92f7a365` — “Let me elaborate on that a bit, gladly.” → “Let me gladly elaborate on that a bit further.” (improvement)
  - Trailing ', gladly' is unnatural English word order. Moving 'gladly' inline keeps the 'gern' nuance while sounding native, and 'further' nudges 'genauer ausführen'.
- `edd61cc2cd9d` — “Now I come to the second point.” → “Now I'll move on to the second point.” (improvement)
  - 'Now I come to...' is a literal calque; natural English uses future 'I'll'. 'move on to' cues 'komme ich zum ... Punkt' (transition) while sounding idiomatic.
- `9825edd6a25b` — “The idea is appealing, only the budget is missing.” → “The idea is appealing, only there's no budget.” (error)
  - 'nur' here is the adversative discourse connector ('it's just that...'), but 'only the budget is missing' reads as a quantifier scoping over 'budget' (only that, nothing else), which mistranslates the logic and fails to cue connective 'nur'. Fronting 'only' before the clause preserves the adversative reading the German has.
- `0e8603cb557f` — “The parents work, while the children meanwhile play.” → “The parents work, the children by contrast play.” (improvement)
  - The note pins 'indes' here as contrastive (Gegensatz), but 'while ... meanwhile' signals temporal simultaneity, cueing the wrong logic and pointing toward a temporal reading. 'by contrast' signals the intended adversative sense and matches the Mittelfeld position contrasting the two subjects.

## Exam fixes
- `s3-a2` (title_de) — Title/content mismatch: the title 'Persönliche Kontakte und Internet' does not describe this task at all. The prompt's stimulus and the entire sample answer are about fixed working hours, flexibility, Homeoffice and work-life balance. The unrelated title (identical to s4-a2, where it is correct) would confuse a candidate. Aligning the title to the actual theme fixes the internal inconsistency without altering the (sound) sample answer.
- `s3-a2` (prompt_de) — The prompt names the theme as 'Persönliche Kontakte und Internet' but then says the stimulus comment is about 'feste Arbeitszeiten und Flexibilität' — a self-contradiction. The sample answer addresses only working hours, flexibility and reconciling work and family life. Renaming the theme to match the stimulus and content removes the contradiction; German is otherwise correct.


## Frame capitalization fix (Nachschlagen headlines)
The `frame_de` field (shown as the headline in the reference browser) had been generated by naively lowercasing the phrase, which wrongly lowercased German nouns and the formal *Sie*. Re-cased deterministically from each entry's correctly-capitalized `phrase` (preserving the deliberate lowercase first word of the pattern). **75 frames corrected** — e.g. `…dein urlaub` → `…dein Urlaub`, `würden sie …einen termin` → `würden Sie …einen Termin`.

## Example sentences cleanup
Stripped any example identical to its phrase (112 entries) so feedback never just echoes the answer; every entry retains ≥1 genuine contextual example (avg 1.73).
