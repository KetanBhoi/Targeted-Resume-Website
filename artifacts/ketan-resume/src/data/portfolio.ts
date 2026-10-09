export const portfolio = {
  name: "Ketan Kaushikbhai Bhoi",
  targetRole: "IT Recruiter & AI-Assisted Web Developer | Prompt Engineering",
  positioning:
    "An early-career professional with current freelance design and AI evaluation experience, a background in software development, and goals in IT recruitment and AI-assisted web development through prompt engineering.",
  context:
    "Freelance Designer & AI Evaluation Specialist at Handshake AI since May 2026, alongside earlier web-development roles. IT recruitment and AI-assisted web development are target career paths, not prior job titles. Direct IT-recruiting employment and paid AI-assisted web-development employment are not documented.",
  strengths: [
    {
      title: "Structured evaluation",
      detail:
        "Lists LLM output review and quality assessment, test-case design for AI responses, bias and consistency checking, structured feedback and annotation, and comparative model testing.",
      proof: "AI / LLM Evaluation skills",
      section: "skills",
    },
    {
      title: "Detail-minded operations",
      detail:
        "Sorted and organized files, spreadsheets, and reports while supporting staff with daily tasks.",
      proof: "Web Developer Intern, Jinarth Infotech · May–June 2025",
      section: "experience",
    },
    {
      title: "Technology fluency",
      detail:
        "B.Tech in Information Technology; built vendor- and customer-facing modules for a multivendor commerce product and integrated REST APIs.",
      proof: "Education and MERN Stack Web Developer, Haronex Technology · Jan–April 2026",
      section: "projects",
    },
    {
      title: "AI-assisted web development",
      detail:
        "Lists Prompt Engineering and LLM quality review as skills. The owner supplied 11 unique Handshake AI projects and states that they were created entirely through prompts, including web apps, prototypes, design work and presentations.",
      proof: "Handshake AI project profile (owner-reported)",
      section: "projects",
    },
  ],
  experiences: [
    {
      title: "Freelance Designer & AI Evaluation Specialist",
      company: "Handshake AI",
      dates: "May 2026 – Present",
      bullets: [
        "Works as a freelance designer and AI evaluation specialist at Handshake AI.",
        "Reports creating all 11 supplied profile projects entirely through prompts; their paid/client status is not specified.",
      ],
    },
    {
      title: "MERN Stack Web Developer",
      company: "Haronex Technology",
      dates: "January 2026 – April 2026",
      bullets: [
        "Developed MetroMart, a multivendor e-commerce website using MongoDB, Express.js, React.js, and Node.js.",
        "Built vendor- and customer-facing modules, including product listings, cart, and order management for multiple vendors.",
        "Implemented RESTful APIs and integrated front-end components with backend services.",
      ],
    },
    {
      title: "Intern, Web Developer",
      company: "Jinarth Infotech",
      dates: "May 2025 – June 2025",
      bullets: [
        "Supported staff members with daily tasks, helping reduce workload burden and allowing more focus on higher-priority assignments.",
        "Sorted and organized files, spreadsheets, and reports.",
        "Applied learned concepts in relevant work situations and gained hands-on experience with software programs.",
      ],
    },
  ],
  projects: [
    {
      name: "MetroMart",
      kind: "Multivendor e-commerce website",
      context: "Built during the MERN Stack Web Developer role at Haronex Technology.",
      problem:
        "The resume describes a multivendor commerce product for vendors and customers; it does not name a more specific business pain point.",
      contribution:
        "Developed vendor and customer modules for product listings, carts, and multi-vendor order management; implemented RESTful APIs and connected frontend and backend services.",
      outcome:
        "Delivered the listed vendor/customer workflows and API integration. The resume provides no launch, usage, or performance metrics.",
      tools: ["MongoDB", "Express.js", "React.js", "Node.js", "REST APIs"],
      link: null,
      section: "experience",
    },
    {
      name: "This portfolio (current work sample)",
      kind: "AI-assisted web development work sample",
      context: "Current project, built through prompts in Replit. Not part of the Haronex Technology or Jinarth Infotech roles.",
      problem:
        "Presents two career focus areas, IT recruiter and AI-assisted web developer, with documented evidence for each.",
      contribution:
        "Created this portfolio entirely through prompts in Replit. Its capabilities include a public page in English, Hindi, and Gujarati, role views, a one-page brief PDF, a resume Q&A, and a signed-in private workspace.",
      outcome:
        "Observable as the site you are viewing. Additional owner-supplied project links are listed below. No launch date, customer counts or published results are documented; no source-code repository is supplied.",
      tools: ["Replit", "Prompt engineering", "React.js"],
      link: "https://targeted-resume-website.replit.app/",
      section: "projects",
    },
  ],
  skills: [
    {
      group: "AI-assisted web development",
      items: ["Prompt engineering", "Prompt-driven building in Replit", "LLM output review and quality assessment"],
    },
    {
      group: "AI / LLM evaluation",
      items: [
        "Prompt engineering",
        "LLM output review and quality assessment",
        "Test-case design for AI responses",
        "Bias and consistency checking",
        "Structured feedback and annotation",
        "Comparative model testing",
      ],
    },
    {
      group: "Programming and web",
      items: [
        "HTML",
        "CSS",
        "JavaScript",
        "Node.js",
        "React.js",
        "Tailwind CSS",
        "RESTful APIs",
        "Python",
        "Java",
        "SQL",
      ],
    },
    {
      group: "Tools and platforms",
      items: ["Git", "Linux shell scripting", "Google Cloud fundamentals"],
    },
  ],
  softSkills: [
    "Communication",
    "Collaboration and teamwork",
    "Active listening",
    "Analytical and detail-oriented thinking",
    "Time management",
    "Fast learner",
    "Leadership quality",
  ],
  education: [
    {
      credential: "Bachelor of Technology (Information Technology)",
      institution:
        "Madhuben and Bhanubhai Patel Institute of Technology – CVM University",
      completed: "June 2026",
      result: "CGPA 7.58 · SGPA 8.00",
    },
    {
      credential: "Higher Secondary Education",
      institution: "CVM Higher Secondary School",
      completed: "February 2022",
      result: null,
    },
  ],
  certificates: [
    "Networking in Google Cloud: Fundamentals",
    "Introduction to Object-Oriented Programming with Java",
    "Java Class Library",
    "Hands-On Introduction to Linux Commands and Shell Scripting",
    "Introduction to Java",
  ],
  publicLinks: {
    linkedin: "https://www.linkedin.com/in/ketan-bhoi-b591a5331" as string | null,
    github: null as string | null,
    additional: [] as { label: string; url: string }[],
  },
  publicContact: { label: "Email", url: "mailto:kkbhoi09@gmail.com" } as { label: string; url: string } | null,
};

export type PortfolioSection =
  | "about"
  | "role-fit"
  | "experience"
  | "projects"
  | "skills"
  | "education";