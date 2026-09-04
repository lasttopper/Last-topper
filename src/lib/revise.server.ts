import { aiChat, openRouterChat } from "@/lib/ai-router";
import type { ReviseReference, ReviseTopic } from "./revise.types";

type SupabaseContext = { supabase: { from: (table: string) => any } };

type ChapterRow = {
  id: string;
  name: string;
  class_level: number | null;
  subject_id?: string | null;
};

type ChapterDetails = {
  name: string;
  class_level: number | null;
  subjects?: { name?: string | null } | null;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function sanitizeTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim().replace(/\s+/g, " ").slice(0, 200);
  return title.length > 0 ? title : null;
}

function isAiGenerationError(error: unknown): boolean {
  return error instanceof Error && /AI|credits|busy|gateway/i.test(error.message);
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseStructuredJson(value: unknown): unknown {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") throw new Error("AI returned invalid structured content");

  const clean = stripJsonFence(value);
  const candidates = [clean, extractFirstJsonObject(clean)].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next extraction strategy.
    }
  }
  throw new Error("AI returned non-JSON content");
}

function aiResponsePayload(json: any): unknown {
  const message = json?.choices?.[0]?.message;
  const toolArgs =
    message?.tool_calls?.[0]?.function?.arguments ?? message?.function_call?.arguments;
  if (toolArgs) return toolArgs;

  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part?.text ?? part?.content ?? "")))
      .join("");
  }
  return null;
}

async function callAi<T>(
  prompt: string,
  schema: Record<string, unknown>,
  runner: (body: any) => Promise<any> = aiChat,
): Promise<T> {
  const schemaText = JSON.stringify(schema);
  const json = await runner({
    model: "google/gemini-3.6-flash",
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert NCERT-aligned exam tutor for Indian JEE/NEET students. If tool calling is available, use the reply tool. Otherwise return only strict JSON. Content must be chapter-specific, not a generic template, and must stay within official NCERT Class 11–12 curriculum.",
      },
      {
        role: "user",
        content: `${prompt}

Return ONLY valid JSON matching this JSON Schema:
${schemaText}`,
      },
    ],
    tools: [
      {
        type: "function",
        function: { name: "reply", description: "Return structured response", parameters: schema },
      },
    ],
    tool_choice: { type: "function", function: { name: "reply" } },
  });
  const payload = aiResponsePayload(json);
  if (!payload) throw new Error("AI returned no content");
  return parseStructuredJson(payload) as T;
}

const callGemini = <T>(prompt: string, schema: Record<string, unknown>) =>
  callAi<T>(prompt, schema);

const DIAGRAM_SCHEMA = {
  type: "object",
  properties: { diagram: { type: "string" }, diagram_caption: { type: "string" } },
  required: ["diagram"],
} as const;

