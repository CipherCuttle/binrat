import sniffBase from "./assets/sniff/sniff-base.webp";

export function SniffScene() {
  return (
    <img
      className="roadmap-scene roadmap-scene--sniff"
      data-scene-art="raster"
      data-scene-id="sniff"
      src={sniffBase}
      alt=""
      aria-hidden="true"
    />
  );
}
