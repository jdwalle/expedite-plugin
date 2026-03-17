# Recycle Escalation Messaging (GATE-04)

Read by the research orchestrator when G2 gate outcome is Recycle or when the user needs to decide whether to approve gap-fill. Escalation tone changes based on how many times G2 has already recycled.

Count previous G2 recycle outcomes in `.expedite/gates.yml` history array (entries where `gate` = `"G2"` AND `outcome` = `"recycle"`).

---

## 1st Recycle (recycle_count == 0 before this recycle)

Informational tone. Display:

```
Some questions need additional evidence. Here's what's missing:
{For each PARTIAL/NOT COVERED question: question_id, question_text, status, gap_details}
```

Then ask the user via freeform prompt:

```
Approve gap-fill research? Options:
- yes -- dispatch gap-fill agents for the questions above
- adjust questions -- reprioritize or accept gaps for specific questions
- override -- proceed to synthesis with documented gaps
```

---

## 2nd Recycle (recycle_count == 1 before this recycle)

Suggest adjustment. Display:

```
This is the second recycle. Consider adjusting expectations:

Persistently weak questions:
{For each question that was PARTIAL/NOT COVERED in BOTH this and previous evaluation:
  question_id, question_text, status history}

Suggestions:
- Lower priority of stubborn questions (P0 -> P1 or P1 -> P2)
- Accept weak areas as advisory (they'll be documented in SYNTHESIS.md)
- Try different sources for specific questions
```

Then ask the user via freeform prompt:

```
Options:
- approve gap-fill -- one more round targeting remaining gaps
- adjust -- reprioritize or accept gaps (describe changes)
- override -- proceed to synthesis with documented gaps (recommended if same questions keep failing)
```

---

## 3rd+ Recycle (recycle_count >= 2 before this recycle)

Recommend override. Display:

```
This is recycle #{recycle_count + 1}. Recommend overriding the gate.

Remaining gaps may not be resolvable through additional research. The same questions
have been recycled {recycle_count} times without reaching COVERED status.

Recommendation: Override with documented gaps flowing to design as advisory.
The design phase will flag decisions in affected areas as lower confidence.
```

Then ask the user via freeform prompt:

```
Options:
- override (recommended) -- proceed to synthesis with gaps documented as advisory
- one more attempt -- dispatch gap-fill agents again (not recommended)
```
