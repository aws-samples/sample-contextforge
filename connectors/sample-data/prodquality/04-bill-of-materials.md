---
title: "Bill of Materials — VoltCore 20V Drill and Impact Driver"
upstream_id: plm-bom-voltcore-20v
source_url: https://plm.example.com/bom/voltcore-20v
fetched_at: 2026-01-10T09:00:00Z
feed: plm-bom
entity_types:
  - Product
  - Component
  - SupplierLot
---

# Bill of Materials — VoltCore 20V Platform

This bill of materials records the component genealogy for the VoltCore 20V
finished products. Genealogy is expressed as **derived from**: a finished product
is derived from its components, and a component is derived from the supplier lot
it was built from.

## VoltCore 20V Cordless Drill (VC-20-DRL)

The drill is **derived from** the following components:

- **VC 20V 2.0Ah Battery Pack** (VC-BAT-20)
- **Brushless Motor Assembly** (VC-MOT-01)
- **13mm Keyless Chuck** (VC-CHK-13)

## VoltCore 20V Impact Driver (VC-20-IMP)

The impact driver is **derived from** the **same** VC 20V 2.0Ah Battery Pack
(VC-BAT-20) as the drill — the two products share the battery platform. It can
also ship with the optional **VC 20V 4.0Ah Battery Pack (XL)** (VC-BAT-40).

## Battery pack genealogy

- The **VC 20V 2.0Ah Battery Pack** (VC-BAT-20) is **derived from** 18650 cell
  lots. In the Sep–Nov build it was **built from Cell Lot NS-2411**; in the
  Jul–Aug build it was built from Cell Lot AX-2409.
- The **VC 20V 4.0Ah Battery Pack (XL)** (VC-BAT-40) is **built only from Apex
  cells (Cell Lot AX-2409)** and is not affected by the cold-weather defect.

## Facts

| Product | Components |
| --- | --- |
| VoltCore 20V Drill (VC-20-DRL) | 2.0Ah Battery Pack, Brushless Motor, 13mm Chuck |
| VoltCore 20V Impact Driver (VC-20-IMP) | 2.0Ah Battery Pack (shared), optional 4.0Ah XL Pack |
| VC 20V 2.0Ah Battery Pack (VC-BAT-20) | built from Cell Lot NS-2411 (Sep–Nov), AX-2409 (Jul–Aug) |
| VC 20V 4.0Ah Battery Pack (VC-BAT-40) | built only from Cell Lot AX-2409 (Apex) |