/** Deterministic concept map so a topic is never left without a visual. */
function fallbackDiagram(topicTitle: string): { diagram: string; diagram_caption: string } {
  const t = topicTitle.replace(/"/g, "");
  return {
    diagram: `flowchart TD\n  A["${t}"] --> B["NCERT definitions"]\n  A --> C["Core concept / process"]\n  A --> D["Formulas & conditions"]\n  C --> E["Solved examples"]\n  D --> E\n  E --> F["Exercise practice"]`,
    diagram_caption: "Quick revision map for this topic.",
  };
}

/**
 * Diagram runs on OpenRouter and is saved permanently in Supabase.
 */
async function generateDiagram(
  topicTitle: string,
  chapter: ChapterDetails,
): Promise<{ diagram: string; diagram_caption: string | null }> {
  try {
    const ai = await callAi<{ diagram?: string; diagram_caption?: string }>(
      `Create ONE Mermaid diagram that visually explains the NCERT topic "${topicTitle}" from the Class ${chapter.class_level} ${chapter.subjects?.name ?? ""} chapter "${chapter.name}".
Rules: start with "flowchart TD" (or "graph LR", "mindmap"). Every node label MUST be wrapped in double quotes, e.g. A["Ideal gas"] --> B["PV = nRT"]. Plain text only inside labels — NO LaTeX, no $, no parentheses, no <br>, no emojis, no semicolons. 6-12 nodes maximum. Output raw Mermaid code with no markdown fences.
Also return diagram_caption: one short line (max 90 chars).`,
      DIAGRAM_SCHEMA as unknown as Record<string, unknown>,
      openRouterChat,
    );
    const diagram = sanitizeDiagram(ai.diagram);
    if (diagram) return { diagram, diagram_caption: sanitizeTitle(ai.diagram_caption) };
  } catch (error) {
    if (!isAiGenerationError(error)) throw error;
  }
  return fallbackDiagram(topicTitle);
}

/**
 * Fetch verified web references from top educational sites using Firecrawl API.
 */
async function firecrawlReferences(topic: string, chapter: string): Promise<ReviseReference[]> {
  const fcKey = process.env.FIRECRAWL_API_KEY;
  if (!fcKey) return fallbackReferences();
  const sites = ["ncert.nic.in", "unacademy.com", "vedantu.com", "oswaalbooks.com", "byjus.com"];
  const query = `${topic} ${chapter} NCERT revision notes ${sites.map((s) => `site:${s}`).join(" OR ")}`;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fcKey}`,
      },
      body: JSON.stringify({ query, limit: 8 }),
    });
    if (!res.ok) return fallbackReferences();
    const json = await res.json();
    const items: Array<{ url?: string; title?: string; description?: string }> =
      json?.data?.web ?? json?.data ?? json?.results ?? [];
    const seen = new Set<string>();
    const refs: ReviseReference[] = [];

    for (const it of items) {
      if (!it.url) continue;
      let host: string;
      try {
        host = new URL(it.url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      const source = sites.find((s) => host.endsWith(s));
      if (!source) continue;
      if (seen.has(host + it.url)) continue;
      seen.add(host + it.url);
      refs.push({ title: it.title ?? host, url: it.url, source });
      if (refs.length >= 6) break;
    }
    return refs.length > 0 ? refs : fallbackReferences();
  } catch {
    return fallbackReferences();
  }
}

function fallbackReferences(): ReviseReference[] {
  return [
    {
      title: "NCERT official textbooks",
      url: "https://ncert.nic.in/textbook.php",
      source: "ncert.nic.in",
    },
    {
      title: "Vedantu CBSE Revision Notes",
      url: "https://www.vedantu.com/revision-notes",
      source: "vedantu.com",
    },
    {
      title: "BYJU'S NCERT Learning Resources",
      url: "https://byjus.com/ncert/",
      source: "byjus.com",
    },
  ];
}

type SubjectBucket = "physics" | "chemistry" | "mathematics" | "biology" | "general";

type ChapterKnowledge = {
  core: string[];
  keyPoints: string[];
  formulas: string[];
};

type KnowledgeEntry = {
  subject?: SubjectBucket;
  match: RegExp;
  core: string[];
  formulas?: string[];
  tips?: string[];
};

function subjectBucket(subjectName?: string | null): SubjectBucket {
  const subject = (subjectName ?? "").toLowerCase();
  if (subject.includes("physics")) return "physics";
  if (subject.includes("chem")) return "chemistry";
  if (subject.includes("math")) return "mathematics";
  if (subject.includes("bio")) return "biology";
  return "general";
}

const SUBJECT_KEY_POINTS: Record<SubjectBucket, string[]> = {
  physics: [
    "Draw the diagram, axes, or graph first; then write the law in equation form.",
    "Check units, sign convention, limiting cases, and assumptions before substituting numbers.",
    "Connect every formula with its physical meaning instead of memorising symbols only.",
  ],
  chemistry: [
    "Start from NCERT definitions, balanced equations, and the condition under which a law or reaction applies.",
    "Track charge, oxidation number, hybridisation, and state functions wherever relevant.",
    "Separate thermodynamic feasibility, kinetic speed, and equilibrium extent in conceptual questions.",
  ],
  mathematics: [
    "Write the domain, condition, and standard form before applying a theorem or formula.",
    "Transform the problem step by step and verify the answer by substitution or a boundary case.",
    "Watch for sign, interval, and extraneous-root traps in objective questions.",
  ],
  biology: [
    "Use exact NCERT terms and revise labelled diagrams because NEET often tests wording and labels.",
    "Separate structure, location, function, example, and exception for each biological term.",
    "Revise processes as ordered sequences rather than disconnected facts.",
  ],
  general: [
    "Revise official terminology first, then connect it with examples and exam-style applications.",
    "Avoid generic memorisation; identify the condition that makes each statement valid.",
    "Practise NCERT exercise-style questions after each short revision block.",
  ],
};

const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  // Physics
  {
    subject: "physics",
    match: /units|measurement/,
    core: [
      "SI units and derived units",
      "dimensional formulae",
      "significant figures",
      "absolute, relative, and percentage error",
    ],
    formulas: [
      "Dimensional form: $[Q]=M^aL^bT^c$",
      "Relative error: $\frac{\Delta Z}{Z}=\frac{\Delta A}{A}+\frac{\Delta B}{B}$",
      "Percentage error: $\frac{\Delta Z}{Z}\times100$",
    ],
    tips: [
      "Dimensional analysis checks consistency but cannot determine pure numerical constants.",
    ],
  },
  {
    subject: "physics",
    match: /kinematics/,
    core: [
      "displacement, velocity, and acceleration",
      "uniform acceleration equations",
      "relative motion",
      "projectile motion",
    ],
    formulas: [
      "Velocity: $v=u+at$",
      "Displacement: $s=ut+\tfrac{1}{2}at^2$",
      "Third equation: $v^2-u^2=2as$",
      "Projectile range: $R=\frac{u^2\sin2\theta}{g}$",
    ],
    tips: ["Area under a velocity-time graph gives displacement and slope gives acceleration."],
  },
  {
    subject: "physics",
    match: /laws? of motion/,
    core: ["Newton's laws", "free-body diagrams", "friction", "impulse and momentum"],
    formulas: [
      "Newton's second law: $\vec F_{net}=m\vec a$",
      "Static friction: $f_s\le\mu_sN$",
      "Kinetic friction: $f_k=\mu_kN$",
      "Impulse: $J=\Delta p$",
    ],
    tips: ["Draw a free-body diagram before writing equations of motion."],
  },
  {
    subject: "physics",
    match: /work.*energy|energy.*power/,
    core: [
      "work by a force",
      "kinetic and potential energy",
      "work-energy theorem",
      "power and conservation of energy",
    ],
    formulas: [
      "Work: $W=\vec F\cdot\vec s=Fs\cos\theta$",
      "Kinetic energy: $K=\tfrac{1}{2}mv^2$",
      "Work-energy theorem: $W_{net}=\Delta K$",
      "Power: $P=\frac{dW}{dt}=\vec F\cdot\vec v$",
    ],
    tips: ["Use net work in the work-energy theorem, not only the applied force."],
  },
  {
    subject: "physics",
    match: /rotational|system of particles/,
    core: ["centre of mass", "torque", "angular momentum", "moment of inertia and rolling motion"],
    formulas: [
      "Torque: $\vec\tau=\vec r\times\vec F$",
      "Angular momentum: $\vec L=I\vec\omega$",
      "Rotational KE: $K=\tfrac{1}{2}I\omega^2$",
      "Pure rolling: $v=R\omega$",
    ],
    tips: ["Moment of inertia depends on mass distribution and axis of rotation."],
  },
  {
    subject: "physics",
    match: /gravitation/,
    core: [
      "universal gravitation",
      "gravitational field",
      "potential energy",
      "satellites and escape velocity",
    ],
    formulas: [
      "Gravitational force: $F=\frac{Gm_1m_2}{r^2}$",
      "Field: $g=\frac{GM}{r^2}$",
      "Potential energy: $U=-\frac{GMm}{r}$",
      "Escape speed: $v_e=\sqrt{\frac{2GM}{R}}$",
    ],
    tips: [
      "Potential energy is negative for a bound gravitational system when zero is at infinity.",
    ],
  },
  {
    subject: "physics",
    match: /mechanical properties of solids/,
    core: ["stress and strain", "Hooke's law", "elastic moduli", "stress-strain graph"],
    formulas: [
      "Stress: $\sigma=\frac{F}{A}$",
      "Strain: $\epsilon=\frac{\Delta L}{L}$",
      "Young's modulus: $Y=\frac{\sigma}{\epsilon}$",
      "Elastic energy density: $u=\tfrac{1}{2}\sigma\epsilon$",
    ],
    tips: ["Hooke's law is valid only within the elastic limit."],
  },
  {
    subject: "physics",
    match: /mechanical properties of fluids/,
    core: [
      "pressure in fluids",
      "buoyancy",
      "continuity equation",
      "Bernoulli principle and viscosity",
    ],
    formulas: [
      "Hydrostatic pressure: $P=P_0+\rho gh$",
      "Continuity: $A_1v_1=A_2v_2$",
      "Bernoulli: $P+\tfrac{1}{2}\rho v^2+\rho gh=\text{constant}$",
      "Stokes force: $F=6\pi\eta rv$",
    ],
    tips: ["Bernoulli's equation assumes steady, incompressible, non-viscous flow."],
  },
  {
    subject: "physics",
    match: /thermal properties/,
    core: [
      "temperature and heat",
      "thermal expansion",
      "calorimetry",
      "conduction, convection, and radiation",
    ],
    formulas: [
      "Heat: $Q=mc\Delta T$",
      "Linear expansion: $\Delta L=\alpha L\Delta T$",
      "Stefan law: $P=\sigma eAT^4$",
      "Newton cooling: $\frac{dT}{dt}\propto-(T-T_s)$",
    ],
    tips: ["In calorimetry, heat lost equals heat gained when losses are neglected."],
  },
  {
    subject: "physics",
    match: /thermodynamics/,
    core: [
      "zeroth and first law",
      "isothermal, adiabatic, isobaric, and isochoric processes",
      "internal energy of ideal gas",
      "heat engines and refrigerators",
    ],
    formulas: [
      "First law: $\Delta U=Q-W$",
      "Constant-pressure work: $W=P\Delta V$",
      "Ideal-gas internal energy: $\Delta U=nC_V\Delta T$",
      "Heat-engine efficiency: $\eta=1-\frac{Q_C}{Q_H}$",
    ],
    tips: ["Use one sign convention consistently for heat, work, and internal energy."],
  },
  {
    subject: "physics",
    match: /kinetic theory/,
    core: [
      "ideal gas assumptions",
      "pressure from molecular motion",
      "rms speed",
      "degrees of freedom and equipartition",
    ],
    formulas: [
      "Ideal gas: $PV=nRT=Nk_BT$",
      "Average KE: $\langle K\rangle=\tfrac{3}{2}k_BT$",
      "RMS speed: $v_{rms}=\sqrt{\frac{3RT}{M}}$",
      "Pressure: $P=\tfrac{1}{3}\rho v_{rms}^2$",
    ],
    tips: ["Temperature is proportional to average translational kinetic energy."],
  },
  {
    subject: "physics",
    match: /oscillations/,
    core: ["periodic motion", "simple harmonic motion", "phase and amplitude", "energy in SHM"],
    formulas: [
      "SHM acceleration: $a=-\omega^2x$",
      "Displacement: $x=A\sin(\omega t+\phi)$",
      "Spring period: $T=2\pi\sqrt{\frac{m}{k}}$",
      "Pendulum period: $T=2\pi\sqrt{\frac{l}{g}}$",
    ],
    tips: ["Maximum speed occurs at mean position; maximum acceleration occurs at extremes."],
  },
  {
    subject: "physics",
    match: /waves/,
    core: ["wave speed", "superposition", "standing waves", "sound and Doppler effect"],
    formulas: [
      "Wave speed: $v=f\lambda$",
      "String speed: $v=\sqrt{\frac{T}{\mu}}$",
      "Wave equation: $y=A\sin(kx-\omega t+\phi)$",
      "Open pipe fundamental: $f=\frac{v}{2L}$",
    ],
    tips: ["Boundary conditions decide nodes and antinodes in standing waves."],
  },
  {
    subject: "physics",
    match: /electric charges|electric fields/,
    core: ["Coulomb's law", "electric field", "electric flux", "Gauss's law"],
    formulas: [
      "Coulomb force: $F=\frac{1}{4\pi\epsilon_0}\frac{q_1q_2}{r^2}$",
      "Electric field: $\vec E=\frac{\vec F}{q}$",
      "Flux: $\Phi_E=\vec E\cdot\vec A$",
      "Gauss law: $\oint\vec E\cdot d\vec A=\frac{q_{enc}}{\epsilon_0}$",
    ],
    tips: ["Use symmetry before applying Gauss's law."],
  },
  {
    subject: "physics",
    match: /electrostatic potential|capacitance/,
    core: [
      "electric potential",
      "potential energy",
      "capacitors",
      "energy stored in electric field",
    ],
    formulas: [
      "Potential: $V=\frac{1}{4\pi\epsilon_0}\frac{q}{r}$",
      "Capacitance: $C=\frac{Q}{V}$",
      "Parallel plate: $C=\frac{\epsilon_0A}{d}$",
      "Energy: $U=\tfrac{1}{2}CV^2$",
    ],
    tips: ["In series capacitors charge is common; in parallel voltage is common."],
  },
  {
    subject: "physics",
    match: /current electricity/,
    core: ["electric current", "drift velocity", "Ohm's law", "Kirchhoff's laws"],
    formulas: [
      "Ohm law: $V=IR$",
      "Resistance: $R=\rho\frac{L}{A}$",
      "Power: $P=VI=I^2R=\frac{V^2}{R}$",
      "Drift current: $I=neAv_d$",
    ],
    tips: ["Ohm's law applies only under constant physical conditions."],
  },
  {
    subject: "physics",
    match: /moving charges/,
    core: [
      "magnetic force",
      "motion in magnetic field",
      "Biot-Savart law",
      "force on current carrying conductor",
    ],
    formulas: [
      "Lorentz force: $\vec F=q(\vec E+\vec v\times\vec B)$",
      "Circular radius: $r=\frac{mv}{qB}$",
      "Force on wire: $F=BIL\sin\theta$",
      "Long wire field: $B=\frac{\mu_0I}{2\pi r}$",
    ],
    tips: ["Magnetic force is perpendicular to velocity and does no work."],
  },
  {
    subject: "physics",
    match: /magnetism and matter/,
    core: ["bar magnet as dipole", "earth's magnetism", "magnetic materials", "susceptibility"],
    formulas: [
      "Torque on dipole: $\tau=mB\sin\theta$",
      "Potential energy: $U=-\vec m\cdot\vec B$",
      "Magnetisation: $M=\chi H$",
    ],
    tips: [
      "Dia-, para-, and ferromagnetic materials differ by susceptibility and temperature behaviour.",
    ],
  },
  {
    subject: "physics",
    match: /electromagnetic induction/,
    core: ["magnetic flux", "Faraday's law", "Lenz's law", "self and mutual induction"],
    formulas: [
      "Flux: $\Phi_B=\vec B\cdot\vec A$",
      "Faraday law: $\mathcal E=-\frac{d\Phi_B}{dt}$",
      "Motional emf: $\mathcal E=Blv$",
      "Self induction: $\mathcal E=-L\frac{dI}{dt}$",
    ],
    tips: ["Lenz's law gives direction by opposing the cause of flux change."],
  },
  {
    subject: "physics",
    match: /alternating current/,
    core: ["AC voltage and current", "reactance", "impedance", "resonance and power factor"],
    formulas: [
      "RMS value: $V_{rms}=\frac{V_0}{\sqrt2}$",
      "Reactance: $X_L=\omega L,\;X_C=\frac{1}{\omega C}$",
      "Impedance: $Z=\sqrt{R^2+(X_L-X_C)^2}$",
      "Power: $P=V_{rms}I_{rms}\cos\phi$",
    ],
    tips: ["At series LCR resonance, impedance is minimum and current is maximum."],
  },
  {
    subject: "physics",
    match: /electromagnetic waves/,
    core: [
      "displacement current",
      "transverse EM waves",
      "speed of light",
      "electromagnetic spectrum",
    ],
    formulas: [
      "Speed: $c=\frac{1}{\sqrt{\mu_0\epsilon_0}}$",
      "Field relation: $c=\frac{E_0}{B_0}$",
      "Photon energy: $E=h\nu$",
    ],
    tips: ["Memorise EM spectrum order with wavelength, frequency, and uses."],
  },
  {
    subject: "physics",
    match: /ray optics|optical instruments/,
    core: [
      "reflection and refraction",
      "mirrors and lenses",
      "total internal reflection",
      "microscope and telescope",
    ],
    formulas: [
      "Snell law: $n_1\sin i=n_2\sin r$",
      "Mirror/lens formula: $\frac{1}{v}-\frac{1}{u}=\frac{1}{f}$",
      "Lens maker: $\frac{1}{f}=(n-1)(\frac{1}{R_1}-\frac{1}{R_2})$",
      "Magnification: $m=\frac{h'}{h}=\frac{v}{u}$",
    ],
    tips: ["Use the Cartesian sign convention consistently."],
  },
  {
    subject: "physics",
    match: /wave optics/,
    core: [
      "Huygens principle",
      "interference",
      "Young's double-slit experiment",
      "diffraction and polarisation",
    ],
    formulas: [
      "Path difference: $\Delta x=d\sin\theta$",
      "Fringe width: $\beta=\frac{\lambda D}{d}$",
      "Constructive condition: $\Delta x=n\lambda$",
      "Malus law: $I=I_0\cos^2\theta$",
    ],
    tips: ["Coherent sources are required for sustained interference."],
  },
  {
    subject: "physics",
    match: /dual nature/,
    core: ["photoelectric effect", "photon energy", "Einstein equation", "de Broglie wavelength"],
    formulas: [
      "Photon energy: $E=h\nu$",
      "Einstein equation: $h\nu=\phi+K_{max}$",
      "Stopping potential: $K_{max}=eV_0$",
      "de Broglie wavelength: $\lambda=\frac{h}{p}$",
    ],
    tips: ["Photoemission depends on threshold frequency, not merely intensity."],
  },
  {
    subject: "physics",
    match: /atoms/,
    core: ["Rutherford model", "Bohr postulates", "hydrogen spectrum", "energy levels"],
    formulas: [
      "Bohr radius: $r_n=a_0\frac{n^2}{Z}$",
      "Energy level: $E_n=-13.6\frac{Z^2}{n^2}\,eV$",
      "Photon relation: $h\nu=E_i-E_f$",
      "Rydberg formula: $\frac{1}{\lambda}=RZ^2(\frac{1}{n_1^2}-\frac{1}{n_2^2})$",
    ],
    tips: ["Bohr model works best for hydrogen-like species."],
  },
  {
    subject: "physics",
    match: /nuclei/,
    core: ["nuclear composition", "mass defect", "binding energy", "radioactive decay"],
    formulas: [
      "Mass-energy: $E=\Delta mc^2$",
      "Decay law: $N=N_0e^{-\lambda t}$",
      "Half-life: $T_{1/2}=\frac{0.693}{\lambda}$",
      "Activity: $A=\lambda N$",
    ],
    tips: ["Mass number and atomic number must balance in nuclear reactions."],
  },
  {
    subject: "physics",
    match: /semiconductor/,
    core: [
      "intrinsic and extrinsic semiconductors",
      "p-n junction diode",
      "rectification",
      "logic gates",
    ],
    formulas: [
      "Conductivity: $\sigma=ne\mu_e+pe\mu_h$",
      "Diode current: $I=I_0(e^{eV/kT}-1)$",
      "Photon energy gap: $E_g=h\nu$",
    ],
    tips: ["Doping controls majority carriers: electrons in n-type and holes in p-type."],
  },

  // Chemistry
  {
    subject: "chemistry",
    match: /basic concepts/,
    core: [
      "mole concept",
      "stoichiometry",
      "empirical and molecular formula",
      "concentration terms",
    ],
    formulas: [
      "Moles: $n=\frac{m}{M}$",
      "Molarity: $M=\frac{n}{V}$",
      "Particles: $N=nN_A$",
      "Mass percent: $\frac{\text{mass of solute}}{\text{mass of solution}}\times100$",
    ],
    tips: ["Convert everything into moles before comparing reactants and products."],
  },
  {
    subject: "chemistry",
    match: /structure of atom/,
    core: ["Bohr model", "quantum numbers", "orbitals", "electronic configuration"],
    formulas: [
      "de Broglie wavelength: $\lambda=\frac{h}{mv}$",
      "Uncertainty: $\Delta x\Delta p\ge\frac{h}{4\pi}$",
      "Bohr energy: $E_n=-2.18\times10^{-18}\frac{Z^2}{n^2}\,J$",
    ],
    tips: ["Aufbau, Pauli exclusion, and Hund's rule decide electronic configurations."],
  },
  {
    subject: "chemistry",
    match: /periodicity|classification of elements/,
    core: [
      "modern periodic law",
      "periods, groups, and blocks",
      "atomic and ionic radii",
      "ionisation enthalpy, electron gain enthalpy, and electronegativity",
    ],
    formulas: ["Effective nuclear charge idea: $Z_{eff}=Z-\sigma$"],
    tips: ["Periodic trends follow effective nuclear charge, shielding, and shell number."],
  },
  {
    subject: "chemistry",
    match: /chemical bonding/,
    core: ["Lewis structures", "VSEPR shapes", "hybridisation", "MOT and hydrogen bonding"],
    formulas: [
      "Formal charge: $FC=V-L-\tfrac{1}{2}B$",
      "Bond order: $BO=\frac{N_b-N_a}{2}$",
      "Dipole moment: $\mu=q\times r$",
    ],
    tips: ["VSEPR shape depends on lone pairs and bond pairs around the central atom."],
  },
  {
    subject: "chemistry",
    match: /thermodynamics/,
    core: [
      "system and surroundings",
      "internal energy and enthalpy",
      "entropy",
      "Gibbs energy and spontaneity",
    ],
    formulas: [
      "First law: $\Delta U=q+w$",
      "Enthalpy relation: $\Delta H=\Delta U+\Delta n_gRT$",
      "Gibbs energy: $\Delta G=\Delta H-T\Delta S$",
      "Equilibrium link: $\Delta G^\circ=-RT\ln K$",
    ],
    tips: [
      "Heat and work are path functions; internal energy, enthalpy, entropy, and Gibbs energy are state functions.",
    ],
  },
  {
    subject: "chemistry",
    match: /equilibrium/,
    core: [
      "dynamic equilibrium",
      "equilibrium constants",
      "Le Chatelier principle",
      "ionic equilibrium, pH, buffers, and Ksp",
    ],
    formulas: [
      "Gas relation: $K_p=K_c(RT)^{\Delta n}$",
      "pH: $pH=-\log[H^+]$",
      "Ionic product: $K_w=[H^+][OH^-]$",
      "Solubility product: $K_{sp}=[M^{n+}]^a[X^{m-}]^b$",
    ],
    tips: ["Equilibrium constant changes with temperature, not catalyst or starting amounts."],
  },
  {
    subject: "chemistry",
    match: /redox/,
    core: [
      "oxidation and reduction",
      "oxidation number",
      "redox balancing",
      "oxidising and reducing agents",
    ],
    formulas: [
      "Oxidation-number change: $\Delta ON=ON_{final}-ON_{initial}$",
      "Electron balance: $e^-\text{ lost}=e^-\text{ gained}$",
    ],
    tips: ["The oxidising agent gets reduced; the reducing agent gets oxidised."],
  },
  {
    subject: "chemistry",
    match: /organic chemistry.*basic|basic principles/,
    core: ["IUPAC nomenclature", "isomerism", "electronic effects", "intermediates and mechanisms"],
    formulas: ["Degree of unsaturation: $DBE=C-\frac{H+X}{2}+\frac{N}{2}+1$"],
    tips: ["Identify electrophile, nucleophile, leaving group, and reaction intermediate."],
  },
  {
    subject: "chemistry",
    match: /hydrocarbons/,
    core: [
      "alkanes, alkenes, and alkynes",
      "addition and substitution reactions",
      "aromaticity",
      "benzene reactions",
    ],
    formulas: [
      "Alkane: $C_nH_{2n+2}$",
      "Alkene: $C_nH_{2n}$",
      "Alkyne: $C_nH_{2n-2}$",
      "Hydrogenation: $C=C+H_2\rightarrow C-C$",
    ],
    tips: ["Alkenes and alkynes show addition because of pi bonds."],
  },
  {
    subject: "chemistry",
    match: /solutions/,
    core: ["concentration terms", "Raoult's law", "colligative properties", "van't Hoff factor"],
    formulas: [
      "Raoult law: $p_A=x_Ap_A^\circ$",
      "Boiling elevation: $\Delta T_b=iK_bm$",
      "Freezing depression: $\Delta T_f=iK_fm$",
      "Osmotic pressure: $\pi=iCRT$",
    ],
    tips: ["Colligative properties depend on number of solute particles, not their identity."],
  },
  {
    subject: "chemistry",
    match: /electrochemistry/,
    core: [
      "galvanic and electrolytic cells",
      "electrode potential",
      "Nernst equation",
      "conductance",
    ],
    formulas: [
      "Nernst equation: $E=E^\circ-\frac{0.0591}{n}\log Q$",
      "Gibbs relation: $\Delta G^\circ=-nFE^\circ$",
      "Conductance: $G=\frac{1}{R}$",
      "Molar conductivity: $\Lambda_m=\frac{\kappa\times1000}{C}$",
    ],
    tips: ["Oxidation occurs at anode and reduction at cathode."],
  },
  {
    subject: "chemistry",
    match: /chemical kinetics/,
    core: [
      "rate of reaction",
      "rate law and order",
      "integrated rate equations",
      "activation energy",
    ],
    formulas: [
      "Rate law: $r=k[A]^m[B]^n$",
      "First-order law: $k=\frac{2.303}{t}\log\frac{[A]_0}{[A]}$",
      "Half-life: $t_{1/2}=\frac{0.693}{k}$",
      "Arrhenius equation: $k=Ae^{-E_a/RT}$",
    ],
    tips: ["Order is experimental; molecularity belongs to an elementary step."],
  },
  {
    subject: "chemistry",
    match: /d- and f-block|d.*f.*block/,
    core: [
      "transition elements",
      "variable oxidation states",
      "coloured ions and magnetism",
      "lanthanoid contraction",
    ],
    formulas: ["Spin-only magnetic moment: $\mu=\sqrt{n(n+2)}\,BM$"],
    tips: ["Partially filled d-orbitals explain colour, magnetism, and catalytic behaviour."],
  },
  {
    subject: "chemistry",
    match: /coordination/,
    core: [
      "coordination entity",
      "ligands and coordination number",
      "isomerism",
      "crystal-field splitting",
    ],
    formulas: ["EAN rule: $EAN=Z-ON+2\times CN$", "Magnetic moment: $\mu=\sqrt{n(n+2)}\,BM$"],
    tips: ["Identify ligand type, central metal oxidation state, and coordination number first."],
  },
  {
    subject: "chemistry",
    match: /haloalkanes|haloarenes/,
    core: ["nucleophilic substitution", "SN1 and SN2", "elimination", "aryl halide reactivity"],
    formulas: [
      "Substitution: $R-X+Nu^-\rightarrow R-Nu+X^-$",
      "Elimination: $R-CH_2-CH_2X\rightarrow R-CH=CH_2+HX$",
    ],
    tips: ["SN2 gives backside attack and inversion; SN1 proceeds through carbocation."],
  },
  {
    subject: "chemistry",
    match: /alcohols|phenols|ethers/,
    core: ["alcohol reactions", "phenol acidity", "ether cleavage", "distinguishing tests"],
    formulas: [
      "Alcohol oxidation: $RCH_2OH\rightarrow RCHO\rightarrow RCOOH$",
      "Ether cleavage: $R-O-R'+HI\rightarrow R-I+R'-OH$",
    ],
    tips: ["Phenoxide ion resonance explains why phenols are more acidic than alcohols."],
  },
  {
    subject: "chemistry",
    match: /aldehydes|ketones|carboxylic/,
    core: [
      "carbonyl polarity",
      "nucleophilic addition",
      "oxidation and reduction",
      "carboxylic acid acidity",
    ],
    formulas: [
      "Nucleophilic addition: $R_2C=O+Nu^-\rightarrow R_2C(O^-)Nu$",
      "Aldehyde oxidation: $RCHO\rightarrow RCOO^-$",
      "Reduction: $RCHO\rightarrow RCH_2OH$",
    ],
    tips: ["Aldehydes are generally more reactive than ketones."],
  },
  {
    subject: "chemistry",
    match: /amines/,
    core: ["classification of amines", "basicity", "preparation reactions", "diazonium salts"],
    formulas: [
      "Salt formation: $RNH_2+HCl\rightarrow RNH_3^+Cl^-$",
      "Diazotisation: $ArNH_2+NaNO_2+HCl\rightarrow ArN_2^+Cl^-+NaCl+2H_2O$",
    ],
    tips: ["Basicity depends on lone-pair availability, solvation, and substituent effects."],
  },
  {
    subject: "chemistry",
    match: /biomolecules/,
    core: ["carbohydrates", "proteins and amino acids", "enzymes", "nucleic acids and vitamins"],
    formulas: ["Glucose: $C_6H_{12}O_6$", "Peptide bond: $-CO-NH-$"],
    tips: ["Proteins are polymers of amino acids joined by peptide bonds."],
  },

  // Mathematics
  {
    subject: "mathematics",
    match: /sets/,
    core: [
      "set notation",
      "subsets and power set",
      "Venn diagrams",
      "union, intersection, and complement",
    ],
    formulas: [
      "Union count: $n(A\cup B)=n(A)+n(B)-n(A\cap B)$",
      "Power set: $n(P(A))=2^{n(A)}$",
      "De Morgan: $(A\cup B)'=A'\cap B'$",
    ],
    tips: ["Fix the universal set before using complement."],
  },
  {
    subject: "mathematics",
    match: /relations and functions/,
    core: [
      "Cartesian product",
      "relations",
      "domain, codomain, and range",
      "composition and inverse",
    ],
    formulas: [
      "Composition: $(f\circ g)(x)=f(g(x))$",
      "Inverse condition: $f^{-1}(f(x))=x$",
      "Product size: $n(A\times B)=n(A)n(B)$",
    ],
    tips: ["Inverse exists only when the function is bijective on the stated domain and codomain."],
  },
  {
    subject: "mathematics",
    match: /trigonometric/,
    core: ["radian measure", "trigonometric identities", "graphs", "trigonometric equations"],
    formulas: [
      "Identity: $\sin^2x+\cos^2x=1$",
      "Addition: $\sin(a+b)=\sin a\cos b+\cos a\sin b$",
      "Double angle: $\cos2x=1-2\sin^2x$",
    ],
    tips: ["Use quadrant signs and periodicity while solving equations."],
  },
  {
    subject: "mathematics",
    match: /complex numbers|quadratic/,
    core: ["complex algebra", "Argand plane", "modulus and argument", "quadratic roots"],
    formulas: [
      "Modulus: $|z|=\sqrt{x^2+y^2}$",
      "Polar form: $z=r(\cos\theta+i\sin\theta)$",
      "Quadratic roots: $x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}$",
    ],
    tips: ["Use conjugate and Argand-plane geometry to simplify complex-number questions."],
  },
  {
    subject: "mathematics",
    match: /linear inequalities/,
    core: ["inequality rules", "solution intervals", "number line", "half-plane solution"],
    formulas: [
      "Addition rule: $a<b\Rightarrow a+c<b+c$",
      "Negative multiplier: $a<b,c<0\Rightarrow ac>bc$",
    ],
    tips: ["Reverse the inequality sign when multiplying or dividing by a negative number."],
  },
  {
    subject: "mathematics",
    match: /permutations|combinations/,
    core: ["factorial notation", "permutations", "combinations", "counting principles"],
    formulas: [
      "Permutation: ${}^nP_r=\frac{n!}{(n-r)!}$",
      "Combination: ${}^nC_r=\frac{n!}{r!(n-r)!}$",
      "Symmetry: ${}^nC_r={}^nC_{n-r}$",
    ],
    tips: ["Use permutation when order matters and combination when order does not matter."],
  },
  {
    subject: "mathematics",
    match: /binomial theorem/,
    core: ["binomial expansion", "general term", "middle term", "binomial coefficients"],
    formulas: [
      "Expansion: $(a+b)^n=\sum_{r=0}^{n}{}^nC_ra^{n-r}b^r$",
      "General term: $T_{r+1}={}^nC_ra^{n-r}b^r$",
      "Coefficient sum: $\sum{}^nC_r=2^n$",
    ],
    tips: ["Use the general term to find a required power without expanding fully."],
  },
  {
    subject: "mathematics",
    match: /sequences|series/,
    core: ["arithmetic progression", "geometric progression", "means", "sum of series"],
    formulas: [
      "AP term: $a_n=a+(n-1)d$",
      "AP sum: $S_n=\frac{n}{2}[2a+(n-1)d]$",
      "GP term: $a_n=ar^{n-1}$",
      "Infinite GP: $S_\infty=\frac{a}{1-r}$",
    ],
    tips: ["Check whether differences or ratios are constant."],
  },
  {
    subject: "mathematics",
    match: /straight lines/,
    core: ["slope", "line equations", "angle between lines", "distance from a point"],
    formulas: [
      "Slope: $m=\frac{y_2-y_1}{x_2-x_1}$",
      "Point-slope: $y-y_1=m(x-x_1)$",
      "Distance: $d=\frac{|Ax_1+By_1+C|}{\sqrt{A^2+B^2}}$",
    ],
    tips: ["Parallel lines have equal slopes; perpendicular slopes multiply to $-1$."],
  },
  {
    subject: "mathematics",
    match: /conic/,
    core: ["circle", "parabola", "ellipse", "hyperbola"],
    formulas: [
      "Circle: $(x-h)^2+(y-k)^2=r^2$",
      "Parabola: $y^2=4ax$",
      "Ellipse: $\frac{x^2}{a^2}+\frac{y^2}{b^2}=1$",
      "Hyperbola: $\frac{x^2}{a^2}-\frac{y^2}{b^2}=1$",
    ],
    tips: ["Convert to standard form before reading focus, directrix, or eccentricity."],
  },
  {
    subject: "mathematics",
    match: /3d|three dimensional/,
    core: [
      "coordinates in space",
      "distance and section formula",
      "direction cosines",
      "lines and planes",
    ],
    formulas: [
      "Distance: $d=\sqrt{(x_2-x_1)^2+(y_2-y_1)^2+(z_2-z_1)^2}$",
      "Direction cosines: $l^2+m^2+n^2=1$",
      "Line: $\vec r=\vec a+\lambda\vec b$",
      "Plane: $\vec r\cdot\vec n=d$",
    ],
    tips: ["Vector form reduces sign mistakes in 3D geometry."],
  },
  {
    subject: "mathematics",
    match: /limits|derivatives|continuity|differentiability/,
    core: [
      "limits",
      "continuity",
      "derivative as rate of change",
      "standard differentiation rules",
    ],
    formulas: [
      "Derivative: $f'(x)=\lim_{h\to0}\frac{f(x+h)-f(x)}{h}$",
      "Standard limit: $\lim_{x\to0}\frac{\sin x}{x}=1$",
      "Product rule: $(uv)'=u'v+uv'$",
      "Chain rule: $\frac{dy}{dx}=\frac{dy}{du}\frac{du}{dx}$",
    ],
    tips: [
      "Differentiability implies continuity, but continuity need not imply differentiability.",
    ],
  },
  {
    subject: "mathematics",
    match: /statistics/,
    core: ["mean, median, and mode", "variance", "standard deviation", "grouped data"],
    formulas: [
      "Mean: $\bar x=\frac{\sum x_i}{n}$",
      "Variance: $\sigma^2=\frac{\sum (x_i-\bar x)^2}{n}$",
      "Standard deviation: $\sigma=\sqrt{\sigma^2}$",
    ],
    tips: ["Use the formula matching raw, frequency, or grouped data."],
  },
  {
    subject: "mathematics",
    match: /probability/,
    core: ["sample space", "events", "addition rule", "conditional probability"],
    formulas: [
      "Classical probability: $P(E)=\frac{n(E)}{n(S)}$",
      "Addition: $P(A\cup B)=P(A)+P(B)-P(A\cap B)$",
      "Conditional: $P(A|B)=\frac{P(A\cap B)}{P(B)}$",
    ],
    tips: ["Independence and mutual exclusivity are different concepts."],
  },
  {
    subject: "mathematics",
    match: /matrices/,
    core: ["matrix types", "matrix operations", "transpose", "inverse"],
    formulas: [
      "Entry of product: $(AB)_{ij}=\sum_k a_{ik}b_{kj}$",
      "Inverse condition: $AA^{-1}=I$",
      "Transpose rule: $(AB)^T=B^TA^T$",
    ],
    tips: ["Matrix multiplication is generally not commutative."],
  },
  {
    subject: "mathematics",
    match: /determinants/,
    core: ["determinant expansion", "properties", "area of triangle", "adjoint and inverse"],
    formulas: [
      "Two by two: $\begin{vmatrix}a&b\\c&d\end{vmatrix}=ad-bc$",
      "Inverse: $A^{-1}=\frac{\operatorname{adj}A}{|A|}$",
      "Triangle area: $\Delta=\tfrac{1}{2}|x_1(y_2-y_3)+x_2(y_3-y_1)+x_3(y_1-y_2)|$",
    ],
    tips: ["Interchanging two rows changes the sign of determinant."],
  },
  {
    subject: "mathematics",
    match: /application of derivatives/,
    core: ["rate of change", "tangents and normals", "monotonicity", "maxima and minima"],
    formulas: [
      "Tangent slope: $m=f'(x_1)$",
      "Normal slope: $m_n=-\frac{1}{f'(x_1)}$",
      "Stationary point: $f'(x)=0$",
    ],
    tips: ["Critical points occur where derivative is zero or undefined inside the domain."],
  },
  {
    subject: "mathematics",
    match: /integrals/,
    core: ["indefinite integrals", "substitution", "partial fractions", "integration by parts"],
    formulas: [
      "Power rule: $\int x^n dx=\frac{x^{n+1}}{n+1}+C$",
      "By parts: $\int u\,dv=uv-\int v\,du$",
      "Symmetry: $\int_a^b f(x)dx=\int_a^b f(a+b-x)dx$",
    ],
    tips: ["Add $C$ for indefinite integrals; definite integrals use limits instead."],
  },
  {
    subject: "mathematics",
    match: /application of integrals/,
    core: [
      "area under a curve",
      "area between curves",
      "limits of integration",
      "geometric interpretation",
    ],
    formulas: [
      "Area under curve: $A=\int_a^b y\,dx$",
      "Area between curves: $A=\int_a^b |y_1-y_2|\,dx$",
    ],
    tips: ["Draw curves and split the integral where their order changes."],
  },
  {
    subject: "mathematics",
    match: /differential equations/,
    core: ["order and degree", "formation", "separable equations", "linear differential equations"],
    formulas: [
      "Separable form: $\frac{dy}{dx}=g(x)h(y)$",
      "Linear form: $\frac{dy}{dx}+Py=Q$",
      "Integrating factor: $IF=e^{\int Pdx}$",
    ],
    tips: ["Eliminate arbitrary constants to form a differential equation."],
  },
  {
    subject: "mathematics",
    match: /vector algebra/,
    core: ["vectors and scalars", "dot product", "cross product", "projection"],
    formulas: [
      "Dot product: $\vec a\cdot\vec b=|a||b|\cos\theta$",
      "Cross product: $|\vec a\times\vec b|=|a||b|\sin\theta$",
      "Projection: $\operatorname{proj}_{b}a=\frac{\vec a\cdot\vec b}{|b|}$",
    ],
    tips: ["Zero dot product means perpendicular; zero cross product means parallel."],
  },
  {
    subject: "mathematics",
    match: /linear programming/,
    core: ["objective function", "constraints", "feasible region", "corner-point method"],
    formulas: ["Objective: $Z=ax+by$", "Constraint: $a_1x+b_1y\le c_1$"],
    tips: ["The optimum occurs at a corner point of the feasible region when it exists."],
  },

  // Biology
  {
    subject: "biology",
    match: /living world/,
    core: [
      "characteristics of living organisms",
      "biodiversity",
      "taxonomy",
      "binomial nomenclature and taxonomical aids",
    ],
    tips: ["Herbarium, botanical gardens, museums, and keys are important taxonomical aids."],
  },
  {
    subject: "biology",
    match: /biological classification/,
    core: [
      "five-kingdom classification",
      "Monera, Protista, Fungi, Plantae, and Animalia",
      "viruses, viroids, and lichens",
      "basis of classification",
    ],
    tips: [
      "Classification uses cell type, body organisation, nutrition, reproduction, and phylogeny.",
    ],
  },
  {
    subject: "biology",
    match: /plant kingdom/,
    core: [
      "algae, bryophytes, pteridophytes, gymnosperms, and angiosperms",
      "life cycles",
      "alternation of generations",
      "NCERT examples",
    ],
    tips: ["Compare plant groups by vascular tissue, seeds, flowers, and dominant generation."],
  },
  {
    subject: "biology",
    match: /animal kingdom/,
    core: [
      "basis of animal classification",
      "symmetry and coelom",
      "non-chordates",
      "chordates and vertebrate classes",
    ],
    tips: ["Memorise NCERT examples for every phylum and class."],
  },
  {
    subject: "biology",
    match: /morphology/,
    core: [
      "root, stem, and leaf modifications",
      "inflorescence",
      "flower, fruit, and seed",
      "families and floral formulae",
    ],
    formulas: ["Floral symbols: $\oplus,\;\%,\;K,\;C,\;A,\;G$"],
    tips: ["Floral formula and floral diagram summarise family characters."],
  },
  {
    subject: "biology",
    match: /anatomy/,
    core: [
      "plant tissues",
      "root, stem, and leaf anatomy",
      "secondary growth",
      "dicot and monocot comparison",
    ],
    tips: ["Compare dicot and monocot anatomy through vascular bundle arrangement."],
  },
  {
    subject: "biology",
    match: /structural organisation/,
    core: ["animal tissues", "earthworm, cockroach, and frog", "organ systems", "NCERT diagrams"],
    tips: ["Link each tissue with structure, location, and function."],
  },
  {
    subject: "biology",
    match: /cell.*unit of life/,
    core: [
      "cell theory",
      "prokaryotic and eukaryotic cells",
      "cell organelles",
      "fluid mosaic model",
    ],
    tips: ["Match each organelle with its function and diagram label."],
  },
  {
    subject: "biology",
    match: /biomolecules/,
    core: [
      "carbohydrates, proteins, lipids, and nucleic acids",
      "enzymes",
      "metabolites",
      "biomacromolecules",
    ],
    formulas: ["Glucose: $C_6H_{12}O_6$", "Amino acid: $NH_2-CHR-COOH$"],
    tips: ["Enzymes lower activation energy and show specificity."],
  },
  {
    subject: "biology",
    match: /cell cycle|cell division/,
    core: ["interphase", "mitosis", "meiosis", "chromosome behaviour and significance"],
    tips: [
      "DNA replication occurs in S phase; mitosis preserves chromosome number and meiosis reduces it.",
    ],
  },
  {
    subject: "biology",
    match: /photosynthesis/,
    core: [
      "chloroplast structure",
      "light reaction",
      "Calvin cycle",
      "C3, C4, photorespiration, and limiting factors",
    ],
    formulas: [
      "Photosynthesis: $6CO_2+12H_2O\rightarrow C_6H_{12}O_6+6H_2O+6O_2$",
      "Calvin fixation: $CO_2+RuBP\rightarrow2\times3\text{-PGA}$",
    ],
    tips: ["Light reaction produces ATP and NADPH; Calvin cycle uses them for carbon fixation."],
  },
  {
    subject: "biology",
    match: /respiration in plants/,
    core: [
      "glycolysis",
      "Krebs cycle",
      "electron transport system",
      "fermentation and respiratory quotient",
    ],
    formulas: [
      "Aerobic respiration: $C_6H_{12}O_6+6O_2\rightarrow6CO_2+6H_2O+\text{energy}$",
      "Respiratory quotient: $RQ=\frac{CO_2\;evolved}{O_2\;consumed}$",
    ],
    tips: ["Glycolysis occurs in cytoplasm; Krebs cycle and ETS occur in mitochondria."],
  },
  {
    subject: "biology",
    match: /plant growth/,
    core: ["growth phases", "plant growth regulators", "photoperiodism", "vernalisation"],
    formulas: ["Growth rate: $r=\frac{W_2-W_1}{t_2-t_1}$"],
    tips: ["Revise auxin, gibberellin, cytokinin, ABA, and ethylene by role and example."],
  },
  {
    subject: "biology",
    match: /breathing|exchange of gases/,
    core: [
      "mechanism of breathing",
      "gas exchange",
      "oxygen and carbon dioxide transport",
      "regulation and disorders",
    ],
    formulas: ["Alveolar ventilation: $V_A=(V_T-V_D)\times f$"],
    tips: ["Haemoglobin dissociation curve shifts with pH, CO2, temperature, and 2,3-BPG."],
  },
  {
    subject: "biology",
    match: /body fluids|circulation/,
    core: ["blood and lymph", "human heart", "cardiac cycle", "ECG and circulatory disorders"],
    formulas: ["Cardiac output: $CO=SV\times HR$"],
    tips: ["SA node is the pacemaker of the human heart."],
  },
  {
    subject: "biology",
    match: /excretory/,
    core: [
      "nitrogenous wastes",
      "nephron",
      "urine formation",
      "counter-current mechanism and osmoregulation",
    ],
    formulas: ["Clearance idea: $C=\frac{UV}{P}$"],
    tips: ["Urine formation includes filtration, reabsorption, secretion, and concentration."],
  },
  {
    subject: "biology",
    match: /locomotion|movement/,
    core: ["types of movement", "muscle contraction", "skeletal system", "joints and disorders"],
    tips: ["Sliding filament theory explains contraction through actin-myosin interaction."],
  },
  {
    subject: "biology",
    match: /neural control/,
    core: ["neuron structure", "nerve impulse", "synaptic transmission", "CNS and sense organs"],
    tips: ["Reflex arc components and eye/ear diagrams are high-yield."],
  },
  {
    subject: "biology",
    match: /chemical coordination/,
    core: ["endocrine glands", "hormones", "feedback regulation", "mechanism of hormone action"],
    tips: ["Memorise gland, hormone, target organ, and function together."],
  },
  {
    subject: "biology",
    match: /sexual reproduction in flowering plants/,
    core: [
      "flower structure",
      "microsporogenesis and megasporogenesis",
      "pollination",
      "double fertilisation, seed, and fruit",
    ],
    tips: ["Double fertilisation forms zygote and primary endosperm nucleus."],
  },
  {
    subject: "biology",
    match: /human reproduction/,
    core: [
      "reproductive systems",
      "gametogenesis",
      "menstrual cycle",
      "fertilisation, implantation, pregnancy, and parturition",
    ],
    tips: ["Menstrual-cycle phases are controlled by pituitary and ovarian hormones."],
  },
  {
    subject: "biology",
    match: /reproductive health/,
    core: [
      "contraception",
      "STIs",
      "infertility and ART",
      "population and reproductive-health issues",
    ],
    tips: ["Know IVF, ZIFT, IUT, GIFT, and ICSI meanings exactly."],
  },
  {
    subject: "biology",
    match: /inheritance|variation/,
    core: [
      "Mendelian inheritance",
      "deviations from Mendelism",
      "chromosomal theory",
      "sex determination and genetic disorders",
    ],
    formulas: ["Monohybrid ratio: $3:1$", "Dihybrid ratio: $9:3:3:1$", "Test cross: $1:1$"],
    tips: ["Pedigree symbols and common genetic disorders are direct NEET targets."],
  },
  {
    subject: "biology",
    match: /molecular basis/,
    core: ["DNA structure", "replication", "transcription", "genetic code and translation"],
    formulas: ["Chargaff rule: $A=T,\;G=C$", "Codons: $4^3=64$"],
    tips: ["Genetic code is triplet, degenerate, unambiguous, and nearly universal."],
  },
  {
    subject: "biology",
    match: /evolution/,
    core: [
      "origin of life",
      "evidences of evolution",
      "natural selection",
      "Hardy-Weinberg principle",
    ],
    formulas: ["Hardy-Weinberg: $p^2+2pq+q^2=1$", "Allele frequencies: $p+q=1$"],
    tips: ["Homology indicates common ancestry; analogy indicates convergent evolution."],
  },
  {
    subject: "biology",
    match: /human health|disease/,
    core: ["pathogens and diseases", "immunity", "vaccination", "AIDS, cancer, and drug abuse"],
    tips: ["Revise pathogen-disease-vector tables exactly from NCERT."],
  },
  {
    subject: "biology",
    match: /microbes/,
    core: [
      "household products",
      "industrial production",
      "sewage treatment",
      "biogas, antibiotics, biocontrol, and biofertilisers",
    ],
    formulas: ["BOD idea: $\text{BOD}\propto\text{organic matter in water}$"],
    tips: ["Remember organism-product pairs such as Lactobacillus-curd and yeast-ethanol."],
  },
  {
    subject: "biology",
    match: /biotechnology.*principles|principles and processes/,
    core: [
      "recombinant DNA technology",
      "restriction enzymes",
      "vectors",
      "PCR, gel electrophoresis, and bioreactors",
    ],
    formulas: ["PCR amplification: $N\approx N_0\times2^n$"],
    tips: ["Plasmid vectors need ori, selectable marker, and cloning site."],
  },
  {
    subject: "biology",
    match: /biotechnology.*applications/,
    core: [
      "transgenic organisms",
      "Bt cotton",
      "gene therapy",
      "molecular diagnosis and biosafety",
    ],
    tips: ["Bt toxin is activated in the alkaline gut of insect larvae."],
  },
  {
    subject: "biology",
    match: /organisms and populations/,
    core: ["population attributes", "population growth", "adaptations", "biotic interactions"],
    formulas: [
      "Exponential growth: $\frac{dN}{dt}=rN$",
      "Logistic growth: $\frac{dN}{dt}=rN\left(\frac{K-N}{K}\right)$",
    ],
    tips: ["Interactions include predation, competition, parasitism, commensalism, and mutualism."],
  },
  {
    subject: "biology",
    match: /ecosystem/,
    core: [
      "ecosystem structure",
      "productivity",
      "decomposition",
      "energy flow and nutrient cycles",
    ],
    formulas: ["Productivity: $NPP=GPP-R$", "Energy transfer: $E_{next}\approx0.1E_{previous}$"],
    tips: ["Energy flow is unidirectional and decreases at successive trophic levels."],
  },
  {
    subject: "biology",
    match: /biodiversity|conservation/,
    core: [
      "genetic, species, and ecosystem diversity",
      "species-area relationship",
      "biodiversity loss",
      "in-situ and ex-situ conservation",
    ],
    formulas: ["Species-area: $\log S=\log C+Z\log A$"],
    tips: ["Biodiversity loss is driven strongly by habitat loss and fragmentation."],
  },
];

function uniqueStrings(values: string[], limit = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const clean = sanitizeTitle(value);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function derivedCore(chapterName: string, subject: SubjectBucket): string[] {
  const chapter = sanitizeTitle(chapterName) ?? "this chapter";
  if (subject === "biology")
    return [
      `${chapter} terminology`,
      `${chapter} labelled diagrams`,
      `${chapter} process sequence`,
      `${chapter} NCERT examples`,
    ];
  if (subject === "chemistry")
    return [
      `${chapter} definitions`,
      `${chapter} equations and reactions`,
      `${chapter} trends or mechanism`,
      `${chapter} NCERT examples`,
    ];
  if (subject === "mathematics")
    return [
      `${chapter} definitions`,
      `${chapter} standard formulae`,
      `${chapter} solved patterns`,
      `${chapter} domain and condition checks`,
    ];
  if (subject === "physics")
    return [
      `${chapter} laws`,
      `${chapter} graphs or diagrams`,
      `${chapter} formula conditions`,
      `${chapter} numerical patterns`,
    ];
  return [
    `${chapter} definitions`,
    `${chapter} concepts`,
    `${chapter} examples`,
    `${chapter} exam traps`,
  ];
}

function getChapterKnowledge(chapterName: string, subjectName?: string | null): ChapterKnowledge {
  const subject = subjectBucket(subjectName);
  const chapter = chapterName.toLowerCase();
  const entry = KNOWLEDGE_ENTRIES.find(
    (item) => (!item.subject || item.subject === subject) && item.match.test(chapter),
  );
  return {
    core: uniqueStrings([...(entry?.core ?? []), ...derivedCore(chapterName, subject)], 8),
    keyPoints: uniqueStrings([...(entry?.tips ?? []), ...SUBJECT_KEY_POINTS[subject]], 8),
    formulas: uniqueStrings(entry?.formulas ?? [], 8),
  };
}

function humanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "core NCERT ideas";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function diagramLabel(value: string): string {
  return value.replace(/["<>]/g, "").replace(/[()]/g, "").slice(0, 60);
}

function fallbackTopicTitles(chapterName: string, subjectName?: string | null): string[] {
  const knowledge = getChapterKnowledge(chapterName, subjectName);
  const core = knowledge.core.slice(0, 5);
  const subject = subjectBucket(subjectName);
  const formulaTitle =
    subject === "biology" && knowledge.formulas.length === 0
      ? `${chapterName}: NCERT Diagrams, Tables & Examples`
      : `${chapterName}: Formulas, Reactions & NCERT Conditions`;

  return uniqueStrings(
    [
      `${chapterName}: NCERT High-Yield Overview`,
      ...core.map((item) => `${chapterName}: ${item}`),
      formulaTitle,
      `${chapterName}: Solved NCERT Examples & PYQ Patterns`,
      `${chapterName}: Common Mistakes, Exceptions & Last-Minute Checklist`,
    ],
    10,
  );
}

function isGenericFallbackTopicTitle(title: unknown, chapterName: string): boolean {
  if (typeof title !== "string") return false;
  const t = title.toLowerCase();
  const c = chapterName.toLowerCase();
  return (
    t === `${c} — high-yield overview` ||
    t === `${c} overview` ||
    t === `${c}: overview` ||
    t.includes("ncert definitions & key scientific terminology") ||
    t.includes("ncert definitions and key terms") ||
    t.includes("core concept mechanism & mathematical relationships") ||
    t.includes("core concepts and relationships") ||
    t.includes("laws, formulas, units, and graphs") ||
    t.includes("diagrams, terminology, and processes") ||
    t.includes("important examples from ncert") ||
    t.includes("high-yield solved examples & numerical applications") ||
    t.includes("exercise-style problem patterns") ||
    t.includes("tricky ncert exercise patterns") ||
    t.includes("common mistakes to avoid") ||
    t.includes("common mistakes & conceptual traps") ||
    t.includes("last-minute revision checklist") ||
    t.includes("last-minute ncert formula & diagram revision checklist")
  );
}

function shouldRefreshGenericTopics(existing: unknown[], chapterName: string): boolean {
  if (!existing.length) return false;
  const rows = existing as Array<Record<string, unknown>>;
  const generated = rows.some((row) => row.generated_at || row.summary);
  if (generated) return false;
  const genericCount = rows.filter((row) =>
    isGenericFallbackTopicTitle(row.title, chapterName),
  ).length;
  return genericCount >= Math.min(3, rows.length);
}

function isGenericPlaceholderRevision(topicRecord: Record<string, unknown>): boolean {
  const summary = String(topicRecord.summary ?? "");
  const formulas = Array.isArray(topicRecord.formulas)
    ? topicRecord.formulas.map(String).join("\n")
    : "";
  return (
    /critical high-yield topic in .* for the chapter/i.test(summary) ||
    /physical or biological significance of every term/i.test(summary) ||
    (/E\s*=\s*mc\^?2/i.test(formulas) && /PV\s*=\s*nRT/i.test(formulas))
  );
}

function fallbackRevision(
  topicTitle: string,
  chapter: ChapterDetails,
): Pick<
  ReviseTopic,
  "summary" | "key_points" | "formulas" | "refs" | "diagram" | "diagram_caption"
> {
  const subject = chapter.subjects?.name ?? "NCERT";
  const subjectKey = subjectBucket(subject);
  const classText = chapter.class_level ? `Class ${chapter.class_level}` : "NCERT";
  const knowledge = getChapterKnowledge(chapter.name, subject);
  const core = knowledge.core.slice(0, 4);
  const topicLower = topicTitle.toLowerCase();
  const topicAngle =
    topicLower.includes("formula") || topicLower.includes("reaction")
      ? "formula conditions, units, exceptions, and direct applications"
      : topicLower.includes("mistake") || topicLower.includes("trap")
        ? "common misconceptions, exception cases, and option-elimination traps"
        : topicLower.includes("diagram") || topicLower.includes("table")
          ? "NCERT diagram labels, tables, examples, and sequence-based recall"
          : topicLower.includes("example") || topicLower.includes("pyq")
            ? "NCERT solved patterns and previous-year style applications"
            : `the core chain of ${humanList(core.slice(0, 3))}`;

  const subjectSentence =
    subjectKey === "biology"
      ? "Revise it through definitions, labelled diagrams, examples, and ordered processes."
      : subjectKey === "mathematics"
        ? "Revise it by writing the standard form, conditions, and one solved pattern before attempting objective questions."
        : subjectKey === "chemistry"
          ? "Revise it through definitions, equations or mechanisms, exceptions, and NCERT examples."
          : "Revise it by connecting laws, diagrams or graphs, formula conditions, and numerical patterns.";

  const keyPoints = uniqueStrings(
    [
      `For "${topicTitle}", focus on ${topicAngle}.`,
      ...knowledge.keyPoints,
      `Core NCERT anchors for this chapter: ${humanList(core)}.`,
      knowledge.formulas.length > 0
        ? "Before using any formula, confirm the symbols, units, assumptions, and limiting case."
        : "For this chapter, prioritise exact NCERT words, diagrams, examples, and sequence of events.",
      `After revision, solve NCERT examples/exercises from "${chapter.name}" and mark every error source.`,
    ],
    8,
  );

  const diagramNodes = core.slice(0, 4);
  const diagram = [
    "flowchart TD",
    `  A["${diagramLabel(chapter.name)}"] --> B["${diagramLabel(diagramNodes[0] ?? "NCERT definitions")}"]`,
    `  A --> C["${diagramLabel(diagramNodes[1] ?? "Core concept")}"]`,
    `  A --> D["${diagramLabel(diagramNodes[2] ?? "Examples")}"]`,
    `  C --> E["${diagramLabel(diagramNodes[3] ?? "Exam application")}"]`,
    '  D --> F["PYQ practice"]',
    "  E --> F",
  ].join("\n");

  return {
    summary: `${topicTitle} belongs to ${classText} ${subject} chapter "${chapter.name}". This revision should centre on ${humanList(core)}. The most important angle here is ${topicAngle}, because exam questions usually test whether you can recognise the NCERT condition and apply it without mixing it with a neighbouring chapter. ${subjectSentence} While revising, make a two-column sheet: left side for exact NCERT terms or formulae, right side for the condition, example, exception, or common trap. Finish by solving two easy and two mixed questions from the same chapter so the note becomes usable, not just memorable.`,
    key_points: keyPoints,
    formulas: knowledge.formulas,
    refs: fallbackReferences(),
    diagram,
    diagram_caption: `Chapter-specific map for ${chapter.name}.`,
  };
}

/** Mermaid is strict — keep only what we can safely render. */
function sanitizeDiagram(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value
    .replace(/^\s*```(?:mermaid)?/i, "")
    .replace(/```\s*$/, "")
    .trim()
    .slice(0, 3000);
  if (!code) return null;
  if (
    !/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|mindmap|erDiagram|timeline)\b/i.test(
      code,
    )
  ) {
    return null;
  }
  return code;
}

/**
 * Lists the best high-yield revision topics for a chapter and PERMANENTLY saves them in Supabase.
 */
export async function listChapterTopics(
  chapterId: string,
  context: SupabaseContext,
): Promise<{
  chapter: { id: string; name: string; class_level: number | null } | null;
  topics: ReviseTopic[];
}> {
  const { data: chapter } = await context.supabase
    .from("chapters")
    .select("id, name, class_level, subject_id")
    .eq("id", chapterId)
    .maybeSingle();
  if (!chapter) return { chapter: null, topics: [] };

  const { data: subject } = await context.supabase
    .from("subjects")
    .select("name")
    .eq("id", (chapter as ChapterRow).subject_id)
    .maybeSingle();

  // 1. Check if topics are ALREADY saved in Supabase. Older fallback rows were
  // generic for every chapter, so replace those ungenerated placeholder rows
  // with chapter-specific titles the next time the chapter is opened.
  const { data: existing } = await context.supabase
    .from("revise_topics")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("display_order");

  if (existing && existing.length > 0) {
    if (shouldRefreshGenericTopics(existing, chapter.name)) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: deleteError } = await supabaseAdmin
        .from("revise_topics")
        .delete()
        .eq("chapter_id", chapterId)
        .is("generated_at", null);
      if (deleteError) throw deleteError;
    } else {
      return { chapter, topics: existing as unknown as ReviseTopic[] };
    }
  }

  // 2. Fetch educational web topics using Firecrawl & Gemini AI
  let titles = fallbackTopicTitles(chapter.name, subject?.name);
  try {
    const result = await callGemini<{ topics: { title: string }[] }>(
      `Select the top 8 to 10 BEST high-yield NCERT revision topics for Class ${chapter.class_level} ${subject?.name ?? ""} chapter "${chapter.name}" commonly featured on top educational websites (NCERT, Vedantu, BYJU'S, Unacademy) for IIT-JEE and NEET revision. Return titles ordered logically from core concepts to high-yield exam applications.`,
      {
        type: "object",
        properties: {
          topics: {
            type: "array",
            items: {
              type: "object",
              properties: { title: { type: "string" } },
              required: ["title"],
            },
          },
        },
        required: ["topics"],
      },
    );
    const aiTitles = (result.topics ?? [])
      .map((topic) => sanitizeTitle(topic.title))
      .filter(Boolean) as string[];
    if (aiTitles.length > 0) titles = aiTitles;
  } catch (error) {
    console.warn(
      "[listChapterTopics] Error fetching AI topic titles, using fallback titles:",
      error,
    );
  }

  // 3. Save topics PERMANENTLY to Supabase database so they persist forever
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inserted, error } = await supabaseAdmin
    .from("revise_topics")
    .upsert(buildTopicRows(chapterId, titles), {
      onConflict: "chapter_id,slug",
      ignoreDuplicates: true,
    })
    .select("*")
    .order("display_order");

  if (error) throw error;
  return { chapter, topics: (inserted ?? []) as unknown as ReviseTopic[] };
}

