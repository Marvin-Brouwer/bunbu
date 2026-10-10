# 3D assets

Where the 3D models and animations for the world come from, and the rules for picking them. The world itself is described in [gameplay.md](gameplay.md). Research done 2026-10-07; links and licenses were checked on that date.

## Rules

1. **Free, open license.** In order of preference:
   - **CC0** (public domain): use, modify and ship without credit.
   - **CC-BY**: fine, but every use goes into the attribution list (see [Attribution](#attribution)).
   - **Custom free licenses** ("free for commercial use, don't resell"): only when nothing CC0 or CC-BY fits. Read the terms first.
   - **Never** NonCommercial (NC) or NoDerivatives (ND) licenses, assets without a stated license, or paid packs.
2. **No AI-generated assets** if we can help it. Prefer hand-made work; many itch.io listings state "No generative AI was used", which is a plus. Skip listings that are AI-generated or don't make it clear.
3. **One art style.** The samurai and the ninjas must look like they belong in the same world. Mixing artists gave a cartoony samurai next to a gritty ninja, so check them side by side before adding anything.
4. **Web-ready.** glTF/GLB for three.js. FBX-only assets go through Blender once and are committed as GLB. Keep props under ~5k triangles.

## Chosen characters

| Role             | Asset                                                                     | License | Format      | Animations        |
| ---------------- | ------------------------------------------------------------------------- | ------- | ----------- | ----------------- |
| Samurai (player) | [LOWPO: Samurai Pack](https://standout7.itch.io/lowpo-samurai), free tier | CC0     | GLB, rigged | None in free tier |
| Ninja (enemies)  | [Ninja by Quaternius](https://poly.pizza/m/xGYmeDpfTu) (1,960 triangles)  | CC0     | GLTF        | Included          |

This is the pick "for now". No free pack ships a samurai and a ninja together in one style; if one turns up, it replaces these.

The samurai's run, attack and hit animations come from the [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) (Quaternius, CC0, 120+ animations including run and sword attacks). Retarget in Blender and export one GLB with all clips, rather than retargeting at runtime.

### In the game now

Until a samurai model of our own lands, both sides come from one Quaternius pack ([Ultimate Animated Character Pack](https://quaternius.com/), CC0), so they share one rig, one set of clips and one style:

- **Samurai:** ["Matt"](https://poly.pizza/m/66kQ4dBBC7) in armour built in code (`fight/world/armour.mts`). The armour is a kabuto helmet with gilt horns and a neck guard, a laced breastplate, shoulder and hip plates, sleeves and hakama, hung on the bones. His long blade serves as the katana. The helmet comes off when he falls.
- **Ninjas:** the [ninja](https://poly.pizza/m/xGYmeDpfTu) in black with a red sash.

The world plays these clips, fitted to the state's timing (`fight/world/poses.mts`):

| Pose                     | Clip       |
| ------------------------ | ---------- |
| run, approach, fleeing   | `Run`      |
| idle                     | `Idle`     |
| strike                   | `Weapon` (ninja), `Slash` (samurai) |
| block                    | `Duck` (first 40%) |
| hurt, blocked            | `HitReact` |
| fallen, slain            | `Death`    |

A replacement model needs clips with these names, or a change to that table.

The **Castle town** stage uses, from Quaternius on Poly Pizza (CC0): the [maple trees](https://poly.pizza/m/iGFtQd0PJO) (five variants in one file), [bamboo](https://poly.pizza/m/xBPj13w3JQ) and the [torii gate](https://poly.pizza/m/7SyXZ62xR5). The town houses (machiya), stone lanterns, the bridge, the pagoda and the castle keep are built in code from simple shapes (`fight/world/castle-town.mts`): no free CC0 pack of Japanese town buildings turned up. The models are in `apps/game/public/models/` as downloaded; they are not compressed yet.

## Sources

Ranked by usefulness for this game.

| Source                                                                      | License                      | Notes                                                                                                    |
| --------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| [Quaternius](https://quaternius.com/)                                       | CC0                          | Main source. Consistent low-poly style, glTF. The free tier of each pack holds 60-70% of its models.     |
| [Poly Pizza](https://poly.pizza/)                                           | Per model (CC0 or CC-BY)     | Searches Quaternius, Kenney and the old Google Poly library. No login. Check each model's license line.  |
| [KayKit](https://kaylousberg.itch.io/)                                      | CC0                          | Stylised characters and a free animation pack. Nothing Japanese out of the box.                          |
| [itch.io game assets](https://itch.io/game-assets/free)                     | Per asset                    | Where most samurai, ninja and Japan-specific assets live. Licenses vary a lot.                           |
| [Mixamo](https://www.mixamo.com/)                                           | Adobe, royalty-free in games | Extra animations (slide, roll, block). FBX only. Not an open license, so second choice after Quaternius. |
| [Sketchfab](https://sketchfab.com/search?features=downloadable&type=models) | Per model, mostly CC-BY      | Quality varies. Filter on downloadable and license; avoid NC and ND.                                     |
| [Poly Haven](https://polyhaven.com/)                                        | CC0                          | Sky HDRIs and textures.                                                                                  |
| [Kenney](https://kenney.nl/assets)                                          | CC0                          | No Japanese theme, but useful for generic props and particles.                                           |

## Environment candidates

Old-school Japan props found on Poly Pizza, all from Quaternius (CC0) unless noted:

- [Torii gate](https://poly.pizza/m/7SyXZ62xR5) (300 triangles)
- [Temple](https://poly.pizza/m/CE2Mn7lh6A) (3.6k triangles): looks like a European castle tower, not a Japanese temple; not used.
- Bamboo: [1](https://poly.pizza/m/xBPj13w3JQ), [2](https://poly.pizza/m/FUgtfvqgMx), [mid](https://poly.pizza/m/z0d6CbNtrz). Instance these for bamboo forest stretches.
- [Japanese door](https://poly.pizza/m/t4otyljz8K)
- [Japanese Stone Lamp by Flopsi](https://poly.pizza/m/5gZfOZIW92k): **CC-BY 3.0**, not CC0; not used, the stone lanterns are built in code.
- [Maple trees](https://poly.pizza/m/iGFtQd0PJO): recolour the leaves pink for cherry blossoms.
- [Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html): 116 trees, plants and rocks.
- Pagodas from Google Poly: [1](https://poly.pizza/m/1zS7ucaAd4J), [2](https://poly.pizza/m/d1M5ncMBUDi), [3](https://poly.pizza/m/eHOI2VgW1ol). **CC-BY 3.0**, credit "Poly by Google".

## Rejected

- **Cyber Samurai (TORTOR)**: CC-BY-ND, and commercial use needs the original artist's permission.
- **Low Poly Samurai (TheGoldenEye)**: no license stated.
- **Synty POLYGON Samurai, LOWPO Pro, RG Poly Asia Megapack, YOHA Stylized Ninjas**: good matched sets, but paid.
- **Hajileee Japan Set, Seventh Solution Japanese Village**: 2D sprites, not 3D.

## Web pipeline

- Compress every GLB with [gltf-transform](https://gltf-transform.dev/) (`optimize`, meshopt geometry, KTX2 or WebP textures).
- Use `InstancedMesh` for repeated props such as bamboo and trees.

## Attribution

Every CC-BY asset is listed with its author, source link and license in an attribution file from the moment it is added, so the credits screen can be generated from it. CC0 assets need no credit, but listing them too is appreciated.
