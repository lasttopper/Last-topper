import type { QuizQuestion } from "@/lib/learning.functions";

export const STATIC_PCM_QUESTIONS: QuizQuestion[] = [
  {
    id: "pcm_static_1",
    chapter_id: "",
    question: "A body of mass $m$ is projected at an angle $\\theta$ with the horizontal with initial velocity $u$. What is the horizontal range of the projectile?",
    options: {
      A: "$\\frac{u^2 \\sin(2\\theta)}{g}$",
      B: "$\\frac{u^2 \\sin^2(\\theta)}{2g}$",
      C: "$\\frac{u^2 \\cos(2\\theta)}{g}$",
      D: "$\\frac{2u \\sin(\\theta)}{g}$"
    },
    correct: "A",
    hint: "Horizontal distance = (horizontal velocity component) $\\times$ (time of flight).",
    explanation: "Horizontal velocity $u_x = u \\cos\\theta$ and time of flight $T = \\frac{2u \\sin\\theta}{g}$. Range $R = u_x T = \\frac{u^2 (2 \\sin\\theta \\cos\\theta)}{g} = \\frac{u^2 \\sin(2\\theta)}{g}$."
  },
  {
    id: "pcm_static_2",
    chapter_id: "",
    question: "What is the order of reaction for a zero-order reaction whose rate constant unit is $\\text{mol L}^{-1} \\text{s}^{-1}$?",
    options: {
      A: "First order",
      B: "Zero order",
      C: "Second order",
      D: "Half order"
    },
    correct: "B",
    hint: "For a reaction of order $n$, the unit of rate constant $k$ is $(\\text{mol L}^{-1})^{1-n} \\text{s}^{-1}$.",
    explanation: "Substituting $n = 0$ yields unit $(\\text{mol L}^{-1})^1 \\text{s}^{-1} = \\text{mol L}^{-1} \\text{s}^{-1}$."
  },
  {
    id: "pcm_static_3",
    chapter_id: "",
    question: "What is the derivative of $\\tan^{-1}(x)$ with respect to $x$?",
    options: {
      A: "$\\frac{1}{1+x^2}$",
      B: "$\\frac{1}{\\sqrt{1-x^2}}$",
      C: "$\\frac{-1}{1+x^2}$",
      D: "$\\frac{1}{x^2-1}$"
    },
    correct: "A",
    hint: "Use implicit differentiation on $y = \\tan^{-1}(x) \\implies x = \\tan(y)$.",
    explanation: "Differentiating $x = \\tan(y)$ gives $1 = \\sec^2(y) \\frac{dy}{dx} \\implies \\frac{dy}{dx} = \\frac{1}{\\sec^2(y)} = \\frac{1}{1+\\tan^2(y)} = \\frac{1}{1+x^2}$."
  },
  {
    id: "pcm_static_4",
    chapter_id: "",
    question: "Which law states that the total electric flux through a closed surface is equal to $\\frac{1}{\\varepsilon_0}$ times the enclosed charge?",
    options: {
      A: "Coulomb's Law",
      B: "Gauss's Law",
      C: "Ampere's Law",
      D: "Faraday's Law"
    },
    correct: "B",
    hint: "$\\Phi_E = \\oint \\vec{E} \\cdot d\\vec{A} = \\frac{q_{\\text{enc}}}{\\varepsilon_0}$.",
    explanation: "Gauss's Law relates the net electric flux through any hypothetical closed surface (Gaussian surface) to the net electric charge enclosed within that surface."
  },
  {
    id: "pcm_static_5",
    chapter_id: "",
    question: "According to IUPAC nomenclature, what is the systematic name of $\\text{CH}_3\\text{-CH}_2\\text{-CHO}$?",
    options: {
      A: "Propanone",
      B: "Propan-1-ol",
      C: "Propanal",
      D: "Propanoic acid"
    },
    correct: "C",
    hint: "The functional group is an aldehyde ($-\\text{CHO}$) attached to a 3-carbon chain.",
    explanation: "A 3-carbon aldehyde is named propanal ($-\\text{CHO}$ takes priority as C-1)."
  },
  {
    id: "pcm_static_6",
    chapter_id: "",
    question: "Find the distance of the point $(1, 2, 3)$ from the plane $2x + y - 2z + 4 = 0$.",
    options: {
      A: "$\\frac{2}{3}$",
      B: "$\\frac{4}{3}$",
      C: "$2$",
      D: "$\\frac{1}{3}$"
    },
    correct: "A",
    hint: "Perpendicular distance formula: $d = \\frac{|Ax_0 + By_0 + Cz_0 + D|}{\\sqrt{A^2 + B^2 + C^2}}$.",
    explanation: "$d = \\frac{|2(1) + 1(2) - 2(3) + 4|}{\\sqrt{2^2 + 1^2 + (-2)^2}} = \\frac{|2 + 2 - 6 + 4|}{\\sqrt{4 + 1 + 4}} = \\frac{|2|}{3} = \\frac{2}{3}$."
  },
  {
    id: "pcm_static_7",
    chapter_id: "",
    question: "What is the root mean square (rms) speed of gas molecules proportional to?",
    options: {
      A: "$\\sqrt{T}$",
      B: "$T$",
      C: "$T^2$",
      D: "$\\frac{1}{T}$"
    },
    correct: "A",
    hint: "Formula for rms velocity: $v_{\\text{rms}} = \\sqrt{\\frac{3RT}{M}}$.",
    explanation: "From kinetic theory of gases, $v_{\\text{rms}} = \\sqrt{\\frac{3RT}{M}}$, which shows $v_{\\text{rms}} \\propto \\sqrt{T}$ where $T$ is absolute temperature."
  },
  {
    id: "pcm_static_8",
    chapter_id: "",
    question: "What is the principal value of $\\sin^{-1}\\left(-\\frac{1}{2}\\right)$?",
    options: {
      A: "$-\\frac{\\pi}{6}$",
      B: "$\\frac{5\\pi}{6}$",
      C: "$-\\frac{\\pi}{3}$",
      D: "$\\frac{7\\pi}{6}$"
    },
    correct: "A",
    hint: "The principal value branch of $\\sin^{-1}(x)$ is $\\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$.",
    explanation: "Since $\\sin\\left(-\\frac{\\pi}{6}\\right) = -\\frac{1}{2}$ and $-\\frac{\\pi}{6} \\in \\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$, the principal value is $-\\frac{\\pi}{6}$."
  },
  {
    id: "pcm_static_9",
    chapter_id: "",
    question: "Which of the following coordination compounds exhibits optical isomerism?",
    options: {
      A: "$[\\text{Co}(\\text{NH}_3)_6]^{3+}$",
      B: "cis-$[\\text{Co}(\\text{en})_2\\text{Cl}_2]^+$",
      C: "trans-$[\\text{Co}(\\text{en})_2\\text{Cl}_2]^+$",
      D: "$[\\text{Ni}(\\text{CN})_4]^{2-}$"
    },
    correct: "B",
    hint: "Check for non-superimposable mirror images and absence of a plane of symmetry.",
    explanation: "cis-$[\\text{Co}(\\text{en})_2\\text{Cl}_2]^+$ lacks a plane of symmetry and forms non-superimposable mirror images (dextro and laevo forms). trans-$[\\text{Co}(\\text{en})_2\\text{Cl}_2]^+$ has a plane of symmetry and is optically inactive."
  },
  {
    id: "pcm_static_10",
    chapter_id: "",
    question: "What is the magnetic force on a moving charge $q$ with velocity $\\vec{v}$ in a magnetic field $\\vec{B}$?",
    options: {
      A: "$\\vec{F} = q(\\vec{v} \\times \\vec{B})$",
      B: "$\\vec{F} = q(\\vec{v} \\cdot \\vec{B})$",
      C: "$\\vec{F} = \\frac{q}{\\vec{v} \\times \\vec{B}}$",
      D: "$\\vec{F} = q(\\vec{B} \\times \\vec{v})$"
    },
    correct: "A",
    hint: "Lorentz magnetic force is perpendicular to both velocity and magnetic field.",
    explanation: "The magnetic force on a moving charge is given by $\\vec{F} = q(\\vec{v} \\times \\vec{B})$, directed perpendicular to the plane containing $\\vec{v}$ and $\\vec{B}$."
  }
];

