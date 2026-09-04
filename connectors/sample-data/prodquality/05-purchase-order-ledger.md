---
title: "Purchase-Order Ledger — 18650 Cell Procurement"
upstream_id: erp-po-ledger-cells
source_url: https://erp.example.com/purchase-orders/cells
fetched_at: 2026-01-09T09:00:00Z
feed: erp-purchase-orders
entity_types:
  - PurchaseOrder
  - Supplier
  - SupplierLot
---

# Purchase-Order Ledger — 18650 Li-ion Cell Procurement

This ledger records the purchase orders through which 18650 Li-ion cell lots were
sourced. Each cell lot is **sourced via** a purchase order, and each purchase
order is **issued to** a supplier.

## Purchase orders

| PO | Issued to | Quantity | Cell Lot sourced | Notes |
| --- | --- | --- | --- | --- |
| PO #NS-4411 | NorthStar Cells Ltd. | 60,000 | NS-2411 | Aug order; used in VC-BAT-20 Sep–Nov build |
| PO #NS-3300 | NorthStar Cells Ltd. | 40,000 | NS-2308 | Prior-year order; no issues |
| PO #AX-4390 | Apex Power Components | 45,000 | AX-2409 | Jul order; qualified good lot |

## Detail

- **PO #NS-4411** was **issued to NorthStar Cells Ltd.** for 60,000 cells in
  August. Cell Lot **NS-2411** was **sourced via** PO #NS-4411. This is the lot
  that fails the cold test and is built into the Sep–Nov battery run.
- **PO #NS-3300** was issued to NorthStar in the prior year and sourced the good
  lot NS-2308. No issues.
- **PO #AX-4390** was issued to Apex Power Components and sourced the qualified
  good lot AX-2409.

The failing lot NS-2411 traces, via **PO #NS-4411**, to the supplier **NorthStar
Cells Ltd.**
