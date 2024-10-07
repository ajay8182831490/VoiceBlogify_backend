import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from "../../utils/logger.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import { JSDOM } from 'jsdom'

dotenv.config();




const genAI = new GoogleGenerativeAI(process.env.Google_GEMNI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const generateBlogFromText = async (transcribedText) => {
    try {
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



        return { title, content: articleString, tag: tagsString }

    } catch (error) {
        logError(error, path.basename(__filename), generateBlogFromText)
        return {
            title: "Error",
            content: "Failed to generate blog content.",
            tags: ""
        };
    }
};
