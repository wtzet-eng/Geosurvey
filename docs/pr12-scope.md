# PR #12 scope

This integration deliberately activates only the literature-backed geological interpretation layer.

It does **not** modify the working BGS or SoilGrids acquisition services, their parsers, endpoint constants, or fallback order.

The source-resilience foundation merged in PR #11 remains available for a later, separate runtime-routing PR where the acquisition files can be patched safely and reviewed independently.

Safety boundary:
- interpretation consumes canonical geology only;
- formation/group records match geological unit identity only;
- lithology records match lithology only;
- unknown units produce no interpretation;
- prohibited engineering design claims are rejected;
- citations preserve stable publication identity;
- canonical evidence is not mutated.