export const STATIC_PCB_QUESTIONS: QuizQuestion[] = [
  {
    id: "pcb_static_1",
    chapter_id: "",
    question: "Where does light reaction of photosynthesis take place inside a plant cell?",
    options: {
      A: "Stroma of chloroplast",
      B: "Thylakoid membrane (Grana)",
      C: "Mitochondrial matrix",
      D: "Cytoplasm"
    },
    correct: "B",
    hint: "Photosystems I & II and ATP synthase are located in these membranes.",
    explanation: "Light-dependent reactions occur in the thylakoid membranes (grana) of chloroplasts, where chlorophyll pigments absorb sunlight to produce ATP and NADPH. Dark reaction (Calvin cycle) occurs in the stroma."
  },
  {
    id: "pcb_static_2",
    chapter_id: "",
    question: "What is the structural and functional unit of the human kidney?",
    options: {
      A: "Neuron",
      B: "Nephron",
      C: "Alveolus",
      D: "Hepatocyte"
    },
    correct: "B",
    hint: "Each human kidney contains approximately 1 million of these filtering units.",
    explanation: "The nephron is the microscopic structural and functional unit of the kidney, consisting of a renal corpuscle (Bowman's capsule + glomerulus) and renal tubule."
  },
  {
    id: "pcb_static_3",
    chapter_id: "",
    question: "Which hormone is responsible for maintaining the corpus luteum and pregnancy during early gestation?",
    options: {
      A: "Progesterone & hCG",
      B: "Oxytocin",
      C: "Prolactin",
      D: "Thyroxine"
    },
    correct: "A",
    hint: "Human chorionic gonadotropin (hCG) signals corpus luteum to secrete this steroid hormone.",
    explanation: "hCG produced by trophoblasts maintains the corpus luteum, which secretes progesterone essential for endometrial growth and pregnancy maintenance."
  },
  {
    id: "pcb_static_4",
    chapter_id: "",
    question: "In DNA structure according to Watson-Crick model, how many hydrogen bonds link Guanine (G) and Cytosine (C)?",
    options: {
      A: "1",
      B: "2",
      C: "3",
      D: "4"
    },
    correct: "C",
    hint: "Adenine and Thymine share 2 hydrogen bonds; G and C share more.",
    explanation: "Guanine pairs with Cytosine via 3 hydrogen bonds ($G \\equiv C$), making G-C rich DNA regions thermally more stable than A-T rich regions (which have 2 hydrogen bonds)."
  },
  {
    id: "pcb_static_5",
    chapter_id: "",
    question: "Which functional group is formed when an alcohol reacts with a carboxylic acid in the presence of concentrated $\\text{H}_2\\text{SO}_4$?",
    options: {
      A: "Ether",
      B: "Ester",
      C: "Ketone",
      D: "Amide"
    },
    correct: "B",
    hint: "This reaction is known as Fischer Esterification and produces fruity smells.",
    explanation: "$\\text{R-COOH} + \\text{R'-OH} \\xrightarrow{\\text{H}^+} \\text{R-COOR'} + \\text{H}_2\\text{O}$. An ester is formed."
  },
  {
    id: "pcb_static_6",
    chapter_id: "",
    question: "What is the SI unit of electric dipole moment?",
    options: {
      A: "Coulomb-meter (C·m)",
      B: "Coulomb per meter (C/m)",
      C: "Newton-meter (N·m)",
      D: "Volt-meter (V·m)"
    },
    correct: "A",
    hint: "Dipole moment $\\vec{p} = q \\cdot (2\\vec{a})$.",
    explanation: "Electric dipole moment $p = q \\times 2a$, where charge $q$ is in Coulombs (C) and separation $2a$ is in meters (m), giving unit $\\text{C} \\cdot \\text{m}$."
  },
  {
    id: "pcb_static_7",
    chapter_id: "",
    question: "What is the phenotypic ratio in the F2 generation of a classic Mendelian dihybrid cross?",
    options: {
      A: "3 : 1",
      B: "9 : 3 : 3 : 1",
      C: "1 : 2 : 1",
      D: "9 : 7"
    },
    correct: "B",
    hint: "Product rule of two independent monohybrid crosses $(3:1) \\times (3:1)$.",
    explanation: "Cross of two heterozygous individuals ($RrYy \\times RrYy$) yields a 9:3:3:1 phenotypic ratio (9 dominant-dominant, 3 dominant-recessive, 3 recessive-dominant, 1 recessive-recessive)."
  },
  {
    id: "pcb_static_8",
    chapter_id: "",
    question: "What is the focal length of a thin convex lens of power $+5\\text{ D}$?",
    options: {
      A: "$+20\\text{ cm}$",
      B: "$+50\\text{ cm}$",
      C: "$-20\\text{ cm}$",
      D: "$+5\\text{ cm}$"
    },
    correct: "A",
    hint: "Lens power $P = \\frac{1}{f \\text{ (in meters)}}$.",
    explanation: "$f = \\frac{1}{P} = \\frac{1}{+5} \\text{ m} = +0.2 \\text{ m} = +20 \\text{ cm}$."
  },
  {
    id: "pcb_static_9",
    chapter_id: "",
    question: "Which element is central to the ring structure of the chlorophyll molecule?",
    options: {
      A: "Iron (Fe)",
      B: "Magnesium (Mg)",
      C: "Copper (Cu)",
      D: "Zinc (Zn)"
    },
    correct: "B",
    hint: "Hemoglobin has central Fe, while chlorophyll has central...",
    explanation: "Chlorophyll contains a porphyrin ring with a central Magnesium ($Mg^{2+}$) ion bound to four nitrogen atoms."
  },
  {
    id: "pcb_static_10",
    chapter_id: "",
    question: "What is the oxidation state of Chromium in $\\text{K}_2\\text{Cr}_2\\text{O}_7$?",
    options: {
      A: "+3",
      B: "+6",
      C: "+7",
      D: "+4"
    },
    correct: "B",
    hint: "$2(+1) + 2(x) + 7(-2) = 0$.",
    explanation: "$2 + 2x - 14 = 0 \\implies 2x = 12 \\implies x = +6$."
  }
];

export function getStaticFallbackQuestions(profession: "pcm" | "pcb" | string, count: number): QuizQuestion[] {
  const pool = profession === "pcb" ? STATIC_PCB_QUESTIONS : STATIC_PCM_QUESTIONS;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const result: QuizQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const item = shuffled[i % shuffled.length];
    result.push({
      ...item,
      id: `static_${profession}_${Date.now()}_${i}`,
    });
  }
  return result;
}
