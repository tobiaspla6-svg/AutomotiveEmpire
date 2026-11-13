# Reference images of the reference saloon

| File | Source | Used for |
|---|---|---|
| `side.png`, `front.png`, `rear.png`, `top.png`, `design-sheet.png` | Generated from the design parameters by `tools/blender/sedan/reference_sheet.py` (orthographic, 220 px/m) | The single, consistent statement of proportions and character lines; loaded by the Blender build as aligned image planes (`ref_*` empties in `sedan.blend`) to check the model in every view |
| `front34.png`, `interior.png` | *not present* — see `PROMPTS.md` | Optional: AI-generated mood references (e.g. Google Flow). The build loads them if you add them |

No AI image tool was available in the environment that built this asset, so no generated images are included.
Generated images are pictures only: they cannot be turned into editable geometry automatically, and only
images you have the right to use belong here.
