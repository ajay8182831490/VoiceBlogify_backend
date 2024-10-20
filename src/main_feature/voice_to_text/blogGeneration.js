import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from "../../utils/logger.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import { JSDOM } from 'jsdom'

dotenv.config();




const genAI = new GoogleGenerativeAI(process.env.Google_GEMNI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/*export const generateBlogFromText = async (transcribedText,blogType,blogTone) => {
    try {
     console.log(blogType,blogTone,"inside the blog");

        const prompt = `
        Task: Generate a high-quality, professional blog post based on the provided transcribed audio content. The blog should reflect the speaker’s tone, style, and intent while being authentic, engaging, and informative. The output should be well-structured, reader-friendly, and include dynamic elements like bullet points, numbered lists, and relevant tags wherever applicable.

        Objective: Transform spoken audio content, such as podcasts, voice memos, or video transcriptions, into compelling, value-driven blog articles. The content should be easy to read, visually appealing, and optimized for maximum impact, providing readers with clear insights, actionable takeaways, and a smooth narrative flow that feels human-like. Ensure that the content stands out in the market by combining creativity, storytelling, and a personal touch.

        Guidelines:

        Title and Hook:

          Create a captivating title wrapped in <h1> tags.
          Craft a powerful hook in the first few sentences, wrapped in <p> tags, to grab the reader’s attention and include it within the <article> tag.
        Main Content:

        The main content should be wrapped in an <article> tag, with appropriate HTML elements such as <h2>, <h3>, <p>, <ul>, and <li>.
        Include <strong> tags to make important points bold.
        Use <br> tags to create line breaks where necessary to improve readability.

        Introduction:

        The introduction should be wrapped in <p> tags.
        Subsections:

       Use <h2> tags for main sections and <h3> for subsections.
      Lists:

      Use <ul> for unordered lists and <ol> for ordered lists, wrapping each item in <li> tags.
        If necessary, generate points or lists to highlight key concepts or steps.
        Conclusion:

        Wrap the conclusion in <p> tags.
        Tags:

        Generate tags as a comma-separated list wrapped in <span> tags.
        Content Structuring and Flow:

        Divide the content into logical sections using appropriate HTML tags like <h1>, <h2>, <h3>, and <p>.
        Use clear headings and subheadings to create an easy-to-follow structure.
        Break down complex ideas into concise paragraphs for better readability and flow.
        Value-Driven Content:

        Ensure the content provides practical value through tips, strategies, or insights that readers can implement.
        Include examples, real-life scenarios, or analogies to make the content more relatable and engaging.
        Tone, Style, and Personalization:

        Adapt the tone and style to match the speaker’s delivery (e.g., conversational, formal, inspirational).
        Use emotional language where appropriate to connect with readers on a deeper level.
        Highlight personal reflections and insights as bullet points where applicable.
        Human-Like Narrative Elements:
        Add rhetorical questions, personal reflections, or humorous anecdotes if applicable.
        Use transitional phrases to create a smooth flow between topics, making the article feel like a well-told story.
        Fact-Checking and Authenticity:
        Verify the accuracy of factual information such as statistics, dates, or references through reliable sources.
        Include hyperlinks to sources formatted as <a href="#">source</a>, where applicable.
        Content Summary:

        Write a concise conclusion that summarizes the key points of the article.
        Reinforce the core message or insight that the reader should take away.
        Conditional Call-to-Action (CTA):

         Include a CTA only if necessary and relevant to the context of the article.
        If a CTA is needed, it should be aligned with the article’s purpose (e.g., encourage readers to share their thoughts, apply the tips, or engage further).
        Use appropriate HTML tags (e.g., <strong>, <em>, or CTA buttons) to make the CTA visually distinct.
        Tag Generation:

         Generate 3 to 5 relevant tags for the article based on its core topics and subtopics.
        Tags should be descriptive and contextually appropriate for the content, using phrases that potential readers might search for (e.g.,“Leadership Strategies,” “Personal Development Tips,” “Marketing Trends”).
        Ensure that tags are short, concise, specific to the content’s focus, and separated by commas, and wrap them in <span> tags.

        *Input:*
        Transcribed Audio Content: ${transcribedText}

        Output format:
        1. Title: <title>
        2. Content: <article> (include <h1>, <h2>, <h3>, <p>, <ul>, <li>)
        3. Tags: <tag1>, <tag2>, <tag3>
        `;

        const result = await model.generateContent(prompt);


        const responseText = await result.response.text();


        const dom = new JSDOM(responseText);
        const document = dom.window.document;


        const title = document.querySelector('h1').textContent;

        const articleElement = document.querySelector('article');
        const articleString = articleElement.outerHTML;


        const tagsString = document.querySelector('span').textContent;
        const tagsArray = tagsString.split(',').map(tag => tag.trim());


        return { title, content: articleString, tag: tagsArray }

    } catch (error) {
        logError(error, path.basename(__filename), generateBlogFromText)
        return {
            title: "Error",
            content: "Failed to generate blog content.",
            tags: ""
        };
    }
};*/
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
Transform this audio transcript into an engaging ${blogType} blog post that feels genuinely human and valuable.

TRANSCRIBED TEXT: ${transcribedText}

BLOG TYPE: ${typeDescriptions[blogType].description}

TONE: ${toneDescriptions[blogTone].description}

REQUIRED OUTPUT FORMAT:

<title>
[Your SEO-optimized title here]
</title>

<article>
[h1 for main title]
[p]Introductory paragraph with hook here.[/p]
[h2 for major section if needed]
[p]Main content here with logical flow.[/p]
<h3 for subsection if needed>
[p]Additional details or examples here.[/p]
</article>

<span>[tag1], [tag2], [tag3], [tag4], [tag5]</span> <!-- This line is now outside the article -->

MUST-INCLUDE ELEMENTS:
${typeDescriptions[blogType].mustInclude.map(item => `• ${item}`).join('\n')}

ORGANIZATION INSTRUCTIONS:
If the content appears disorganized, ensure to:
1. Identify main themes or sections.
2. Rearrange the content into a logical flow.
3. Use headings and subheadings for clarity.
4. Ensure each section connects well with the next.
5. Use bullet points or lists for clarity where appropriate.

WRITING STYLE GUIDELINES:
Language: ${toneDescriptions[blogTone].stylistics.language}
Sentence Style: ${toneDescriptions[blogTone].stylistics.sentences}

NATURAL TRANSITIONS TO USE:
${toneDescriptions[blogTone].stylistics.transitions.join('\n')}

AUTHENTIC EXPRESSIONS:
${toneDescriptions[blogTone].stylistics.expressions.join('\n')}

QUALITY CHECKS:
□ Title is in <title> tags
□ All content is within <article> tags
□ Tags are provided in the specified format
`;






        const result = await model.generateContent(prompt);
        const responseText = await result.response.text();

        const dom = new JSDOM(responseText);
        const document = dom.window.document;

        const title = document.querySelector('title').textContent;
        const articleElement = document.querySelector('article');


        const articleString = articleElement.innerHTML;



        const tagsString = document.querySelector('span').textContent;
        const tagsArray = tagsString.split(',').map(tag => tag.trim());




        return { title, content: articleString, tag: tagsArray }


    } catch (error) {

        logError(error, path.basename(__filename), generateBlogFromText)
        return {
            title: "Error",
            content: "Failed to generate blog content.",
            tags: ""
        };
    }
}
