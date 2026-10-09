export type PromptProjectCategory = 'Web app' | 'Interactive prototype' | 'Design and animation' | 'Presentation and guide' | 'Portfolio website';
export type PromptProject = {
  id: string;
  name: string;
  category: PromptProjectCategory;
  platform: string;
  description: string;
  url: string;
  featured: boolean;
};

export const promptProjectCreation = 'Created entirely through AI prompts, not manually coded.';
export const promptProjectEvidence = 'Owner-supplied Handshake AI project details. Capabilities are owner-reported, not independently tested. Some external links may require sign-in.';

/** One entry per supplied project; the two resume-website entries share one URL. */
export const promptProjects: PromptProject[] = [
  {
    id: 'animate-line-icons', name: 'Animate Line Icons', category: 'Design and animation', platform: 'Figma',
    description: 'A vector-icon animation design with coordinated stroke timing, shared easing and a dark frame.',
    url: 'https://www.figma.com/design/FLqlKACYVQqXbU5xbJsSxR/Untitled', featured: false,
  },
  {
    id: 'personal-photo-gallery', name: 'Personal Photo Gallery', category: 'Interactive prototype', platform: 'Figma Make',
    description: 'An interactive photo-gallery prototype with slide transitions, drag and swipe navigation, keyboard controls, autoplay and a thumbnail strip.',
    url: 'https://www.figma.com/make/iAM3V8t1aKtIVb65oj01v9/Build-interactive-slider', featured: true,
  },
  {
    id: 'draw-to-sticker-pack', name: 'Draw to Sticker Pack', category: 'Design and animation', platform: 'Figma',
    description: 'A sketch-to-sticker illustration workflow using a square canvas and AI-assisted illustration refinement.',
    url: 'https://www.figma.com/design/zkrCwGZQrtYGTIKRkFMd67/Untitled', featured: false,
  },
  {
    id: 'gamma-deck-guide', name: 'Build, Extend and Share a Gamma Deck', category: 'Presentation and guide', platform: 'Gamma',
    description: 'A practical presentation guide covering source material, charts, AI summaries, speaker notes, rehearsal and translation.',
    url: 'https://gamma.app/docs/Build-extend-and-share-a-Gamma-deck-3wdyuduhno9hj1h', featured: false,
  },
  {
    id: 'forma', name: 'Forma', category: 'Web app', platform: 'Lovable',
    description: 'A browser-based design tool for mood boards, annotated references, written design briefs and three-screen phone mockups.',
    url: 'https://lovable.dev/preview/ipQ8fAsH89iEvUjGR00KNEbzCjmF9nEZ', featured: true,
  },
  {
    id: 'lunchpad-creator', name: 'Lunchpad Creator', category: 'Web app', platform: 'Lovable',
    description: 'A product-launch page with a product pitch, device mockups, an email waitlist, validation and signup confirmation.',
    url: 'https://lovable.dev/preview/qCVgHDUvO0naC9K630yT0T35Vw8ipSml', featured: false,
  },
  {
    id: 'smarthire-ai', name: 'SmartHire AI', category: 'Presentation and guide', platform: 'Gamma',
    description: 'A hiring-team pilot pitch deck with audience-specific messaging and a real-results measurement plan instead of invented numbers. This is a presentation, not a working hiring product.',
    url: 'https://gamma.app/docs/SmartHire-AI-pgbsb0ibqh0zamn', featured: true,
  },
  {
    id: 'targeted-resume-website', name: 'Targeted Resume Website', category: 'Portfolio website', platform: 'Replit',
    description: 'This public career portfolio and private preparation workspace, including resume versions, job tracking, job-description comparison, interview drafts and fact-review safeguards.',
    url: 'https://targeted-resume-website.replit.app/', featured: false,
  },
  {
    id: 'applyflow-ai-studio', name: 'ApplyFlow AI Studio', category: 'Web app', platform: 'Google AI Studio',
    description: 'An AI-assisted job-search workspace for parsing job descriptions, tailoring resume wording and applying standing writing preferences. Automated application submission is not established by the supplied description.',
    url: 'https://ai.studio/apps/40df71af-4d52-4863-b6b0-5f4403267118', featured: true,
  },
  {
    id: 'event-launch-kit', name: 'Event Launch Kit', category: 'Web app', platform: 'Replit',
    description: 'A perfume-event launch tool for publishing events, showcasing fragrances, managing private RSVPs and downloading promotional materials.',
    url: 'https://event-launch-kit-kkbhoi09.replit.app/', featured: true,
  },
  {
    id: 'quickdraw', name: 'Quickdraw', category: 'Web app', platform: 'Netlify (hosting)',
    description: 'A multiplayer party-game project for 2-8 players using room codes, humorous prompts and voting. The creation tool is not specified; Netlify is the supplied hosting platform.',
    url: 'https://incredible-tanuki-1cc31c.netlify.app/', featured: false,
  },
];

export const featuredPromptProjects = promptProjects.filter((project) => project.featured);
