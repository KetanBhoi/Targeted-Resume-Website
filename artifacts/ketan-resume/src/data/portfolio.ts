export const portfolio = {
  name: "Ketan Kaushikbhai Bhoi",
  targetRole: "Recruiter / Talent Acquisition",
  positioning:
    "An early-career recruiter candidate bringing structured evaluation, detail-minded operations, and technology fluency.",
  context:
    "The resume documents IT education and software-development experience, not prior recruiting work. The strengths below are transferable evidence, not claims of recruiting experience.",
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
  ],
  experiences: [
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
  ],
  skills: [
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