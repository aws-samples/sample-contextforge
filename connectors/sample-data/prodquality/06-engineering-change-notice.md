---
title: "Engineering Change Notice ECN-NS-77 — NorthStar Electrolyte Reformulation"
upstream_id: ecn-ns-77
source_url: https://plm.example.com/ecn/ECN-NS-77
fetched_at: 2026-01-17T09:00:00Z
feed: plm-change-notices
entity_types:
  - Supplier
  - SupplierLot
  - DefectType
  - CorrectiveAction
---

# Engineering Change Notice ECN-NS-77 — NorthStar Electrolyte Reformulation

This change notice records the **root cause** of the cold-weather battery failure
defect.

## The change

In **Q3**, the supplier **NorthStar Cells Ltd.** changed the electrolyte
formulation of its 18650 Li-ion cells to a **lower-cost electrolyte**. The new
formulation **raises internal resistance below freezing**, which causes the cell
to lose more than half its capacity at 20°F.

Critically, NorthStar made this change **without re-qualification** — the cells
were never re-tested against the cold-temperature specification after the change.

## Why the defect appears only now

The cold failure appears **only in cell lots built after ECN-NS-77**. Cell Lot
**NS-2411** is the first lot produced after the change, and it fails the cold
test. The earlier lot **NS-2308 predates** the change and passes — which is why
the original qualification, performed on the old formulation, showed no problem.

## Root cause statement

The root cause of the cold-weather battery failure is the **unqualified
electrolyte formulation change (ECN-NS-77)** introduced by **NorthStar Cells
Ltd.** The defect is attributed to this supplier process change, which affected
cell lot NS-2411 and every battery pack derived from it.
