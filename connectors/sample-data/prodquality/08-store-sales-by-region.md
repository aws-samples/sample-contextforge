---
title: "Store-Level Sales and Return Rates by Region — VoltCore 20V"
upstream_id: pos-store-sales-region
source_url: https://pos.example.com/reports/store-sales-region
fetched_at: 2026-01-12T09:00:00Z
feed: pos-store-sales
entity_types:
  - Product
  - DefectType
---

# Store-Level Sales and Return Rates by Region — VoltCore 20V

This report ties the negative-review geography to specific retail stores and
regions, establishing the correlation between cold climate and battery returns.

## Regions

- **Northern / Cold-Climate Region** — Minnesota, Wisconsin, Michigan, North
  Dakota, Maine, Montana. Average winter temperature 18°F. The negative
  "dies in the cold" review cluster is **concentrated in** this region: 312 of
  312 cold-failure reviews geolocate to cold-climate states (correlation 0.89).
- **Southern / Warm Region** — Texas, Florida, Arizona, Georgia. Average winter
  temperature 61°F. The baseline positive reviews concentrate here.

## Stores and return rates

| Store | Retailer | Region | Units sold | Return rate |
| --- | --- | --- | --- | --- |
| Lowe's — Minnesota | Lowe's | North (cold) | 21,400 | 14.2% |
| Ace Hardware — Wisconsin | Ace Hardware | North (cold) | 9,800 | 12.8% |
| Menards — North Dakota | Menards | North (cold) | 7,300 | 15.6% |
| Home Depot — Texas | Home Depot | South (warm) | 44,100 | 2.1% |

The cold-climate stores (Lowe's MN, Ace WI, Menards ND) generated the winter
return batch. The warm-region store (Home Depot TX) shows a normal 2.1% return
rate. This geographic concentration is the first clue that the defect is
climate-dependent — pointing to the battery rather than to a manufacturing error
that would be evenly distributed.
