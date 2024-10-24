import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from "../../utils/logger.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import { JSDOM } from 'jsdom'


dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);




const genAI = new GoogleGenerativeAI(process.env.Google_GEMNI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });


export const generateBlogFromText = async (transcribedText, blogType, blogTone) => {


    try {
        // Complete blog type descriptions
        const typeDescriptions = {
            technical: {
                description: "Transform complex technical concepts into an engaging tutorial that feels like a knowledgeable friend explaining things over coffee.",
                mustInclude: [
                    "Real debugging stories",
                    "Common pitfalls and solutions",
                    "Practical tips from experience",
                    "Code explanations with context",
                    "Performance insights",
                    "Security considerations",
                    "Scalability lessons",
                    "Testing strategies",
                    "Development environment setup",
                    "Troubleshooting guides",
                    "Best practices from real projects",
                    "Resource optimization tips"
                ]
            },
            personal: {
                description: "Share an authentic personal journey that resonates emotionally and inspires others.",
                mustInclude: [
                    "Specific moments and details",
                    "Emotional journey",
                    "Key decision points",
                    "Personal revelations",
                    "Challenges faced",
                    "Lessons learned",
                    "Growth moments",
                    "Reader connection points",
                    "Vulnerable admissions",
                    "Success celebrations",
                    "Failure insights",
                    "Future aspirations"
                ]
            },
            industry: {
                description: "Break down industry trends with insider insights and data-driven forecasts.",
                mustInclude: [
                    "Market trend analysis",
                    "Expert predictions",
                    "Data-backed insights",
                    "Industry insider views",
                    "Company case examples",
                    "Market opportunities",
                    "Risk assessments",
                    "Competitive analysis",
                    "Innovation insights",
                    "Future scenarios",
                    "Economic impacts",
                    "Strategic recommendations"
                ]
            },
            howTo: {
                description: "Create clear, practical guides that feel like having an expert by your side.",
                mustInclude: [
                    "Prerequisites and materials",
                    "Step-by-step instructions",
                    "Common mistakes to avoid",
                    "Expert tips and tricks",
                    "Time-saving shortcuts",
                    "Troubleshooting guide",
                    "Alternative approaches",
                    "Success indicators",
                    "Safety warnings",
                    "Cost considerations",
                    "Maintenance tips",
                    "Advanced variations"
                ]
            },
            lifestyle: {
                description: "Explore and share insights into daily living, personal interests, and wellness practices that enhance life experiences.",
                mustInclude: [
                    "Tips for balancing work and life",
                    "Personal anecdotes",
                    "Recommendations for products or services",
                    "Engaging storytelling",
                    "Practical advice",
                    "Wellness strategies",
                    "Lifestyle hacks",
                    "Cultural reflections",
                    "Hobbies and passions",
                    "Seasonal activities",
                    "Community involvement"
                ]
            },
            research: {
                description: "Present findings from studies and investigations, making complex data accessible and understandable to the audience.",
                mustInclude: [
                    "Research questions",
                    "Methodology",
                    "Data analysis",
                    "Findings",
                    "Implications of the research",
                    "Potential applications",
                    "Expert quotes",
                    "Limitations",
                    "Future research suggestions",
                    "Real-world examples",
                    "Visuals to support data"
                ]
            },
            news: {
                description: "Report on current events, trends, and updates in a specific field or industry, providing timely insights and analysis.",
                mustInclude: [
                    "Key facts and figures",
                    "Context for the news",
                    "Expert opinions",
                    "Potential impacts",
                    "Future implications",
                    "Relevant background information",
                    "Quotes from sources",
                    "Visual aids where appropriate"
                ]
            },
            caseStudy: {
                description: "Analyze specific instances or examples to illustrate a particular principle, outcome, or strategy in action.",
                mustInclude: [
                    "Background of the case",
                    "Objectives",
                    "Methodology",
                    "Findings",
                    "Implications",
                    "Lessons learned",
                    "Expert insights",
                    "Data supporting conclusions",
                    "Recommendations",
                    "Applications to broader contexts"
                ]
            },
            product: {
                description: "Review, compare, or highlight products with an emphasis on features, benefits, and user experience.",
                mustInclude: [
                    "Detailed descriptions of features",
                    "Pros and cons",
                    "User experiences",
                    "Comparison with similar products",
                    "Practical use cases",
                    "Pricing information",
                    "Recommendations for potential users",
                    "Any additional relevant insights"
                ]
            },
            opinion: {
                description: "Present thoughtful perspectives backed by experience and evidence.",
                mustInclude: [
                    "Clear stance",
                    "Supporting evidence",
                    "Personal experiences",
                    "Counter-arguments",
                    "Expert citations",
                    "Real-world examples",
                    "Historical context",
                    "Future implications",
                    "Ethical considerations",
                    "Practical impacts",
                    "Call for action"
                ]
            }
        };

        // Enhanced tone descriptions
        const toneDescriptions = {
            casual: {
                description: "Write like you're having coffee with a friend - relaxed and genuine.",
                stylistics: {
                    language: "Conversational, friendly, approachable",
                    sentences: "Short to medium, natural flow",
                    transitions: [
                        "You know what's interesting...",
                        "Here's the thing...",
                        "I've found that...",
                        "Let me share something..."
                    ],
                    expressions: [
                        "Honestly...",
                        "Truth be told...",
                        "Between you and me...",
                        "You won't believe this..."
                    ]
                }
            },
            professional: {
                description: "Maintain warmth while sharing expert knowledge - authoritative yet approachable.",
                stylistics: {
                    language: "Clear, precise, yet welcoming",
                    sentences: "Well-structured, balanced length",
                    transitions: [
                        "It's worth noting that...",
                        "Consider this perspective...",
                        "Let's examine...",
                        "This brings us to..."
                    ],
                    expressions: [
                        "In my experience...",
                        "Research suggests...",
                        "Industry experts confirm...",
                        "Data indicates..."
                    ]
                }
            },
            expert: {
                description: "Share deep expertise while remaining engaging and accessible.",
                stylistics: {
                    language: "Technical but explained clearly",
                    sentences: "Complex ideas broken down simply",
                    transitions: [
                        "A key insight here is...",
                        "This is crucial because...",
                        "Let me break this down...",
                        "Here's what makes this important..."
                    ],
                    expressions: [
                        "Based on extensive research...",
                        "My years in the field show...",
                        "A common misconception is...",
                        "What most people don't realize..."
                    ]
                }
            },
            storyDriven: {
                description: "Engage readers through narrative storytelling and compelling examples.",
                stylistics: {
                    language: "Narrative, descriptive, engaging",
                    sentences: "Varied length with narrative flow",
                    transitions: [
                        "Picture this scenario...",
                        "Here's where it gets interesting...",
                        "But that's not all...",
                        "This is where everything changed..."
                    ],
                    expressions: [
                        "Imagine for a moment...",
                        "Let me take you back...",
                        "Here's what happened next...",
                        "The story unfolds..."
                    ]
                }
            },
            analytical: {
                description: "Present information with logical analysis and evidence-based reasoning.",
                stylistics: {
                    language: "Precise, methodical, evidence-based",
                    sentences: "Well-structured with clear logical connections",
                    transitions: [
                        "Analysis shows that...",
                        "The data reveals...",
                        "When we examine...",
                        "Looking at the evidence..."
                    ],
                    expressions: [
                        "The findings indicate...",
                        "Upon careful analysis...",
                        "The results demonstrate...",
                        "Statistical evidence suggests..."
                    ]
                }
            }
        };

        // Prepare the prompt using the provided transcribed text, blog type, and tone
       const prompt = `
        Imagine you're having a casual conversation with a friend about this topic. 
        Transform this audio transcript into a relatable and engaging ${blogType} blog post.

        Here’s the transcribed text: 
        ${transcribedText}

        **IMPORTANT INSTRUCTIONS**:
        - **Include a proper title in <title> tags. This is mandatory.**
        - **Make sure the <title> is SEO-optimized and accurately reflects the blog content.**

        **SEO-Optimized Title**: Provide a catchy title that captures the essence of the blog.

        **Structure**:
       <title>[Your Main Title Here]</title>
        <article>
          <p>[Introductory paragraph with a hook that draws the reader in.]</p>
          
          <h2>[Major Section Title]</h2>
          <p>[Main content with logical flow, engaging style, and personal insights.]</p>
          
          <h3>[Subsection Title]</h3>
          <p>[Additional details, examples, or personal stories here.]</p>
        </article>

        **Tags**: 
        <span>[tag1], [tag2], [tag3], [tag4], [tag5]</span>

        **MUST-INCLUDE ELEMENTS**:
        ${typeDescriptions[blogType].mustInclude.map(item => `• ${item}`).join('\n')}

        **ORGANIZATION INSTRUCTIONS**:
        If the content appears disorganized, ensure to:
        1. Identify main themes or sections.
        2. Rearrange the content for logical flow.
        3. Use headings and subheadings for clarity.
        4. Ensure smooth transitions between sections.
        5. Use bullet points or lists for clarity where appropriate.

        **WRITING STYLE GUIDELINES**:
        - **Language**: ${toneDescriptions[blogTone].stylistics.language}
        - **Sentence Style**: ${toneDescriptions[blogTone].stylistics.sentences}

        **NATURAL TRANSITIONS TO USE**:
        ${toneDescriptions[blogTone].stylistics.transitions.join('\n')}

        **AUTHENTIC EXPRESSIONS**:
        ${toneDescriptions[blogTone].stylistics.expressions.join('\n')}

        **QUALITY CHECKS**:
        □ Title is in <title> tags  
        □ All content is within <article> tags  
        □ Tags are provided in the specified format  
`;

const result = await model.generateContent(prompt);
const responseText = await result.response.text();

const dom = new JSDOM(responseText);
const document = dom.window.document;

let title = null;

// Extract Title
const titleElement = document.querySelector('title');
if (titleElement) {
    title = titleElement.textContent.trim();
} else {
    console.warn("Title extraction failed. Attempting fallback title.");
    // Fallback to first heading or first part of article content
    const altTitleElement = document.querySelector('h1') || document.querySelector('h2') || document.querySelector('article p');
    if (altTitleElement) {
        title = altTitleElement.textContent.trim().substring(0, 50) + '...';
    } else {
        title = "Untitled Blog";
    }
}

// Extract Article Content
const articleElement = document.querySelector('article');
if (!articleElement) {
    console.error("Article content extraction failed.");
    return { title: "Error", content: "Failed to generate blog content.", tags: [] };
}
const articleString = articleElement.innerHTML.trim();

// Extract Tags
const tagsElement = document.querySelector('span');
let tagsArray = [];
if (tagsElement) {
    const tagsString = tagsElement.textContent;
    tagsArray = tagsString.split(',').map(tag => tag.trim());
} else {
    console.warn("Tag extraction failed. Defaulting to empty tags.");
}

return { title, content: articleString, tag: tagsArray };


    } catch (error) {

        logError(error, path.basename(__filename), generateBlogFromText)
        return {
            title: "Error",
            content: "Failed to generate blog content.",
            tags: ""
        };
    }
}