/**
 * Reads a topic revision note. Once generated, it is SAVED PERMANENTLY in Supabase forever.
 */
export async function readTopicRevision(
  topicId: string,
  context: SupabaseContext,
): Promise<ReviseTopic> {
  const { data: topic, error } = await context.supabase
    .from("revise_topics")
    .select("*, chapters(name, class_level, subjects(name))")
    .eq("id", topicId)
    .maybeSingle();
  if (error) throw error;
  if (!topic) throw new Error("Topic not found");

  const topicRecord = topic as Record<string, unknown> & { chapters?: ChapterDetails };
  const { chapters, ...rest } = topicRecord;
  const chapter = chapters ?? { name: "NCERT", class_level: null, subjects: { name: "subject" } };

  // 1. PERMANENT CACHE CHECK: If explanation + diagram + references are already stored in DB, return immediately!
  if (
    topicRecord.summary &&
    topicRecord.generated_at &&
    topicRecord.diagram &&
    Array.isArray(topicRecord.refs) &&
    topicRecord.refs.length > 0 &&
    !isGenericPlaceholderRevision(topicRecord)
  ) {
    return rest as unknown as ReviseTopic;
  }

  // 2. Generate best explanation using Gemini 3.6 Flash + Firecrawl Search for verified educational references
  try {
    const ai = await callGemini<{
      summary: string;
      key_points: string[];
      formulas: string[];
    }>(
      `Write a comprehensive, crystal-clear NCERT-aligned revision note for the topic "${topicRecord.title}" from Class ${chapter.class_level} ${chapter.subjects?.name ?? ""} chapter "${chapter.name}".

Requirements:
- summary: 140-220 word crystal-clear, deep explanation covering NCERT principles, physical/chemical/biological meaning, and exam relevance.
- key_points: 6-8 bullet points highlighting crucial definitions, edge-cases, and JEE/NEET exam tips.
- formulas: array of essential formulas or chemical equations. STRICT FORMAT: each item MUST be "Label: $latex$" wrapping valid LaTeX in single dollar signs (e.g. "Kinetic energy: $K=\\tfrac{1}{2}mv^2$", "Ideal gas law: $PV=nRT$").

Write in your own clear words without copying copyrighted text.`,
      {
        type: "object",
        properties: {
          summary: { type: "string" },
          key_points: { type: "array", items: { type: "string" } },
          formulas: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "key_points", "formulas"],
      },
    );

    // Fetch verified educational references from top learning sites via Firecrawl Search
    const [refs, dia] = await Promise.all([
      firecrawlReferences(String(topicRecord.title ?? "Revision"), chapter.name),
      generateDiagram(String(topicRecord.title ?? "Revision"), chapter),
    ]);

    // 3. SAVE PERMANENTLY IN SUPABASE FOREVER
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error: upErr } = await supabaseAdmin
      .from("revise_topics")
      .update({
        summary: ai.summary,
        key_points: ai.key_points,
        formulas: ai.formulas,
        diagram: dia.diagram,
        diagram_caption: dia.diagram_caption,
        refs,
        generated_at: new Date().toISOString(),
      })
      .eq("id", topicId)
      .select("*")
      .maybeSingle();

    if (upErr) throw upErr;
    return updated as unknown as ReviseTopic;
  } catch (error) {
    console.warn(
      "[readTopicRevision] Error generating topic revision, using fallback & saving:",
      error,
    );
    const fallback = fallbackRevision(String(topicRecord.title ?? "Revision"), chapter);
    return { ...(rest as unknown as ReviseTopic), ...fallback };
  }
}
