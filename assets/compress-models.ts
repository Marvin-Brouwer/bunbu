// Compresses every model in models/ into the game's apps/game/public/models/, the same way for each
// (the web pipeline in docs/design/assets.md): textures to WebP at 512 px at most, then meshopt
// geometry. Run it with `pnpm models` after adding or changing a model here; never edit the game's
// copies by hand.
//
// No `optimize`: it joins and flattens meshes, which renames the nodes the world looks up by name.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Logger, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt, textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const sources = fileURLToPath(new URL("models/", import.meta.url));
const target = fileURLToPath(new URL("../apps/game/public/models/", import.meta.url));

await MeshoptEncoder.ready;
// Only warnings: every model would otherwise print what prune removed.
const io = new NodeIO()
  .setLogger(new Logger(Logger.Verbosity.WARN))
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const kilobytes = (path: string): string => `${Math.round(statSync(path).size / 1024)} KB`;

async function compress(file: string): Promise<string> {
  const source = join(sources, file);
  const output = join(target, file);
  const document = await io.read(source);
  await document.transform(
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [512, 512] }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await io.write(output, document);
  return `${file}: ${kilobytes(source)} -> ${kilobytes(output)}`;
}

const files = readdirSync(sources).filter((name) => name.endsWith(".glb")).toSorted();
for (const line of await Promise.all(files.map(compress))) console.log(line);
