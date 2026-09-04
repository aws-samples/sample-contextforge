---
title: "Cold-Temperature Cell Test Report — Lots NS-2411, NS-2308, AX-2409"
upstream_id: qa-coldtest-2411
source_url: https://qa-lab.example.com/reports/coldtest-2411
fetched_at: 2026-01-16T09:00:00Z
feed: qa-lab
entity_types:
  - Component
  - SupplierLot
  - DefectType
  - Specification
---

# Cold-Temperature Cell Test Report — 18650 Li-ion Cell Lots

This QA lab report records cold-temperature capacity testing of the 18650 Li-ion
cell lots consumed in the **VC 20V 2.0Ah Battery Pack** (part VC-BAT-20). The
governing **specification** requires a minimum operating temperature of 32°F and
at least 80% capacity retention at 20°F.

## Test results by supplier lot

| Supplier Lot | Supplier | Cold test @ 20°F | Capacity retention @ 20°F | Result |
| --- | --- | --- | --- | --- |
| NS-2411 | NorthStar Cells Ltd. | FAIL | 41% | Out of spec |
| NS-2308 | NorthStar Cells Ltd. | PASS | 84% | In spec |
| AX-2409 | Apex Power Components | PASS | 88% | In spec |

## Findings

- **Cell Lot NS-2411**, supplied by **NorthStar Cells Ltd.**, **fails** the cold
  test: capacity retention drops to **41% at 20°F**, far below the 80%
  specification. This lot is the source of the cold-weather battery failure
  defect. Lot NS-2411 was built into the battery pack during the **September–November**
  production window.
- **Cell Lot NS-2308**, an **earlier** lot from the same supplier (NorthStar),
  **passes** at 84% retention. NS-2308 was produced **before** the supplier's Q3
  electrolyte formulation change and is not associated with the defect.
- **Cell Lot AX-2409**, supplied by **Apex Power Components**, **passes** at 88%
  retention and is the qualified good alternative.

The battery pack (VC-BAT-20) is **derived from** cell lot NS-2411 for the
Sep–Nov build. The defect is **attributed to** lot NS-2411 and its supplier,
NorthStar Cells Ltd.
