# Headache Tracker design system

## Product character

Calm, private, medically neutral, and fast under discomfort. The interface is mobile-first and bilingual rather than a marketing site. It avoids diagnostic language and clearly labels low-confidence patterns.

## Foundations

- Primary: `#0B6B62`; strong: `#07534C`; soft: `#DCEFE9`
- Background: `#F4F7F5`; surface: `#FFFFFF`; muted surface: `#EDF3F0`
- Text: `#162521`; secondary text: `#63736D`; border: `#D9E5DF`
- Dark background: `#0D1614`; dark surface: `#16211F`; raised surface: `#1C2926`
- Dark text: `#EDF7F3`; secondary text: `#A7B8B2`; border: `#30413C`
- Dark primary: `#68CBB7`; strong text/accent: `#9DE0D2`; soft selected surface: `#173B34`
- Warning/pattern: warm amber; destructive/end action: muted red
- Latin type: Figtree. Arabic type: Noto Sans Arabic.
- Spacing follows a 4/8px rhythm. Cards use 17–25px radii and restrained elevation.

## Interaction

- Every primary touch target is at least 44px; bottom navigation has five destinations.
- One tap records the episode start timestamp. Details remain optional and progressive.
- Pain intensity is represented by number and text, never color alone.
- The 3D head separates rotate mode from point/paint mode to avoid gesture conflicts and includes a clear button.
- Fixed navigation respects iOS safe areas; page padding prevents obscured content.
- Focus rings are visible and reduced-motion preferences disable nonessential transitions.
- Theme defaults to the device preference on first use, then persists the user's explicit light/dark choice.
- Dark mode avoids pure black and pure-white app surfaces to reduce glare; the doctor PDF temporarily uses the light print palette during export.

## Information architecture

1. Today: start or manage the active episode.
2. History: independent episode list, including multiple episodes per day.
3. Insights: intensity trend, duration, weekday frequencies, and confidence language.
4. Ask: deterministic answers grounded only in recorded data.
5. Report: date/language controls and PDF preview/export.

## Accessibility and safety

- Arabic uses RTL at the document level; English switches to LTR.
- Lucide SVG icons are used consistently; no emoji icons.
- Charts include a table fallback.
- The AI organizer shows structured results for review before applying them.
- Pattern estimates are not presented as diagnoses or guarantees.
