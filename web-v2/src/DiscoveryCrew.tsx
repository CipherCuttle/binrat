import { useRef } from "react";

/** Availability is presentation only; the live badge requires fresh source evidence. */
export function DiscoveryCrew({ live, checking }: { live: boolean; checking: boolean }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const crew = [
    { image: "/crew/rat-avatar-48.png", name: "RAT ZERO", status: live ? "LIVE" : checking ? "CHECKING" : "PAUSED", description: "Finds Pons launches automatically and brings earlier launch evidence and receipts." },
    { image: "/crew/tripwire.png", name: "TRIPWIRE", status: "BUILDING", description: "Being built to watch a trail for changes and bring you back. Persistent jobs are not active." },
    { image: "/crew/sniffer.png", name: "SNIFFER", status: "PROVING", description: "Funding-trail work is being tested. Predicting later launches is unproven; no public agent is active." },
  ];
  return <details ref={disclosure} className="a1-crew" onKeyDown={(event) => {
    if (event.key === "Escape") { disclosure.current?.removeAttribute("open"); disclosure.current?.querySelector("summary")?.focus(); }
  }}>
    <summary className="vl-utility">MEET THE CREW <span aria-hidden="true">+</span></summary>
    <section aria-label="Meet the crew" className="a1-crew-content">
      <h2>ONE RAT DIGGING. MORE IN THE WORKS.</h2>
      {crew.map((rat) => <div className="a1-crew-member" key={rat.name}>
        <img src={rat.image} width={44} height={44} alt="" loading="lazy" />
        <div><div className="a1-crew-name"><strong>{rat.name}</strong><b>{rat.status}</b></div><p>{rat.description}</p></div>
      </div>)}
      <div className="a1-future"><strong>FUTURE RATS · LOCKED</strong><p>More jobs are planned. No active workers or launch dates promised.</p></div>
    </section>
  </details>;
}
