#!/usr/bin/env python3
"""Calculate contrast for two opaque #RRGGBB colors. Not a full WCAG audit."""

import argparse
import re


def luminance(value: str) -> float:
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        raise ValueError("Use an opaque color in #RRGGBB format")
    channels = [int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return sum(c * weight for c, weight in zip(linear, (0.2126, 0.7152, 0.0722)))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("foreground")
    parser.add_argument("background")
    parser.add_argument("--minimum", type=float, choices=(3.0, 4.5, 7.0), default=4.5)
    args = parser.parse_args()
    try:
        first, second = luminance(args.foreground), luminance(args.background)
    except ValueError as error:
        parser.error(str(error))
    ratio = (max(first, second) + 0.05) / (min(first, second) + 0.05)
    passed = ratio >= args.minimum
    print(f"{args.foreground} on {args.background}: {ratio:.4f}:1; "
          f"minimum {args.minimum}:1; {'PASS' if passed else 'FAIL'}")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
