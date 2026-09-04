/**
 * Topper AI Offline & Resilience Assistant Module.
 * Provides instant, high-quality NCERT tutoring and app navigation help when primary AI keys
 * are unconfigured or temporarily unreachable.
 */

export function getOfflineAssistantResponse(userQuery: string): string {
  const q = userQuery.toLowerCase().trim();

  // 0. Greetings & Friendly Inquiries
  if (/^(hi|hii|hello|hey|hey there|ho|namaste|topper|topper ai|bot|help)$/i.test(q) || q.length <= 3) {
    return `### **Namaste! I am Topper AI** ✨

Your dedicated **NCERT Tutor** for **IIT-JEE (PCM)** and **NEET (PCB)** prep, as well as your guide for the **Last Topper** app!

**How can I assist you right now?**
- ⚡ **Physics**: Kinetic Energy, Newton's Laws, Gauss Law, Projectile Motion, Nuclear Physics.
- 🧪 **Chemistry**: IUPAC Rules, Chemical Kinetics, Electrochemistry, Periodic Trends.
- 🧬 **Biology & Math**: Cell Nucleus, DNA Replication, Photosynthesis, Calculus.
- 🎯 **App Help**: Sunday Mega Test, Mistake Bank, Battle Arena, Pro Subscription.

*Type any concept or doubt to get instant high-yield notes and step-by-step solutions!*`;
  }

  // 1. App Feature Help
  if (q.includes("mega test") || q.includes("sunday mega")) {
    return `### **Sunday Mega Test (All-India Rank Exam)** 🏆

- **Schedule**: Every Sunday at **10:00 AM IST**.
- **Syllabus**: Full NCERT Class 11 & 12 Syllabus for JEE (PCM) and NEET (PCB).
- **Format**: 180 Questions with live All-India Leaderboards & percentile reports.
- **How to Enter**: Go to **Battle Arena** -> **Sunday Mega Test** tab and complete the quick registration steps to unlock your live ticket!`;
  }

  if (q.includes("pro") || q.includes("subscription") || q.includes("upgrade") || q.includes("price") || q.includes("cost")) {
    return `### **Last Topper Pro Subscription** 💎

Unlock unlimited practice, instant AI tutoring, and deep analytics:

- 🆓 **Free Plan**: 20 practice questions/day + 5 AI tutor messages/day.
- ⚡ **Pro Plan**:
  - **Unlimited Practice Questions & Quizzes**
  - **Unlimited Topper AI Chat & 1-Click Handwritten Notes**
  - **Step-by-Step Worked Solutions for Every Question**
  - **Mistake Bank Auto-Sync & Spaced Repetition Review**
- **How to Upgrade**: Tap **Pro / Upgrade** in your top menu or visit /pricing.`;
  }

  if (q.includes("mistake bank") || q.includes("mistake") || q.includes("mistaken") || q.includes("wrong question")) {
    return `### **Mistake Bank & Spaced Repetition** 🎯

1. **Automatic Tracking**: Every question you answer incorrectly in Chapter Quizzes or Battle Arena is automatically added to your **Mistake Bank**.
2. **Accessing Your Bank**: Navigate to **Mistake Bank** from the bottom bar or left sidebar menu.
3. **Practice & Master**: Filter mistakes by Subject/Chapter and launch targeted practice sessions until your accuracy reaches 100%!`;
  }

  if (q.includes("daily challenge") || q.includes("daily test")) {
    return `### **Daily NCERT Challenge** 🔥

- **Refreshes**: Every night at **12:00 AM IST** with 10 fresh NCERT questions.
- **Rewards**: Earn Streak Bonuses, XP, and top rank points on the **Daily Leaderboard**.
- **Keep Your Streak**: Complete today's 10 questions before midnight!`;
  }

  // 2. Physics NCERT Doubts
  if (q.includes("kinetic energy") || q.includes("kinetic") || (q.includes("energy") && q.includes("formula"))) {
    return `### **Kinetic Energy (NCERT Physics Class 11, Chap 6: Work, Energy & Power)**

**Definition**: Kinetic energy ($K$ or $KE$) is the energy possessed by an object due to its motion.

#### **1. Main Formula (Translational Kinetic Energy)**
$$K = \\frac{1}{2} m v^2$$
*where $m$ = mass of the body (kg), $v$ = speed of the body (m/s).*

#### **2. Relation with Linear Momentum ($p = mv$)**
$$K = \\frac{p^2}{2m} \\quad \\text{or} \\quad p = \\sqrt{2mK}$$
* High-Yield NCERT Tip: If two bodies of masses $m_1$ and $m_2$ have the same momentum, the lighter body has higher kinetic energy ($K \\propto \\frac{1}{m}$).*

#### **3. Work-Energy Theorem**
The net work done by all forces on a particle equals the change in its kinetic energy:
$$W_{\\text{net}} = \\Delta K = K_f - K_i = \\frac{1}{2} m v^2 - \\frac{1}{2} m u^2$$

#### **4. Rotational Kinetic Energy (Rigid Bodies)**
$$K_{\\text{rot}} = \\frac{1}{2} I \\omega^2$$
*(where $I$ = moment of inertia, $\\omega$ = angular velocity).*`;
  }

  if (q.includes("nucleus") || q.includes("nuclear physics") || q.includes("atomic nucleus")) {
    return `### **NCERT Summary: Nucleus (Biology & Physics)**

---

#### 🧬 **1. Biology: Cell Nucleus (Class 11, Chap 8)**
- **Discovery**: Discovered by **Robert Brown** (1831). Material named **chromatin** by **W. Flemming**.
- **Structure**:
  - **Nuclear Envelope**: Double membrane with perinuclear space (10–50 nm) and nuclear pores for bidirectional transport of RNA and proteins.
  - **Nucleoplasm**: Contains the **nucleolus** (non-membrane bound, site for active **rRNA synthesis**) and **chromatin** (DNA + basic **histone** proteins).

---

#### ⚛️ **2. Physics: Atomic Nucleus (Class 12, Chap 13)**
- **Composition**: Nucleons = Protons ($Z$) + Neutrons ($N$). Mass Number $A = Z + N$.
- **Nuclear Radius Formula**:
  $$R = R_0 A^{1/3} \\quad (R_0 \\approx 1.2 \\times 10^{-15} \\text{ m} = 1.2 \\text{ fm})$$
- **Nuclear Density**: Constant for all nuclei ($\\approx 2.3 \\times 10^{17} \\text{ kg/m}^3$), **independent** of mass number $A$.
- **Binding Energy ($BE$)**:
  $$\\Delta m = [Z m_p + (A - Z) m_n] - M_{\\text{nucleus}}$$
  $$BE = \\Delta m \\cdot c^2 = \\Delta m \\times 931.5 \\text{ MeV}$$`;
  }

  if (q.includes("gauss")) {
    return `### **Gauss's Law (NCERT Physics Class 12, Chap 1)**

**Statement**: The net electric flux $\\Phi_E$ through any closed Gaussian surface equals $\\frac{1}{\\varepsilon_0}$ times the net charge $q_{\\text{enc}}$ enclosed:
$$\\Phi_E = \\oint \\vec{E} \\cdot d\\vec{A} = \\frac{q_{\\text{enc}}}{\\varepsilon_0}$$

**High-Yield Applications**:
1. **Infinitely long straight wire**: $E = \\frac{\\lambda}{2\\pi \\varepsilon_0 r}$
2. **Infinite plane sheet of charge**: $E = \\frac{\\sigma}{2\\varepsilon_0}$
3. **Thin spherical shell** (radius $R$):
   - Inside ($r < R$): $E = 0$
   - Outside ($r \\ge R$): $E = \\frac{1}{4\\pi \\varepsilon_0} \\frac{q}{r^2}$`;
  }

  if (q.includes("newton") || q.includes("laws of motion")) {
    return `### **Newton's Laws of Motion (NCERT Physics Class 11, Chap 5)**

1. **First Law (Inertia)**: A body remains at rest or in uniform motion unless acted upon by a net external force.
2. **Second Law**: Net force equals rate of change of linear momentum:
   $$\\vec{F} = \\frac{d\\vec{p}}{dt} = m \\vec{a}$$
3. **Third Law**: Action and reaction are equal and opposite ($\\,\\vec{F}_{AB} = -\\vec{F}_{BA}\\,$).`;
  }

  if (q.includes("projectile") || q.includes("trajectory")) {
    return `### **Projectile Motion Formulas (NCERT Physics Class 11)**

For initial speed $u$ at angle $\\theta$ to horizontal:
- **Time of Flight**: $T = \\frac{2u \\sin\\theta}{g}$
- **Maximum Height**: $H = \\frac{u^2 \\sin^2\\theta}{2g}$
- **Horizontal Range**: $R = \\frac{u^2 \\sin(2\\theta)}{g}$
- **Max Range Angle**: $\\theta = 45^\\circ \\implies R_{\\text{max}} = \\frac{u^2}{g}$`;
  }

  if (q.includes("ohm") || q.includes("resistance")) {
    return `### **Ohm's Law & Resistance (NCERT Physics Class 12)**

**Ohm's Law**: $V = IR \\implies R = \\frac{V}{I}$

**Resistivity Relation**:
$$R = \\rho \\frac{l}{A}$$
*where $\\rho$ = resistivity ($\\Omega \\cdot \\text{m}$), $l$ = length, $A$ = cross-sectional area.*`;
  }

  // 3. Chemistry NCERT Doubts
  if (q.includes("iupac") || q.includes("naming") || q.includes("organic")) {
    return `### **IUPAC Organic Nomenclature Rules (NCERT Chemistry Class 11)**

1. **Longest Chain Rule**: Select principal carbon chain containing main functional group.
2. **Lowest Locant**: Number to give lowest locants to principal functional group, multiple bonds, then substituents.
3. **Functional Group Priority Order**:
   $$-\\text{COOH} > -\\text{SO}_3\\text{H} > -\\text{COOR} > -\\text{COCl} > -\\text{CONH}_2 > -\\text{CN} > -\\text{CHO} > >\\text{C=O} > -\\text{OH} > -\\text{NH}_2 > >\\text{C=C}< > -\\text{C}\\equiv\\text{C}-$$`;
  }

  if (q.includes("kinetics") || q.includes("zero order") || q.includes("first order")) {
    return `### **Chemical Kinetics Formulas (NCERT Chemistry Class 12)**

- **Zero-Order Reaction**:
  - Integrated Rate Law: $[A] = [A]_0 - kt$
  - Half-life: $t_{1/2} = \\frac{[A]_0}{2k}$

- **First-Order Reaction**:
  - Integrated Rate Law: $k = \\frac{2.303}{t} \\log_{10} \\left(\\frac{[A]_0}{[A]}\\right)$
  - Half-life: $t_{1/2} = \\frac{0.693}{k}$ *(independent of initial concentration)*`;
  }

  // 4. Biology / Math NCERT Doubts
  if (q.includes("photosynthesis") || q.includes("calvin")) {
    return `### **Photosynthesis (NCERT Biology Class 11)**

1. **Light Reaction (Grana/Thylakoid)**: Photolysis of water ($2\\text{H}_2\\text{O} \\to 4\\text{H}^+ + 4e^- + \\text{O}_2$) yields ATP & NADPH.
2. **Dark Reaction (Stroma)**: Calvin cycle fixes $\\text{CO}_2$ using RuBisCO into glucose. Primary acceptor in $C_3$ plants is RuBP.`;
  }

  if (q.includes("dna") || q.includes("replication")) {
    return `### **DNA & Replication (NCERT Biology Class 12)**

- **Double Helix**: Watson & Crick model ($A=T$ with 2 H-bonds, $G \\equiv C$ with 3 H-bonds).
- **Semi-Conservative Replication**: DNA Polymerase synthesizes in $5' \\to 3'$ direction. Proven by Meselson & Stahl.`;
  }

  if (q.includes("calculus") || q.includes("derivative") || q.includes("integral")) {
    return `### **Calculus Standard Formulas (NCERT Math Class 11 & 12)**

- **Derivatives**:
  - $\\frac{d}{dx}(x^n) = n x^{n-1}, \\quad \\frac{d}{dx}(\\sin x) = \\cos x, \\quad \\frac{d}{dx}(e^x) = e^x$
- **Integrals**:
  - $\\int x^n dx = \\frac{x^{n+1}}{n+1} + C, \\quad \\int \\frac{1}{x} dx = \\ln|x| + C, \\quad \\int e^x dx = e^x + C$`;
  }

  // Default clean NCERT Assistant response
  return `### **Topper AI — NCERT Tutor** ✨

I am ready to solve any doubt or explain concepts from **NCERT Physics, Chemistry, Mathematics, and Biology (Class 11 & 12)** for **IIT-JEE** and **NEET** prep.

**Try asking me about:**
- ⚡ **Physics**: *"What is kinetic energy formula?"*, *"Explain Gauss law"*, *"Projectile range formula"*.
- 🧪 **Chemistry**: *"IUPAC priority order"*, *"First order reaction kinetics"*, *"Electrochemistry"*.
- 🧬 **Biology & Math**: *"Structure of Nucleus"*, *"DNA replication steps"*, *"Integration formulas"*.
- 🎯 **App Help**: *"How to use Mistake Bank?"*, *"Sunday Mega Test timing"*, *"Pro subscription features"*.`;
}
