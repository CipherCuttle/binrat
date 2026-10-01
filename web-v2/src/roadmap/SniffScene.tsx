import sniffBase from "./assets/sniff/sniff-base.webp";

export function SniffScene() {
  return (
    <div
      className="roadmap-scene roadmap-scene--sniff"
      data-scene-art="raster"
      data-scene-id="sniff"
      aria-hidden="true"
    >
      <img className="roadmap-scene__base" data-scene-layer="base" src={sniffBase} alt="" />
      <img className="roadmap-scene__emissive roadmap-scene__emissive--radar" data-scene-layer="radar" src={sniffBase} alt="" />
      <img className="roadmap-scene__emissive roadmap-scene__emissive--crt-a" data-scene-layer="crt-a" src={sniffBase} alt="" />
      <img className="roadmap-scene__emissive roadmap-scene__emissive--crt-b" data-scene-layer="crt-b" src={sniffBase} alt="" />
      <img className="roadmap-scene__emissive roadmap-scene__emissive--lamp" data-scene-layer="lamp" src={sniffBase} alt="" />
    </div>
  );
}
